from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Q

from .models import StaffTarget
from .serializers import StaffTargetSerializer, StaffTargetSaveSerializer
from .permissions import IsAdmin, IsManagerOrAdmin
from .services.target_service import (
    calculate_staff_progress,
    get_or_create_staff_target,
    get_team_target_overview,
    get_current_period_month,
    TARGET_PRESETS,
)

User = get_user_model()


class StaffTargetViewSet(viewsets.ModelViewSet):
    """
    API ViewSet for managing customizable staff targets (Daily and Monthly).
    - List/Retrieve: Admin & Managers see all staff; Executives see their own targets.
    - Create/Update/Delete: Admins and Managers only.
    """
    queryset = StaffTarget.objects.all().select_related('user', 'set_by')

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsManagerOrAdmin()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return StaffTargetSaveSerializer
        return StaffTargetSerializer

    def get_queryset(self):
        user = self.request.user
        qs = StaffTarget.objects.all().select_related('user', 'set_by')

        # Executive role can only inspect their own targets
        if user.role == User.Role.EXECUTIVE and not user.is_superuser:
            qs = qs.filter(user=user)

        # Filters
        month = self.request.query_params.get('month')
        if month:
            qs = qs.filter(period_month=month)

        user_id = self.request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(user_id=user_id)

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')

        return qs.order_by('-period_month', 'user__first_name')

    def perform_create(self, serializer):
        serializer.save(set_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(set_by=self.request.user)

    def list(self, request, *args, **kwargs):
        """
        List staff targets. If Admin requests a specific month and some staff members
        do not have an explicit target yet, auto-populates their target cards from baseline!
        """
        month = request.query_params.get('month') or get_current_period_month()
        user = request.user

        if user.role in ['ADMIN', 'MANAGER'] or user.is_superuser:
            # For management, return progress reports for all active sales staff
            staff_qs = User.objects.filter(is_active=True).exclude(is_superuser=True, role='ADMIN')
            if not staff_qs.exists():
                staff_qs = User.objects.filter(is_active=True)

            results = []
            for staff in staff_qs:
                target = StaffTarget.objects.filter(user=staff, period_month=month).first()
                if not target:
                    target = StaffTarget.objects.filter(user=staff).order_by('-period_month').first()
                report = calculate_staff_progress(staff, target=target)
                results.append(report)

            return Response({
                'success': True,
                'count': len(results),
                'period_month': month,
                'data': results,
            })
        else:
            # Executive sees their own progress report
            target = StaffTarget.objects.filter(user=user, period_month=month).first()
            if not target:
                target = StaffTarget.objects.filter(user=user).order_by('-period_month').first()
            report = calculate_staff_progress(user, target=target)
            return Response({
                'success': True,
                'count': 1,
                'period_month': month,
                'data': [report],
            })

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def current(self, request):
        """
        Retrieves current active daily and monthly target + real-time performance progress.
        For Executives: returns their own progress.
        For Admins: accepts ?user_id=<id> or defaults to the logged-in user.
        """
        target_user = request.user
        req_user_id = request.query_params.get('user_id')

        if req_user_id and (request.user.role in ['ADMIN', 'MANAGER'] or request.user.is_superuser):
            try:
                target_user = User.objects.get(id=req_user_id)
            except User.DoesNotExist:
                return Response({
                    'success': False,
                    'message': f"User with ID {req_user_id} does not exist."
                }, status=status.HTTP_404_NOT_FOUND)

        month = request.query_params.get('month') or get_current_period_month()
        target = StaffTarget.objects.filter(user=target_user, period_month=month).first()
        if not target:
            target = StaffTarget.objects.filter(user=target_user).order_by('-period_month').first()

        report = calculate_staff_progress(target_user, target=target)
        return Response({
            'success': True,
            'data': report,
        })

    @action(detail=False, methods=['get'], permission_classes=[IsManagerOrAdmin])
    def overview(self, request):
        """
        Retrieves team-wide target summary, aggregates, and leaderboard for Admin/Manager.
        """
        month = request.query_params.get('month') or get_current_period_month()
        overview_data = get_team_target_overview(period_month=month)
        return Response({
            'success': True,
            'data': overview_data,
        })

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def presets(self, request):
        """
        Returns standard recommended target presets for Admin customization.
        """
        return Response({
            'success': True,
            'data': TARGET_PRESETS,
        })
