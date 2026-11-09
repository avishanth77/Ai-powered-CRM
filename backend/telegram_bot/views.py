import logging
import time
import uuid
from typing import Optional, Dict, Any, List
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from .models import TelegramProfile
from .serializers import (
    TelegramProfileSerializer,
    TelegramPreferencesSerializer,
    TelegramLinkCodeResponseSerializer,
)
from .services.telegram_client import TelegramClient
from .services.telegram_handler import TelegramUpdateHandler

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name='dispatch')
class TelegramWebhookView(APIView):
    """
    POST /api/telegram/webhook/
    Public webhook receiver for Telegram Bot updates.
    Verifies optional secret header X-Telegram-Bot-Api-Secret-Token.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        # 1. Verify webhook secret header if configured
        configured_secret = getattr(settings, 'TELEGRAM_WEBHOOK_SECRET', '')
        if configured_secret:
            incoming_secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token', '')
            if incoming_secret != configured_secret:
                logger.warning("[TelegramWebhook] Rejected unauthorized webhook request (invalid secret token).")
                return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        # 2. Extract and handle update
        update_data = request.data or {}
        if not update_data:
            return Response({'ok': True}, status=status.HTTP_200_OK)

        handler = TelegramUpdateHandler()
        handler.handle_update(update_data)

        return Response({'ok': True}, status=status.HTTP_200_OK)


class TelegramStatusView(APIView):
    """
    GET /api/telegram/status/
    Returns Telegram connection status and notification preferences for current user.
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: TelegramProfileSerializer})
    def get(self, request):
        profile, _ = TelegramProfile.objects.get_or_create(user=request.user)
        serializer = TelegramProfileSerializer(profile)
        return Response({
            'success': True,
            'data': serializer.data
        })


class TelegramGenerateLinkCodeView(APIView):
    """
    POST /api/telegram/generate-link-code/
    Generates a fresh 6-digit one-time PIN and deep link for the user to connect Telegram.
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: TelegramLinkCodeResponseSerializer})
    def post(self, request):
        profile, _ = TelegramProfile.objects.get_or_create(user=request.user)
        code = profile.generate_verification_code(expiry_minutes=15)
        bot_username = getattr(settings, 'TELEGRAM_BOT_USERNAME', 'mycrm_sales_copilot_bot').lstrip('@')
        deep_link = f"https://t.me/{bot_username}?start={code}"

        return Response({
            'success': True,
            'message': '6-digit connection PIN generated. Valid for 15 minutes.',
            'data': {
                'code': code,
                'bot_username': f"@{bot_username}",
                'deep_link': deep_link,
                'expires_in_minutes': 15
            }
        })


class TelegramUpdatePreferencesView(APIView):
    """
    POST /api/telegram/preferences/
    Updates Telegram push notification toggles for the user.
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=TelegramPreferencesSerializer, responses={200: TelegramProfileSerializer})
    def post(self, request):
        profile, _ = TelegramProfile.objects.get_or_create(user=request.user)
        serializer = TelegramPreferencesSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response({
            'success': True,
            'message': 'Telegram notification preferences updated.',
            'data': TelegramProfileSerializer(profile).data
        })


