import io
from django.test import TestCase
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password
from rest_framework import status
from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile

from accounts.models import User
from leads.models import Lead, LeadStage
from products.models import Product, LeadProduct
from ai.serializers import CallSummaryRequestSerializer


class SecurityAppSecTests(TestCase):
    """
    AppSec automated regression suite verifying vulnerability fixes:
    - Privilege escalation prevention on self profile (CWE-269 / CWE-915)
    - Password minimum length enforcement (OWASP A07)
    - Open mail relay protection (CWE-306)
    - IDOR protection on lead product attachments (OWASP A01)
    - Malicious audio file upload rejection (OWASP file upload)
    """

    def setUp(self):
        self.client = APIClient()

        # Regular sales executive
        self.executive = User.objects.create_user(
            email='exec_security@crm.com',
            password='Password@123',
            first_name='Executive',
            last_name='Security',
            role=User.Role.EXECUTIVE
        )

        # Another executive
        self.other_exec = User.objects.create_user(
            email='other_security@crm.com',
            password='Password@123',
            first_name='Other',
            last_name='Rep',
            role=User.Role.EXECUTIVE
        )

        # Admin user
        self.admin = User.objects.create_user(
            email='admin_security@crm.com',
            password='Password@123',
            first_name='Admin',
            last_name='Security',
            role=User.Role.ADMIN,
            is_staff=True
        )

        # Lead stage (get seeded stage or create)
        self.stage, _ = LeadStage.objects.get_or_create(name='New', defaults={'display_order': 1})

        # Lead owned by other_exec
        self.other_lead = Lead.objects.create(
            name='Target Corp Lead',
            email='target@corp.com',
            stage=self.stage,
            assigned_to=self.other_exec,
            created_by=self.other_exec
        )

        # Product
        self.product = Product.objects.create(
            name='Cloud SaaS Enterprise',
            code='SAAS-ENT',
            unit_price=1000.00,
            is_active=True,
            created_by=self.admin
        )

    def test_privilege_escalation_blocked(self):
        """Executive cannot escalate role or status via PATCH /api/auth/me/."""
        self.client.force_authenticate(user=self.executive)
        res = self.client.patch('/api/auth/me/', {
            'role': 'ADMIN',
            'is_active': False,
            'first_name': 'HackedName'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.executive.refresh_from_db()
        # Role must remain EXECUTIVE, not elevated to ADMIN
        self.assertEqual(self.executive.role, User.Role.EXECUTIVE)
        # Active must remain True
        self.assertTrue(self.executive.is_active)
        # Safe fields like first_name can be updated
        self.assertEqual(self.executive.first_name, 'HackedName')

    def test_password_minimum_length_ten(self):
        """Passwords under 10 chars must fail validation per OWASP guidelines."""
        # 6-9 char password should raise ValidationError
        with self.assertRaises(ValidationError):
            validate_password('Short1!', user=self.executive)

        # 10+ char password passes
        try:
            validate_password('ValidPass123!', user=self.executive)
        except ValidationError:
            self.fail("validate_password raised ValidationError unexpectedly for >= 10 chars.")

    def test_open_email_relay_blocked_for_anonymous(self):
        """Unauthenticated requester cannot trigger /api/email/test/ to relay spam."""
        res = self.client.post('/api/email/test/', {
            'recipient': 'victim@external.com',
            'subject': 'Spam subject',
            'message': 'Spam body'
        }, format='json')
        self.assertIn(res.status_code, [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN])

    def test_open_email_relay_blocked_for_regular_user(self):
        """Non-admin user cannot use email test relay."""
        self.client.force_authenticate(user=self.executive)
        res = self.client.post('/api/email/test/', {
            'recipient': 'victim@external.com',
            'subject': 'Spam',
            'message': 'Spam'
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_lead_product_idor_blocked_for_unauthorized_exec(self):
        """Executive cannot attach or mutate products on leads assigned to another executive."""
        self.client.force_authenticate(user=self.executive)

        # 1. Attempt to create lead product for other_lead
        res = self.client.post('/api/lead-products/', {
            'lead': self.other_lead.id,
            'product_id': self.product.id,
            'quantity': 2,
            'unit_price': '1000.00'
        }, format='json')
        self.assertIn(res.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND])

        # 2. Even if product was attached by someone else, executive cannot list or modify it
        lead_product = LeadProduct.objects.create(
            lead=self.other_lead,
            product=self.product,
            quantity=1,
            unit_price=1000.00
        )
        res_get = self.client.get(f'/api/lead-products/{lead_product.id}/')
        self.assertEqual(res_get.status_code, status.HTTP_404_NOT_FOUND)

    def test_audio_file_upload_extension_validation(self):
        """CallSummaryRequestSerializer rejects dangerous/unsupported file types."""
        fake_executable = SimpleUploadedFile("malicious.exe", b"MZ\x90\x00\x03\x00\x00\x00", content_type="application/octet-stream")
        serializer = CallSummaryRequestSerializer(data={'audio_file': fake_executable})
        self.assertFalse(serializer.is_valid())
        self.assertIn('audio_file', serializer.errors)

        # Valid audio extension (.mp3) passes
        fake_audio = SimpleUploadedFile("recording.mp3", b"ID3\x03\x00\x00\x00\x00\x00\x00", content_type="audio/mpeg")
        valid_serializer = CallSummaryRequestSerializer(data={'audio_file': fake_audio})
        self.assertTrue(valid_serializer.is_valid())
