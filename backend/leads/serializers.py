import re
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from .models import Lead, LeadStage, LeadSource, LeadNote, LeadHandover

User = get_user_model()

class LeadSourceSerializer(serializers.ModelSerializer):
    leads_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = LeadSource
        fields = ['id', 'name', 'description', 'is_active', 'created_at', 'leads_count']
        read_only_fields = ['id', 'created_at']


class LeadStageSerializer(serializers.ModelSerializer):
    leads_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = LeadStage
        fields = [
            'id',
            'name',
            'slug',
            'description',
            'color',
            'display_order',
            'is_active',
            'is_system',
            'created_at',
            'updated_at',
            'leads_count',
        ]
        read_only_fields = ['id', 'slug', 'created_at', 'updated_at', 'leads_count']

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("Stage name cannot be empty or contain only whitespace.")
        
        qs = LeadStage.objects.filter(name__iexact=name)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError("A lead stage with this name already exists.")
        return name

    def validate_color(self, value):
        if not value or not value.strip():
            return '#6366F1'
        val = value.strip()
        if not re.match(r'^#(?:[0-9a-fA-F]{3}){1,2}$', val) and not re.match(r'^[a-zA-Z]+$', val):
            raise serializers.ValidationError("Please provide a valid color value (e.g. #6366F1).")
        return val

    def validate_display_order(self, value):
        if value is None or value < 1:
            raise serializers.ValidationError("Display order must be a valid positive number.")
        return value

    def create(self, validated_data):
        from django.utils.text import slugify
        name = validated_data['name']
        base_slug = slugify(name) or 'stage'
        slug = base_slug
        counter = 1
        while LeadStage.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        validated_data['slug'] = slug
        return super().create(validated_data)

    def update(self, instance, validated_data):
        from django.utils.text import slugify
        if 'name' in validated_data and validated_data['name'] != instance.name:
            if not instance.is_system:
                base_slug = slugify(validated_data['name']) or 'stage'
                slug = base_slug
                counter = 1
                while LeadStage.objects.filter(slug=slug).exclude(id=instance.id).exists():
                    slug = f"{base_slug}-{counter}"
                    counter += 1
                validated_data['slug'] = slug
        return super().update(instance, validated_data)


class UserSimpleSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'role']


class LeadNoteSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = LeadNote
        fields = ['id', 'lead', 'user', 'user_name', 'user_email', 'note_type', 'note_text', 'created_at']
        read_only_fields = ['id', 'lead', 'user', 'created_at']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated and 'user' not in validated_data:
            validated_data['user'] = request.user
        return super().create(validated_data)


class LeadHandoverSerializer(serializers.ModelSerializer):
    lead_name = serializers.CharField(source='lead.name', read_only=True)
    previous_assignee_details = UserSimpleSerializer(source='previous_assignee', read_only=True)
    new_assignee_details = UserSimpleSerializer(source='new_assignee', read_only=True)
    handed_over_by_details = UserSimpleSerializer(source='handed_over_by', read_only=True)

    class Meta:
        model = LeadHandover
        fields = [
            'id',
            'lead',
            'lead_name',
            'previous_assignee',
            'previous_assignee_details',
            'new_assignee',
            'new_assignee_details',
            'reason',
            'handed_over_by',
            'handed_over_by_details',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class LeadHandoverRequestSerializer(serializers.Serializer):
    new_assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        required=True
    )
    reason = serializers.CharField(required=True, allow_blank=False, min_length=1)

    def validate_reason(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError("A handover reason is required.")
        return value.strip()

    def validate_new_assigned_to(self, target_user):
        if not target_user.is_active:
            raise serializers.ValidationError("Cannot hand over lead to an inactive user.")
        if target_user.role != User.Role.EXECUTIVE:
            raise serializers.ValidationError("Cannot hand over lead to a non-executive. Target user must have Sales Executive role.")
        return target_user


class LeadListSerializer(serializers.ModelSerializer):
    source_name = serializers.CharField(source='source.name', read_only=True)
    assigned_to_details = UserSimpleSerializer(source='assigned_to', read_only=True)
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    stage_details = LeadStageSerializer(source='stage', read_only=True)
    status = serializers.CharField(source='stage.name', read_only=True)
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
            'stage',
            'stage_name',
            'stage_details',
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
    stage_details = LeadStageSerializer(source='stage', read_only=True)
    status = serializers.CharField(source='stage.name', read_only=True)
    notes = LeadNoteSerializer(many=True, read_only=True)
    handovers = LeadHandoverSerializer(many=True, read_only=True)
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
            'stage',
            'stage_details',
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
            'handovers',
            'customer_id',
        ]


