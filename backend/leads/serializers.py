import re
import json
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from .models import (
    Lead,
    LeadStage,
    LeadSource,
    LeadNote,
    LeadHandover,
    StageTaskRule,
    LeadStageTask,
    CustomPropertyDefinition,
    CustomPropertyValue,
    LeadAssignmentConfig,
    LeadAssignmentRule,
)
from accounts.serializers import UserSerializer

User = get_user_model()

class LeadSourceSerializer(serializers.ModelSerializer):
    leads_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = LeadSource
        fields = ['id', 'name', 'description', 'is_active', 'created_at', 'leads_count']
        read_only_fields = ['id', 'created_at']


class LeadStageSerializer(serializers.ModelSerializer):
    leads_count = serializers.IntegerField(read_only=True, default=0)
    task_rules_count = serializers.IntegerField(read_only=True, default=0)

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
            'require_manager_approval',
            'win_probability',
            'win_probability_reason',
            'created_at',
            'updated_at',
            'leads_count',
            'task_rules_count',
        ]
        read_only_fields = ['id', 'slug', 'created_at', 'updated_at', 'leads_count', 'task_rules_count']

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
        from django.db import transaction
        from django.utils.text import slugify
        from .services.stage_ordering import shift_stages_for_insert, resequence_stages

        name = validated_data['name']
        base_slug = slugify(name) or 'stage'
        slug = base_slug
        counter = 1
        while LeadStage.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        validated_data['slug'] = slug

        with transaction.atomic():
            target_order = validated_data.get('display_order')
            if target_order is None:
                max_order = LeadStage.objects.aggregate(m=models.Max('display_order'))['m'] or 0
                target_order = max_order + 1
                validated_data['display_order'] = target_order
            else:
                shift_stages_for_insert(target_order)

            instance = super().create(validated_data)
            resequence_stages()
            instance.refresh_from_db()
            return instance

    def update(self, instance, validated_data):
        from django.db import transaction
        from django.utils.text import slugify
        from .services.stage_ordering import shift_stages_for_update, resequence_stages

        if 'name' in validated_data and validated_data['name'] != instance.name:
            if not instance.is_system:
                base_slug = slugify(validated_data['name']) or 'stage'
                slug = base_slug
                counter = 1
                while LeadStage.objects.filter(slug=slug).exclude(id=instance.id).exists():
                    slug = f"{base_slug}-{counter}"
                    counter += 1
                validated_data['slug'] = slug

        new_order = validated_data.get('display_order')
        old_order = instance.display_order

        with transaction.atomic():
            if new_order is not None and new_order != old_order:
                if new_order < 1:
                    new_order = 1
                    validated_data['display_order'] = 1
                shift_stages_for_update(instance.id, new_order, old_order)

            instance = super().update(instance, validated_data)
            resequence_stages()
            instance.refresh_from_db()
            return instance


class CustomPropertyDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomPropertyDefinition
        fields = [
            'id',
            'name',
            'label',
            'field_type',
            'section',
            'options',
            'is_mandatory',
            'is_active',
            'display_order',
            'placeholder',
            'help_text',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        from django.utils.text import slugify
        val = slugify(value.strip()).replace('-', '_')
        if not val:
            raise serializers.ValidationError("Field machine key must contain valid alphanumeric characters.")
        qs = CustomPropertyDefinition.objects.filter(name=val)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError(f"A property with key '{val}' already exists.")
        return val


class CustomPropertyValueSerializer(serializers.ModelSerializer):
    property_details = CustomPropertyDefinitionSerializer(source='property_def', read_only=True)

    class Meta:
        model = CustomPropertyValue
        fields = [
            'id',
            'lead',
            'property_def',
            'property_details',
            'value_text',
            'value_json',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


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

    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = data.copy()
            if 'note' in data and 'note_text' not in data:
                data['note_text'] = data.get('note')
            elif 'notes' in data and 'note_text' not in data:
                data['note_text'] = data.get('notes')
        return super().to_internal_value(data)

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
    stage_task_summary = serializers.SerializerMethodField()
    win_probability = serializers.IntegerField(source='effective_win_probability', read_only=True)
    win_probability_reason = serializers.CharField(source='effective_win_probability_reason', read_only=True)
    weighted_value = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    products = serializers.SerializerMethodField(read_only=True)
    product_ids = serializers.SerializerMethodField(read_only=True)

    def get_stage_task_summary(self, obj):
        return obj.get_stage_task_summary()

    def get_products(self, obj):
        return [
            {
                'id': lp.product_id,
                'lead_product_id': lp.id,
                'name': lp.product.name,
                'code': lp.product.code,
                'category': lp.product.category,
                'unit_price': float(lp.unit_price),
                'quantity': lp.quantity,
                'discount_percent': float(lp.discount_percent),
                'total_price': float(lp.total_price),
                'currency': lp.product.currency,
                'billing_cycle': lp.product.billing_cycle,
                'notes': lp.notes,
            }
            for lp in obj.lead_products.select_related('product').all()
        ]

    def get_product_ids(self, obj):
        return [lp.product_id for lp in obj.lead_products.all()]

    class Meta:
        model = Lead
        fields = [
            'id',
            'name',
            'first_name',
            'last_name',
            'job_title',
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
            'lead_score',
            'buying_intent',
            'lead_type',
            'expected_close_date',
            'created_at',
            'updated_at',
            'converted_at',
            'lost_reason',
            'notes_count',
            'pending_followups_count',
            'stage_task_summary',
            'icp_status',
            'pld_score',
            'pld_status',
            'win_probability',
            'win_probability_reason',
            'weighted_value',
            'win_probability_override',
            'products',
            'product_ids',
        ]


class LeadDetailSerializer(serializers.ModelSerializer):
    source_details = LeadSourceSerializer(source='source', read_only=True)
    assigned_to_details = UserSimpleSerializer(source='assigned_to', read_only=True)
    created_by_details = UserSimpleSerializer(source='created_by', read_only=True)
    stage_details = LeadStageSerializer(source='stage', read_only=True)
    previous_stage_details = LeadStageSerializer(source='previous_stage', read_only=True)
    status = serializers.CharField(source='stage.name', read_only=True)
    notes = LeadNoteSerializer(many=True, read_only=True)
    handovers = LeadHandoverSerializer(many=True, read_only=True)
    customer_id = serializers.IntegerField(source='customer_profile.id', read_only=True, default=None)
    stage_task_summary = serializers.SerializerMethodField()
    win_probability = serializers.IntegerField(source='effective_win_probability', read_only=True)
    win_probability_reason = serializers.CharField(source='effective_win_probability_reason', read_only=True)
    weighted_value = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    products = serializers.SerializerMethodField(read_only=True)
    product_ids = serializers.SerializerMethodField(read_only=True)
    custom_properties = serializers.SerializerMethodField(read_only=True)

    def get_custom_properties(self, obj):
        defs = CustomPropertyDefinition.objects.filter(is_active=True).order_by('section', 'display_order', 'id')
        val_map = {val.property_def_id: val for val in obj.custom_property_values.all()}
        res = []
        for prop_def in defs:
            v = val_map.get(prop_def.id)
            val_txt = v.value_text if v else ''
            val_json = v.value_json if v else None
            disp = val_txt if val_txt else (json.dumps(val_json) if val_json is not None else '')
            res.append({
                'id': prop_def.id,
                'name': prop_def.name,
                'label': prop_def.label,
                'field_type': prop_def.field_type,
                'section': prop_def.section,
                'options': prop_def.options,
                'is_mandatory': prop_def.is_mandatory,
                'placeholder': prop_def.placeholder,
                'help_text': prop_def.help_text,
                'value_text': val_txt,
                'value_json': val_json,
                'display_value': disp,
            })
        return res

    def get_products(self, obj):
        return [
            {
                'id': lp.product_id,
                'lead_product_id': lp.id,
                'name': lp.product.name,
                'code': lp.product.code,
                'category': lp.product.category,
                'unit_price': float(lp.unit_price),
                'quantity': lp.quantity,
                'discount_percent': float(lp.discount_percent),
                'total_price': float(lp.total_price),
                'currency': lp.product.currency,
                'billing_cycle': lp.product.billing_cycle,
                'notes': lp.notes,
            }
            for lp in obj.lead_products.select_related('product').all()
        ]

    def get_product_ids(self, obj):
        return [lp.product_id for lp in obj.lead_products.all()]

    def get_stage_task_summary(self, obj):
        return obj.get_stage_task_summary()

    class Meta:
        model = Lead
        fields = [
            'id',
            'name',
            # Contact Information
            'first_name',
            'last_name',
            'mobile_phone',
            'phone',
            'email',
            'job_title',
            'department',
            'linkedin_url',
            'buying_role',
            # Company Information
            'company_name',
            'website',
            'industry',
            'company_size',
            'annual_revenue',
            'country',
            'state',
            'city',
            'address',
            # Lead Qualification
            'lead_score',
            'buying_intent',
            'estimated_budget',
            'customer_requirements',
            'purchasing_timeline',
            'decision_maker',
            'competitor_info',
            'qualification_notes',
            # Sales Information
            'lead_type',
            'source',
            'source_details',
            'stage',
            'stage_details',
            'previous_stage',
            'previous_stage_details',
            'stage_entered_at',
            'expected_close_date',
            'next_followup_date',
            'status',
            'priority',
            'assigned_to',
            'assigned_to_details',
            'expected_value',
            'created_by',
            'created_by_details',
            'created_at',
            'updated_at',
            'converted_at',
            'lost_reason',
            'notes',
            'handovers',
            'customer_id',
            'stage_task_summary',
            'icp_status',
            'pld_score',
            'pld_status',
            'win_probability',
            'win_probability_reason',
            'weighted_value',
            'win_probability_override',
            'products',
            'product_ids',
            # Dynamic Custom Properties
            'custom_properties',
        ]


def _check_stage_gate(lead, stage):
    """
    Return the unmet PLD gate requirements for placing ``lead`` into ``stage``.

    Imported lazily so the ``leads`` app never pulls in ``pld`` at module load.
    A lead that has not been saved yet starts from the untouched defaults.
    """
    from pld.services.gates import check_gate

    if lead is None:
        lead = Lead(icp_status=Lead.ICPStatus.NOT_TESTED, pld_status=Lead.PLDStatus.NOT_ASSESSED)
    return check_gate(lead, stage)


def _save_custom_properties(lead, custom_props):
    if not custom_props or not isinstance(custom_props, dict):
        return
    for prop_key, prop_val in custom_props.items():
        lookup = models.Q(name=str(prop_key))
        if str(prop_key).isdigit():
            lookup |= models.Q(id=int(prop_key))
        prop_def = CustomPropertyDefinition.objects.filter(lookup).first()
        if not prop_def:
            continue
        val_obj, _ = CustomPropertyValue.objects.get_or_create(lead=lead, property_def=prop_def)
        if isinstance(prop_val, (dict, list)):
            val_obj.value_json = prop_val
            val_obj.value_text = json.dumps(prop_val)
        else:
            val_obj.value_text = str(prop_val) if prop_val is not None else ''
            val_obj.value_json = None
        val_obj.save()


class LeadCreateUpdateSerializer(serializers.ModelSerializer):
    stage = serializers.PrimaryKeyRelatedField(
        queryset=LeadStage.objects.all(),
        required=False,
        allow_null=True
    )
    status = serializers.CharField(required=False, write_only=True, allow_blank=True)
    name = serializers.CharField(required=False, allow_blank=True, default='')
    phone = serializers.CharField(required=False, allow_blank=True, default='')
    product_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        write_only=True
    )
    custom_properties = serializers.DictField(
        required=False,
        write_only=True
    )

    class Meta:
        model = Lead
        fields = [
            'id',
            'name',
            # Contact Information
            'first_name',
            'last_name',
            'mobile_phone',
            'phone',
            'email',
            'job_title',
            'department',
            'linkedin_url',
            'buying_role',
            # Company Information
            'company_name',
            'website',
            'industry',
            'company_size',
            'annual_revenue',
            'country',
            'state',
            'city',
            'address',
            # Lead Qualification
            'lead_score',
            'buying_intent',
            'estimated_budget',
            'customer_requirements',
            'purchasing_timeline',
            'decision_maker',
            'competitor_info',
            'qualification_notes',
            # Sales Information
            'lead_type',
            'source',
            'stage',
            'status',
            'priority',
            'assigned_to',
            'expected_value',
            'lost_reason',
            'expected_close_date',
            'next_followup_date',
            'win_probability_override',
            'win_probability_reason',
            'product_ids',
            # Dynamic Custom Properties
            'custom_properties',
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
        if not value or not str(value).strip():
            return ""
        val = str(value).strip()
        if val.upper() in ('N/A', 'NONE', 'NOT PROVIDED', '-', 'UNKNOWN', 'NULL', 'NO PHONE'):
            return ""
        digits = re.sub(r'\D', '', val)
        if len(digits) < 7:
            raise serializers.ValidationError("Please provide a valid phone number (minimum 7 digits).")
        
        instance = getattr(self, 'instance', None)
        qs = Lead.objects.filter(phone=val).exclude(stage__slug__in=['won', 'lost'])
        if instance:
            qs = qs.exclude(id=instance.id)
        if qs.exists():
            raise serializers.ValidationError("An active lead with this phone number already exists.")
        return val

    def validate_expected_value(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Expected value cannot be negative.")
        return value

    def validate(self, attrs):
        # Ensure at least one direct contact detail (Email Address or Work Phone / Mobile) is provided
        email_val = attrs.get('email') if 'email' in attrs else getattr(self.instance, 'email', None)
        phone_val = attrs.get('phone') if 'phone' in attrs else getattr(self.instance, 'phone', None)
        mobile_val = attrs.get('mobile_phone') if 'mobile_phone' in attrs else getattr(self.instance, 'mobile_phone', None)

        def is_meaningful_contact(val):
            if not val:
                return False
            s = str(val).strip()
            return bool(s and s.upper() not in ('NONE', 'NULL', 'N/A', '-', 'NOT PROVIDED', 'UNKNOWN', 'NO PHONE'))

        has_email = is_meaningful_contact(email_val)
        has_phone = is_meaningful_contact(phone_val) or is_meaningful_contact(mobile_val)

        if not has_email and not has_phone:
            raise serializers.ValidationError({
                "contact": "Please provide at least one contact detail: Email Address or Work Phone.",
                "email": "Email address or work phone is required.",
                "phone": "Work phone or email address is required."
            })

        # Auto-generate or synchronize name with first_name and last_name
        name_val = attrs.get('name')
        first_val = attrs.get('first_name') or (getattr(self.instance, 'first_name', '') if self.instance else '')
        last_val = attrs.get('last_name') or (getattr(self.instance, 'last_name', '') if self.instance else '')

        if (first_val or last_val) and (not name_val or not str(name_val).strip() or str(name_val).strip() == 'Prospect Lead'):
            attrs['name'] = f"{first_val} {last_val}".strip()
        elif not name_val or not str(name_val).strip():
            company_val = attrs.get('company_name') or getattr(self.instance, 'company_name', None)
            email_val = attrs.get('email') or getattr(self.instance, 'email', None)
            phone_val = attrs.get('phone') or getattr(self.instance, 'phone', None)
            if company_val and str(company_val).strip():
                attrs['name'] = f"{str(company_val).strip()} Contact"
            elif email_val and str(email_val).strip():
                local_part = str(email_val).split('@')[0].replace('.', ' ').replace('_', ' ').title()
                attrs['name'] = local_part or "Prospect Lead"
            elif phone_val and str(phone_val).strip():
                attrs['name'] = f"Lead {str(phone_val).strip()}"
            else:
                attrs['name'] = "Prospect Lead"

        # Split name into first_name / last_name if they are blank
        if attrs.get('name') and not attrs.get('first_name') and not attrs.get('last_name'):
            parts = str(attrs['name']).strip().split(' ', 1)
            attrs['first_name'] = parts[0]
            if len(parts) > 1:
                attrs['last_name'] = parts[1]

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

        # Task-Based Lead Progression:
        # A lead may not advance to a new stage unless all mandatory tasks
        # assigned to its current stage have been completed.
        if stage_val and stage_changed and self.instance:
            from leads.services.progression import check_stage_progression
            request = self.context.get('request')
            actor = request.user if request and request.user.is_authenticated else None
            can_progress, missing_tasks, message = check_stage_progression(
                self.instance, stage_val, actor=actor
            )
            if not can_progress:
                raise serializers.ValidationError({
                    'stage': [message],
                    'missing': ['mandatory_tasks'],
                    'missing_tasks': missing_tasks,
                    'missing_details': missing_tasks,
                    'progression_blocked': True,
                    'current_stage_id': self.instance.stage_id,
                    'current_stage_name': self.instance.stage.name if self.instance.stage else '',
                    'target_stage_id': stage_val.id,
                    'target_stage_name': stage_val.name,
                })

            # PLD stage gates: a lead may not move into a stage whose requirements are unmet.
            missing_gates = _check_stage_gate(self.instance, stage_val)
            if missing_gates:
                raise serializers.ValidationError({
                    'stage': [f"Cannot move to stage '{stage_val.name}': "
                              + ' '.join(item['message'] for item in missing_gates)],
                    'missing': [item['code'] for item in missing_gates],
                    'missing_messages': [item['message'] for item in missing_gates],
                })

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
        product_ids = validated_data.pop('product_ids', None)
        custom_props = validated_data.pop('custom_properties', None)
        request = self.context.get('request')
        if 'stage' not in validated_data or not validated_data['stage']:
            default_stage = LeadStage.objects.filter(is_system=True, slug='new').first() or LeadStage.objects.filter(is_active=True).order_by('display_order').first()
            validated_data['stage'] = default_stage

        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
            if not validated_data.get('assigned_to') and request.user.role == 'EXECUTIVE':
                validated_data['assigned_to'] = request.user
        lead = super().create(validated_data)

        # Auto-assign incoming lead if no salesman was explicitly assigned
        if not lead.assigned_to:
            from leads.services.assignment import assign_lead_to_salesman
            actor = request.user if request and request.user.is_authenticated else None
            assigned_user = assign_lead_to_salesman(lead, channel='manual', actor=actor, commit=True)
            if assigned_user:
                lead._auto_assigned_notified = True

        if custom_props:
            _save_custom_properties(lead, custom_props)

        if product_ids:
            from products.models import Product, LeadProduct
            from django.db.models import Sum
            for pid in product_ids:
                p = Product.objects.filter(id=pid, is_active=True).first()
                if p:
                    LeadProduct.objects.get_or_create(lead=lead, product=p, defaults={'unit_price': p.unit_price, 'quantity': 1})
            total = lead.lead_products.aggregate(s=Sum('total_price'))['s']
            if total and (lead.expected_value == 0 or 'expected_value' not in validated_data):
                lead.expected_value = total
                lead.save(update_fields=['expected_value'])
        return lead

    def to_representation(self, instance):
        return LeadDetailSerializer(instance, context=self.context).data

    def update(self, instance, validated_data):
        product_ids = validated_data.pop('product_ids', None)
        custom_props = validated_data.pop('custom_properties', None)
        lead = super().update(instance, validated_data)

        if custom_props is not None:
            _save_custom_properties(lead, custom_props)

        if product_ids is not None:
            from decimal import Decimal
            from products.models import Product, LeadProduct
            from django.db.models import Sum
            existing_pids = set(lead.lead_products.values_list('product_id', flat=True))
            new_pids = set(product_ids)
            # Remove removed products
            lead.lead_products.exclude(product_id__in=new_pids).delete()
            # Add newly selected products
            for pid in new_pids - existing_pids:
                p = Product.objects.filter(id=pid, is_active=True).first()
                if p:
                    LeadProduct.objects.create(lead=lead, product=p, unit_price=p.unit_price, quantity=1)
            total = lead.lead_products.aggregate(s=Sum('total_price'))['s']
            if 'expected_value' not in validated_data:
                lead.expected_value = total if total is not None else Decimal('0.00')
                lead.save(update_fields=['expected_value'])
            elif total and lead.expected_value == 0:
                lead.expected_value = total
                lead.save(update_fields=['expected_value'])
        return lead


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



class StageTaskRuleSerializer(serializers.ModelSerializer):
    stage_details = LeadStageSerializer(source='stage', read_only=True)
    specific_user_details = UserSerializer(source='specific_user', read_only=True)
    fallback_user_details = UserSerializer(source='fallback_user', read_only=True)
    round_robin_users_details = UserSerializer(source='round_robin_users', many=True, read_only=True)
    created_by_details = UserSerializer(source='created_by', read_only=True)
    dependency_title = serializers.CharField(source='dependency.title', read_only=True, default=None)
    round_robin_user_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(),
        many=True,
        write_only=True,
        required=False,
        source='round_robin_users'
    )

    class Meta:
        model = StageTaskRule
        fields = [
            'id',
            'stage',
            'stage_details',
            'name',
            'purpose',
            'title',
            'description_template',
            'assignee_strategy',
            'specific_user',
            'specific_user_details',
            'fallback_user',
            'fallback_user_details',
            'round_robin_users',
            'round_robin_user_ids',
            'round_robin_users_details',
            'due_offset_value',
            'due_offset_unit',
            'priority_filter',
            'is_mandatory',
            'order',
            'dependency',
            'dependency_title',
            'task_priority',
            'requires_approval',
            'prevent_duplicate',
            'is_active',
            'created_by',
            'created_by_details',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at', 'round_robin_users', 'dependency_title']

    def validate(self, attrs):
        strategy = attrs.get('assignee_strategy', getattr(self.instance, 'assignee_strategy', None))
        specific_user = attrs.get('specific_user', getattr(self.instance, 'specific_user', None))
        if strategy == StageTaskRule.AssigneeStrategy.SPECIFIC_USER and not specific_user:
            raise serializers.ValidationError({'specific_user': 'Please select a specific user for this assignment strategy.'})
        return attrs

    def create(self, validated_data):
        round_robin_users = validated_data.pop('round_robin_users', [])
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        instance = StageTaskRule.objects.create(**validated_data)
        if round_robin_users:
            instance.round_robin_users.set(round_robin_users)
        return instance

    def update(self, instance, validated_data):
        round_robin_users = validated_data.pop('round_robin_users', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if round_robin_users is not None:
            instance.round_robin_users.set(round_robin_users)
        return instance



class LeadStageTaskSerializer(serializers.ModelSerializer):
    lead_name = serializers.CharField(source='lead.name', read_only=True)
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    assigned_to_details = UserSimpleSerializer(source='assigned_to', read_only=True)
    completed_by_details = UserSimpleSerializer(source='completed_by', read_only=True)
    approved_by_details = UserSimpleSerializer(source='approved_by', read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    is_blocked_by_dependency = serializers.BooleanField(read_only=True)
    dependency_title = serializers.CharField(source='dependency.title', read_only=True, default=None)

    class Meta:
        model = LeadStageTask
        fields = [
            'id',
            'lead',
            'lead_name',
            'stage',
            'stage_name',
            'rule',
            'follow_up',
            'title',
            'description',
            'purpose',
            'priority',
            'assigned_to',
            'assigned_to_details',
            'due_date',
            'status',
            'is_mandatory',
            'order',
            'dependency',
            'dependency_title',
            'is_blocked_by_dependency',
            'completed_at',
            'completed_by',
            'completed_by_details',
            'outcome_notes',
            'requires_approval',
            'approved_by',
            'approved_by_details',
            'approved_at',
            'is_overdue',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'completed_at', 'completed_by',
            'approved_at', 'approved_by', 'is_overdue', 'is_blocked_by_dependency',
            'lead_name', 'stage_name', 'assigned_to_details', 'completed_by_details',
            'approved_by_details', 'dependency_title'
        ]


class LeadAssignmentConfigSerializer(serializers.ModelSerializer):
    specific_user_details = UserSimpleSerializer(source='specific_user', read_only=True)
    fallback_user_details = UserSimpleSerializer(source='fallback_user', read_only=True)
    last_assigned_user_details = UserSimpleSerializer(source='last_assigned_user', read_only=True)
    salesmen_pool_details = UserSimpleSerializer(source='salesmen_pool', many=True, read_only=True)
    salesmen_pool_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        many=True,
        write_only=True,
        required=False,
        source='salesmen_pool'
    )

    class Meta:
        model = LeadAssignmentConfig
        fields = [
            'id',
            'is_enabled',
            'strategy',
            'specific_user',
            'specific_user_details',
            'fallback_user',
            'fallback_user_details',
            'salesmen_pool',
            'salesmen_pool_details',
            'salesmen_pool_ids',
            'last_assigned_user',
            'last_assigned_user_details',
            'notify_salesman',
            'auto_assign_web_to_lead',
            'auto_assign_csv_import',
            'auto_assign_manual_create',
            'updated_at',
            'created_at',
        ]
        read_only_fields = ['id', 'updated_at', 'created_at']


class LeadAssignmentRuleSerializer(serializers.ModelSerializer):
    source_details = LeadSourceSerializer(source='source', read_only=True)
    specific_user_details = UserSimpleSerializer(source='specific_user', read_only=True)
    last_assigned_user_details = UserSimpleSerializer(source='last_assigned_user', read_only=True)
    salesmen_pool_details = UserSimpleSerializer(source='salesmen_pool', many=True, read_only=True)
    salesmen_pool_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(is_active=True),
        many=True,
        write_only=True,
        required=False,
        source='salesmen_pool'
    )

    class Meta:
        model = LeadAssignmentRule
        fields = [
            'id',
            'name',
            'is_active',
            'order',
            'source',
            'source_details',
            'lead_type',
            'country',
            'product',
            'strategy',
            'specific_user',
            'specific_user_details',
            'salesmen_pool',
            'salesmen_pool_details',
            'salesmen_pool_ids',
            'last_assigned_user',
            'last_assigned_user_details',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

