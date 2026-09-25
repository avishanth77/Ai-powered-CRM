from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
import django_filters
from django.db.models import Q
from .models import Customer
from .serializers import CustomerSerializer
from activity.services import log_activity
from activity.models import ActivityLog
from leads.models import Lead

class CustomerPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        # Only Admins and Managers can edit or create direct customers
        return request.user.role in ['ADMIN', 'MANAGER'] or request.user.is_superuser


class CustomerFilter(django_filters.FilterSet):
    # Origin filter: 'won_lead' (converted from Won lead), 'direct' (direct customer)
    origin = django_filters.CharFilter(method='filter_origin')
    has_lead = django_filters.BooleanFilter(field_name='lead', lookup_expr='isnull', exclude=True)
    source = django_filters.CharFilter(field_name='lead__source__name', lookup_expr='iexact')
    source_id = django_filters.NumberFilter(field_name='lead__source__id')
    created_by = django_filters.NumberFilter(field_name='created_by__id')
    from_date = django_filters.DateTimeFilter(field_name='converted_at', lookup_expr='gte')
    to_date = django_filters.DateTimeFilter(field_name='converted_at', lookup_expr='lte')

    class Meta:
        model = Customer
        fields = ['origin', 'has_lead', 'source', 'source_id', 'created_by', 'from_date', 'to_date']

    def filter_origin(self, queryset, name, value):
        if value in ['won_lead', 'converted', 'lead']:
            return queryset.filter(lead__isnull=False)
        elif value == 'direct':
            return queryset.filter(lead__isnull=True)
        return queryset


class CustomerViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing converted Customers and direct accounts.
    """
    serializer_class = CustomerSerializer
    permission_classes = [CustomerPermission]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = CustomerFilter
    search_fields = ['name', 'phone', 'email', 'company_name', 'lead__name', 'lead__company_name', 'lead__source__name']
    ordering_fields = ['converted_at', 'name', 'company_name', 'created_at']
    ordering = ['-converted_at']

    def get_queryset(self):
        # Auto-sync any Won leads without customer profile
        won_leads_missing_profile = Lead.objects.filter(
            Q(stage__slug='won') | Q(stage__name__iexact='won'),
            customer_profile__isnull=True
        )
        if won_leads_missing_profile.exists():
            from leads.views import ensure_customer_for_won_lead
            for w_lead in won_leads_missing_profile:
                ensure_customer_for_won_lead(w_lead)

        return Customer.objects.select_related('lead', 'lead__source', 'created_by').all().order_by('-converted_at')

    def perform_create(self, serializer):
        customer = serializer.save(created_by=self.request.user)
        log_activity(
            entity_type=ActivityLog.EntityType.CUSTOMER,
            entity_id=customer.id,
            action=ActivityLog.ActionType.CUSTOMER_CREATED,
            performed_by=self.request.user,
            notes=f"Customer created directly by {self.request.user.get_full_name() or self.request.user.email}"
        )

    def perform_update(self, serializer):
        customer = serializer.save()
        log_activity(
            entity_type=ActivityLog.EntityType.CUSTOMER,
            entity_id=customer.id,
            action=ActivityLog.ActionType.CUSTOMER_UPDATED,
            performed_by=self.request.user,
            notes=f"Customer {customer.name} was updated"
        )
