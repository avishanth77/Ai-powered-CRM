from rest_framework.permissions import BasePermission

class IsAdmin(BasePermission):
    """Allows access only to Admin users."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.role == 'ADMIN' or request.user.is_superuser))

class IsManager(BasePermission):
    """Allows access only to Sales Managers."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'MANAGER')

class IsManagerOrAdmin(BasePermission):
    """Allows access to Sales Managers and Admins."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (
            request.user.role in ['ADMIN', 'MANAGER'] or request.user.is_superuser
        ))

class IsExecutive(BasePermission):
    """Allows access to Sales Executives / Interns."""
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'EXECUTIVE')
