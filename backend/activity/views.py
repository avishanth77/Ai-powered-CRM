from rest_framework import viewsets, permissions
from .models import ActivityLog
from .serializers import ActivityLogSerializer

class ActivityLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for system activity/audit logs.
    Allows filtering by entity_type and entity_id.
    """
    queryset = ActivityLog.objects.select_related('performed_by').all().order_by('-created_at')
    serializer_class = ActivityLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['entity_type', 'entity_id', 'action', 'performed_by']
    search_fields = ['action', 'notes', 'entity_id']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Admin and Manager can see all logs
        if user.is_authenticated and (user.role in ['ADMIN', 'MANAGER'] or user.is_superuser):
            return qs
        # Executives can see logs related to their own actions or their assigned leads
        return qs.filter(performed_by=user)
