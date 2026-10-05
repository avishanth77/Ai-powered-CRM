from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from activity.services import log_activity
from leads.models import Lead, LeadStage

from .models import PLDAssessment, PLDProblem, PLDStageGate, get_scoring_config
from .permissions import (
    PLDAssessmentPermission,
    PLDConfigPermission,
    visible_leads,
)
from .serializers import (
    PLDAssessmentDetailSerializer,
    PLDAssessmentListSerializer,
    PLDAssessSubmitSerializer,
    PLDProblemCreateUpdateSerializer,
    PLDProblemSerializer,
    PLDScoringConfigSerializer,
    PLDStageGateSerializer,
)
from .services.gates import gate_report, stage_gate_report
from .services.scoring import PLDValidationError, get_active_problems, submit_assessment


class PLDProblemViewSet(viewsets.ModelViewSet):
    """
    Admin-configured PLD problems.

    - Admin / Manager: full management (create, edit, reorder, activate, delete, points)
    - Everyone else: read-only access so the assessment can be rendered
    """

    serializer_class = PLDProblemSerializer
    permission_classes = [PLDConfigPermission]
    search_fields = ['name', 'description']
    filterset_fields = ['is_active', 'severity']

    def get_queryset(self):
        queryset = PLDProblem.objects.order_by('display_order', 'id')
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()

        include_inactive = (
            self.request.query_params.get('include_inactive') == 'true'
            or self.request.query_params.get('all') == 'true'
        )
        if include_inactive and (user.role in ['ADMIN', 'MANAGER'] or user.is_superuser):
            return queryset
        return queryset.filter(is_active=True)

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return PLDProblemCreateUpdateSerializer
        return PLDProblemSerializer

    def retrieve(self, request, *args, **kwargs):
        problem = self.get_object()
        return Response({
            'success': True,
            'message': 'PLD problem detail.',
            'data': PLDProblemSerializer(problem).data,
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        problem = serializer.save()
        log_activity(
            entity_type='pld_problem',
            entity_id=problem.id,
            action='created',
            new_value=problem.name,
            performed_by=request.user,
        )
        return Response(
            {'success': True, 'message': 'PLD problem created successfully.',
             'data': PLDProblemSerializer(problem).data},
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        problem = serializer.save()
        log_activity(
            entity_type='pld_problem',
            entity_id=problem.id,
            action='updated',
            new_value=problem.name,
            performed_by=request.user,
        )
        return Response({
            'success': True,
            'message': 'PLD problem updated successfully.',
            'data': PLDProblemSerializer(problem).data,
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.name
        instance.delete()
        log_activity(
            entity_type='pld_problem',
            entity_id=instance.id,
            action='deleted',
            old_value=name,
            performed_by=request.user,
            notes='Historical assessments are unaffected because they store snapshots.',
        )
        return Response({'success': True, 'message': f"Problem '{name}' was deleted."})

    @action(detail=True, methods=['patch'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        problem = self.get_object()
        if 'is_active' in request.data:
            problem.is_active = bool(request.data['is_active'])
        else:
            problem.is_active = not problem.is_active
        problem.save(update_fields=['is_active', 'updated_at'])
        return Response({
            'success': True,
            'message': f"Problem is now {'active' if problem.is_active else 'inactive'}.",
            'data': PLDProblemSerializer(problem).data,
        })

    @action(detail=True, methods=['patch'], url_path='move')
    def move(self, request, pk=None):
        problem = self.get_object()
        direction = request.data.get('direction')
        display_order = request.data.get('display_order')

        if direction == 'up':
            previous = (
                PLDProblem.objects.filter(display_order__lt=problem.display_order)
                .order_by('-display_order', '-id')
                .first()
            )
            if previous:
                problem.display_order, previous.display_order = previous.display_order, problem.display_order
                problem.save(update_fields=['display_order'])
                previous.save(update_fields=['display_order'])
        elif direction == 'down':
            following = (
                PLDProblem.objects.filter(display_order__gt=problem.display_order)
                .order_by('display_order', 'id')
                .first()
            )
            if following:
                problem.display_order, following.display_order = following.display_order, problem.display_order
                problem.save(update_fields=['display_order'])
                following.save(update_fields=['display_order'])
        elif display_order is not None:
            try:
                value = int(display_order)
            except (TypeError, ValueError):
                value = 0
            if value < 1:
                return Response(
                    {'success': False, 'message': 'Display order must be 1 or greater.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            problem.display_order = value
            problem.save(update_fields=['display_order'])
        else:
            return Response(
                {'success': False, 'message': "Provide either a 'direction' or 'display_order' value."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            'success': True,
            'message': 'Problem order updated.',
            'data': PLDProblemSerializer(problem).data,
        })


class PLDScoringConfigView(APIView):
    """Singleton endpoint holding the Qualified PLD percentage threshold."""

    permission_classes = [PLDConfigPermission]

    def get(self, request):
        config = get_scoring_config()
        return Response({
            'success': True,
            'message': 'PLD scoring configuration.',
            'data': PLDScoringConfigSerializer(config).data,
        })

    def put(self, request):
        config = get_scoring_config()
        serializer = PLDScoringConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        config = serializer.save()
        log_activity(
            entity_type='pld_config',
            entity_id=config.pk,
            action='updated',
            new_value=str(config.as_dict()),
            performed_by=request.user,
        )
        return Response({
            'success': True,
            'message': 'Scoring threshold updated.',
            'data': PLDScoringConfigSerializer(config).data,
        })


class PLDStageGateViewSet(viewsets.ModelViewSet):
    """Configurable per-stage requirements. Reads for all, writes for Admin / Manager."""

    serializer_class = PLDStageGateSerializer
    permission_classes = [PLDConfigPermission]

    def get_queryset(self):
        if not self.request.user.is_authenticated:
            return PLDStageGate.objects.none()
        return PLDStageGate.objects.select_related('stage').order_by('stage__display_order', 'stage__id')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        gate = serializer.save()
        log_activity(
            entity_type='pld_gate',
            entity_id=gate.id,
            action='created',
            new_value=gate.stage.name,
            performed_by=request.user,
        )
        return Response({
            'success': True,
            'message': 'Stage gate created.',
            'data': PLDStageGateSerializer(gate).data,
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        gate = serializer.save()
        log_activity(
            entity_type='pld_gate',
            entity_id=gate.id,
            action='updated',
            new_value=gate.stage.name,
            performed_by=request.user,
        )
        return Response({
            'success': True,
            'message': 'Stage gate updated.',
            'data': PLDStageGateSerializer(gate).data,
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        stage_name = instance.stage.name
        instance.delete()
        log_activity(
            entity_type='pld_gate',
            entity_id=instance.id,
            action='deleted',
            old_value=stage_name,
            performed_by=request.user,
        )
        return Response({'success': True, 'message': f"Gate for stage '{stage_name}' was removed."})


class PLDAssessmentDetailView(APIView):
    """Full historical result including the frozen problem snapshot."""

    permission_classes = [PLDAssessmentPermission]

    def get(self, request, pk):
        assessment = get_object_or_404(
            PLDAssessment.objects.select_related('lead', 'assessed_by').prefetch_related('problems'),
            id=pk,
        )
        if not PLDAssessmentPermission.user_can_access_lead(request.user, assessment.lead):
            return Response(
                {'success': False, 'message': 'You do not have permission to view this assessment.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response({
            'success': True,
            'message': 'PLD assessment detail.',
            'data': PLDAssessmentDetailSerializer(assessment).data,
        })


def _resolve_lead(request, lead_id):
    """Return (lead, error_response). error_response is a 403/404 Response when access is denied."""
    lead = visible_leads(request.user).filter(id=lead_id).select_related('stage').first()
    if lead is None:
        exists = Lead.objects.filter(id=lead_id).exists()
        if not exists:
            return None, Response(
                {'success': False, 'message': 'Lead not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return None, Response(
            {'success': False, 'message': 'You do not have permission to view this lead.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return lead, None


class LeadPLDView(APIView):
    """Active problems, current PLD state and every configured gate for a lead."""

    permission_classes = [PLDAssessmentPermission]

    def get(self, request, lead_id):
        lead, error = _resolve_lead(request, lead_id)
        if error:
            return error

        history = PLDAssessment.objects.filter(lead=lead)
        latest = history.order_by('-assessed_at', '-id').first()

        return Response({
            'success': True,
            'message': 'Active PLD problems and gate state.',
            'data': {
                'lead': {'id': lead.id, 'name': lead.name, 'company_name': lead.company_name},
                'pld_score': lead.pld_score,
                'pld_status': lead.pld_status,
                'icp_status': lead.icp_status,
                'assessment_count': history.count(),
                'latest_assessment': PLDAssessmentListSerializer(latest).data if latest else None,
                'problems': PLDProblemSerializer(get_active_problems(), many=True).data,
                'gates': gate_report(lead),
            },
        })


class LeadPLDAssessView(APIView):
    """Scores a submitted problem selection server-side and stores an immutable snapshot."""

    permission_classes = [PLDAssessmentPermission]

    def post(self, request, lead_id):
        lead, error = _resolve_lead(request, lead_id)
        if error:
            return error

        serializer = PLDAssessSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            assessment = submit_assessment(lead, request.user, serializer.validated_data['problem_ids'])
        except PLDValidationError as exc:
            payload = {'success': False, 'message': exc.message}
            if exc.errors:
                payload['errors'] = exc.errors
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        log_activity(
            entity_type='lead',
            entity_id=lead.id,
            action='pld_assessed',
            old_value=lead.pld_status,
            new_value=assessment.pld_status,
            performed_by=request.user,
            notes=f'PLD score {assessment.total_score}/{assessment.max_score} ({assessment.percentage}%)',
        )

        detail = PLDAssessmentDetailSerializer(assessment)
        return Response({
            'success': True,
            'message': 'PLD assessment submitted and scored.',
            'data': detail.data,
        }, status=status.HTTP_201_CREATED)


class LeadPLDHistoryView(APIView):
    """Every PLD assessment for a lead, newest first."""

    permission_classes = [PLDAssessmentPermission]

    def get(self, request, lead_id):
        lead, error = _resolve_lead(request, lead_id)
        if error:
            return error

        history = list(
            PLDAssessment.objects.filter(lead=lead)
            .select_related('assessed_by')
            .annotate(problems_count=Count('problems'))
            .order_by('-assessed_at', '-id')
        )

        data = PLDAssessmentListSerializer(history, many=True).data
        for index, row in enumerate(data):
            row['problems_count'] = history[index].problems_count
            row['latest'] = index == 0

        return Response({
            'success': True,
            'message': 'PLD assessment history.',
            'count': len(data),
            'results': data,
            'pld_score': lead.pld_score,
            'pld_status': lead.pld_status,
        })


class LeadPLDGateCheckView(APIView):
    """Preview whether a lead may move into a stage before the PATCH is sent."""

    permission_classes = [PLDAssessmentPermission]

    def _stage_from_request(self, request):
        raw = request.query_params.get('stage') or request.data.get('stage')
        if raw in (None, ''):
            return None, Response(
                {'success': False, 'message': "Provide a 'stage' id."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            stage = LeadStage.objects.filter(id=int(raw)).first()
        except (TypeError, ValueError):
            stage = None
        if stage is None:
            return None, Response(
                {'success': False, 'message': 'Stage not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return stage, None

    def get(self, request, lead_id):
        lead, error = _resolve_lead(request, lead_id)
        if error:
            return error
        stage, error = self._stage_from_request(request)
        if error:
            return error

        report = stage_gate_report(lead, stage)
        return Response({
            'success': True,
            'message': 'Stage gate check.',
            'data': report,
        })

    def post(self, request, lead_id):
        return self.get(request, lead_id)
