from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import timedelta
from accounts.models import User
from leads.models import Lead
from followups.models import FollowUp

class FollowUpTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.manager = User.objects.create_user(
            email='manager@test.com', password='Password@123', role=User.Role.MANAGER
        )
        self.exec_user = User.objects.create_user(
            email='exec@test.com', password='Password@123', role=User.Role.EXECUTIVE
        )

        self.lead = Lead.objects.create(
            name='Test Company Lead',
            phone='+15554443333',
            assigned_to=self.exec_user
        )

    def test_cannot_schedule_followup_in_past(self):
        self.client.force_authenticate(user=self.exec_user)
        past_time = timezone.now() - timedelta(days=1)
        response = self.client.post('/api/follow-ups/', {
            'lead': self.lead.id,
            'follow_up_at': past_time.isoformat(),
            'purpose': FollowUp.Purpose.PHONE_CALL
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_schedule_future_followup_success(self):
        self.client.force_authenticate(user=self.exec_user)
        future_time = timezone.now() + timedelta(days=2)
        response = self.client.post('/api/follow-ups/', {
            'lead': self.lead.id,
            'follow_up_at': future_time.isoformat(),
            'purpose': FollowUp.Purpose.DEMO
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], FollowUp.Status.PENDING)

    def test_complete_followup_with_outcome(self):
        self.client.force_authenticate(user=self.exec_user)
        future_time = timezone.now() + timedelta(days=1)
        fu = FollowUp.objects.create(
            lead=self.lead,
            assigned_to=self.exec_user,
            follow_up_at=future_time,
            purpose=FollowUp.Purpose.PHONE_CALL
        )

        response = self.client.post(f'/api/follow-ups/{fu.id}/complete/', {
            'outcome': 'Spoke with Director of Engineering. Moving to commercial proposal.'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        fu.refresh_from_db()
        self.assertEqual(fu.status, FollowUp.Status.COMPLETED)
        self.assertIn('Director of Engineering', fu.outcome)
        self.assertIsNotNone(fu.completed_at)
