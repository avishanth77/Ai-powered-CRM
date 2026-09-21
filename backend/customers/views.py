from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from .models import Customer
from .serializers import CustomerSerializer
from activity.services import log_activity
from activity.models import ActivityLog

class CustomerPermission(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        # Only Admins and Managers can edit or create direct customers
        return request.user.role in ['ADMIN', 'MANAGER'] or request.user.is_superuser

class CustomerViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing converted Customers.
    """
    queryset = Customer.objects.select_related('lead', 'lead__source', 'created_by').all().order_by('-converted_at')
    serializer_class = CustomerSerializer
    permission_classes = [CustomerPermission]
    search_fields = ['name', 'phone', 'email', 'company_name']
    ordering_fields = ['converted_at', 'name', 'company_name', 'created_at']

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
