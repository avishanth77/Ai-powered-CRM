import logging
from typing import Optional
from django.conf import settings
from .telegram_client import TelegramClient
from ..models import TelegramProfile

logger = logging.getLogger(__name__)


class TelegramNotificationDispatcher:
    """
    Dispatches outbound proactive CRM notifications (new leads, overdue follow-ups,
    deal won alerts) directly to user's Telegram chat with actionable inline buttons.
    """

    @classmethod
    def dispatch(cls, notification) -> bool:
        """
        Sends an in-app notification to the recipient's Telegram chat if linked and enabled.
        """
        if not notification or not notification.recipient:
            return False

        try:
            profile = TelegramProfile.objects.filter(
                user=notification.recipient,
                is_verified=True,
                chat_id__isnull=False
            ).first()

            if not profile:
                return False

            ntype = notification.notification_type or ''

            # Check user preference flags
            if ntype in ['LEAD_ASSIGNED', 'LEAD_CREATED'] and not profile.notify_new_leads:
                return False
            if ntype in ['FOLLOW_UP_REMINDER', 'FOLLOW_UP_OVERDUE'] and not profile.notify_followups:
                return False
            if ntype in ['STAGE_CHANGE', 'STAGE_TASK_PENDING', 'LEAD_WON'] and not profile.notify_stage_changes:
                return False

            client = TelegramClient()
            if not client.is_configured:
                return False

            # Format notification with clean emojis
            icon = "🔔"
            if 'LEAD' in ntype:
                icon = "👤"
            elif 'FOLLOW_UP' in ntype or 'OVERDUE' in ntype:
                icon = "⏰"
            elif 'WON' in ntype:
                icon = "🎉"
            elif 'STAGE' in ntype:
                icon = "⚡"

            text = (
                f"{icon} <b>{notification.title}</b>\n\n"
                f"{notification.message}\n\n"
                f"<i>Sent via CRM Lite Real-time Alerts</i>"
            )

            # Build action buttons if entity reference exists
            buttons = []
            if notification.entity_type == 'lead' and notification.entity_id:
                buttons.append([
                    {'text': "🔍 View Lead", 'callback_data': f"lead_detail_{notification.entity_id}"},
                    {'text': "⚡ Move Stage", 'callback_data': f"lead_move_{notification.entity_id}"}
                ])
            elif notification.entity_type == 'followup' and notification.entity_id:
                buttons.append([
                    {'text': "✅ Mark Completed", 'callback_data': f"followup_done_{notification.entity_id}"}
                ])

            if buttons:
                client.send_inline_keyboard(profile.chat_id, text, buttons)
            else:
                client.send_message(profile.chat_id, text)

            return True

        except Exception as e:
            logger.error(f"[TelegramDispatcher] Failed to dispatch notification {notification.id}: {e}", exc_info=True)
            return False
