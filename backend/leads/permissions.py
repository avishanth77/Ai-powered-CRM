from rest_framework.permissions import BasePermission, SAFE_METHODS

class LeadPermission(BasePermission):
    """
    Custom permission for Leads:
    - Admin: Full access
    - Manager: Full access across team
    - Executive:
        - Can create leads
        - Can view and edit only assigned leads or leads they created
        - Cannot delete leads
        - Cannot reassign leads
        - Cannot convert leads to customer
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role in ['ADMIN', 'MANAGER'] or user.is_superuser:
            if request.method == 'DELETE' and not (user.role == 'ADMIN' or user.is_superuser):
                return False  # Only Admin can delete
            return True

        # Executive role
        if request.method == 'DELETE':
            return False  # Executive cannot delete

        # Executive can only access if assigned or creator
        return obj.assigned_to_id == user.id or obj.created_by_id == user.id


class LeadSourcePermission(BasePermission):
    """
    Only Admin and Manager can manage lead sources.
    Executives have read-only access.
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.role in ['ADMIN', 'MANAGER'] or request.user.is_superuser
