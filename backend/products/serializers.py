from decimal import Decimal
from rest_framework import serializers
from .models import Product, LeadProduct, CustomerProduct


class ProductSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'code',
            'category',
            'unit_price',
            'currency',
            'billing_cycle',
            'is_active',
        ]


class ProductSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    leads_count = serializers.SerializerMethodField()
    billing_cycle_display = serializers.CharField(source='get_billing_cycle_display', read_only=True)

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'code',
            'description',
            'category',
            'unit_price',
            'currency',
            'billing_cycle',
            'billing_cycle_display',
            'is_active',
            'created_by',
            'created_by_name',
            'leads_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def get_leads_count(self, obj):
        return obj.product_leads.count()


class LeadProductSerializer(serializers.ModelSerializer):
    product = ProductSimpleSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.filter(is_active=True),
        source='product',
        write_only=True
    )
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_code = serializers.CharField(source='product.code', read_only=True)

    class Meta:
        model = LeadProduct
        fields = [
            'id',
            'lead',
            'product',
            'product_id',
            'product_name',
            'product_code',
            'quantity',
            'unit_price',
            'discount_percent',
            'total_price',
            'notes',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'total_price', 'created_at', 'updated_at']

    def create(self, validated_data):
        # Auto-fill unit_price if not passed
        if 'unit_price' not in validated_data or validated_data['unit_price'] is None:
            validated_data['unit_price'] = validated_data['product'].unit_price
        return super().create(validated_data)


class CustomerProductSerializer(serializers.ModelSerializer):
    product = ProductSimpleSerializer(read_only=True)
    product_id = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(),
        source='product',
        write_only=True
    )

    class Meta:
        model = CustomerProduct
        fields = [
            'id',
            'customer',
            'product',
            'product_id',
            'quantity',
            'unit_price',
            'total_price',
            'status',
            'purchased_at',
        ]
        read_only_fields = ['id', 'purchased_at']

