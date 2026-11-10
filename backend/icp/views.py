from django.db import models
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from activity.services import log_activity
from leads.models import Lead
from products.models import Product

from .models import (
    ICPQuestion,
    ICPQualification,
    ICPScoringConfig,
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
        queryset = ICPQuestion.objects.prefetch_related('options', 'product').order_by('display_order', 'id')
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()

        include_inactive = (
            self.request.query_params.get('include_inactive') == 'true'
            or self.request.query_params.get('all') == 'true'
        )
        if not (include_inactive and (user.role in ['ADMIN', 'MANAGER'] or user.is_superuser)):
            queryset = queryset.filter(is_active=True)

        product_param = self.request.query_params.get('product') or self.request.query_params.get('product_id')
        if product_param is not None and product_param != 'all':
            if product_param in ('', 'null', 'none', 'global'):
                queryset = queryset.filter(product__isnull=True)
            else:
                try:
                    pid = int(product_param)
                    if self.request.query_params.get('include_global') == 'true':
                        queryset = queryset.filter(models.Q(product_id=pid) | models.Q(product__isnull=True))
                    else:
                        queryset = queryset.filter(product_id=pid)
                except (ValueError, TypeError):
                    pass

        return queryset

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
    """Scoring thresholds endpoint for global or product-specific configurations."""

    permission_classes = [ICPScoringConfigPermission]

    def get(self, request):
        product_param = request.query_params.get('product') or request.query_params.get('product_id')
        product = None
        if product_param and str(product_param).lower() not in ('', 'null', 'none', 'global', 'all'):
            try:
                product = Product.objects.filter(id=int(product_param)).first()
            except (ValueError, TypeError):
                pass

        config = get_scoring_config(product=product)
        return Response({
            'success': True,
            'message': 'ICP scoring configuration.',
            'data': ICPScoringConfigSerializer(config).data,
        })

    def put(self, request):
        product_param = (
            request.data.get('product_id')
            or request.data.get('product')
            or request.query_params.get('product_id')
            or request.query_params.get('product')
        )
        product = None
        if product_param and str(product_param).lower() not in ('', 'null', 'none', 'global'):
            try:
                product = Product.objects.filter(id=int(product_param)).first()
            except (ValueError, TypeError):
                pass

        if product:
            config, _ = ICPScoringConfig.objects.get_or_create(product=product)
        else:
            config = get_scoring_config()

        serializer = ICPScoringConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        config = serializer.save()
        if product and config.product_id != product.id:
            config.product = product
            config.save(update_fields=['product'])
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
            ICPQualification.objects.select_related('lead', 'qualified_by', 'product').prefetch_related('answers'),
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
    """Active question set used to run the ICP test for a lead, supporting product-specific scoping."""

    permission_classes = [ICPQualificationPermission]

    def get(self, request, lead_id):
        lead, error = _resolve_lead(request, lead_id)
        if error:
            return error

        product_param = request.query_params.get('product') or request.query_params.get('product_id')
        product = None
        if product_param and str(product_param).lower() not in ('', 'null', 'none', 'global', 'all'):
            try:
                product = Product.objects.filter(id=int(product_param)).first()
            except (ValueError, TypeError):
                pass

        lead_products = [
            {'id': lp.product.id, 'name': lp.product.name, 'code': lp.product.code}
            for lp in lead.lead_products.select_related('product').all()
        ]

        # Target product resolution:
        # 1. Specifically requested product
        # 2. Or if not specified and lead has products, check if any product has customized ICP questions
        target_product = product
        if not target_product and product_param != 'global' and lead_products:
            first_pid = lead_products[0]['id']
            if ICPQuestion.objects.filter(product_id=first_pid, is_active=True).exists():
                target_product = Product.objects.filter(id=first_pid).first()

        questions = get_active_questions(product=target_product)
        history = ICPQualification.objects.filter(lead=lead)
        if target_product:
            history = history.filter(product=target_product)
        latest = history.order_by('-qualified_at', '-id').first()

        return Response({
            'success': True,
            'message': 'Active ICP questions.',
            'data': {
                'lead': {'id': lead.id, 'name': lead.name, 'company_name': lead.company_name},
                'icp_status': lead.icp_status,
                'selected_product': {'id': target_product.id, 'name': target_product.name, 'code': target_product.code} if target_product else None,
                'lead_products': lead_products,
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

        product_id = (
            serializer.validated_data.get('product_id')
            or request.data.get('product')
            or request.data.get('product_id')
        )
        product = None
        if product_id and str(product_id).lower() not in ('null', 'none', 'global', ''):
            try:
                product = Product.objects.filter(id=int(product_id)).first()
            except (ValueError, TypeError):
                pass

        try:
            qualification = submit_qualification(
                lead=lead,
                user=request.user,
                answers_payload=serializer.validated_data['answers'],
                product=product
            )
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

        # Check if the result qualifies (POTENTIAL_FIT, GOOD_FIT, STRONG_ICP_FIT)
        is_qualified = qualification.icp_status in [
            'POTENTIAL_FIT',
            'GOOD_FIT',
            'STRONG_ICP_FIT',
        ]

        stage_advanced = False
        new_stage_name = None
        new_stage_id = None
        old_stage_name = None

        current_stage = lead.stage
        if is_qualified and current_stage and (
            current_stage.slug.lower() == 'icp' or current_stage.name.lower() == 'icp'
        ):
            from leads.models import LeadStageTask, LeadStage
            from leads.services.progression import complete_stage_task
            from leads.services.task_automation import execute_stage_task_automations
            from notifications.services import NotificationService
            from notifications.models import Notification

            # 1. Complete pending ICP stage checkpoint tasks
            icp_pending_tasks = lead.stage_tasks.filter(
                stage=current_stage,
                status=LeadStageTask.Status.PENDING
            )
            for task in icp_pending_tasks:
                complete_stage_task(
                    task=task,
                    outcome_notes=f"Auto-completed via ICP Qualification: {qualification.get_icp_status_display()} ({qualification.percentage}%).",
                    actor=request.user
                )

            # 2. Find next active pipeline stage after ICP
            next_stage = LeadStage.objects.filter(
                display_order__gt=current_stage.display_order,
                is_active=True
            ).order_by('display_order', 'id').first()

            if next_stage:
                old_stage = current_stage
                lead.stage = next_stage
                lead.save(update_fields=['stage', 'updated_at'])

                # 3. Instantiate automated tasks for the next stage
                execute_stage_task_automations(
                    lead=lead,
                    new_stage=next_stage,
                    old_stage=old_stage,
                    actor=request.user
                )

                # 4. Log stage change in ActivityLog
                log_activity(
                    entity_type='lead',
                    entity_id=lead.id,
                    action='status_changed',
                    old_value={'stage': old_stage.name, 'stage_id': old_stage.id},
                    new_value={'stage': next_stage.name, 'stage_id': next_stage.id},
                    performed_by=request.user,
                    notes=f"Lead moved from '{old_stage.name}' to '{next_stage.name}' upon passing ICP Qualification ({qualification.get_icp_status_display()}, {qualification.percentage}%)."
                )

                # 5. Notify assigned sales rep
                if lead.assigned_to:
                    NotificationService.create_notification(
                        recipient=lead.assigned_to,
                        notification_type=Notification.NotificationType.LEAD_STAGE_CHANGED,
                        title=f"Lead Stage Advanced: {next_stage.name}",
                        message=f"{lead.name} passed ICP Qualification ({qualification.percentage}%) and was advanced to '{next_stage.name}'.",
                        entity_type='lead',
                        entity_id=lead.id,
                        action_url=f"/leads/{lead.id}",
                        priority=Notification.Priority.HIGH,
                        allow_self=True
                    )

                stage_advanced = True
                new_stage_name = next_stage.name
                new_stage_id = next_stage.id
                old_stage_name = old_stage.name

        detail_data = ICPQualificationDetailSerializer(qualification).data
        detail_data['stage_advanced'] = stage_advanced
        detail_data['previous_stage'] = old_stage_name
        detail_data['new_stage'] = new_stage_name
        detail_data['new_stage_id'] = new_stage_id
        detail_data['is_qualified'] = is_qualified

        msg = 'ICP qualification submitted and scored.'
        if stage_advanced:
            msg = f"ICP Qualification passed ({qualification.percentage}%). Lead automatically moved to '{new_stage_name}'."

        return Response({
            'success': True,
            'message': msg,
            'data': detail_data,
        }, status=status.HTTP_201_CREATED)


class LeadICPHistoryView(APIView):
    """Every qualification attempt for a lead, newest first, supporting product filter."""

    permission_classes = [ICPQualificationPermission]

    def get(self, request, lead_id):
        lead, error = _resolve_lead(request, lead_id)
        if error:
            return error

        product_param = request.query_params.get('product') or request.query_params.get('product_id')
        history_qs = (
            ICPQualification.objects.filter(lead=lead)
            .select_related('qualified_by', 'product')
            .annotate(answers_count=Count('answers'))
            .order_by('-qualified_at', '-id')
        )
        if product_param and product_param != 'all':
            if product_param in ('null', 'none', 'global'):
                history_qs = history_qs.filter(product__isnull=True)
            else:
                try:
                    history_qs = history_qs.filter(product_id=int(product_param))
                except (ValueError, TypeError):
                    pass

        history = list(history_qs)

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