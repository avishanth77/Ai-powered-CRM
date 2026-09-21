from rest_framework.permissions import BasePermission, SAFE_METHODS

class FollowUpPermission(BasePermission):
    """
    Permission rules for Follow-ups:
    - Admin: Full access
    - Manager: Full access across team
    - Executive:
        - Can create follow-ups for assigned leads
        - Can only view, update, complete own assigned follow-ups
        - Cannot modify other executives' follow-ups
    """
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        if user.role in ['ADMIN', 'MANAGER'] or user.is_superuser:
            return True

        # Executive can only access if assigned to them
        return obj.assigned_to_id == user.id
