import re
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import Lead, LeadSource, LeadNote

User = get_user_model()

class LeadSourceSerializer(serializers.ModelSerializer):
    leads_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = LeadSource
        fields = ['id', 'name', 'description', 'is_active', 'created_at', 'leads_count']
        read_only_fields = ['id', 'created_at']


class LeadNoteSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = LeadNote
        fields = ['id', 'lead', 'user', 'user_name', 'user_email', 'note_type', 'note_text', 'created_at']
        read_only_fields = ['id', 'user', 'created_at']

    def create(self, validated_data):
        # Automatically set current request user
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['user'] = request.user
        return super().create(validated_data)


class UserSimpleSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'role']


class LeadListSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source='source.name', read_only=True)
    assigned_to_details = UserSimpleSerializer(source='assigned_to', read_only=True)
    notes_count = serializers.IntegerField(read_only=True, default=0)
    pending_followups_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Lead
        fields = [
            'id',
            'name',
            'phone',
            'email',
            'company_name',
            'source',
            'source_name',
            'status',
            'priority',
            'assigned_to',
            'assigned_to_details',
            'expected_value',
            'created_at',
            'updated_at',
            'converted_at',
            'lost_reason',
            'notes_count',
            'pending_followups_count',
        ]


class LeadDetailSerializer(serializers.ModelSerializer):
    source_details = LeadSourceSerializer(source='source', read_only=True)
    assigned_to_details = UserSimpleSerializer(source='assigned_to', read_only=True)
    created_by_details = UserSimpleSerializer(source='created_by', read_only=True)
    notes = LeadNoteSerializer(many=True, read_only=True)
    customer_id = serializers.IntegerField(source='customer_profile.id', read_only=True, default=None)

    class Meta:
        model = Lead
        fields = [
            'id',
            'name',
            'phone',
            'email',
            'company_name',
            'source',
            'source_details',
            'status',
            'priority',
            'assigned_to',
            'assigned_to_details',
            'expected_value',
            'address',
            'created_by',
            'created_by_details',
            'created_at',
            'updated_at',
            'converted_at',
            'lost_reason',
            'notes',
            'customer_id',
        ]


class LeadCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = [
            'id',
            'name',
            'phone',
            'email',
            'company_name',
            'source',
            'status',
            'priority',
            'assigned_to',
            'expected_value',
            'address',
            'lost_reason',
        ]

    def validate_phone(self, value):
        if not value:
            raise serializers.ValidationError("Phone number is required.")
        # Basic validation: ensure phone has at least 7 digits
        digits = re.sub(r'\D', '', value)
        if len(digits) < 7:
            raise serializers.ValidationError("Please provide a valid phone number (minimum 7 digits).")
        
        # Check duplicate phone for active leads
        instance = getattr(self, 'instance', None)
        qs = Lead.objects.filter(phone=value).exclude(status__in=[Lead.Status.WON, Lead.Status.LOST])
        if instance:
            qs = qs.exclude(id=instance.id)
        if qs.exists():
            raise serializers.ValidationError("An active lead with this phone number already exists.")
        return value

    def validate_expected_value(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Expected value cannot be negative.")
        return value

    def validate(self, attrs):
        status_val = attrs.get('status', getattr(self.instance, 'status', None))
        lost_reason = attrs.get('lost_reason', getattr(self.instance, 'lost_reason', None))

        if status_val == Lead.Status.LOST and not (lost_reason and lost_reason.strip()):
            raise serializers.ValidationError({"lost_reason": "A reason is mandatory when marking a lead as Lost."})

        # Role-based validation for assignment
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            # Executive cannot reassign leads
            if 'assigned_to' in attrs:
                new_assignee = attrs['assigned_to']
                old_assignee = getattr(self.instance, 'assigned_to', None) if self.instance else None
                if self.instance and new_assignee != old_assignee:
                    if request.user.role == 'EXECUTIVE' and not request.user.is_superuser:
                        raise serializers.ValidationError({"assigned_to": "Only Managers and Admins can reassign leads."})
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
            # If executive creates lead and no assignee given, assign to self
            if not validated_data.get('assigned_to') and request.user.role == 'EXECUTIVE':
                validated_data['assigned_to'] = request.user
        return super().create(validated_data)


class LeadAssignSerializer(serializers.Serializer):
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        required=True
    )


class LeadStatusChangeSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Lead.Status.choices)
    lost_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get('status') == Lead.Status.LOST and not attrs.get('lost_reason', '').strip():
            raise serializers.ValidationError({"lost_reason": "Reason is required when marking a lead as Lost."})
        return attrs
