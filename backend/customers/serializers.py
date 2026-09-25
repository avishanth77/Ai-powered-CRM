from rest_framework import serializers
from .models import Customer
from accounts.serializers import UserSerializer

class CustomerSerializer(serializers.ModelSerializer):
    created_by_details = UserSerializer(source='created_by', read_only=True)
    lead_name = serializers.CharField(source='lead.name', read_only=True)
    lead_source = serializers.CharField(source='lead.source.name', read_only=True)
    lead_source_id = serializers.IntegerField(source='lead.source.id', read_only=True, default=None)
    lead_expected_value = serializers.DecimalField(source='lead.expected_value', max_digits=12, decimal_places=2, read_only=True, default=None)
    is_won_lead = serializers.SerializerMethodField()

    class Meta:
        model = Customer
        fields = [
            'id',
            'lead',
            'lead_name',
            'lead_source',
            'lead_source_id',
            'lead_expected_value',
            'is_won_lead',
            'name',
            'phone',
            'email',
            'company_name',
            'address',
            'converted_at',
            'created_by',
            'created_by_details',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'converted_at', 'created_at', 'updated_at', 'created_by']

    def get_is_won_lead(self, obj):
        return bool(obj.lead_id)
