from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import ChatMessage

User = get_user_model()


class ChatUserSummarySerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'role', 'is_active']

    def get_full_name(self, obj):
        name = obj.get_full_name()
        return name if name.strip() else obj.email.split('@')[0]


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.SerializerMethodField()
    sender_email = serializers.CharField(source='sender.email', read_only=True)
    sender_role = serializers.CharField(source='sender.role', read_only=True)
    recipient_name = serializers.SerializerMethodField()
    recipient_email = serializers.CharField(source='recipient.email', read_only=True)
    recipient_role = serializers.CharField(source='recipient.role', read_only=True)
    is_me = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = [
            'id',
            'sender',
            'sender_name',
            'sender_email',
            'sender_role',
            'recipient',
            'recipient_name',
            'recipient_email',
            'recipient_role',
            'message',
            'is_read',
            'read_at',
            'created_at',
            'is_me',
        ]
        read_only_fields = ['id', 'sender', 'is_read', 'read_at', 'created_at']

    def get_sender_name(self, obj):
        name = obj.sender.get_full_name()
        return name if name.strip() else obj.sender.email.split('@')[0]

    def get_recipient_name(self, obj):
        name = obj.recipient.get_full_name()
        return name if name.strip() else obj.recipient.email.split('@')[0]

    def get_is_me(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.sender_id == request.user.id
        return False


class ChatMessageCreateSerializer(serializers.ModelSerializer):
    recipient = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        required=True
    )
    message = serializers.CharField(
        required=True,
        allow_blank=False,
        trim_whitespace=True,
        max_length=5000
    )

    class Meta:
        model = ChatMessage
        fields = ['recipient', 'message']

    def validate_recipient(self, value):
        request = self.context.get('request')
        if request and request.user == value:
            raise serializers.ValidationError("You cannot start a direct chat with yourself.")
        return value


class ConversationSerializer(serializers.Serializer):
    user = ChatUserSummarySerializer()
    last_message = serializers.CharField(allow_null=True)
    last_message_at = serializers.DateTimeField(allow_null=True)
    last_message_sender_id = serializers.IntegerField(allow_null=True)
    unread_count = serializers.IntegerField()
