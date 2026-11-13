from rest_framework import serializers
from django.utils import timezone
from .models import FollowUp
from accounts.serializers import UserSerializer

class FollowUpSerializer(serializers.ModelSerializer):
    assigned_to_details = UserSerializer(source='assigned_to', read_only=True)
    lead_name = serializers.CharField(source='lead.name', read_only=True)
    lead_company = serializers.CharField(source='lead.company_name', read_only=True)
    lead_phone = serializers.CharField(source='lead.phone', read_only=True)
    customer_name = serializers.CharField(source='customer.name', read_only=True)
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = FollowUp
        fields = [
            'id',
            'lead',
            'lead_name',
            'lead_company',
            'lead_phone',
            'customer',
            'customer_name',
            'assigned_to',
            'assigned_to_details',
            'follow_up_at',
            'purpose',
            'status',
            'notes',
            'outcome',
            'completed_at',
            'is_overdue',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'completed_at', 'created_at', 'updated_at']

    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = data.copy()
            if 'scheduled_date' in data and 'follow_up_at' not in data:
                data['follow_up_at'] = data.get('scheduled_date')
            purpose_raw = data.get('purpose') or data.get('followup_type')
            if purpose_raw:
                purpose_map = {
                    'CALL': FollowUp.Purpose.PHONE_CALL,
                    'PHONE_CALL': FollowUp.Purpose.PHONE_CALL,
                    'Phone Call': FollowUp.Purpose.PHONE_CALL,
                    'WHATSAPP': FollowUp.Purpose.WHATSAPP,
                    'WhatsApp': FollowUp.Purpose.WHATSAPP,
                    'MEETING': FollowUp.Purpose.MEETING,
                    'Meeting': FollowUp.Purpose.MEETING,
                    'DEMO': FollowUp.Purpose.DEMO,
                    'Demo': FollowUp.Purpose.DEMO,
                    'EMAIL': FollowUp.Purpose.EMAIL,
                    'Email': FollowUp.Purpose.EMAIL,
                    'PROPOSAL': FollowUp.Purpose.PROPOSAL,
                    'Proposal': FollowUp.Purpose.PROPOSAL,
                    'PAYMENT': FollowUp.Purpose.PAYMENT,
                    'Payment Follow-up': FollowUp.Purpose.PAYMENT,
                    'TASK': FollowUp.Purpose.OTHER,
                    'NOTE': FollowUp.Purpose.OTHER,
                    'OTHER': FollowUp.Purpose.OTHER,
                    'Other': FollowUp.Purpose.OTHER,
                }
                if purpose_raw in purpose_map:
                    data['purpose'] = purpose_map[purpose_raw]
        return super().to_internal_value(data)

    def get_is_overdue(self, obj):
        return obj.status == FollowUp.Status.PENDING and obj.follow_up_at < timezone.now()

    def validate(self, attrs):
        # Validation: Lead or Customer must be linked
        lead = attrs.get('lead', getattr(self.instance, 'lead', None))
        customer = attrs.get('customer', getattr(self.instance, 'customer', None))
        if not lead and not customer:
            raise serializers.ValidationError("A follow-up must be associated with either a Lead or a Customer.")

        # Validation: On creation, follow_up_at cannot be in the past
        follow_up_at = attrs.get('follow_up_at')
        if not self.instance and follow_up_at:
            if follow_up_at < timezone.now() - timezone.timedelta(minutes=5):  # allow 5 min clock skew
                raise serializers.ValidationError({'follow_up_at': 'A new follow-up cannot be scheduled in the past.'})

        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        # Default assigned_to to requesting user if not provided
        if not validated_data.get('assigned_to') and request and request.user.is_authenticated:
            validated_data['assigned_to'] = request.user
        return super().create(validated_data)


class FollowUpCompleteSerializer(serializers.Serializer):
    outcome = serializers.CharField(required=True, min_length=3, error_messages={
        'required': 'Please record the outcome of this follow-up.',
        'min_length': 'Please provide a meaningful outcome description (minimum 3 characters).'
    })
    next_follow_up_at = serializers.DateTimeField(required=False, allow_null=True)
    next_purpose = serializers.ChoiceField(choices=FollowUp.Purpose.choices, required=False)

    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = data.copy()
            if 'outcome_notes' in data and 'outcome' not in data:
                data['outcome'] = data.get('outcome_notes')
            elif 'notes' in data and 'outcome' not in data:
                data['outcome'] = data.get('notes')
            # Normalize short/empty outcome to pass min_length
            if 'outcome' in data and data['outcome']:
                val = str(data['outcome']).strip()
                if len(val) < 3:
                    data['outcome'] = f"Completed: {val}"
        return super().to_internal_value(data)
