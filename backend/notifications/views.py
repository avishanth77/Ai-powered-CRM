from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter
from django.utils import timezone

from .models import Notification
from .serializers import NotificationSerializer
from .services import NotificationService


class NotificationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing user-scoped in-app notifications.
    Strictly restricted so that an authenticated user can only view,
    mark as read, or delete their own notifications.
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['is_read', 'notification_type', 'priority']
    ordering_fields = ['created_at', 'priority', 'is_read']
    ordering = ['-created_at']
    http_method_names = ['get', 'patch', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return Notification.objects.none()
        NotificationService.sync_user_followups(user)
        return Notification.objects.filter(recipient=user).select_related('actor')

    @action(detail=False, methods=['get'], url_path='unread-count')
    def unread_count(self, request):
        """
        Returns the count of unread notifications for the authenticated user.
        Format: {"count": 5}
        """
        NotificationService.sync_user_followups(request.user)
        count = NotificationService.get_unread_count(request.user)
        return Response({'count': count}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch', 'post'], url_path='read')
    def mark_read(self, request, pk=None):
        """
        Marks a specific notification as read.
        """
        notification = self.get_object()
        notification.mark_as_read()
        serializer = self.get_serializer(notification)
        return Response({
            'success': True,
            'message': 'Notification marked as read.',
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['patch', 'post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        """
        Marks all unread notifications for current user as read.
        """
        updated_count = NotificationService.mark_all_as_read(request.user)
        return Response({
            'success': True,
            'message': f'Marked {updated_count} notification(s) as read.',
            'updated_count': updated_count,
            'count': 0
        }, status=status.HTTP_200_OK)
