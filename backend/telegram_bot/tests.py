from unittest.mock import patch, MagicMock
from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from accounts.models import User
from leads.models import Lead, LeadStage, LeadStageTask
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

    @patch('telegram_bot.services.telegram_client.TelegramClient.edit_message_text')
    @patch('telegram_bot.services.telegram_client.TelegramClient.answer_callback_query')
    def test_quick_setstage_blocked_when_mandatory_task_pending(self, mock_answer, mock_edit_text):
        """Moving lead stage via Telegram is blocked if mandatory tasks for current stage are incomplete."""
        # Create a mandatory task on the lead for stage_new
        task = LeadStageTask.objects.create(
            lead=self.lead,
            stage=self.stage_new,
            title='Verify Contact Details',
            is_mandatory=True,
            status=LeadStageTask.Status.PENDING,
            due_date=timezone.now() + timedelta(days=2),
            assigned_to=self.user
        )

        handler = TelegramUpdateHandler()
        cb_update = {
            'update_id': 108,
            'callback_query': {
                'id': 'cq_stage_blocked',
                'data': f"setstage_{self.lead.id}_{self.stage_qual.id}",
                'message': {
                    'chat': {'id': self.profile.chat_id},
                    'message_id': 789
                }
            }
        }
        handler.handle_update(cb_update)

        # Stage should NOT have changed
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.stage, self.stage_new)
        mock_answer.assert_called_with('cq_stage_blocked', '⚠️ Stage progression blocked: Mandatory tasks pending!', show_alert=True)
        self.assertIn('Stage Progression Blocked', mock_edit_text.call_args[0][2])

        # Complete the task via stagetask_done_ callback
        complete_update = {
            'update_id': 109,
            'callback_query': {
                'id': 'cq_task_done',
                'data': f"stagetask_done_{task.id}_{self.lead.id}_{self.stage_qual.id}",
                'message': {
                    'chat': {'id': self.profile.chat_id},
                    'message_id': 789
                }
            }
        }
        handler.handle_update(complete_update)
        task.refresh_from_db()
        self.assertEqual(task.status, LeadStageTask.Status.COMPLETED)

        # Now re-attempt moving stage -> Should succeed!
        retry_update = {
            'update_id': 110,
            'callback_query': {
                'id': 'cq_stage_allowed',
                'data': f"setstage_{self.lead.id}_{self.stage_qual.id}",
                'message': {
                    'chat': {'id': self.profile.chat_id},
                    'message_id': 789
                }
            }
        }
        handler.handle_update(retry_update)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.stage, self.stage_qual)

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

    # --------------------------------------------------------------------------
    # 6. STAFF TASKS DASHBOARD & COMMANDS
    # --------------------------------------------------------------------------

    @patch('telegram_bot.services.telegram_client.TelegramClient.send_inline_keyboard')
    def test_tasks_command_displays_assigned_tasks(self, mock_send_keyboard):
        """Slash command /tasks lists pending tasks assigned to the user with complete buttons."""
        task = LeadStageTask.objects.create(
            lead=self.lead,
            stage=self.stage_new,
            title='Prepare Custom Quotation',
            is_mandatory=True,
            status=LeadStageTask.Status.PENDING,
            due_date=timezone.now() + timedelta(days=1),
            assigned_to=self.user
        )

        handler = TelegramUpdateHandler()
        update = {
            'update_id': 111,
            'message': {
                'chat': {'id': self.profile.chat_id},
                'from': {'username': 'alex_rivera_crm'},
                'text': '/tasks'
            }
        }
        handler.handle_update(update)

        mock_send_keyboard.assert_called_once()
        sent_text = mock_send_keyboard.call_args[0][1]
        sent_keyboard = mock_send_keyboard.call_args[0][2]

        self.assertIn('Prepare Custom Quotation', sent_text)
        self.assertIn('Mandatory', sent_text)
        # Check inline complete button present
        flat_callbacks = [btn['callback_data'] for row in sent_keyboard for btn in row]
        self.assertTrue(any(cb.startswith(f"stagetask_done_{task.id}") for cb in flat_callbacks))

    @patch('telegram_bot.services.telegram_client.TelegramClient.send_inline_keyboard')
    def test_tasks_staff_breakdown_and_filter(self, mock_send_keyboard):
        """Admins can view team staff tasks breakdown and filter by staff member."""
        self.user.role = User.Role.ADMIN
        self.user.save(update_fields=['role'])

        rep = User.objects.create_user(
            email='rep_sarah@crm.com',
            password='Password@123',
            first_name='Sarah',
            last_name='Connor',
            role=User.Role.EXECUTIVE
        )
        task = LeadStageTask.objects.create(
            lead=self.lead,
            stage=self.stage_new,
            title='Send Product Proposal',
            is_mandatory=True,
            status=LeadStageTask.Status.PENDING,
            due_date=timezone.now() + timedelta(days=2),
            assigned_to=rep
        )

        handler = TelegramUpdateHandler()

        # 1. Test /tasks sarah
        filter_update = {
            'update_id': 112,
            'message': {
                'chat': {'id': self.profile.chat_id},
                'from': {'username': 'alex_rivera_crm'},
                'text': '/tasks sarah'
            }
        }
        handler.handle_update(filter_update)
        sent_text = mock_send_keyboard.call_args[0][1]
        self.assertIn('Send Product Proposal', sent_text)
        self.assertIn('Sarah', sent_text)

        # 2. Test staff breakdown callback
        mock_send_keyboard.reset_mock()
        cb_update = {
            'update_id': 113,
            'callback_query': {
                'id': 'cq_staff_breakdown',
                'data': 'tasks_staff_breakdown',
                'message': {
                    'chat': {'id': self.profile.chat_id},
                    'message_id': 888
                }
            }
        }
        handler.handle_update(cb_update)
        mock_send_keyboard.assert_called_once()
        breakdown_text = mock_send_keyboard.call_args[0][1]
        self.assertIn('Team Staff Tasks Breakdown', breakdown_text)
        self.assertIn('Sarah Connor', breakdown_text)

    # --------------------------------------------------------------------------
    # 7. CREATE LEAD VIA TELEGRAM NATURAL LANGUAGE FLOW
    # --------------------------------------------------------------------------

    @patch('telegram_bot.services.telegram_client.TelegramClient.edit_message_text')
    @patch('telegram_bot.services.telegram_client.TelegramClient.answer_callback_query')
    @patch('telegram_bot.services.telegram_client.TelegramClient.send_inline_keyboard')
    def test_create_lead_via_telegram_flow(self, mock_send_keyboard, mock_answer, mock_edit_text):
        """User can type 'Create lead Rahul Sharma, phone 9876543210, company TechNova' and confirm in Telegram."""
        handler = TelegramUpdateHandler()

        # Step 1: User sends creation text
        msg_update = {
            'update_id': 114,
            'message': {
                'chat': {'id': self.profile.chat_id},
                'from': {'username': 'alex_rivera_crm'},
                'text': 'Create lead Rahul Sharma, phone 9876543210, company TechNova'
            }
        }
        handler.handle_update(msg_update)

        # Action session created with confirmation keyboard
        session = TelegramActionSession.objects.filter(user=self.user, action_type='CREATE_LEAD').first()
        self.assertIsNotNone(session)
        self.assertEqual(session.action_payload['parameters']['name'], 'Rahul Sharma')
        self.assertEqual(session.action_payload['parameters']['phone'], '9876543210')
        self.assertEqual(session.action_payload['parameters']['company_name'], 'TechNova')

        mock_send_keyboard.assert_called_once()
        keyboard = mock_send_keyboard.call_args[0][2]
        self.assertEqual(keyboard[0][0]['callback_data'], f"act_confirm_{session.id}")

        # Step 2: User taps [✅ Create Lead]
        cb_update = {
            'update_id': 115,
            'callback_query': {
                'id': 'cq_confirm_create',
                'data': f"act_confirm_{session.id}",
                'message': {
                    'chat': {'id': self.profile.chat_id},
                    'message_id': 999
                }
            }
        }
        handler.handle_update(cb_update)

        # Verify lead created in DB
        created_lead = Lead.objects.filter(name='Rahul Sharma').first()
        self.assertIsNotNone(created_lead)
        self.assertEqual(created_lead.phone, '9876543210')
        self.assertEqual(created_lead.company_name, 'TechNova')
        self.assertEqual(created_lead.assigned_to, self.user)
        self.assertEqual(created_lead.created_by, self.user)

        # Verify message updated with success and navigation buttons
        session.refresh_from_db()
        self.assertEqual(session.status, TelegramActionSession.Status.EXECUTED)
        mock_answer.assert_called_with('cq_confirm_create', 'Action executed successfully!')
        mock_edit_text.assert_called_once()
        self.assertIn('Rahul Sharma', mock_edit_text.call_args[0][2])

    def test_simulation_endpoint_connect_and_query(self):
        """Tests POST /api/telegram/simulate/ for end-to-end mobile UI simulation."""
        # Setup pending profile with PIN 555666
        profile, _ = TelegramProfile.objects.get_or_create(user=self.user)
        profile.verification_code = '555666'
        profile.code_expires_at = timezone.now() + timedelta(minutes=15)
        profile.is_verified = False
        profile.save()

        sim_chat_id = 999888777

        # 1. Simulate user sending /connect 555666
        res = self.client.post('/api/telegram/simulate/', {
            'chat_id': sim_chat_id,
            'text': '/connect 555666',
            'username': 'sim_tester'
        }, format='json')

        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['is_verified'])
        self.assertEqual(res.data['crm_user']['email'], self.user.email)
        self.assertTrue(len(res.data['events']) > 0)
        self.assertIn('Successfully Linked', res.data['events'][0]['text'])

        # 2. Simulate user sending /pipeline command
        res_pipeline = self.client.post('/api/telegram/simulate/', {
            'chat_id': sim_chat_id,
            'text': '/pipeline',
        }, format='json')
        self.assertEqual(res_pipeline.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res_pipeline.data['events']) > 0)
        self.assertIn('Pipeline Snapshot', res_pipeline.data['events'][0]['text'])
        self.assertIn('inline_keyboard', res_pipeline.data['events'][0]['reply_markup'])

        # 3. Simulate tapping inline callback button 'cmd_tasks'
        res_cb = self.client.post('/api/telegram/simulate/', {
            'chat_id': sim_chat_id,
            'callback_data': 'cmd_tasks',
            'message_id': 2005
        }, format='json')
        self.assertEqual(res_cb.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res_cb.data['events']) > 0)
        self.assertIn('Stage Tasks', res_cb.data['events'][0]['text'])
