import sys
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
from django.conf import settings
from .telegram_client import TelegramClient
from ..models import TelegramProfile

logger = logging.getLogger(__name__)

# Background thread pool executor for non-blocking outbound notification delivery
_dispatcher_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix='tg-notify')


class TelegramNotificationDispatcher:
    """
    Dispatches outbound proactive CRM notifications (new leads, overdue follow-ups,
    deal won alerts) directly to user's Telegram chat with actionable inline buttons.
    Runs asynchronously in the background so lead creation and auto-assignment are instantaneous.
    """

    @classmethod
    def dispatch(cls, notification, async_mode: Optional[bool] = None) -> bool:
        """
        Sends an in-app notification to the recipient's Telegram chat if linked and enabled.
        When async_mode is True (default in server runtime), delivers in a background thread
        to ensure zero delay for HTTP requests.
        """
        if not notification or not notification.recipient:
            return False

        if async_mode is None:
            # Execute synchronously in test runner so assertions and mocks work deterministically
            async_mode = 'test' not in sys.argv

        if async_mode:
            try:
                _dispatcher_executor.submit(cls._do_dispatch, notification)
                return True
            except Exception as e:
                logger.warning(f"[TelegramDispatcher] ThreadPool submission failed, falling back: {e}")
                return cls._do_dispatch(notification)

        return cls._do_dispatch(notification)

    @classmethod
    def _do_dispatch(cls, notification) -> bool:
        """Internal synchronous worker for Telegram message delivery."""
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
            logger.error(f"[TelegramDispatcher] Failed to dispatch notification {getattr(notification, 'id', 'unknown')}: {e}", exc_info=True)
            return False