class TelegramDisconnectView(APIView):
    """
    POST /api/telegram/disconnect/
    Unlinks the current user's Telegram account from the CRM.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile = TelegramProfile.objects.filter(user=request.user).first()
        if profile:
            profile.unlink()

        return Response({
            'success': True,
            'message': 'Telegram account disconnected successfully.'
        })


class TelegramSendTestMessageView(APIView):
    """
    POST /api/telegram/test-message/
    Dispatches a test notification message to the user's connected Telegram chat.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile = TelegramProfile.objects.filter(user=request.user, is_verified=True).first()
        if not profile or not profile.chat_id:
            return Response({
                'success': False,
                'message': 'Your account is not yet connected to Telegram. Please link your account first.'
            }, status=status.HTTP_400_BAD_REQUEST)

        client = TelegramClient()
        if not client.is_configured:
            return Response({
                'success': False,
                'message': 'TELEGRAM_BOT_TOKEN is not configured on the CRM backend.'
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        res = client.send_message(
            profile.chat_id,
            f"🔔 <b>CRM Lite Test Alert</b>\n\n"
            f"Hello {request.user.first_name or request.user.email}! 👋\n"
            f"Your Telegram bot integration is working properly.\n\n"
            f"You will receive live alerts for leads, follow-ups, and pipeline updates directly here."
        )

        if res.get('ok'):
            return Response({
                'success': True,
                'message': 'Test alert dispatched to your Telegram successfully!'
            })
        else:
            return Response({
                'success': False,
                'message': f"Telegram API error: {res.get('description', 'Unknown error')}"
            }, status=status.HTTP_502_BAD_GATEWAY)


class CaptureTelegramClient:
    """
    In-memory mock TelegramClient for mobile UI simulator and automated tests.
    Intercepts outgoing Telegram calls (sendMessage, editMessageText, answerCallbackQuery)
    and stores them in an array to be returned to the simulator UI as JSON events.
    """

    def __init__(self):
        self.events: List[Dict[str, Any]] = []
        self.last_toast: Optional[Dict[str, Any]] = None
        self._next_msg_id = 2000

    @property
    def is_configured(self) -> bool:
        return True

    def send_message(
        self,
        chat_id: int,
        text: str,
        reply_markup: Optional[Dict[str, Any]] = None,
        parse_mode: str = 'HTML',
        disable_web_page_preview: bool = True
    ) -> Dict[str, Any]:
        self._next_msg_id += 1
        event = {
            'type': 'message',
            'message_id': self._next_msg_id,
            'chat_id': chat_id,
            'text': text,
            'reply_markup': reply_markup,
            'parse_mode': parse_mode,
            'timestamp': int(time.time()),
        }
        self.events.append(event)
        return {'ok': True, 'result': event}

    def send_inline_keyboard(
        self,
        chat_id: int,
        text: str,
        buttons: List[List[Dict[str, str]]],
        parse_mode: str = 'HTML'
    ) -> Dict[str, Any]:
        return self.send_message(
            chat_id=chat_id,
            text=text,
            reply_markup={'inline_keyboard': buttons},
            parse_mode=parse_mode
        )

    def edit_message_text(
        self,
        chat_id: int,
        message_id: int,
        text: str,
        reply_markup: Optional[Dict[str, Any]] = None,
        parse_mode: str = 'HTML'
    ) -> Dict[str, Any]:
        event = {
            'type': 'edit',
            'message_id': message_id,
            'chat_id': chat_id,
            'text': text,
            'reply_markup': reply_markup,
            'parse_mode': parse_mode,
            'timestamp': int(time.time()),
        }
        self.events.append(event)
        return {'ok': True, 'result': event}

    def answer_callback_query(
        self,
        callback_query_id: str,
        text: Optional[str] = None,
        show_alert: bool = False
    ) -> Dict[str, Any]:
        if text:
            self.last_toast = {
                'text': text,
                'show_alert': show_alert
            }
        return {'ok': True}

    def delete_message(self, chat_id: int, message_id: int) -> Dict[str, Any]:
        self.events.append({
            'type': 'delete',
            'message_id': message_id,
            'chat_id': chat_id,
        })
        return {'ok': True}


@method_decorator(csrf_exempt, name='dispatch')
class TelegramSimulateView(APIView):
    """
    POST /api/telegram/simulate/
    Interactive Telegram Simulator endpoint for the HTML Mobile UI.
    Runs text messages and inline keyboard callback queries through TelegramUpdateHandler
    and returns recorded outgoing bot events.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, *args, **kwargs):
        """Returns connection status of the simulated chat_id."""
        chat_id_param = request.query_params.get('chat_id', '888123456')
        try:
            chat_id = int(chat_id_param)
        except (ValueError, TypeError):
            chat_id = 888123456

        profile = TelegramProfile.objects.filter(chat_id=chat_id, is_verified=True).select_related('user').first()
        bot_username = getattr(settings, 'TELEGRAM_BOT_USERNAME', 'mycrm_sales_copilot_bot')

        return Response({
            'success': True,
            'chat_id': chat_id,
            'bot_username': f"@{bot_username.lstrip('@')}",
            'is_verified': bool(profile),
            'crm_user': {
                'email': profile.user.email,
                'name': profile.user.get_full_name() or profile.user.email,
                'role': profile.user.role,
            } if profile else None,
        })

    def post(self, request, *args, **kwargs):
        data = request.data or {}
        text = (data.get('text') or '').strip()
        pin = (data.get('pin') or '').strip()
        action = data.get('action')
        callback_data = data.get('callback_data')
        chat_id_val = data.get('chat_id') or 888123456
        username = data.get('username') or 'sales_rep'
        first_name = data.get('first_name') or 'Alex'
        last_name = data.get('last_name') or 'Morgan'
        message_id = data.get('message_id') or 1000

        try:
            chat_id = int(chat_id_val)
        except (ValueError, TypeError):
            chat_id = 888123456

        User = get_user_model()

        # Handle explicit actions (reset or auto-connect admin)
        if action == 'reset':
            TelegramProfile.objects.filter(chat_id=chat_id).update(chat_id=None, is_verified=False)
            return Response({
                'success': True,
                'chat_id': chat_id,
                'is_verified': False,
                'message': 'Simulated Telegram chat unlinked.',
                'events': []
            })

        if action == 'connect_admin':
            admin_user = User.objects.filter(is_superuser=True).first() or User.objects.filter(email='admin@crmlite.com').first()
            if admin_user:
                profile, _ = TelegramProfile.objects.get_or_create(user=admin_user)
                profile.chat_id = chat_id
                profile.telegram_username = username
                profile.first_name = first_name
                profile.last_name = last_name
                profile.is_verified = True
                profile.verification_code = None
                profile.save()

        # Handle direct PIN entry helper
        if pin and not text:
            text = f"/connect {pin}"

        # If user passed auto_connect_email
        auto_connect_email = data.get('auto_connect_email')
        if auto_connect_email:
            target_user = User.objects.filter(email=auto_connect_email).first()
            if target_user:
                profile, _ = TelegramProfile.objects.get_or_create(user=target_user)
                profile.chat_id = chat_id
                profile.telegram_username = username
                profile.first_name = first_name
                profile.last_name = last_name
                profile.is_verified = True
                profile.verification_code = None
                profile.save()

        capture_client = CaptureTelegramClient()
        handler = TelegramUpdateHandler(client=capture_client)

        now_ts = int(time.time())
        if callback_data:
            update = {
                'update_id': now_ts,
                'callback_query': {
                    'id': f"cb_{uuid.uuid4().hex[:8]}",
                    'from': {
                        'id': chat_id,
                        'is_bot': False,
                        'first_name': first_name,
                        'last_name': last_name,
                        'username': username,
                    },
                    'message': {
                        'message_id': message_id,
                        'chat': {
                            'id': chat_id,
                            'first_name': first_name,
                            'username': username,
                            'type': 'private'
                        },
                        'text': data.get('message_text', '')
                    },
                    'data': callback_data
                }
            }
        elif text:
            update = {
                'update_id': now_ts,
                'message': {
                    'message_id': message_id,
                    'from': {
                        'id': chat_id,
                        'is_bot': False,
                        'first_name': first_name,
                        'last_name': last_name,
                        'username': username,
                    },
                    'chat': {
                        'id': chat_id,
                        'first_name': first_name,
                        'username': username,
                        'type': 'private'
                    },
                    'text': text,
                    'date': now_ts
                }
            }
        elif action == 'connect_admin':
            # Send initial greeting for newly connected admin
            handler._send_account_status(chat_id, profile)
            update = None
        else:
            return Response({'success': False, 'message': 'Neither text, callback_data, nor valid action provided.'}, status=status.HTTP_400_BAD_REQUEST)

        if update:
            handler.handle_update(update)

        # Check updated verification state
        active_profile = TelegramProfile.objects.filter(chat_id=chat_id, is_verified=True).select_related('user').first()
        bot_username = getattr(settings, 'TELEGRAM_BOT_USERNAME', 'mycrm_sales_copilot_bot')

        return Response({
            'success': True,
            'chat_id': chat_id,
            'bot_username': f"@{bot_username.lstrip('@')}",
            'is_verified': bool(active_profile),
            'crm_user': {
                'email': active_profile.user.email,
                'name': active_profile.user.get_full_name() or active_profile.user.email,
                'role': active_profile.user.role,
            } if active_profile else None,
            'events': capture_client.events,
            'toast': capture_client.last_toast
        })

