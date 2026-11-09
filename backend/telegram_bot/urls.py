from django.urls import path
from .views import (
    TelegramWebhookView,
    TelegramStatusView,
    TelegramGenerateLinkCodeView,
    TelegramUpdatePreferencesView,
    TelegramDisconnectView,
    TelegramSendTestMessageView,
    TelegramSimulateView,
)

app_name = 'telegram_bot'

urlpatterns = [
    # Webhook endpoint called by Telegram server
    path('webhook/', TelegramWebhookView.as_view(), name='telegram-webhook'),

    # Mobile UI Simulator endpoint
    path('simulate/', TelegramSimulateView.as_view(), name='telegram-simulate'),

    # CRM Authenticated API endpoints for frontend
    path('status/', TelegramStatusView.as_view(), name='telegram-status'),
    path('generate-link-code/', TelegramGenerateLinkCodeView.as_view(), name='telegram-generate-code'),
    path('preferences/', TelegramUpdatePreferencesView.as_view(), name='telegram-preferences'),
    path('disconnect/', TelegramDisconnectView.as_view(), name='telegram-disconnect'),
    path('test-message/', TelegramSendTestMessageView.as_view(), name='telegram-test-message'),
]

