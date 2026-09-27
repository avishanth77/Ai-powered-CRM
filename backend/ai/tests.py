from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from datetime import timedelta

from leads.models import Lead, LeadStage
from followups.models import FollowUp
from activity.models import ActivityLog
from ai.models import Call

User = get_user_model()

class AIFeaturesTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.admin = User.objects.create_user(
            email='admin@test.com',
            password='password123',
            role='ADMIN',
            first_name='Admin',
            last_name='User'
        )
        self.manager = User.objects.create_user(
            email='manager@test.com',
            password='password123',
            role='MANAGER',
            first_name='Manager',
            last_name='User'
        )
        self.executive = User.objects.create_user(
            email='exec@test.com',
            password='password123',
            role='EXECUTIVE',
            first_name='Executive',
            last_name='Rep'
        )
        self.other_exec = User.objects.create_user(
            email='other@test.com',
            password='password123',
            role='EXECUTIVE',
            first_name='Other',
            last_name='Rep'
        )

        # Stage (may already exist via migrations)
        self.stage, _ = LeadStage.objects.get_or_create(
            slug='negotiation',
            defaults={'name': 'Negotiation', 'display_order': 1}
        )

        # Leads
        self.exec_lead = Lead.objects.create(
            name='ABC Technologies',
            company_name='ABC Tech Corp',
            phone='+919876543210',
            stage=self.stage,
            expected_value=150000.00,
            assigned_to=self.executive,
            created_by=self.executive
        )

        self.other_lead = Lead.objects.create(
            name='Other Enterprises',
            company_name='Other Ent',
            phone='+919876543211',
            stage=self.stage,
            expected_value=50000.00,
            assigned_to=self.other_exec,
            created_by=self.other_exec
        )

        # Overdue Follow-up
        FollowUp.objects.create(
            lead=self.exec_lead,
            assigned_to=self.executive,
            follow_up_at=timezone.now() - timedelta(days=2),
            status=FollowUp.Status.OVERDUE,
            purpose='Phone Call',
            notes='Check revised quotation'
        )

    def test_ai_chat_overdue_leads(self):
        """Test Chatbot responds to overdue query for executive"""
        self.client.force_authenticate(user=self.executive)
        response = self.client.post('/api/ai/chat/', {
            'prompt': 'Show my overdue leads'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data.get('data', {})
        self.assertEqual(data.get('intent'), 'OVERDUE_LEADS')
        self.assertIn('ABC Technologies', data.get('response'))

    def test_ai_chat_lead_summary(self):
        """Test Chatbot summarizes ABC Technologies"""
        self.client.force_authenticate(user=self.executive)
        response = self.client.post('/api/ai/chat/', {
            'prompt': 'Summarize ABC Technologies'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data.get('data', {})
        self.assertEqual(data.get('intent'), 'LEAD_SUMMARY')
        self.assertIn('ABC Technologies', data.get('response'))

    def test_ai_call_summary_generation(self):
        """Test generating structured call summary from notes"""
        self.client.force_authenticate(user=self.executive)
        response = self.client.post('/api/ai/call-summary/', {
            'lead_id': self.exec_lead.id,
            'notes': 'Discussed enterprise pricing and 30-day onboarding timeline.',
            'call_type': 'Outbound',
            'duration_seconds': 755
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data.get('data', {})
        self.assertIn('transcript', data)
        self.assertIn('summary', data)
        self.assertIn('key_points', data['summary'])
        self.assertIn('customer_requirements', data['summary'])
        self.assertIn('customer_objections', data['summary'])

    def test_executive_permission_on_call_summary(self):
        """Executive cannot generate summary for an unassigned lead"""
        self.client.force_authenticate(user=self.executive)
        response = self.client.post('/api/ai/call-summary/', {
            'lead_id': self.other_lead.id,
            'notes': 'Attempting unauthorized summary',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_save_call_to_lead_and_activity_timeline(self):
        """Test saving a call creates a Call record and an ActivityLog entry"""
        self.client.force_authenticate(user=self.executive)
        call_payload = {
            'lead': self.exec_lead.id,
            'call_type': 'Outbound',
            'started_at': timezone.now().isoformat(),
            'duration_seconds': 755,
            'transcript': 'Executive: Hello Rahul\nCustomer: Hi',
            'ai_summary': 'Customer interested in enterprise package.',
            'key_points': ['Enterprise package discussed'],
            'customer_requirements': ['30-day implementation'],
            'objections': ['Pricing flexibility'],
            'customer_intent': 'High purchase interest',
            'next_action': 'Send revised quotation',
            'follow_up_date': '2026-09-30'
        }

        response = self.client.post('/api/calls/', call_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        call_id = response.data['id']

        # Verify Call in DB
        call = Call.objects.get(pk=call_id)
        self.assertEqual(call.lead, self.exec_lead)
        self.assertEqual(call.created_by, self.executive)

        # Verify ActivityLog entry was created
        log = ActivityLog.objects.filter(
            entity_type='LEAD',
            entity_id=str(self.exec_lead.id),
            action='CALL_LOGGED'
        ).first()

        self.assertIsNotNone(log)
        self.assertEqual(log.performed_by, self.executive)
        self.assertIn('Customer interested in enterprise package', log.notes)

    def test_executive_call_scoping(self):
        """Executive cannot view calls from leads assigned to others"""
        # Create call on other_lead by other_exec
        Call.objects.create(
            lead=self.other_lead,
            created_by=self.other_exec,
            call_type='Inbound',
            duration_seconds=300,
            ai_summary='Confidential other discussion'
        )

        self.client.force_authenticate(user=self.executive)
        response = self.client.get('/api/calls/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        call_ids = [c['id'] for c in response.data.get('results', [])]
        # Should not see call from other_lead
        other_calls = Call.objects.filter(lead=self.other_lead).values_list('id', flat=True)
        for oc_id in other_calls:
            self.assertNotIn(oc_id, call_ids)
