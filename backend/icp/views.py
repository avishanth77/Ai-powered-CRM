from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from activity.services import log_activity
from leads.models import Lead

from .models import (
    ICPQuestion,
    ICPQualification,
    get_scoring_config,
)
from .permissions import (
    ICPQualificationPermission,
    ICPQuestionPermission,
    ICPScoringConfigPermission,
    visible_leads,
)
from .serializers import (
    ICPQuestionCreateUpdateSerializer,
    ICPQuestionSerializer,
    ICPQuestionTestSerializer,
    ICPQualificationDetailSerializer,
    ICPQualificationListSerializer,
    ICPQualificationSubmitSerializer,
    ICPScoringConfigSerializer,
)
from .services.scoring import (
    ICPValidationError,
    get_active_questions,
    submit_qualification,
)


class ICPQuestionViewSet(viewsets.ModelViewSet):
    """
    Admin-configured ICP qualification questions.

    - Admin / Manager: full management (create, edit, reorder, activate, delete, scoring)
    - Everyone else: read-only access so the test can be rendered
    """

    serializer_class = ICPQuestionSerializer
    permission_classes = [ICPQuestionPermission]
    search_fields = ['question_text', 'description']
    filterset_fields = ['is_active', 'question_type', 'is_required']

    def get_queryset(self):
        queryset = ICPQuestion.objects.prefetch_related('options').order_by('display_order', 'id')
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
            return ICPQuestionCreateUpdateSerializer
        return ICPQuestionSerializer

    def retrieve(self, request, *args, **kwargs):
        question = self.get_object()
        return Response({
            'success': True,
            'message': 'ICP question detail.',
            'data': ICPQuestionSerializer(question).data,
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        question = serializer.save()
        log_activity(
            entity_type='icp_question',
            entity_id=question.id,
            action='created',
            new_value=question.question_text,
            performed_by=request.user,
        )
        return Response(
            {'success': True, 'message': 'ICP question created successfully.', 'data': ICPQuestionSerializer(question).data},
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        question = serializer.save()
        log_activity(
            entity_type='icp_question',
            entity_id=question.id,
            action='updated',
            new_value=question.question_text,
            performed_by=request.user,
        )
        return Response(
            {'success': True, 'message': 'ICP question updated successfully.', 'data': ICPQuestionSerializer(question).data}
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        question_text = instance.question_text
        instance.delete()
        log_activity(
            entity_type='icp_question',
            entity_id=instance.id,
            action='deleted',
            old_value=question_text,
            performed_by=request.user,
            notes='Historical qualifications are unaffected because they store snapshots.',
        )
        return Response({'success': True, 'message': f"Question '{question_text}' was deleted."})

    @action(detail=True, methods=['patch'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        question = self.get_object()
        if 'is_active' in request.data:
            question.is_active = bool(request.data['is_active'])
        else:
            question.is_active = not question.is_active
        question.save(update_fields=['is_active', 'updated_at'])
        return Response({
            'success': True,
            'message': f"Question is now {'active' if question.is_active else 'inactive'}.",
            'data': ICPQuestionSerializer(question).data,
        })

    @action(detail=True, methods=['patch'], url_path='move')
    def move(self, request, pk=None):
        question = self.get_object()
        direction = request.data.get('direction')
        display_order = request.data.get('display_order')

        if direction == 'up':
            previous = (
                ICPQuestion.objects.filter(display_order__lt=question.display_order)
                .order_by('-display_order', '-id')
                .first()
            )
            if previous:
                question.display_order, previous.display_order = previous.display_order, question.display_order
                question.save(update_fields=['display_order'])
                previous.save(update_fields=['display_order'])
        elif direction == 'down':
            following = (
                ICPQuestion.objects.filter(display_order__gt=question.display_order)
                .order_by('display_order', 'id')
                .first()
            )
            if following:
                question.display_order, following.display_order = following.display_order, question.display_order
                question.save(update_fields=['display_order'])
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
            question.display_order = value
            question.save(update_fields=['display_order'])
        else:
            return Response(
                {'success': False, 'message': "Provide either a 'direction' or 'display_order' value."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            'success': True,
            'message': 'Question order updated.',
            'data': ICPQuestionSerializer(question).data,
        })


class ICPScoringConfigView(APIView):
    """Singleton endpoint holding the Poor / Potential / Good Fit percentage thresholds."""

    permission_classes = [ICPScoringConfigPermission]

    def get(self, request):
        config = get_scoring_config()
        return Response({
            'success': True,
            'message': 'ICP scoring configuration.',
            'data': ICPScoringConfigSerializer(config).data,
        })

    def put(self, request):
        config = get_scoring_config()
        serializer = ICPScoringConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        config = serializer.save()
        log_activity(
            entity_type='icp_config',
            entity_id=config.pk,
            action='updated',
            new_value=str(config.as_dict()),
            performed_by=request.user,
        )
        return Response({
            'success': True,
            'message': 'Scoring thresholds updated.',
            'data': ICPScoringConfigSerializer(config).data,
        })


class ICPQualificationDetailView(APIView):
    """Full historical result including the frozen question/answer snapshot."""

    permission_classes = [ICPQualificationPermission]

    def get(self, request, pk):
        qualification = get_object_or_404(
            ICPQualification.objects.select_related('lead', 'qualified_by').prefetch_related('answers'),
            id=pk,
        )
        if not ICPQualificationPermission.user_can_access_lead(request.user, qualification.lead):
            return Response(
                {'success': False, 'message': 'You do not have permission to view this qualification.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response({
            'success': True,
            'message': 'ICP qualification detail.',
            'data': ICPQualificationDetailSerializer(qualification).data,
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


class LeadICPView(APIView):
    """Active question set used to run the ICP test for a lead."""

    permission_classes = [ICPQualificationPermission]

    def get(self, request, lead_id):
        lead, error = _resolve_lead(request, lead_id)
        if error:
            return error

        questions = get_active_questions()
        history = ICPQualification.objects.filter(lead=lead)
        latest = history.order_by('-qualified_at', '-id').first()

        return Response({
            'success': True,
            'message': 'Active ICP questions.',
            'data': {
                'lead': {'id': lead.id, 'name': lead.name, 'company_name': lead.company_name},
                'icp_status': lead.icp_status,
                'qualification_count': history.count(),
                'latest_qualification': ICPQualificationListSerializer(latest).data if latest else None,
                'questions': ICPQuestionTestSerializer(questions, many=True).data,
            },
        })


class LeadICPQualifyView(APIView):
    """Scores a submitted test server-side and stores an immutable qualification snapshot."""

    permission_classes = [ICPQualificationPermission]

    def post(self, request, lead_id):
        lead, error = _resolve_lead(request, lead_id)
        if error:
            return error

        serializer = ICPQualificationSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            qualification = submit_qualification(lead, request.user, serializer.validated_data['answers'])
        except ICPValidationError as exc:
            payload = {'success': False, 'message': exc.message}
            if exc.errors:
                payload['errors'] = exc.errors
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        log_activity(
            entity_type='lead',
            entity_id=lead.id,
            action='icp_qualified',
            old_value=lead.icp_status,
            new_value=qualification.icp_status,
            performed_by=request.user,
            notes=f'ICP score {qualification.total_score}/{qualification.max_score} '
                  f'({qualification.percentage}%)',
        )

        detail = ICPQualificationDetailSerializer(qualification)
        return Response({
            'success': True,
            'message': 'ICP qualification submitted and scored.',
            'data': detail.data,
        }, status=status.HTTP_201_CREATED)


class LeadICPHistoryView(APIView):
    """Every qualification attempt for a lead, newest first."""

    permission_classes = [ICPQualificationPermission]

    def get(self, request, lead_id):
        lead, error = _resolve_lead(request, lead_id)
        if error:
            return error

        history = list(
            ICPQualification.objects.filter(lead=lead)
            .select_related('qualified_by')
            .annotate(answers_count=Count('answers'))
            .order_by('-qualified_at', '-id')
        )

        data = ICPQualificationListSerializer(history, many=True).data
        for index, row in enumerate(data):
            row['answers_count'] = history[index].answers_count
            row['latest'] = index == 0

        return Response({
            'success': True,
            'message': 'ICP qualification history.',
            'count': len(data),
            'results': data,
            'icp_status': lead.icp_status,
        })