class LeadCreateUpdateSerializer(serializers.ModelSerializer):
    stage = serializers.PrimaryKeyRelatedField(
        queryset=LeadStage.objects.all(),
        required=False,
        allow_null=True
    )
    status = serializers.CharField(required=False, write_only=True, allow_blank=True)

    class Meta:
        model = Lead
        fields = [
            'id',
            'name',
            'phone',
            'email',
            'company_name',
            'source',
            'stage',
            'status',
            'priority',
            'assigned_to',
            'expected_value',
            'address',
            'lost_reason',
        ]

    def to_internal_value(self, data):
        internal = super().to_internal_value(data)
        if 'stage' not in internal and 'status' in data and data['status']:
            raw_st = str(data['status']).strip()
            found = None
            if raw_st.isdigit():
                found = LeadStage.objects.filter(id=int(raw_st)).first()
            if not found:
                found = LeadStage.objects.filter(
                    models.Q(slug__iexact=raw_st.lower().replace('_', '-')) |
                    models.Q(slug__iexact=raw_st) |
                    models.Q(name__iexact=raw_st)
                ).first()
            if found:
                internal['stage'] = found
        return internal

    def validate_phone(self, value):
        if not value:
            raise serializers.ValidationError("Phone number is required.")
        digits = re.sub(r'\D', '', value)
        if len(digits) < 7:
            raise serializers.ValidationError("Please provide a valid phone number (minimum 7 digits).")
        
        instance = getattr(self, 'instance', None)
        qs = Lead.objects.filter(phone=value).exclude(stage__slug__in=['won', 'lost'])
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
        stage_val = attrs.get('stage', getattr(self.instance, 'stage', None))
        lost_reason = attrs.get('lost_reason', getattr(self.instance, 'lost_reason', None))

        # Check inactive stage selection
        is_create = self.instance is None
        stage_changed = self.instance and ('stage' in attrs and attrs['stage'] != self.instance.stage)
        if (is_create or stage_changed) and stage_val and not stage_val.is_active:
            raise serializers.ValidationError({"stage": f"The stage '{stage_val.name}' is inactive and cannot be selected."})

        # Check lost reason
        is_lost = stage_val and (stage_val.slug == 'lost' or stage_val.name.lower() == 'lost')
        if is_lost and not (lost_reason and lost_reason.strip()):
            raise serializers.ValidationError({"lost_reason": "A reason is mandatory when marking a lead as Lost."})

        # Role-based validation for assignment
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if 'assigned_to' in attrs:
                new_assignee = attrs['assigned_to']
                old_assignee = getattr(self.instance, 'assigned_to', None) if self.instance else None
                if self.instance and new_assignee != old_assignee:
                    if request.user.role == 'EXECUTIVE' and not request.user.is_superuser:
                        raise serializers.ValidationError({"assigned_to": "Only Managers and Admins can reassign leads."})
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        if 'stage' not in validated_data or not validated_data['stage']:
            default_stage = LeadStage.objects.filter(is_system=True, slug='new').first() or LeadStage.objects.filter(is_active=True).order_by('display_order').first()
            validated_data['stage'] = default_stage

        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
            if not validated_data.get('assigned_to') and request.user.role == 'EXECUTIVE':
                validated_data['assigned_to'] = request.user
        return super().create(validated_data)


class LeadAssignSerializer(serializers.Serializer):
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        required=True
    )


class LeadStatusChangeSerializer(serializers.Serializer):
    stage = serializers.PrimaryKeyRelatedField(queryset=LeadStage.objects.all(), required=False)
    status = serializers.CharField(required=False, allow_blank=True)
    lost_reason = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        stage = attrs.get('stage')
        raw_status = attrs.get('status')
        if not stage and raw_status:
            raw_st = str(raw_status).strip()
            stage = LeadStage.objects.filter(
                models.Q(slug__iexact=raw_st.lower().replace('_', '-')) |
                models.Q(slug__iexact=raw_st) |
                models.Q(name__iexact=raw_st)
            ).first()
            if stage:
                attrs['stage'] = stage

        if not attrs.get('stage'):
            raise serializers.ValidationError({"stage": "A valid lead stage is required."})

        resolved_stage = attrs['stage']
        is_lost = resolved_stage and (resolved_stage.slug == 'lost' or resolved_stage.name.lower() == 'lost')
        if is_lost and not attrs.get('lost_reason', '').strip():
            raise serializers.ValidationError({"lost_reason": "Reason is required when marking a lead as Lost."})
        return attrs
