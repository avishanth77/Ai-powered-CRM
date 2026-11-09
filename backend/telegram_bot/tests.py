from unittest.mock import patch, MagicMock
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from leads.models import Lead, LeadStage
from followups.models import FollowUp
from .models import TelegramProfile, TelegramActionSession
from .services.telegram_handler import TelegramUpdateHandler
from .services.telegram_dispatcher import TelegramNotificationDispatcher
from notifications.models import Notification


class TelegramBotIntegrationTestCase(TestCase):
    """
    Automated test suite verifying the Telegram Bot integration:
    - 6-digit PIN generation and verification
    - Slash command handling (/start, /connect, /help, /pipeline, /leads, /today)
    - Action confirmation & callback queries
    - Push notifications dispatching
    - API endpoints (status, code generation, preferences, disconnect)
    """

    def setUp(self):
        self.client = APIClient()

        # Users
        self.user = User.objects.create_user(
            email='telegram_user@crm.com',
            password='Password@123',
            first_name='Alex',
            last_name='Rivera',
            role=User.Role.EXECUTIVE
        )

        # Lead stages
        self.stage_new, _ = LeadStage.objects.get_or_create(name='New', defaults={'display_order': 1})
        self.stage_qual, _ = LeadStage.objects.get_or_create(name='Qualified', defaults={'display_order': 2})

        # Lead
        self.lead = Lead.objects.create(
            name='Acme Corporation',
            company_name='Acme Corp',
            email='contact@acme.com',
            stage=self.stage_new,
            expected_value=15000.00,
            assigned_to=self.user,
            created_by=self.user
        )

        # Followup
        self.followup = FollowUp.objects.create(
            lead=self.lead,
            assigned_to=self.user,
            follow_up_at=timezone.now() + timedelta(hours=2),
            purpose='Discovery follow-up call',
            status=FollowUp.Status.PENDING
        )

        # Telegram Profile
        self.profile = TelegramProfile.objects.create(
            user=self.user,
            chat_id=987654321,
            telegram_username='alex_rivera_crm',
            is_verified=True
        )

    # --------------------------------------------------------------------------
    # 1. PIN GENERATION & VERIFICATION
    # --------------------------------------------------------------------------

    def test_pin_generation_and_verification(self):
        """Profile generates 6-digit PIN and verifies successfully."""
        new_user = User.objects.create_user(
            email='pin_test@crm.com',
            password='Password@123',
            role=User.Role.EXECUTIVE
        )
        profile = TelegramProfile.objects.create(user=new_user)

        code = profile.generate_verification_code(expiry_minutes=15)
        self.assertEqual(len(code), 6)
        self.assertTrue(code.isdigit())
        self.assertFalse(profile.is_verified)

        # Verify with wrong code fails
        success_bad = profile.verify_code('000000', chat_id=111222333)
        self.assertFalse(success_bad)
        self.assertFalse(profile.is_verified)

        # Verify with correct code succeeds
        success_good = profile.verify_code(code, chat_id=111222333, username='test_handle')
        self.assertTrue(success_good)
        profile.refresh_from_db()
        self.assertTrue(profile.is_verified)
        self.assertEqual(profile.chat_id, 111222333)
        self.assertEqual(profile.telegram_username, 'test_handle')

    # --------------------------------------------------------------------------
    # 2. WEBHOOK & HANDLER COMMANDS
    # --------------------------------------------------------------------------

    @patch('telegram_bot.services.telegram_client.TelegramClient.send_message')
    @patch('telegram_bot.services.telegram_client.TelegramClient.send_inline_keyboard')
    def test_unlinked_user_connect_instruction(self, mock_send_keyboard, mock_send_msg):
        """Unlinked chat_id receives instructions on how to connect."""
        handler = TelegramUpdateHandler()
        update = {
            'update_id': 101,
            'message': {
                'chat': {'id': 999999999},
                'text': 'Hello CRM',
                'from': {'username': 'stranger'}
            }
        }
        handler.handle_update(update)

        mock_send_msg.assert_called_once()
        args, _ = mock_send_msg.call_args
        self.assertEqual(args[0], 999999999)
        self.assertIn("CRM Lite Authentication Required", args[1])

    @patch('telegram_bot.services.telegram_client.TelegramClient.send_message')
    def test_slash_help_command(self, mock_send_msg):
        """Verified user calling /help receives command guide."""
        handler = TelegramUpdateHandler()
        update = {
            'update_id': 102,
            'message': {
                'chat': {'id': self.profile.chat_id},
                'text': '/help',
                'from': {'username': self.profile.telegram_username}
            }
        }
        handler.handle_update(update)

        mock_send_msg.assert_called_once()
        args, _ = mock_send_msg.call_args
        self.assertIn("CRM Lite Copilot", args[1])
        self.assertIn("/pipeline", args[1])

    @patch('telegram_bot.services.telegram_client.TelegramClient.send_inline_keyboard')
    def test_slash_pipeline_command(self, mock_send_keyboard):
        """Verified user calling /pipeline receives visual funnel and buttons."""
        handler = TelegramUpdateHandler()
        update = {
            'update_id': 103,
            'message': {
                'chat': {'id': self.profile.chat_id},
                'text': '/pipeline',
                'from': {'username': self.profile.telegram_username}
            }
        }
        handler.handle_update(update)

        mock_send_keyboard.assert_called_once()
        args, _ = mock_send_keyboard.call_args
        self.assertIn("CRM Pipeline Snapshot", args[1])

    @patch('telegram_bot.services.telegram_client.TelegramClient.send_inline_keyboard')
    def test_slash_leads_command(self, mock_send_keyboard):
        """Verified user calling /leads receives active leads list."""
        handler = TelegramUpdateHandler()
        update = {
            'update_id': 104,
            'message': {
                'chat': {'id': self.profile.chat_id},
                'text': '/leads',
                'from': {'username': self.profile.telegram_username}
            }
        }
        handler.handle_update(update)

        mock_send_keyboard.assert_called_once()
        args, _ = mock_send_keyboard.call_args
        self.assertIn("Acme Corporation", args[1])

    # --------------------------------------------------------------------------
    # 3. INTERACTIVE ACTION CONFIRMATION & CALLBACK
    # --------------------------------------------------------------------------

    @patch('telegram_bot.services.telegram_client.TelegramClient.answer_callback_query')
    @patch('telegram_bot.services.telegram_client.TelegramClient.edit_message_text')
    def test_callback_confirm_stage_action(self, mock_edit_msg, mock_answer_cb):
        """Tapping Confirm button executes pending stage update."""
        session = TelegramActionSession.objects.create(
            user=self.user,
            chat_id=self.profile.chat_id,
            action_type='UPDATE_LEAD_STAGE',
            action_description=f"Move {self.lead.name} to Qualified",
            action_payload={
                'action_type': 'UPDATE_LEAD_STAGE',
                'parameters': {
                    'lead_id': self.lead.id,
                    'stage_id': self.stage_qual.id
                }
            },
            expires_at=timezone.now() + timedelta(minutes=10)
        )

        handler = TelegramUpdateHandler()
        cb_update = {
            'update_id': 105,
            'callback_query': {
                'id': 'cb_123',
                'data': f"act_confirm_{session.id}",
                'message': {
                    'chat': {'id': self.profile.chat_id},
                    'message_id': 456
                }
            }
        }
        handler.handle_update(cb_update)

        session.refresh_from_db()
        self.assertEqual(session.status, TelegramActionSession.Status.EXECUTED)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.stage, self.stage_qual)
        mock_answer_cb.assert_called_once()

    # --------------------------------------------------------------------------
    # 4. REST API ENDPOINTS
    # --------------------------------------------------------------------------

    def test_api_status_endpoint(self):
        """GET /api/telegram/status/ returns profile data."""
        self.client.force_authenticate(user=self.user)
        res = self.client.get('/api/telegram/status/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['success'])
        self.assertTrue(res.data['data']['is_verified'])
        self.assertEqual(res.data['data']['telegram_username'], 'alex_rivera_crm')

    def test_api_generate_code_endpoint(self):
        """POST /api/telegram/generate-link-code/ creates PIN."""
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/telegram/generate-link-code/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['success'])
        self.assertEqual(len(res.data['data']['code']), 6)
        self.assertIn('t.me', res.data['data']['deep_link'])

    def test_api_preferences_endpoint(self):
        """POST /api/telegram/preferences/ updates notification flags."""
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/telegram/preferences/', {
            'notify_new_leads': False,
            'notify_followups': True
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.assertFalse(self.profile.notify_new_leads)
        self.assertTrue(self.profile.notify_followups)

    def test_api_disconnect_endpoint(self):
        """POST /api/telegram/disconnect/ unlinks account."""
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/telegram/disconnect/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.profile.refresh_from_db()
        self.assertFalse(self.profile.is_verified)
        self.assertIsNone(self.profile.chat_id)

    # --------------------------------------------------------------------------
    # 5. PUSH NOTIFICATION DISPATCHER
    # --------------------------------------------------------------------------

    @patch('telegram_bot.services.telegram_client.TelegramClient.send_inline_keyboard')
    @patch('telegram_bot.services.telegram_client.TelegramClient.is_configured', True)
    def test_notification_dispatcher(self, mock_send_keyboard):
        """Notification for user forwards to Telegram chat."""
        notif = Notification.objects.create(
            recipient=self.user,
            notification_type='LEAD_ASSIGNED',
            title='New Lead Assigned: Global Tech',
            message='You have been assigned to Global Tech.',
            entity_type='lead',
            entity_id=str(self.lead.id)
        )

        dispatched = TelegramNotificationDispatcher.dispatch(notif)
        self.assertTrue(dispatched)
        mock_send_keyboard.assert_called_once()
