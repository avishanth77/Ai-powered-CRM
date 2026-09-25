from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Notification

User = get_user_model()


class NotificationActorSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name']


class NotificationSerializer(serializers.ModelSerializer):
    actor_details = NotificationActorSerializer(source='actor', read_only=True)
    notification_type_display = serializers.CharField(source='get_notification_type_display', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id',
            'recipient',
            'actor',
            'actor_details',
            'notification_type',
            'notification_type_display',
            'title',
            'message',
            'entity_type',
            'entity_id',
            'action_url',
            'priority',
            'is_read',
            'read_at',
            'created_at',
        ]
        read_only_fields = [
            'id',
            'recipient',
            'actor',
            'notification_type',
            'notification_type_display',
            'title',
            'message',
            'entity_type',
            'entity_id',
            'action_url',
            'priority',
            'created_at',
            'read_at',
        ]
