from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from datetime import datetime, time
from django.db.models import Q

from .models import FollowUp
from .serializers import FollowUpSerializer, FollowUpCompleteSerializer
from .permissions import FollowUpPermission
from .filters import FollowUpFilter
from activity.services import log_activity
from activity.models import ActivityLog

class FollowUpViewSet(viewsets.ModelViewSet):
    """
    ViewSet for scheduling, managing, and tracking Follow-ups.
    """
    permission_classes = [FollowUpPermission]
    serializer_class = FollowUpSerializer
    filterset_class = FollowUpFilter
    ordering_fields = ['follow_up_at', 'status', 'purpose', 'created_at']
    ordering = ['-follow_up_at', '-created_at']
    search_fields = [
        'purpose',
        'outcome',
        'lead__name',
        'lead__company_name',
        'customer__name',
        'customer__company_name',
        'assigned_to__first_name',
        'assigned_to__last_name',
        'assigned_to__email',
    ]

    def get_queryset(self):
        user = self.request.user
        qs = FollowUp.objects.select_related('lead', 'customer', 'assigned_to').all()

        if not user.is_authenticated:
            return qs.none()

        # Admin and Manager can view all team follow-ups
        if user.role in ['ADMIN', 'MANAGER'] or user.is_superuser:
            return qs

        # Sales Executive can only view follow-ups assigned to them
        return qs.filter(assigned_to=user)

    def perform_create(self, serializer):
        followup = serializer.save()
        target_type = ActivityLog.EntityType.LEAD if followup.lead else ActivityLog.EntityType.CUSTOMER
        target_id = followup.lead_id if followup.lead else followup.customer_id

        log_activity(
            entity_type=target_type,
            entity_id=target_id,
            action=ActivityLog.ActionType.FOLLOW_UP_CREATED,
            new_value={
                'follow_up_id': followup.id,
                'purpose': followup.purpose,
                'follow_up_at': followup.follow_up_at.isoformat(),
                'assigned_to': followup.assigned_to.get_full_name() if followup.assigned_to else None,
            },
            performed_by=self.request.user,
            notes=f"Scheduled {followup.purpose} for {followup.follow_up_at:%Y-%m-%d %H:%M}"
        )

    def perform_update(self, serializer):
        followup = serializer.save()
        action_type = ActivityLog.ActionType.FOLLOW_UP_CANCELLED if followup.status == FollowUp.Status.CANCELLED else ActivityLog.ActionType.FOLLOW_UP_UPDATED
        target_type = ActivityLog.EntityType.LEAD if followup.lead else ActivityLog.EntityType.CUSTOMER
        target_id = followup.lead_id if followup.lead else followup.customer_id

        log_activity(
            entity_type=target_type,
            entity_id=target_id,
            action=action_type,
            performed_by=self.request.user,
            notes=f"Follow-up status: {followup.status}"
        )

    @action(detail=True, methods=['patch', 'post'])
    def complete(self, request, pk=None):
        """
        Mark a follow-up as completed, record outcome, and optionally schedule next step.
        """
        followup = self.get_object()
        serializer = FollowUpCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        followup.status = FollowUp.Status.COMPLETED
        followup.outcome = serializer.validated_data['outcome']
        followup.completed_at = timezone.now()
        followup.save(update_fields=['status', 'outcome', 'completed_at', 'updated_at'])

        # Activity log
        target_type = ActivityLog.EntityType.LEAD if followup.lead else ActivityLog.EntityType.CUSTOMER
        target_id = followup.lead_id if followup.lead else followup.customer_id

        log_activity(
            entity_type=target_type,
            entity_id=target_id,
            action=ActivityLog.ActionType.FOLLOW_UP_COMPLETED,
            old_value={'status': FollowUp.Status.PENDING},
            new_value={'status': FollowUp.Status.COMPLETED, 'outcome': followup.outcome},
            performed_by=request.user,
            notes=f"Completed {followup.purpose}. Outcome: {followup.outcome}"
        )

        # Handle optional next follow-up
        next_followup_data = None
        next_date = serializer.validated_data.get('next_follow_up_at')
        if next_date:
            next_purpose = serializer.validated_data.get('next_purpose', followup.purpose)
            next_fu = FollowUp.objects.create(
                lead=followup.lead,
                customer=followup.customer,
                assigned_to=followup.assigned_to,
                follow_up_at=next_date,
                purpose=next_purpose,
                status=FollowUp.Status.PENDING
            )
            next_followup_data = FollowUpSerializer(next_fu).data

        return Response({
            'success': True,
            'message': 'Follow-up marked as completed.',
            'data': {
                'completed_followup': FollowUpSerializer(followup).data,
                'next_followup': next_followup_data
            }
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def overdue(self, request):
        """
        List overdue follow-ups (pending follow-ups with scheduled time in the past).
        """
        qs = self.filter_queryset(
            self.get_queryset().filter(
                status=FollowUp.Status.PENDING,
                follow_up_at__lt=timezone.now()
            )
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response({'success': True, 'data': serializer.data})

    @action(detail=False, methods=['get'])
    def today(self, request):
        """
        List follow-ups scheduled for today.
        """
        now = timezone.now()
        start_of_day = timezone.make_aware(datetime.combine(now.date(), time.min))
        end_of_day = timezone.make_aware(datetime.combine(now.date(), time.max))

        qs = self.filter_queryset(
            self.get_queryset().filter(
                follow_up_at__range=(start_of_day, end_of_day)
            )
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response({'success': True, 'data': serializer.data})
