from rest_framework import serializers
from .models import ActivityLog

class ActivityLogSerializer(serializers.ModelSerializer):
    performer_name = serializers.SerializerMethodField()
    performer_email = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = [
            'id', 'entity_type', 'entity_id', 'action',
            'old_value', 'new_value', 'notes',
            'performed_by', 'performer_name', 'performer_email',
            'created_at'
        ]

    def get_performer_name(self, obj):
        if obj.performed_by:
            return obj.performed_by.get_full_name() or obj.performed_by.email
        return 'System'

    def get_performer_email(self, obj):
        return obj.performed_by.email if obj.performed_by else None
