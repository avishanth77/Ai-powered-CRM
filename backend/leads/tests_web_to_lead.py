
from decimal import Decimal
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User
from activity.models import ActivityLog
from notifications.models import Notification
from leads.models import Lead, LeadStage, LeadSource, LeadNote, StageTaskRule, LeadStageTask


class WebToLeadApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Users
        self.admin, _ = User.objects.get_or_create(
            email='admin_web@test.com',
            defaults={
                'first_name': 'Admin',
                'last_name': 'User',
                'role': User.Role.ADMIN,
                'is_active': True
            }
        )
        if not self.admin.has_usable_password():
            self.admin.set_password('testpassword123')
            self.admin.save()

        self.executive, _ = User.objects.get_or_create(
            email='rep_web@test.com',
            defaults={
                'first_name': 'Sarah',
                'last_name': 'Rep',
                'role': User.Role.EXECUTIVE,
                'is_active': True
            }
        )
        if not self.executive.has_usable_password():
            self.executive.set_password('testpassword123')
            self.executive.save()

        # Stages
        self.stage_new, _ = LeadStage.objects.get_or_create(
            slug='new',
            defaults={'name': 'New', 'display_order': 1, 'is_active': True}
        )
        self.stage_contacted, _ = LeadStage.objects.get_or_create(
            slug='contacted',
            defaults={'name': 'Contacted', 'display_order': 2, 'is_active': True}
        )

        # Website Source
        self.source_website, _ = LeadSource.objects.get_or_create(
            name='Website',
            defaults={'is_active': True}
        )

        # Create a StageTaskRule for New stage to verify auto-instantiation
        self.rule, _ = StageTaskRule.objects.get_or_create(
            stage=self.stage_new,
            title='Introductory Discovery Call',
            defaults={
                'name': 'Call new web lead',
                'description_template': 'Call customer within 15 minutes of web form submission',
                'is_mandatory': True,
                'task_priority': Lead.Priority.HIGH,
                'due_offset_value': 1,
                'due_offset_unit': StageTaskRule.OffsetUnit.DAYS,
                'is_active': True
            }
        )

        self.url = '/api/leads/web-to-lead/'

    def test_successful_new_lead_creation_json(self):
        """Test sending a valid JSON payload from website contact form."""
        payload = {
            'name': 'Alice Wonder',
            'email': 'alice@example.com',
            'phone': '+1 555-0199',
            'company_name': 'Wonderland Tech',
            'message': 'We need a customized enterprise CRM solution for our sales team.',
            'subject': 'Enterprise Inquiry',
            'expected_value': '5000'
        }

        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertTrue(response.data['is_new'])
        lead_id = response.data['lead_id']

        lead = Lead.objects.get(id=lead_id)
        self.assertEqual(lead.name, 'Alice Wonder')
        self.assertEqual(lead.email, 'alice@example.com')
        self.assertEqual(lead.phone, '+1 555-0199')
        self.assertEqual(lead.company_name, 'Wonderland Tech')
        self.assertEqual(lead.stage, self.stage_new)
        self.assertEqual(lead.source, self.source_website)
        self.assertEqual(lead.expected_value, Decimal('5000.00'))

        # Check Lead Note created with message
        note = LeadNote.objects.filter(lead=lead).first()
        self.assertIsNotNone(note)
        self.assertIn('Enterprise Inquiry', note.note_text)
        self.assertIn('We need a customized enterprise CRM', note.note_text)

        # Check stage task automatically instantiated
        stage_task = LeadStageTask.objects.filter(lead=lead, stage=self.stage_new).first()
        self.assertIsNotNone(stage_task)
        self.assertEqual(stage_task.title, 'Introductory Discovery Call')

        # Check ActivityLog
        activity = ActivityLog.objects.filter(entity_type=ActivityLog.EntityType.LEAD, entity_id=str(lead.id)).first()
        self.assertIsNotNone(activity)
        self.assertEqual(activity.action, ActivityLog.ActionType.LEAD_CREATED)

    def test_form_urlencoded_post(self):
        """Test traditional HTML <form method="POST"> submission."""
        payload = {
            'full_name': 'Bob Builder',
            'email': 'bob@builder.co',
            'phone': '1234567890',
            'company': 'Builder Co',
            'inquiry': 'Looking for pricing details.'
        }
        response = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])

        lead = Lead.objects.get(id=response.data['lead_id'])
        self.assertEqual(lead.name, 'Bob Builder')
        self.assertEqual(lead.company_name, 'Builder Co')

    def test_email_only_submission_without_phone(self):
        """Lead submits with email only; fallback phone is stored."""
        payload = {
            'name': 'Charlie NoPhone',
            'email': 'charlie@email.com',
            'message': 'Please email me your brochure.'
        }
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        lead = Lead.objects.get(id=response.data['lead_id'])
        self.assertEqual(lead.name, 'Charlie NoPhone')
        self.assertEqual(lead.email, 'charlie@email.com')
        self.assertEqual(lead.phone, 'Not provided')

    def test_honeypot_spam_trap(self):
        """If a bot fills a hidden honeypot field, silently return 200 without creating lead."""
        initial_lead_count = Lead.objects.count()
        payload = {
            'name': 'Spam Bot',
            'email': 'bot@spammer.xyz',
            'phone': '9999999999',
            'website_url_hp': 'http://buy-cheap-stuff.xyz',
            'message': 'Click here for free money'
        }
        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(Lead.objects.count(), initial_lead_count)

    def test_duplicate_recontact_appends_note(self):
        """Existing active lead submits contact form again with a new message."""
        existing_lead = Lead.objects.create(
            name='David Existing',
            phone='5551234567',
            email='david@existing.com',
            stage=self.stage_new,
            source=self.source_website,
            assigned_to=self.executive
        )

        payload = {
            'name': 'David Existing',
            'phone': '5551234567',
            'email': 'david@existing.com',
            'message': 'Following up on my previous message. Any update?',
            'subject': 'Follow-up question'
        }

        response = self.client.post(self.url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertFalse(response.data['is_new'])
        self.assertEqual(response.data['lead_id'], existing_lead.id)

        # Check note was added to the existing lead
        notes = LeadNote.objects.filter(lead=existing_lead)
        self.assertEqual(notes.count(), 1)
        self.assertIn('Following up on my previous message', notes.first().note_text)

    def test_validation_errors(self):
        """Missing name or both contact methods returns HTTP 400."""
        # Missing name
        res1 = self.client.post(self.url, {'email': 'test@test.com'}, format='json')
        self.assertEqual(res1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Name is required', res1.data['message'])

        # Missing both phone and email
        res2 = self.client.post(self.url, {'name': 'John Doe'}, format='json')
        self.assertEqual(res2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Please provide an email address or phone number', res2.data['message'])

    def test_public_contact_alias_url(self):
        """Verify alias URL /api/leads/public/contact/ also functions identically."""
        payload = {
            'name': 'Emma Alias',
            'phone': '1112223333',
            'message': 'Testing alias route.'
        }
        res = self.client.post('/api/leads/public/contact/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res.data['success'])
