from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status
from datetime import timedelta

from leads.models import Lead, LeadStage
from followups.models import FollowUp
from activity.models import ActivityLog
from ai.models import Call
from ai.services.ai_provider import AIProviderServiceError, AIProviderConfigurationError

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

        # Stage
        self.stage, _ = LeadStage.objects.get_or_create(
            slug='negotiation',
            defaults={'name': 'Negotiation', 'display_order': 1}
        )
        self.qualified_stage, _ = LeadStage.objects.get_or_create(
            slug='qualified',
            defaults={'name': 'Qualified', 'display_order': 2}
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

    # --------------------------------------------------------------------------
    # 1. AUTHENTICATION & PERMISSIONS TESTS
    # --------------------------------------------------------------------------
    def test_unauthorized_requests_rejected(self):
        """Unauthorized requests without JWT are rejected with 401 Unauthorized"""
        response = self.client.post('/api/ai/chat/', {'prompt': 'Hello'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.post('/api/ai/call-summary/', {'notes': 'test'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.get('/api/calls/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_executive_permission_on_call_summary(self):
        """Executive cannot generate summary for an unassigned lead"""
        self.client.force_authenticate(user=self.executive)
        response = self.client.post('/api/ai/call-summary/', {
            'lead_id': self.other_lead.id,
            'notes': 'Attempting unauthorized summary',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_and_admin_permission_on_any_lead(self):
        """Manager and Admin can generate summary for any lead"""
        self.client.force_authenticate(user=self.manager)
        with patch('ai.services.call_summary_service.get_ai_provider') as mock_provider_fn:
            mock_provider = MagicMock()
            mock_provider.summarize_call.return_value = {
                'summary': 'Discussion summary',
                'key_points': ['Point 1'],
                'customer_requirements': ['Req 1'],
                'objections': ['Price'],
                'customer_intent': 'Interested',
                'next_action': 'Follow up',
                'follow_up_date': '2026-09-30'
            }
            mock_provider_fn.return_value = mock_provider

            response = self.client.post('/api/ai/call-summary/', {
                'lead_id': self.other_lead.id,
                'notes': 'Manager review call notes',
            }, format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --------------------------------------------------------------------------
    # 2. AUDIO VALIDATION TESTS
    # --------------------------------------------------------------------------
    def test_invalid_audio_extension_rejected(self):
        """Uploading non-audio files (e.g., .txt or .exe) is rejected with 400"""
        self.client.force_authenticate(user=self.executive)
        bad_file = SimpleUploadedFile("malicious.exe", b"binary content", content_type="application/octet-stream")
        response = self.client.post('/api/ai/call-summary/', {
            'lead_id': self.exec_lead.id,
            'audio_file': bad_file
        }, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Unsupported audio format", response.data.get('message', ''))

    def test_empty_audio_file_rejected(self):
        """Uploading empty 0-byte audio file is rejected with 400"""
        self.client.force_authenticate(user=self.executive)
        empty_file = SimpleUploadedFile("empty.mp3", b"", content_type="audio/mp3")
        response = self.client.post('/api/ai/call-summary/', {
            'lead_id': self.exec_lead.id,
            'audio_file': empty_file
        }, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # --------------------------------------------------------------------------
    # 3. TRANSCRIPTION & AI SUMMARY TESTS
    # --------------------------------------------------------------------------
    @patch('ai.services.call_summary_service.get_ai_provider')
    @patch('ai.services.transcription_service.get_ai_provider')
    def test_ai_call_summary_generation_with_audio(self, mock_trans_provider_fn, mock_sum_provider_fn):
        """Test generating structured call summary from audio file"""
        mock_provider = MagicMock()
        mock_provider.transcribe_audio.return_value = "Sales Executive: Hello Rahul\nCustomer: We need 25 seats."
        mock_provider.summarize_call.return_value = {
            'summary': 'Customer interested in 25 seats.',
            'key_points': ['25 seats requested', '30-day timeline'],
            'customer_requirements': ['25 seats enterprise license'],
            'objections': ['Pricing terms'],
            'customer_intent': 'High purchase interest',
            'next_action': 'Send revised quotation',
            'follow_up_date': '2026-09-30'
        }
        mock_trans_provider_fn.return_value = mock_provider
        mock_sum_provider_fn.return_value = mock_provider

        self.client.force_authenticate(user=self.executive)
        fake_audio = SimpleUploadedFile("recording.webm", b"\x1a\x45\xdf\xa3webmheader", content_type="audio/webm")

        response = self.client.post('/api/ai/call-summary/', {
            'lead_id': self.exec_lead.id,
            'audio_file': fake_audio,
            'call_type': 'Outbound',
            'duration_seconds': 755
        }, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data.get('data', {})
        self.assertIn('transcript', data)
        self.assertIn('Sales Executive: Hello Rahul', data['transcript'])
        self.assertIn('summary', data)
        self.assertEqual(data['summary']['customer_intent'], 'High purchase interest')
        self.assertEqual(data['summary']['next_action'], 'Send revised quotation')

    def test_ai_provider_failure_returns_graceful_error(self):
        """AI Provider failure returns 502/503 without crashing the server"""
        self.client.force_authenticate(user=self.executive)
        with patch('ai.services.call_summary_service.get_ai_provider') as mock_provider_fn:
            mock_provider = MagicMock()
            mock_provider.summarize_call.side_effect = AIProviderServiceError("Rate limit exceeded")
            mock_provider_fn.return_value = mock_provider

            response = self.client.post('/api/ai/call-summary/', {
                'lead_id': self.exec_lead.id,
                'notes': 'Test conversation notes',
            }, format='json')

            self.assertEqual(response.status_code, status.HTTP_502_BAD_GATEWAY)
            self.assertIn('Rate limit exceeded', response.data.get('message', ''))

    # --------------------------------------------------------------------------
    # 4. CALL MODEL & ACTIVITY TIMELINE TESTS
    # --------------------------------------------------------------------------
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
            'follow_up_date': '2026-09-30',
            'processing_status': 'COMPLETED'
        }

        response = self.client.post('/api/calls/', call_payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        call_id = response.data['id']

        # Verify Call in DB
        call = Call.objects.get(pk=call_id)
        self.assertEqual(call.lead, self.exec_lead)
        self.assertEqual(call.created_by, self.executive)
        self.assertEqual(call.processing_status, Call.ProcessingStatus.COMPLETED)

        # Verify ActivityLog entry was created
        log = ActivityLog.objects.filter(
            entity_type='LEAD',
            entity_id=str(self.exec_lead.id),
            action='CALL_LOGGED'
        ).first()

        self.assertIsNotNone(log)
        self.assertEqual(log.performed_by, self.executive)
        self.assertIn('Customer interested in enterprise package', log.notes)

    def test_update_transcript_and_reanalyze(self):
        """Test updating a call transcript and re-analyzing it with AI Provider"""
        call = Call.objects.create(
            lead=self.exec_lead,
            created_by=self.executive,
            transcript="Old transcript",
            ai_summary="Old summary",
            processing_status='COMPLETED'
        )

        self.client.force_authenticate(user=self.executive)
        with patch('ai.services.call_summary_service.get_ai_provider') as mock_provider_fn:
            mock_provider = MagicMock()
            mock_provider.summarize_call.return_value = {
                'summary': 'Updated customer wants 50 seats now.',
                'key_points': ['50 seats requested'],
                'customer_requirements': ['50 seats'],
                'objections': [],
                'customer_intent': 'Very High',
                'next_action': 'Send 50 seat contract',
                'follow_up_date': '2026-10-05'
            }
            mock_provider_fn.return_value = mock_provider

            response = self.client.post(f'/api/calls/{call.id}/transcript/', {
                'transcript': 'Executive: Good afternoon Rahul\nCustomer: We now want 50 seats instead of 25.',
                'reanalyze': True
            }, format='json')

            self.assertEqual(response.status_code, status.HTTP_200_OK)
            call.refresh_from_db()
            self.assertIn('50 seats', call.transcript)
            self.assertEqual(call.ai_summary, 'Updated customer wants 50 seats now.')
            self.assertEqual(call.processing_status, Call.ProcessingStatus.COMPLETED)

    # --------------------------------------------------------------------------
    # 5. CHATBOT & CONTROLLED CRM TOOLS TESTS
    # --------------------------------------------------------------------------
    def test_ai_chat_overdue_leads(self):
        """Test Chatbot responds to overdue query for executive using live DB records"""
        self.client.force_authenticate(user=self.executive)
        response = self.client.post('/api/ai/chat/', {
            'prompt': 'Show my overdue leads'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data.get('data', {})
        self.assertEqual(data.get('intent'), 'OVERDUE_LEADS')
        self.assertIn('ABC Technologies', data.get('response'))

    def test_ai_chat_lead_summary(self):
        """Test Chatbot summarizes ABC Technologies using live DB records"""
        self.client.force_authenticate(user=self.executive)
        response = self.client.post('/api/ai/chat/', {
            'prompt': 'Summarize ABC Technologies'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data.get('data', {})
        self.assertEqual(data.get('intent'), 'LEAD_SUMMARY')
        self.assertIn('ABC Technologies', data.get('response'))

    def test_ai_chat_detects_write_action_and_requires_confirmation(self):
        """Chatbot detects a proposed stage change, does NOT auto-write, and requires user confirmation"""
        self.client.force_authenticate(user=self.executive)
        response = self.client.post('/api/ai/chat/', {
            'prompt': 'Move ABC Technologies to Qualified'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data.get('data', {})
        self.assertTrue(data.get('action_required'))
        self.assertIsNotNone(data.get('action_payload'))
        self.assertEqual(data['action_payload']['action_type'], 'UPDATE_LEAD_STAGE')
        self.assertEqual(data['action_payload']['parameters']['lead_id'], self.exec_lead.id)

        # Verify lead stage was NOT modified yet!
        self.exec_lead.refresh_from_db()
        self.assertEqual(self.exec_lead.stage, self.stage)

    def test_execute_confirmed_write_action(self):
        """User confirms proposed action; execution applies change and logs activity"""
        self.client.force_authenticate(user=self.executive)
        payload = {
            'action_payload': {
                'action_type': 'UPDATE_LEAD_STAGE',
                'parameters': {
                    'lead_id': self.exec_lead.id,
                    'stage_id': self.qualified_stage.id
                }
            }
        }
        response = self.client.post('/api/ai/execute-action/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Verify lead stage changed
        self.exec_lead.refresh_from_db()
        self.assertEqual(self.exec_lead.stage, self.qualified_stage)

        # Verify activity log
        log = ActivityLog.objects.filter(
            entity_type='LEAD',
            entity_id=str(self.exec_lead.id),
            action='STATUS_CHANGED'
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.performed_by, self.executive)

    def test_executive_cannot_execute_unauthorized_lead_action(self):
        """Executive cannot confirm/execute actions on leads they do not own"""
        self.client.force_authenticate(user=self.executive)
        payload = {
            'action_payload': {
                'action_type': 'UPDATE_LEAD_STAGE',
                'parameters': {
                    'lead_id': self.other_lead.id,
                    'stage_id': self.qualified_stage.id
                }
            }
        }
        response = self.client.post('/api/ai/execute-action/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
