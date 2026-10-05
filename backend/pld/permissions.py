from django.db.models import Q
from rest_framework.permissions import BasePermission


class PLDConfigPermission(BasePermission):
    """Read for any authenticated user, configuration writes for Admin / Manager only."""

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        return self._is_config_writer(request.user)

    @staticmethod
    def _is_config_writer(user):
        return user.role in ['ADMIN', 'MANAGER'] or user.is_superuser


class PLDAssessmentPermission(BasePermission):
    """Sales users can run an assessment and read results for leads they own."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    @staticmethod
    def user_can_access_lead(user, lead):
        if user.is_superuser or user.role in ['ADMIN', 'MANAGER']:
            return True
        return lead.assigned_to_id == user.id or lead.created_by_id == user.id

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False
        lead = obj.lead if hasattr(obj, 'lead') else obj
        return self.user_can_access_lead(request.user, lead)


def visible_leads(user):
    """Lead queryset scoped the same way as LeadViewSet.get_queryset."""
    from leads.models import Lead
    queryset = Lead.objects.all()
    if user.is_superuser or user.role in ['ADMIN', 'MANAGER']:
        return queryset
    return queryset.filter(Q(assigned_to=user) | Q(created_by=user))
