import logging
from django.conf import settings
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
        bot_username = getattr(settings, 'TELEGRAM_BOT_USERNAME', 'CrmLiteCopilotBot').lstrip('@')
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
