import logging
import re
from datetime import timedelta
from typing import Dict, Any, Optional
from django.utils import timezone
from django.db.models import Q

from accounts.models import User
from leads.models import Lead, LeadStage, LeadStageTask
from followups.models import FollowUp
from ai.services.chatbot_service import ChatbotService
from ai.services.crm_tools import CRMTools
from ..models import TelegramProfile, TelegramActionSession
from .telegram_client import TelegramClient

logger = logging.getLogger(__name__)


class TelegramUpdateHandler:
    """
    Processes incoming Telegram Webhook updates and Polling events.
    Translates Telegram interactions into authenticated CRM actions and AI queries.
    """

    def __init__(self, client: Optional[TelegramClient] = None):
        self.client = client or TelegramClient()

    def handle_update(self, update: Dict[str, Any]):
        """Main dispatcher for incoming Telegram payload."""
        try:
            if 'message' in update:
                self._handle_message(update['message'])
            elif 'callback_query' in update:
                self._handle_callback_query(update['callback_query'])
        except Exception as e:
            logger.error(f"[TelegramHandler] Error processing update {update.get('update_id')}: {e}", exc_info=True)

    # =========================================================================
    # MESSAGE HANDLING
    # =========================================================================

    def _handle_message(self, message: Dict[str, Any]):
        chat = message.get('chat', {})
        chat_id = chat.get('id')
        text = (message.get('text') or '').strip()
        from_user = message.get('from', {})
        username = from_user.get('username', '')
        first_name = from_user.get('first_name', '')
        last_name = from_user.get('last_name', '')

        if not chat_id or not text:
            return

        # Check if chat is already linked to a verified CRM user
        profile = TelegramProfile.objects.filter(chat_id=chat_id, is_verified=True).select_related('user').first()

        # Handle account linking commands (/start <code>, /connect <code>)
        if text.startswith('/start') or text.startswith('/connect'):
            self._handle_connect(chat_id, text, username, first_name, last_name, profile)
            return

        # Handle direct 6-digit PIN entry (with or without brackets <...>)
        cleaned_pin = text.strip("<>#\"'`* ")
        if not profile and re.fullmatch(r'\d{6}', cleaned_pin):
            self._handle_connect(chat_id, f"/connect {cleaned_pin}", username, first_name, last_name, profile)
            return

        # If not verified, instruct user how to connect
        if not profile:
            self.client.send_message(
                chat_id,
                "🔒 <b>CRM Lite Authentication Required</b>\n\n"
                "Your Telegram account is not yet connected to CRM Lite.\n\n"
                "<b>How to connect:</b>\n"
                "1. Sign in to your CRM Web app.\n"
                "2. Go to <b>Settings &gt; Telegram Bot</b> and generate your 6-digit PIN.\n"
                "3. Reply here with: <code>/connect &lt;YOUR-PIN&gt;</code>\n\n"
                "<i>Example:</i> <code>/connect 481920</code>"
            )
            return

        user = profile.user
        if not user.is_active:
            self.client.send_message(chat_id, "⚠️ Your CRM account has been deactivated. Please contact an administrator.")
            return

        # Process authenticated slash commands
        cmd = text.split()[0].lower()
        if cmd == '/help':
            self._send_help_message(chat_id, user)
        elif cmd == '/pipeline':
            self._send_pipeline_summary(chat_id, user)
        elif cmd in ['/leads', '/my_leads']:
            self._send_my_leads(chat_id, user)
        elif cmd in ['/agenda', '/today', '/followups']:
            self._send_today_agenda(chat_id, user)
        elif cmd == '/status':
            self._send_account_status(chat_id, profile)
        elif cmd == '/disconnect':
            profile.unlink()
            self.client.send_message(chat_id, "👋 Your Telegram account has been disconnected from CRM Lite. To reconnect, use <code>/connect &lt;PIN&gt;</code>.")
        else:
            # Pass conversational natural language query directly to CRM Chatbot AI
            self._process_ai_query(chat_id, user, text)

    def _handle_connect(self, chat_id: int, text: str, username: str, first_name: str, last_name: str, existing_profile: Optional[TelegramProfile]):
        parts = text.split()
        raw_code = parts[1].strip() if len(parts) > 1 else None

        # Clean off any angle brackets, quotes, or extract exact 6 digits
        code = None
        if raw_code:
            cleaned = raw_code.strip("<>#\"'`* ")
            match = re.search(r'\d{6}', cleaned)
            code = match.group(0) if match else cleaned

        if not code:
            if existing_profile:
                self.client.send_message(
                    chat_id,
                    f"✅ <b>Already Connected!</b>\n\n"
                    f"Signed in as: <b>{existing_profile.user.get_full_name() or existing_profile.user.email}</b>\n"
                    f"Role: <code>{existing_profile.user.role}</code>\n\n"
                    f"Type /help to see all available commands and queries."
                )
            else:
                self.client.send_message(
                    chat_id,
                    "👋 <b>Welcome to CRM Lite Copilot!</b>\n\n"
                    "To link this Telegram account with your CRM profile:\n"
                    "1. Open CRM Web &gt; <b>Settings &gt; Telegram Bot</b>\n"
                    "2. Generate your 6-digit connection PIN\n"
                    "3. Send <code>/connect &lt;PIN&gt;</code> here."
                )
            return

        # Find profile with matching pending verification code
        target_profile = TelegramProfile.objects.filter(verification_code=code).first()
        if not target_profile:
            self.client.send_message(
                chat_id,
                "❌ <b>Invalid or Expired PIN</b>\n\n"
                "Please generate a fresh 6-digit PIN in CRM Web Settings &gt; Telegram Bot and try again."
            )
            return

        success = target_profile.verify_code(
            code=code,
            chat_id=chat_id,
            username=username,
            first_name=first_name,
            last_name=last_name
        )

        if success:
            crm_user = target_profile.user
            self.client.send_message(
                chat_id,
                f"🎉 <b>Account Successfully Linked!</b>\n\n"
                f"👤 <b>Name:</b> {crm_user.get_full_name() or crm_user.email}\n"
                f"🏷 <b>Role:</b> <code>{crm_user.role}</code>\n"
                f"💼 <b>Status:</b> Active\n\n"
                f"You can now manage your leads, pipeline, and follow-ups directly through this chat!\n\n"
                f"Try typing:\n"
                f"• <code>/pipeline</code> — View deals funnel\n"
                f"• <code>/leads</code> — Top active leads\n"
                f"• <code>/today</code> — Today's follow-up agenda\n"
                f"• Or ask anything: <i>\"Move Acme Corp to Contacted\"</i>"
            )
        else:
            self.client.send_message(chat_id, "❌ Verification failed. The PIN may have expired. Please generate a new one.")

    # =========================================================================
    # SLASH COMMAND RESPONDERS
    # =========================================================================

    def _send_help_message(self, chat_id: int, user: User):
        msg = (
            "🤖 <b>CRM Lite Copilot — Commands &amp; AI Capabilities</b>\n\n"
            "<b>Quick Commands:</b>\n"
            "• /pipeline — Visual pipeline deals &amp; value summary\n"
            "• /leads — View your top active leads with 1-click actions\n"
            "• /today — Today's follow-up agenda &amp; overdue tasks\n"
            "• /status — Connection details and notification preferences\n"
            "• /disconnect — Unlink your Telegram account\n\n"
            "<b>Natural Language AI Queries:</b>\n"
            "You can type naturally as if talking to a sales assistant:\n"
            "• <i>\"Show my overdue leads\"</i>\n"
            "• <i>\"Summarize lead Apex Logistics\"</i>\n"
            "• <i>\"Move Acme Corp to Qualified stage\"</i>\n"
            "• <i>\"What's our total pipeline value?\"</i>\n"
            "• <i>\"Create lead Rahul Sharma, phone 9876543210, company TechNova\"</i>\n\n"
            "<i>All mutating write actions ask for your explicit button confirmation before updating the database.</i>"
        )
        self.client.send_message(chat_id, msg)

    def _send_pipeline_summary(self, chat_id: int, user: User):
        summary = CRMTools.get_pipeline_summary(user)
        total_leads = summary.get('total_leads', 0)
        total_value = summary.get('total_value', 0.0)
        by_stage = summary.get('by_stage', [])

        lines = [
            "📊 <b>CRM Pipeline Snapshot</b>",
            f"💼 Total Active Deals: <b>{total_leads}</b>",
            f"💰 Pipeline Value: <b>${total_value:,.2f}</b>\n"
        ]

        for s in by_stage:
            count = s.get('count', 0)
            val = s.get('value', 0.0)
            name = s.get('stage_name', 'Stage')
            bar = "🟦" * min(count, 8) if count > 0 else "▫️"
            lines.append(f"<b>{name}</b> ({count}) — ${val:,.0f}\n{bar}")

        keyboard = [
            [
                {'text': '📋 View My Leads', 'callback_data': 'cmd_leads'},
                {'text': '⏰ Today Agenda', 'callback_data': 'cmd_today'}
            ]
        ]
        self.client.send_inline_keyboard(chat_id, "\n".join(lines), keyboard)

    def _send_my_leads(self, chat_id: int, user: User):
        qs = CRMTools.get_scoped_leads_qs(user)
        active_leads = qs.exclude(stage__slug__in=['won', 'lost']).select_related('stage').order_by('-updated_at')[:5]

        if not active_leads.exists():
            self.client.send_message(chat_id, "ℹ️ You currently have no active assigned leads in the pipeline.")
            return

        lines = ["📋 <b>Your Active Leads (Top 5):</b>\n"]
        buttons = []

        for idx, lead in enumerate(active_leads, 1):
            stage_name = lead.stage.name if lead.stage else 'New'
            val_str = f"${lead.expected_value:,.0f}" if lead.expected_value else "$0"
            lines.append(
                f"{idx}. <b>{lead.name}</b> ({lead.company_name or 'Independent'})\n"
                f"   📍 Stage: <code>{stage_name}</code> | Deal: <b>{val_str}</b>"
            )
            buttons.append([
                {'text': f"🔍 Details: {lead.name[:16]}", 'callback_data': f"lead_detail_{lead.id}"},
                {'text': "⚡ Move", 'callback_data': f"lead_move_{lead.id}"}
            ])

        self.client.send_inline_keyboard(chat_id, "\n\n".join(lines), buttons)

    def _send_today_agenda(self, chat_id: int, user: User):
        now = timezone.now()
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = now.replace(hour=23, minute=59, second=59, microsecond=999999)

        base_qs = FollowUp.objects.filter(status=FollowUp.Status.PENDING)
        if user.role not in ['ADMIN', 'MANAGER'] and not user.is_superuser:
            base_qs = base_qs.filter(assigned_to=user)

        today_followups = base_qs.filter(follow_up_at__gte=start_of_day, follow_up_at__lte=end_of_day).order_by('follow_up_at')
        overdue_followups = base_qs.filter(follow_up_at__lt=start_of_day).order_by('follow_up_at')[:5]

        lines = ["⏰ <b>Today's Follow-Up Agenda</b>\n"]
        buttons = []

        if overdue_followups.exists():
            lines.append("🚨 <b>Overdue Items:</b>")
            for f in overdue_followups:
                target = f.lead.name if f.lead else (f.customer.name if f.customer else 'Contact')
                due_time = f.follow_up_at.strftime('%b %d, %H:%M')
                lines.append(f"• <b>{target}</b> ({f.purpose or 'Call'}) — due {due_time}")
                buttons.append([{'text': f"✅ Complete {target[:14]}", 'callback_data': f"followup_done_{f.id}"}])
            lines.append("")

        if today_followups.exists():
            lines.append("📅 <b>Scheduled For Today:</b>")
            for f in today_followups:
                target = f.lead.name if f.lead else (f.customer.name if f.customer else 'Contact')
                due_time = f.follow_up_at.strftime('%H:%M')
                lines.append(f"• <b>{due_time}</b> — {target} ({f.purpose or 'Call'})")
                buttons.append([{'text': f"✅ Mark Done: {target[:14]}", 'callback_data': f"followup_done_{f.id}"}])
        else:
            lines.append("✨ No further scheduled follow-ups for today!")

        if buttons:
            self.client.send_inline_keyboard(chat_id, "\n".join(lines), buttons)
        else:
            self.client.send_message(chat_id, "\n".join(lines))

    def _send_account_status(self, chat_id: int, profile: TelegramProfile):
        u = profile.user
        text = (
            f"👤 <b>Connected Account Status</b>\n\n"
            f"• <b>CRM User:</b> {u.get_full_name() or u.email}\n"
            f"• <b>Email:</b> <code>{u.email}</code>\n"
            f"• <b>Role:</b> <code>{u.role}</code>\n"
            f"• <b>Telegram Username:</b> @{profile.telegram_username or 'Not set'}\n"
            f"• <b>Chat ID:</b> <code>{profile.chat_id}</code>\n\n"
            f"<b>Active Push Notifications:</b>\n"
            f"• New Inbound Leads: {'✅ Enabled' if profile.notify_new_leads else '❌ Disabled'}\n"
            f"• Follow-Up Reminders: {'✅ Enabled' if profile.notify_followups else '❌ Disabled'}\n"
            f"• Stage Transitions: {'✅ Enabled' if profile.notify_stage_changes else '❌ Disabled'}\n\n"
            f"<i>Configure preferences in CRM Web &gt; Settings &gt; Telegram Bot</i>"
        )
        self.client.send_message(chat_id, text)

    # =========================================================================
    # CONVERSATIONAL AI PROCESSING
    # =========================================================================

    def _process_ai_query(self, chat_id: int, user: User, prompt: str):
        # 1. Ask ChatbotService to analyze prompt with live CRM tools & context
        result = ChatbotService.process_query(
            user=user,
            prompt=prompt,
            context={"channel": "telegram", "chat_id": chat_id}
        )

        response_text = result.get('response', '')
        action_required = result.get('action_required', False)
        action_payload = result.get('action_payload')

        if action_required and action_payload:
            # Create a 10-minute pending action session for button confirmation
            session = TelegramActionSession.objects.create(
                user=user,
                chat_id=chat_id,
                action_type=action_payload.get('action_type', 'ACTION'),
                action_description=action_payload.get('description', 'CRM Action'),
                action_payload=action_payload,
                expires_at=timezone.now() + timedelta(minutes=10)
            )

            keyboard = [
                [
                    {'text': "✅ Confirm Action", 'callback_data': f"act_confirm_{session.id}"},
                    {'text': "❌ Cancel", 'callback_data': f"act_cancel_{session.id}"}
                ]
            ]

            full_msg = (
                f"🤖 <b>Action Confirmation Required</b>\n\n"
                f"{response_text}\n\n"
                f"⚠️ <i>Please confirm to execute this change on the live CRM database.</i>"
            )
            self.client.send_inline_keyboard(chat_id, full_msg, keyboard)
        else:
            # Clean Markdown asterisks into HTML bold/code tags for clean Telegram rendering
            formatted_text = self._format_ai_response_for_telegram(response_text)
            self.client.send_message(chat_id, formatted_text)

    def _format_ai_response_for_telegram(self, text: str) -> str:
        """Converts Markdown formatted text from ChatbotService into Telegram-friendly HTML."""
        # Escape raw HTML characters first
        escaped = (
            text.replace('&', '&amp;')
                .replace('<', '&lt;')
                .replace('>', '&gt;')
        )
        # Bold: **bold** or *bold* -> <b>bold</b>
        escaped = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', escaped)
        # Code spans: `code` -> <code>code</code>
        escaped = re.sub(r'`(.+?)`', r'<code>\1</code>', escaped)
        # Markdown lists: - item -> • item
        escaped = re.sub(r'^\s*[-*]\s+', '• ', escaped, flags=re.MULTILINE)
        return escaped

    # =========================================================================
    # INTERACTIVE BUTTON CALLBACKS
    # =========================================================================

    def _handle_callback_query(self, callback_query: Dict[str, Any]):
        cq_id = callback_query.get('id')
        data = callback_query.get('data', '')
        message = callback_query.get('message', {})
        chat_id = message.get('chat', {}).get('id')
        message_id = message.get('message_id')

        profile = TelegramProfile.objects.filter(chat_id=chat_id, is_verified=True).select_related('user').first()
        if not profile:
            self.client.answer_callback_query(cq_id, "Please authenticate using /connect first.", show_alert=True)
            return

        user = profile.user

        # 1. Action Confirmation: act_confirm_<session_id>
        if data.startswith('act_confirm_'):
            session_id = data.replace('act_confirm_', '')
            session = TelegramActionSession.objects.filter(pk=session_id, user=user).first()

            if not session or not session.is_valid():
                self.client.answer_callback_query(cq_id, "This action request has expired or already been handled.", show_alert=True)
                return

            try:
                # Execute verified write action via ChatbotService
                res = ChatbotService.execute_confirmed_action(user, session.action_payload)
                session.status = TelegramActionSession.Status.EXECUTED
                session.save(update_fields=['status'])

                self.client.answer_callback_query(cq_id, "Action executed successfully!")
                self.client.edit_message_text(
                    chat_id,
                    message_id,
                    f"✅ <b>Action Completed!</b>\n\n{res.get('message', 'Update applied successfully.')}"
                )
            except Exception as e:
                logger.error(f"[TelegramHandler] Action execution failed: {e}", exc_info=True)
                self.client.answer_callback_query(cq_id, f"Execution failed: {e}", show_alert=True)

        # 2. Action Cancellation: act_cancel_<session_id>
        elif data.startswith('act_cancel_'):
            session_id = data.replace('act_cancel_', '')
            session = TelegramActionSession.objects.filter(pk=session_id, user=user).first()
            if session:
                session.status = TelegramActionSession.Status.CANCELLED
                session.save(update_fields=['status'])

            self.client.answer_callback_query(cq_id, "Action cancelled.")
            self.client.edit_message_text(chat_id, message_id, "❌ <i>Action request cancelled. No changes were made.</i>")

        # 3. Complete FollowUp: followup_done_<followup_id>
        elif data.startswith('followup_done_'):
            f_id = data.replace('followup_done_', '')
            followup = FollowUp.objects.filter(pk=f_id).first()
            if followup:
                followup.status = FollowUp.Status.COMPLETED
                followup.outcome = f"Completed via Telegram by {user.get_full_name() or user.email}"
                followup.save(update_fields=['status', 'outcome', 'updated_at'])
                self.client.answer_callback_query(cq_id, "Follow-up marked as completed!")
                self.client.edit_message_text(
                    chat_id,
                    message_id,
                    f"✅ <b>Follow-Up Completed!</b>\n{followup.purpose or 'Contact'} with {followup.lead.name if followup.lead else 'Customer'}"
                )
            else:
                self.client.answer_callback_query(cq_id, "Follow-up not found.", show_alert=True)

        # 4. Lead Details: lead_detail_<id>
        elif data.startswith('lead_detail_'):
            lead_id = data.replace('lead_detail_', '')
            lead = Lead.objects.filter(pk=lead_id).select_related('stage', 'assigned_to').first()
            if lead:
                self.client.answer_callback_query(cq_id)
                info = (
                    f"👤 <b>{lead.name}</b>\n"
                    f"🏢 Company: <b>{lead.company_name or 'N/A'}</b>\n"
                    f"📧 Email: <code>{lead.email or 'N/A'}</code>\n"
                    f"📞 Phone: <code>{lead.phone or 'N/A'}</code>\n"
                    f"📍 Stage: <code>{lead.stage.name if lead.stage else 'New'}</code>\n"
                    f"💰 Deal Value: <b>${lead.expected_value:,.2f}</b>\n"
                    f"🎯 Win Probability: <b>{lead.win_probability}%</b>\n"
                    f"👨‍💼 Assigned To: <b>{lead.assigned_to.get_full_name() if lead.assigned_to else 'Unassigned'}</b>"
                )
                stages = LeadStage.objects.all().order_by('display_order')[:4]
                stage_btns = [
                    {'text': f"➡️ {st.name}", 'callback_data': f"setstage_{lead.id}_{st.id}"}
                    for st in stages if not lead.stage or st.id != lead.stage.id
                ]
                keyboard = [stage_btns, [{'text': '⬅️ Back to Leads', 'callback_data': 'cmd_leads'}]]
                self.client.send_inline_keyboard(chat_id, info, keyboard)
            else:
                self.client.answer_callback_query(cq_id, "Lead not found.", show_alert=True)

        # 5. Quick Stage Move: setstage_<lead_id>_<stage_id>
        elif data.startswith('setstage_'):
            parts = data.split('_')
            if len(parts) == 3:
                l_id, s_id = parts[1], parts[2]
                lead = Lead.objects.filter(pk=l_id).first()
                new_stage = LeadStage.objects.filter(pk=s_id).first()
                if not lead or not new_stage:
                    self.client.answer_callback_query(cq_id, "Lead or stage not found.", show_alert=True)
                    return

                if lead.stage and lead.stage.id == new_stage.id:
                    self.client.answer_callback_query(cq_id, f"Lead is already in {new_stage.name}.")
                    return

                # Enforce stage progression rules & mandatory stage tasks
                from leads.services import check_stage_progression, execute_stage_task_automations
                from leads.serializers import _check_stage_gate
                from activity.services import log_activity

                can_progress, missing_tasks, progress_msg = check_stage_progression(
                    lead, new_stage, actor=user
                )

                if not can_progress:
                    self.client.answer_callback_query(cq_id, "⚠️ Stage progression blocked: Mandatory tasks pending!", show_alert=True)
                    task_items = "\n".join([f"• <b>{t['title']}</b>" for t in missing_tasks[:5]])
                    text = (
                        f"⚠️ <b>Stage Progression Blocked</b>\n\n"
                        f"Lead <b>{lead.name}</b> cannot move to <code>{new_stage.name}</code> yet.\n\n"
                        f"The following mandatory task(s) in <code>{lead.stage.name if lead.stage else 'Current'}</code> must be completed first:\n"
                        f"{task_items}\n\n"
                        f"<i>Tap a task below to mark it done, then retry moving:</i>"
                    )
                    keyboard = []
                    for t in missing_tasks[:4]:
                        keyboard.append([{
                            'text': f"✅ Complete: {t['title'][:25]}",
                            'callback_data': f"stagetask_done_{t['id']}_{lead.id}_{new_stage.id}"
                        }])
                    keyboard.append([
                        {'text': f"🔄 Try Move to {new_stage.name}", 'callback_data': f"setstage_{lead.id}_{new_stage.id}"},
                        {'text': '⬅️ Back to Lead', 'callback_data': f"lead_detail_{lead.id}"}
                    ])
                    self.client.edit_message_text(chat_id, message_id, text, reply_markup={'inline_keyboard': keyboard})
                    return

                # Enforce PLD stage gates
                missing_gates = _check_stage_gate(lead, new_stage)
                if missing_gates:
                    gate_msg = " ".join([item.get('message', '') for item in missing_gates])
                    self.client.answer_callback_query(cq_id, f"Stage gate unmet: {gate_msg}", show_alert=True)
                    self.client.edit_message_text(
                        chat_id,
                        message_id,
                        f"⚠️ <b>Stage Gate Requirement Unmet</b>\n\n"
                        f"Cannot move lead <b>{lead.name}</b> to <code>{new_stage.name}</code>:\n"
                        f"{gate_msg}",
                        reply_markup={'inline_keyboard': [[{'text': '⬅️ Back to Lead', 'callback_data': f"lead_detail_{lead.id}"}]]}
                    )
                    return

                # Allowed! Move the stage
                old_stage = lead.stage
                old_stage_name = old_stage.name if old_stage else 'None'
                lead.stage = new_stage
                lead.save(update_fields=['stage', 'updated_at'])

                # Trigger automated task assignments on stage transition
                execute_stage_task_automations(
                    lead=lead,
                    new_stage=new_stage,
                    old_stage=old_stage,
                    actor=user
                )

                # Log activity
                try:
                    log_activity(
                        entity_type='lead',
                        entity_id=lead.id,
                        action='STATUS_CHANGED',
                        old_value={'stage': old_stage_name},
                        new_value={'stage': new_stage.name},
                        performed_by=user,
                        notes=f"Stage moved to {new_stage.name} via Telegram Bot."
                    )
                except Exception:
                    pass

                self.client.answer_callback_query(cq_id, f"Moved to {new_stage.name}!")
                self.client.edit_message_text(
                    chat_id,
                    message_id,
                    f"✅ <b>Stage Updated!</b>\nLead <b>{lead.name}</b> moved from <code>{old_stage_name}</code> to <code>{new_stage.name}</code>.",
                    reply_markup={'inline_keyboard': [
                        [{'text': '👤 View Lead', 'callback_data': f"lead_detail_{lead.id}"}],
                        [{'text': '📋 View Leads', 'callback_data': 'cmd_leads'}]
                    ]}
                )

        # 5b. Complete Stage Task: stagetask_done_<task_id>_<lead_id>_<target_stage_id>
        elif data.startswith('stagetask_done_'):
            parts = data.split('_')
            if len(parts) >= 5:
                t_id, l_id, s_id = parts[2], parts[3], parts[4]
                from leads.models import LeadStageTask
                from leads.services import complete_stage_task, check_stage_progression

                task = LeadStageTask.objects.filter(pk=t_id).first()
                lead = Lead.objects.filter(pk=l_id).first()
                target_stage = LeadStage.objects.filter(pk=s_id).first()

                if task:
                    complete_stage_task(task, actor=user, outcome_notes="Completed via Telegram Bot")
                    self.client.answer_callback_query(cq_id, f"✅ Completed: {task.title}")
                else:
                    self.client.answer_callback_query(cq_id, "Task not found.")

                if lead and target_stage:
                    can_progress, missing_tasks, _ = check_stage_progression(lead, target_stage, actor=user)
                    if can_progress:
                        text = (
                            f"🎉 <b>All Mandatory Tasks Completed!</b>\n\n"
                            f"Lead <b>{lead.name}</b> is now ready to advance to <code>{target_stage.name}</code>."
                        )
                        keyboard = [
                            [{'text': f"➡️ Move to {target_stage.name} Now", 'callback_data': f"setstage_{lead.id}_{target_stage.id}"}],
                            [{'text': '⬅️ Back to Lead', 'callback_data': f"lead_detail_{lead.id}"}]
                        ]
                    else:
                        task_items = "\n".join([f"• <b>{t['title']}</b>" for t in missing_tasks[:5]])
                        text = (
                            f"✅ <i>Task '{task.title if task else t_id}' marked as completed.</i>\n\n"
                            f"Remaining mandatory task(s) for <b>{lead.name}</b> before moving to <code>{target_stage.name}</code>:\n"
                            f"{task_items}"
                        )
                        keyboard = []
                        for t in missing_tasks[:4]:
                            keyboard.append([{
                                'text': f"✅ Complete: {t['title'][:25]}",
                                'callback_data': f"stagetask_done_{t['id']}_{lead.id}_{target_stage.id}"
                            }])
                        keyboard.append([
                            {'text': f"🔄 Try Move to {target_stage.name}", 'callback_data': f"setstage_{lead.id}_{target_stage.id}"},
                            {'text': '⬅️ Back to Lead', 'callback_data': f"lead_detail_{lead.id}"}
                        ])
                    self.client.edit_message_text(chat_id, message_id, text, reply_markup={'inline_keyboard': keyboard})

        # 6. Navigation Commands from buttons: cmd_leads, cmd_today
        elif data == 'cmd_leads':
            self.client.answer_callback_query(cq_id)
            self._send_my_leads(chat_id, user)
        elif data == 'cmd_today':
            self.client.answer_callback_query(cq_id)
            self._send_today_agenda(chat_id, user)
        else:
            self.client.answer_callback_query(cq_id)
