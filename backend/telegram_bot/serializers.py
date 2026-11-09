from rest_framework import serializers
from django.conf import settings
from .models import TelegramProfile


class TelegramProfileSerializer(serializers.ModelSerializer):
    bot_username = serializers.SerializerMethodField()
    is_bot_configured = serializers.SerializerMethodField()

    class Meta:
        model = TelegramProfile
        fields = [
            'id',
            'chat_id',
            'telegram_username',
            'first_name',
            'last_name',
            'is_verified',
            'notify_new_leads',
            'notify_followups',
            'notify_stage_changes',
            'bot_username',
            'is_bot_configured',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'chat_id', 'telegram_username', 'first_name', 'last_name',
            'is_verified', 'created_at', 'updated_at'
        ]

    def get_bot_username(self, obj) -> str:
        return getattr(settings, 'TELEGRAM_BOT_USERNAME', 'CrmLiteCopilotBot')

    def get_is_bot_configured(self, obj) -> bool:
        token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
        return bool(token and len(token.strip()) > 10)


class TelegramPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = TelegramProfile
        fields = [
            'notify_new_leads',
            'notify_followups',
            'notify_stage_changes',
        ]


class TelegramLinkCodeResponseSerializer(serializers.Serializer):
    code = serializers.CharField()
    bot_username = serializers.CharField()
    deep_link = serializers.CharField()
    expires_in_minutes = serializers.IntegerField(default=15)

