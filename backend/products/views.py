from decimal import Decimal
from django.db.models import Count, Sum, Q
from rest_framework import viewsets, permissions, status, filters, exceptions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from .models import Product, LeadProduct, CustomerProduct
from .serializers import (
    ProductSerializer,
    ProductSimpleSerializer,
    LeadProductSerializer,
    CustomerProductSerializer
)
from leads.models import Lead


class IsAdminOrManagerOrReadOnly(permissions.BasePermission):
    """
    Allow safe methods for all authenticated users;
    mutations require ADMIN or MANAGER role (or superuser).
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        user_role = getattr(request.user, 'role', None)
        return user_role in ['ADMIN', 'MANAGER'] or getattr(request.user, 'is_superuser', False)


class ProductViewSet(viewsets.ModelViewSet):
    """
    Manage products in the CRM product catalog.
    - View products (all sales reps)
    - Add, edit, activate/deactivate products (Admins & Managers)
    - Filter by category, active status, search keywords
    - Stats endpoint for product analytics
    """
    queryset = Product.objects.all().select_related('created_by')
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrManagerOrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_active', 'billing_cycle']
    search_fields = ['name', 'code', 'description', 'category']
    ordering_fields = ['name', 'unit_price', 'created_at', 'category']
    ordering = ['name']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=['get'])
    def simple(self, request):
        """Lightweight list of active products for dropdowns, selectors, and filters."""
        products = self.get_queryset().filter(is_active=True).order_by('name')
        serializer = ProductSimpleSerializer(products, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Analytics on products: active count, deals count, pipeline value distribution."""
        products = Product.objects.all()
        total_products = products.count()
        active_products = products.filter(is_active=True).count()

        product_breakdown = []
        for p in products:
            leads_qs = Lead.objects.filter(lead_products__product=p)
            leads_count = leads_qs.count()
            won_count = leads_qs.filter(stage__slug='won').count()
            pipeline_value = LeadProduct.objects.filter(product=p).aggregate(total=Sum('total_price'))['total'] or Decimal('0.00')

            product_breakdown.append({
                'id': p.id,
                'name': p.name,
                'code': p.code,
                'category': p.category,
                'unit_price': float(p.unit_price),
                'is_active': p.is_active,
                'leads_count': leads_count,
                'won_count': won_count,
                'pipeline_value': float(pipeline_value),
            })

        return Response({
            'success': True,
            'data': {
                'total_products': total_products,
                'active_products': active_products,
                'products': product_breakdown,
            }
        })


class IsLeadProductAuthorized(permissions.BasePermission):
    """
    Ensure Sales Executives can only view, attach, or edit products on
    leads assigned to them or created by them (prevents IDOR).
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role in ['ADMIN', 'MANAGER'] or user.is_superuser:
            return True
        return obj.lead.assigned_to_id == user.id or obj.lead.created_by_id == user.id


class LeadProductViewSet(viewsets.ModelViewSet):
    """
    Manage products attached to specific leads/deals.
    Supports adding products, updating quantities/prices, and recalculating deal value.
    Scoped to assigned leads for Sales Executives to prevent IDOR.
    """
    queryset = LeadProduct.objects.all().select_related('lead', 'product')
    serializer_class = LeadProductSerializer
    permission_classes = [permissions.IsAuthenticated, IsLeadProductAuthorized]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['lead', 'product']

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        if user.is_authenticated and user.role not in ['ADMIN', 'MANAGER'] and not user.is_superuser:
            qs = qs.filter(Q(lead__assigned_to=user) | Q(lead__created_by=user))
        lead_id = self.request.query_params.get('lead')
        if lead_id:
            return qs.filter(lead_id=lead_id)
        return qs

    def perform_create(self, serializer):
        lead = serializer.validated_data.get('lead')
        user = self.request.user
        if user.role not in ['ADMIN', 'MANAGER'] and not user.is_superuser:
            if lead and lead.assigned_to_id != user.id and lead.created_by_id != user.id:
                raise exceptions.PermissionDenied("You do not have permission to attach products to this lead.")
        item = serializer.save()
        # Optionally update lead expected value based on total products
        self._update_lead_deal_value(item.lead)

    def perform_update(self, serializer):
        item = serializer.save()
        self._update_lead_deal_value(item.lead)

    def perform_destroy(self, instance):
        lead = instance.lead
        super().perform_destroy(instance)
        self._update_lead_deal_value(lead)

    def _update_lead_deal_value(self, lead):
        """Syncs the lead's expected deal value to the sum of its product line items if products exist."""
        total = lead.lead_products.aggregate(s=Sum('total_price'))['s']
        if total is not None and total > Decimal('0.00'):
            lead.expected_value = total
            lead.save(update_fields=['expected_value', 'updated_at'])

