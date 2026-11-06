from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import parsers
from django.db import transaction
from django.db.models import Count, Q, Sum
from decimal import Decimal
from django.utils import timezone
from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema, OpenApiParameter
import csv
import io
import json

from .models import (
    Lead,
    LeadStage,
    LeadSource,
    LeadNote,
    LeadHandover,
    StageTaskRule,
    LeadStageTask,
    CustomPropertyDefinition,
    CustomPropertyValue,
)
from .serializers import (
    LeadSourceSerializer,
    LeadStageSerializer,
    LeadHandoverSerializer,
    LeadHandoverRequestSerializer,
    LeadListSerializer,
    LeadDetailSerializer,
    LeadCreateUpdateSerializer,
    LeadNoteSerializer,
    LeadAssignSerializer,
    LeadStatusChangeSerializer,
    StageTaskRuleSerializer,
    LeadStageTaskSerializer,
    CustomPropertyDefinitionSerializer,
    CustomPropertyValueSerializer,
)
from .permissions import (
    LeadPermission,
    LeadSourcePermission,
    LeadStagePermission,
    StageTaskRulePermission,
    CustomPropertyPermission,
)
from .filters import LeadFilter
from activity.services import log_activity
from activity.models import ActivityLog
from activity.serializers import ActivityLogSerializer
from customers.models import Customer
from customers.serializers import CustomerSerializer
from .services import send_lead_stage_update_email, execute_stage_task_automations, complete_stage_task, reopen_stage_task, check_stage_progression
from notifications.services import NotificationService

User = get_user_model()


class LeadStageViewSet(viewsets.ModelViewSet):
    """
    CRUD and dynamic management API for Lead Stages.
    - Admin: Full management (Create, Update, Delete, Reorder, Toggle Active)
    - Others: Read-only access to active stages
    """
    queryset = LeadStage.objects.annotate(leads_count=Count('leads', distinct=True), task_rules_count=Count('task_rules', filter=Q(task_rules__is_active=True), distinct=True)).order_by('display_order', 'id')
    serializer_class = LeadStageSerializer
    permission_classes = [LeadStagePermission]
    search_fields = ['name', 'description', 'slug']
    filterset_fields = ['is_active', 'is_system']

    def get_queryset(self):
        user = self.request.user
        qs = LeadStage.objects.annotate(leads_count=Count('leads', distinct=True), task_rules_count=Count('task_rules', filter=Q(task_rules__is_active=True), distinct=True)).order_by('display_order', 'id')
        if not user.is_authenticated:
            return qs.none()

        include_all = (
            user.role == 'ADMIN' or
            user.is_superuser or
            self.request.query_params.get('all') == 'true' or
            self.request.query_params.get('include_inactive') == 'true'
        )
        if include_all:
            return qs
        return qs.filter(is_active=True)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user
        if not (user.role == 'ADMIN' or user.is_superuser):
            return Response({'success': False, 'message': 'Only Admins can delete stages.'}, status=status.HTTP_403_FORBIDDEN)

        # System stages receive additional protection
        if instance.is_system:
            return Response({
                'success': False,
                'message': f"Stage '{instance.name}' is a system stage and cannot be deleted."
            }, status=status.HTTP_400_BAD_REQUEST)

        leads_count = instance.leads.count()
        move_to_stage_id = request.data.get('move_to_stage') or request.query_params.get('move_to_stage')

        if leads_count > 0:
            if not move_to_stage_id:
                return Response({
                    'success': False,
                    'message': f"This stage is currently used by {leads_count} leads. Move these leads to another stage before deleting this stage.",
                    'leads_count': leads_count,
                    'can_move': True,
                    'stage_id': instance.id,
                    'stage_name': instance.name,
                }, status=status.HTTP_400_BAD_REQUEST)

            target_stage = LeadStage.objects.filter(id=move_to_stage_id, is_active=True).first()
            if not target_stage or target_stage.id == instance.id:
                return Response({
                    'success': False,
                    'message': "Invalid replacement stage selected. Target stage must exist, be active, and differ from deleted stage."
                }, status=status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                instance.leads.update(stage=target_stage)
                stage_name = instance.name
                instance.delete()

            return Response({
                'success': True,
                'message': f"Successfully moved {leads_count} leads to '{target_stage.name}' and deleted stage '{stage_name}'."
            }, status=status.HTTP_200_OK)

        stage_name = instance.name
        instance.delete()
        return Response({
            'success': True,
            'message': f"Stage '{stage_name}' was safely deleted."
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['patch'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        instance = self.get_object()
        user = request.user
        if not (user.role == 'ADMIN' or user.is_superuser):
            return Response({'success': False, 'message': 'Only Admins can activate/deactivate stages.'}, status=status.HTTP_403_FORBIDDEN)

        if 'is_active' in request.data:
            instance.is_active = bool(request.data['is_active'])
        else:
            instance.is_active = not instance.is_active
        instance.save(update_fields=['is_active', 'updated_at'])

        return Response({
            'success': True,
            'message': f"Stage '{instance.name}' is now {'active' if instance.is_active else 'inactive'}.",
            'data': LeadStageSerializer(instance).data
        })

    @action(detail=True, methods=['patch'], url_path='move')
    def move(self, request, pk=None):
        instance = self.get_object()
        user = request.user
        if not (user.role == 'ADMIN' or user.is_superuser):
            return Response({'success': False, 'message': 'Only Admins can reorder stages.'}, status=status.HTTP_403_FORBIDDEN)

        direction = request.data.get('direction')
        new_order = request.data.get('display_order')

        if direction == 'up':
            prev_stage = LeadStage.objects.filter(display_order__lt=instance.display_order).order_by('-display_order').first()
            if prev_stage:
                with transaction.atomic():
                    old_order = instance.display_order
                    instance.display_order = prev_stage.display_order
                    prev_stage.display_order = old_order
                    instance.save(update_fields=['display_order'])
                    prev_stage.save(update_fields=['display_order'])
            elif instance.display_order > 1:
                instance.display_order -= 1
                instance.save(update_fields=['display_order'])
        elif direction == 'down':
            next_stage = LeadStage.objects.filter(display_order__gt=instance.display_order).order_by('display_order').first()
            if next_stage:
                with transaction.atomic():
                    old_order = instance.display_order
                    instance.display_order = next_stage.display_order
                    next_stage.display_order = old_order
                    instance.save(update_fields=['display_order'])
                    next_stage.save(update_fields=['display_order'])
            else:
                instance.display_order += 1
                instance.save(update_fields=['display_order'])
        elif new_order is not None:
            try:
                val = int(new_order)
                if val < 1:
                    return Response({'success': False, 'message': 'Display order must be >= 1.'}, status=status.HTTP_400_BAD_REQUEST)
                instance.display_order = val
                instance.save(update_fields=['display_order'])
            except (ValueError, TypeError):
                return Response({'success': False, 'message': 'Invalid display order value.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'success': True,
            'message': f"Order updated for '{instance.name}'.",
            'data': LeadStageSerializer(instance).data
        })

    @action(detail=True, methods=['get'], url_path='stats')
    def stats(self, request, pk=None):
        instance = self.get_object()
        return Response({
            'success': True,
            'data': {
                'id': instance.id,
                'name': instance.name,
                'stage_name': instance.name,
                'is_active': instance.is_active,
                'active_status': instance.is_active,
                'number_of_leads': instance.leads.count(),
                'leads_count': instance.leads.count(),
                'order': instance.display_order,
                'display_order': instance.display_order,
            }
        })

    @action(detail=False, methods=['get'], url_path='funnel')
    def funnel(self, request):
        """
        Opportunity Stage Distribution & Win Probability Funnel data.
        Returns stages ordered by display_order, with win probability %, reason,
        active lead counts, pipeline distribution %, total value, and weighted forecast value.
        """
        user = request.user
        leads_qs = Lead.objects.all()
        if user.is_authenticated and user.role == 'EXECUTIVE' and not user.is_superuser:
            leads_qs = leads_qs.filter(Q(assigned_to=user) | Q(created_by=user))

        stages = LeadStage.objects.filter(is_active=True).order_by('display_order', 'id')
        total_leads = leads_qs.count()
        total_pipeline_val = leads_qs.aggregate(s=Sum('expected_value'))['s'] or Decimal('0.00')

        stage_data = []
        cumulative_weighted_forecast = Decimal('0.00')

        for stg in stages:
            stage_leads = leads_qs.filter(stage=stg)
            count = stage_leads.count()
            val = stage_leads.aggregate(s=Sum('expected_value'))['s'] or Decimal('0.00')
            win_prob = getattr(stg, 'win_probability', 10)
            reason = getattr(stg, 'win_probability_reason', '')
            weighted_val = (val * Decimal(win_prob) / Decimal('100.00')).quantize(Decimal('0.01'))
            cumulative_weighted_forecast += weighted_val
            dist_percent = round((count / total_leads * 100), 2) if total_leads > 0 else 0.0

            stage_data.append({
                'id': stg.id,
                'name': stg.name,
                'slug': stg.slug,
                'color': stg.color,
                'display_order': stg.display_order,
                'is_system': stg.is_system,
                'win_probability': win_prob,
                'win_probability_reason': reason,
                'leads_count': count,
                'distribution_percentage': dist_percent,
                'total_value': float(val),
                'weighted_value': float(weighted_val),
            })

        return Response({
            'success': True,
            'data': {
                'total_leads': total_leads,
                'total_pipeline_value': float(total_pipeline_val),
                'total_weighted_forecast': float(cumulative_weighted_forecast),
                'stages': stage_data,
            }
        })


class LeadSourceViewSet(viewsets.ModelViewSet):
    """
    CRUD API for Lead Sources.
    - Admin/Manager: Full management
    - Executive: Read-only access
    """
    queryset = LeadSource.objects.annotate(leads_count=Count('leads')).order_by('name')
    serializer_class = LeadSourceSerializer
    permission_classes = [LeadSourcePermission]
    search_fields = ['name', 'description']
    filterset_fields = ['is_active']


class CustomPropertyDefinitionViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for dynamic lead custom properties.
    Allows Admins and Managers to create, update, reorder, and toggle custom fields.
    All authenticated users can list active custom properties.
    """
    queryset = CustomPropertyDefinition.objects.all().order_by('section', 'display_order', 'id')
    serializer_class = CustomPropertyDefinitionSerializer
    permission_classes = [CustomPropertyPermission]
    search_fields = ['name', 'label', 'help_text', 'section']
    filterset_fields = ['section', 'field_type', 'is_mandatory', 'is_active']

    def get_queryset(self):
        user = self.request.user
        qs = CustomPropertyDefinition.objects.all().order_by('section', 'display_order', 'id')
        if not user.is_authenticated:
            return qs.none()
        include_all = (
            user.role in ['ADMIN', 'MANAGER'] or
            user.is_superuser or
            self.request.query_params.get('all') == 'true'
        )
        if include_all:
            return qs
        return qs.filter(is_active=True)

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        """
        Reorders custom property fields. Expects: `{"order": [{"id": 1, "display_order": 1}, ...]}`
        """
        order_list = request.data.get('order', [])
        if not isinstance(order_list, list):
            return Response({'error': 'Expected an array under "order".'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for item in order_list:
                prop_id = item.get('id')
                disp_order = item.get('display_order')
                if prop_id and disp_order is not None:
                    CustomPropertyDefinition.objects.filter(id=prop_id).update(display_order=disp_order)

        return Response({'success': True, 'message': 'Custom properties reordered successfully.'})


def ensure_customer_for_won_lead(lead, user=None):
    """
    Ensure a Customer record is created when a lead is in Won stage.
    """
    is_won = lead.stage and (lead.stage.slug == 'won' or lead.stage.name.lower() == 'won')
    if not is_won:
        return None

    if hasattr(lead, 'customer_profile') and lead.customer_profile:
        return lead.customer_profile

    if not lead.converted_at:
        lead.converted_at = timezone.now()
        lead.save(update_fields=['converted_at', 'updated_at'])

    customer = Customer.objects.create(
        lead=lead,
        name=lead.name,
        phone=lead.phone,
        email=lead.email,
        company_name=lead.company_name,
        address=lead.address,
        converted_at=lead.converted_at,
        created_by=user if (user and user.is_authenticated) else None
    )

    try:
        from products.models import CustomerProduct
        for lp in lead.lead_products.select_related('product').all():
            CustomerProduct.objects.get_or_create(
                customer=customer,
                product=lp.product,
                defaults={
                    'quantity': lp.quantity,
                    'unit_price': lp.unit_price,
                    'total_price': lp.total_price,
                    'status': 'ACTIVE'
                }
            )
    except Exception as e:
        logger.warning(f"Could not copy lead products to customer: {e}")

    log_activity(
        entity_type=ActivityLog.EntityType.LEAD,
        entity_id=lead.id,
        action=ActivityLog.ActionType.LEAD_CONVERTED,
        old_value={'stage': 'Won'},
        new_value={'status': 'Won', 'customer_id': customer.id},
        performed_by=user,
        notes=f"Customer account created as lead won"
    )
    log_activity(
        entity_type=ActivityLog.EntityType.CUSTOMER,
        entity_id=customer.id,
        action=ActivityLog.ActionType.CUSTOMER_CREATED,
        new_value={'lead_id': lead.id, 'name': customer.name},
        performed_by=user,
        notes=f"Customer record created from Won Lead #{lead.id} ({customer.name})"
    )
    NotificationService.notify_customer_conversion(
        customer=customer,
        actor=user
    )
    return customer


class StageTaskRuleViewSet(viewsets.ModelViewSet):
    """
    CRUD and dynamic management API for Stage Task Automation Rules.
    - Admin/Manager: Full management (Create, Update, Delete, Toggle Active)
    - Executives: Read-only access to active rules
    """
    queryset = StageTaskRule.objects.select_related(
        'stage', 'specific_user', 'fallback_user', 'created_by'
    ).prefetch_related('round_robin_users').all()
    serializer_class = StageTaskRuleSerializer
    permission_classes = [StageTaskRulePermission]
    search_fields = ['name', 'title', 'description_template', 'stage__name']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return StageTaskRule.objects.none()

        qs = StageTaskRule.objects.select_related(
            'stage', 'specific_user', 'fallback_user', 'created_by'
        ).prefetch_related('round_robin_users').all()

        stage_id = self.request.query_params.get('stage')
        if stage_id:
            try:
                qs = qs.filter(stage_id=int(stage_id))
            except (ValueError, TypeError):
                pass

        stage_slug = self.request.query_params.get('stage_slug')
        if stage_slug:
            qs = qs.filter(stage__slug__iexact=stage_slug)

        is_active_param = self.request.query_params.get('is_active')
        if is_active_param is not None:
            if is_active_param.lower() in ['true', '1']:
                qs = qs.filter(is_active=True)
            elif is_active_param.lower() in ['false', '0']:
                qs = qs.filter(is_active=False)

        return qs.order_by('stage__display_order', 'id')

    @action(detail=True, methods=['patch'], url_path='toggle-active')
    def toggle_active(self, request, pk=None):
        instance = self.get_object()
        instance.is_active = not instance.is_active
        instance.save(update_fields=['is_active', 'updated_at'])
        return Response({
            'success': True,
            'is_active': instance.is_active,
            'message': f"Task rule '{instance.name}' is now {'active' if instance.is_active else 'inactive'}."
        })

    @action(detail=False, methods=['get'], url_path='by-stage')
    def by_stage(self, request):
        stages = LeadStage.objects.filter(is_active=True).order_by('display_order', 'id')
        rules = self.get_queryset()
        data = []
        for stage in stages:
            stage_rules = rules.filter(stage=stage)
            data.append({
                'stage_id': stage.id,
                'stage_name': stage.name,
                'stage_slug': stage.slug,
                'stage_color': stage.color,
                'rules_count': stage_rules.count(),
                'active_rules_count': stage_rules.filter(is_active=True).count(),
                'rules': StageTaskRuleSerializer(stage_rules, many=True).data
            })
        return Response({'success': True, 'data': data})


class LeadViewSet(viewsets.ModelViewSet):
    """
    Comprehensive Lead Management ViewSet:
    - Full CRUD with role-based scoping
    - Custom actions: convert, assign, handover, bulk-handover, notes, timeline, pipeline
    """
    permission_classes = [LeadPermission]
    filterset_class = LeadFilter
    search_fields = [
        'name', 'first_name', 'last_name', 'phone', 'mobile_phone',
        'email', 'company_name', 'job_title', 'city', 'industry'
    ]
    ordering_fields = [
        'created_at', 'updated_at', 'name', 'expected_value',
        'priority', 'lead_score', 'expected_close_date', 'stage_entered_at'
    ]
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Lead.objects.select_related('source', 'stage', 'previous_stage', 'assigned_to', 'created_by') \
                         .prefetch_related('lead_products__product', 'custom_property_values__property_def') \
                         .annotate(
                             notes_count=Count('notes', distinct=True),
                             pending_followups_count=Count('follow_ups', filter=Q(follow_ups__status='PENDING'), distinct=True)
                         )

        if not user.is_authenticated:
            return qs.none()

        # Product filtering
        prod_filter = self.request.query_params.get('product') or self.request.query_params.get('product_id')
        if prod_filter:
            if str(prod_filter).isdigit():
                qs = qs.filter(lead_products__product_id=int(prod_filter)).distinct()
            else:
                qs = qs.filter(lead_products__product__code__iexact=prod_filter).distinct()

        # Admin and Manager can view all leads
        if user.role in ['ADMIN', 'MANAGER'] or user.is_superuser:
            return qs

        # Sales Executive: only assigned leads or leads they personally created
        return qs.filter(Q(assigned_to=user) | Q(created_by=user))

    def get_serializer_class(self):
        if self.action == 'list':
            return LeadListSerializer
        elif self.action == 'retrieve':
            return LeadDetailSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return LeadCreateUpdateSerializer
        return LeadDetailSerializer

    def perform_create(self, serializer):
        lead = serializer.save()
        log_activity(
            entity_type=ActivityLog.EntityType.LEAD,
            entity_id=lead.id,
            action=ActivityLog.ActionType.LEAD_CREATED,
            new_value={
                'name': lead.name,
                'phone': lead.phone,
                'status': lead.status,
                'stage': lead.stage.name if lead.stage else None,
                'priority': lead.priority,
                'assigned_to': lead.assigned_to.get_full_name() if lead.assigned_to else None,
            },
            performed_by=self.request.user,
            notes=f"Lead created by {self.request.user.get_full_name() or self.request.user.email}"
        )
        if lead.assigned_to:
            NotificationService.notify_lead_assigned(
                lead=lead,
                assignee=lead.assigned_to,
                actor=self.request.user
            )
        if lead.stage:
            execute_stage_task_automations(
                lead=lead,
                new_stage=lead.stage,
                old_stage=None,
                actor=self.request.user
            )
        if lead.stage and (lead.stage.slug == 'won' or lead.stage.name.lower() == 'won'):
            ensure_customer_for_won_lead(lead, self.request.user)

    def perform_update(self, serializer):
        old_lead = self.get_object()
        old_stage = old_lead.stage
        old_status = old_lead.status
        old_assigned = old_lead.assigned_to

        lead = serializer.save()

        # Automatically create Customer account if lead reached Won stage
        if lead.stage and (lead.stage.slug == 'won' or lead.stage.name.lower() == 'won'):
            ensure_customer_for_won_lead(lead, self.request.user)

        # Stage/Status change logging
        if old_stage != lead.stage:
            action = ActivityLog.ActionType.LEAD_MARKED_LOST if (lead.stage and lead.stage.slug == 'lost') else ActivityLog.ActionType.STATUS_CHANGED
            notes = f"Stage changed from {old_stage.name if old_stage else 'None'} to {lead.stage.name}"
            if lead.stage and lead.stage.slug == 'lost' and lead.lost_reason:
                notes += f" (Reason: {lead.lost_reason})"
            if lead.effective_win_probability is not None:
                notes += f" | Win Probability: {lead.effective_win_probability}%"
                if lead.effective_win_probability_reason:
                    notes += f" (Rationale: {lead.effective_win_probability_reason})"
            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=lead.id,
                action=action,
                old_value={
                    'status': old_status,
                    'stage_id': old_stage.id if old_stage else None,
                    'win_probability': old_lead.effective_win_probability,
                },
                new_value={
                    'status': lead.status,
                    'stage_id': lead.stage.id,
                    'lost_reason': lead.lost_reason,
                    'win_probability': lead.effective_win_probability,
                    'win_probability_reason': lead.win_probability_reason,
                },
                performed_by=self.request.user,
                notes=notes
            )

            # Automated customer email notification on stage change (safely queued post-commit)
            transaction.on_commit(
                lambda l=lead, os=old_stage, ns=lead.stage: send_lead_stage_update_email(lead=l, old_stage=os, new_stage=ns)
            )
            NotificationService.notify_stage_change(
                lead=lead,
                old_stage=old_stage,
                new_stage=lead.stage,
                actor=self.request.user
            )

            # Automated customizable task assignment on stage change
            auto_tasks = execute_stage_task_automations(
                lead=lead,
                new_stage=lead.stage,
                old_stage=old_stage,
                actor=self.request.user
            )
            self._created_automated_tasks = auto_tasks

        # Assignment change logging
        if old_assigned != lead.assigned_to:
            action = ActivityLog.ActionType.LEAD_REASSIGNED if old_assigned else ActivityLog.ActionType.LEAD_ASSIGNED
            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=lead.id,
                action=action,
                old_value={'assigned_to': old_assigned.get_full_name() if old_assigned else None},
                new_value={'assigned_to': lead.assigned_to.get_full_name() if lead.assigned_to else None},
                performed_by=self.request.user,
                notes=f"Assigned to {lead.assigned_to.get_full_name() if lead.assigned_to else 'None'}"
            )
            if lead.assigned_to:
                NotificationService.notify_lead_assigned(
                    lead=lead,
                    assignee=lead.assigned_to,
                    actor=self.request.user
                )

        # General update logging if no specific change logged
        if old_stage == lead.stage and old_assigned == lead.assigned_to:
            if (old_lead.win_probability_override != lead.win_probability_override or
                old_lead.win_probability_reason != lead.win_probability_reason):
                prob_notes = f"Win Probability updated to {lead.effective_win_probability}%"
                if lead.win_probability_reason:
                    prob_notes += f" (Reason: {lead.win_probability_reason})"
                log_activity(
                    entity_type=ActivityLog.EntityType.LEAD,
                    entity_id=lead.id,
                    action=ActivityLog.ActionType.LEAD_UPDATED,
                    old_value={'win_probability': old_lead.effective_win_probability, 'win_probability_reason': old_lead.win_probability_reason},
                    new_value={'win_probability': lead.effective_win_probability, 'win_probability_reason': lead.win_probability_reason},
                    performed_by=self.request.user,
                    notes=prob_notes
                )
            else:
                log_activity(
                    entity_type=ActivityLog.EntityType.LEAD,
                    entity_id=lead.id,
                    action=ActivityLog.ActionType.LEAD_UPDATED,
                    performed_by=self.request.user,
                    notes="Lead details updated"
                )

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        if hasattr(self, '_created_automated_tasks') and self._created_automated_tasks:
            from followups.serializers import FollowUpSerializer
            if isinstance(response.data, dict):
                response.data['automated_tasks'] = FollowUpSerializer(self._created_automated_tasks, many=True).data
                response.data['automated_tasks_count'] = len(self._created_automated_tasks)
        return response

    def perform_destroy(self, instance):
        log_activity(
            entity_type=ActivityLog.EntityType.LEAD,
            entity_id=instance.id,
            action=ActivityLog.ActionType.LEAD_UPDATED,
            performed_by=self.request.user,
            notes=f"Lead {instance.name} was deleted."
        )
        instance.delete()

    @action(
        detail=False,
        methods=['post'],
        permission_classes=[permissions.AllowAny],
        authentication_classes=[],
        url_path='public-contact'
    )
    def public_contact(self, request):
        """
        Public endpoint for website contact forms to submit new leads via POST.
        Can be accessed at POST /api/leads/public-contact/ as well as POST /api/leads/web-to-lead/.
        """
        from .views_public import PublicContactLeadView
        return PublicContactLeadView.as_view()(request._request if hasattr(request, '_request') else request)

    @action(detail=True, methods=['post'])
    def convert(self, request, pk=None):
        """
        Convert a QUALIFIED lead to Customer inside an atomic transaction.
        Preserves original lead, sets stage to Won, and records activity.
        Only Managers and Admins can convert leads.
        """
        user = request.user
        if user.role == 'EXECUTIVE' and not user.is_superuser:
            return Response({
                'success': False,
                'message': 'Only Managers and Admins are permitted to convert leads to customers.'
            }, status=status.HTTP_403_FORBIDDEN)

        lead = self.get_object()

        # Validation Rule: Only QUALIFIED leads can convert
        if not lead.stage or lead.stage.slug != 'qualified':
            return Response({
                'success': False,
                'message': f'Cannot convert lead. Only QUALIFIED leads can be converted (Current status: {lead.status}).'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Duplicate check: check if already converted
        if hasattr(lead, 'customer_profile') and lead.customer_profile:
            return Response({
                'success': False,
                'message': 'This lead has already been converted to a customer.',
                'data': CustomerSerializer(lead.customer_profile).data
            }, status=status.HTTP_400_BAD_REQUEST)

        won_stage = LeadStage.objects.filter(slug='won').first() or LeadStage.objects.filter(name__iexact='won').first()

        # Atomic conversion
        with transaction.atomic():
            old_stage = lead.stage
            if won_stage:
                lead.stage = won_stage
            lead.converted_at = timezone.now()
            lead.save(update_fields=['stage', 'converted_at', 'updated_at'])

            customer = Customer.objects.create(
                lead=lead,
                name=lead.name,
                phone=lead.phone,
                email=lead.email,
                company_name=lead.company_name,
                address=lead.address,
                converted_at=lead.converted_at,
                created_by=user
            )

            # Log activities
            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=lead.id,
                action=ActivityLog.ActionType.LEAD_CONVERTED,
                old_value={'status': 'Qualified'},
                new_value={'status': 'Won', 'customer_id': customer.id},
                performed_by=user,
                notes=f"Lead converted to Customer #{customer.id} ({customer.name})"
            )
            log_activity(
                entity_type=ActivityLog.EntityType.CUSTOMER,
                entity_id=customer.id,
                action=ActivityLog.ActionType.CUSTOMER_CREATED,
                new_value={'lead_id': lead.id, 'name': customer.name},
                performed_by=user,
                notes=f"Customer record created from Lead #{lead.id}"
            )

            # Automated customer email notification on conversion to Won stage (safely queued post-commit)
            if won_stage and old_stage != won_stage:
                transaction.on_commit(
                    lambda l=lead, os=old_stage, ns=won_stage: send_lead_stage_update_email(lead=l, old_stage=os, new_stage=ns)
                )
                execute_stage_task_automations(
                    lead=lead,
                    new_stage=won_stage,
                    old_stage=old_stage,
                    actor=user
                )

        return Response({
            'success': True,
            'message': 'Lead successfully converted to customer.',
            'data': {
                'customer': CustomerSerializer(customer).data,
                'lead': LeadDetailSerializer(lead).data
            }
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """
        Reassign lead to another user (Manager/Admin only).
        """
        user = request.user
        if user.role == 'EXECUTIVE' and not user.is_superuser:
            return Response({
                'success': False,
                'message': 'Only Managers and Admins can assign or reassign leads.'
            }, status=status.HTTP_403_FORBIDDEN)

        lead = self.get_object()
        serializer = LeadAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_user = serializer.validated_data['assigned_to']
        old_user = lead.assigned_to

        lead.assigned_to = new_user
        lead.save(update_fields=['assigned_to', 'updated_at'])

        action_type = ActivityLog.ActionType.LEAD_REASSIGNED if old_user else ActivityLog.ActionType.LEAD_ASSIGNED
        log_activity(
            entity_type=ActivityLog.EntityType.LEAD,
            entity_id=lead.id,
            action=action_type,
            old_value={'assigned_to': old_user.get_full_name() if old_user else None},
            new_value={'assigned_to': new_user.get_full_name() if new_user else None},
            performed_by=user,
            notes=f"Lead assigned to {new_user.get_full_name() or new_user.email}"
        )

        NotificationService.notify_lead_assigned(
            lead=lead,
            assignee=new_user,
            actor=user
        )

        return Response({
            'success': True,
            'message': f'Lead assigned to {new_user.get_full_name() or new_user.email}.',
            'data': LeadDetailSerializer(lead).data
        })

    @action(detail=True, methods=['post'], url_path='handover')
    def handover(self, request, pk=None):
        """
        Lead Handover API:
        Transfers lead ownership from one Sales Executive to another.
        Allowed only for ADMIN and SALES MANAGER.
        """
        user = request.user
        if user.role not in ['ADMIN', 'MANAGER'] and not user.is_superuser:
            return Response({
                'success': False,
                'message': 'Only Managers and Admins can hand over leads.'
            }, status=status.HTTP_403_FORBIDDEN)

        lead = self.get_object()
        serializer = LeadHandoverRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_user = serializer.validated_data['new_assigned_to']
        reason = serializer.validated_data['reason']

        # Prevent assigning to the same executive
        if lead.assigned_to_id == new_user.id:
            return Response({
                'success': False,
                'message': 'Cannot hand over lead to the currently assigned executive.'
            }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            old_user = lead.assigned_to
            lead.assigned_to = new_user
            lead.save(update_fields=['assigned_to', 'updated_at'])

            handover = LeadHandover.objects.create(
                lead=lead,
                previous_assignee=old_user,
                new_assignee=new_user,
                reason=reason,
                handed_over_by=user
            )

            old_name = old_user.get_full_name() or old_user.email if old_user else 'Unassigned'
            new_name = new_user.get_full_name() or new_user.email

            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=lead.id,
                action=ActivityLog.ActionType.LEAD_REASSIGNED,
                old_value={'assigned_to': old_name, 'user_id': old_user.id if old_user else None},
                new_value={'assigned_to': new_name, 'user_id': new_user.id, 'reason': reason},
                performed_by=user,
                notes=f"Lead handed over from {old_name} to {new_name}. Reason: {reason}"
            )

            NotificationService.notify_lead_handed_over(
                lead=lead,
                new_assignee=new_user,
                old_assignee=old_user,
                handed_over_by=user,
                reason=reason
            )

        return Response({
            'success': True,
            'message': 'Lead handed over successfully.',
            'lead': {
                'id': lead.id,
                'assigned_to': {
                    'id': new_user.id,
                    'name': new_name,
                    'email': new_user.email
                }
            }
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='bulk-handover')
    def bulk_handover(self, request):
        """
        Bulk Lead Handover API:
        Allows Admin and Manager to hand over multiple leads to a selected Sales Executive.
        """
        user = request.user
        if user.role not in ['ADMIN', 'MANAGER'] and not user.is_superuser:
            return Response({
                'success': False,
                'message': 'Only Managers and Admins can perform bulk lead handover.'
            }, status=status.HTTP_403_FORBIDDEN)

        lead_ids = request.data.get('lead_ids', [])
        new_assigned_to_id = request.data.get('new_assigned_to')
        reason = (request.data.get('reason') or '').strip()

        if not lead_ids or not isinstance(lead_ids, list):
            return Response({'success': False, 'message': 'Please provide a list of lead IDs.'}, status=status.HTTP_400_BAD_REQUEST)

        if not reason:
            return Response({'success': False, 'message': 'A handover reason is required.'}, status=status.HTTP_400_BAD_REQUEST)

        new_user = User.objects.filter(id=new_assigned_to_id, is_active=True).first()
        if not new_user:
            return Response({'success': False, 'message': 'Target user not found or inactive.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_user.role != User.Role.EXECUTIVE:
            return Response({'success': False, 'message': 'Target user must have Sales Executive role.'}, status=status.HTTP_400_BAD_REQUEST)

        leads = Lead.objects.filter(id__in=lead_ids)
        if not leads.exists():
            return Response({'success': False, 'message': 'No matching leads found.'}, status=status.HTTP_400_BAD_REQUEST)

        new_name = new_user.get_full_name() or new_user.email
        updated_count = 0

        with transaction.atomic():
            for lead in leads:
                if lead.assigned_to_id == new_user.id:
                    continue
                old_user = lead.assigned_to
                lead.assigned_to = new_user
                lead.save(update_fields=['assigned_to', 'updated_at'])

                LeadHandover.objects.create(
                    lead=lead,
                    previous_assignee=old_user,
                    new_assignee=new_user,
                    reason=reason,
                    handed_over_by=user
                )

                old_name = old_user.get_full_name() or old_user.email if old_user else 'Unassigned'
                log_activity(
                    entity_type=ActivityLog.EntityType.LEAD,
                    entity_id=lead.id,
                    action=ActivityLog.ActionType.LEAD_REASSIGNED,
                    old_value={'assigned_to': old_name, 'user_id': old_user.id if old_user else None},
                    new_value={'assigned_to': new_name, 'user_id': new_user.id, 'reason': reason},
                    performed_by=user,
                    notes=f"Lead handed over from {old_name} to {new_name}. Reason: {reason}"
                )
                NotificationService.notify_lead_handed_over(
                    lead=lead,
                    new_assignee=new_user,
                    old_assignee=old_user,
                    handed_over_by=user,
                    reason=reason
                )
                updated_count += 1

        return Response({
            'success': True,
            'message': f"Successfully handed over {updated_count} lead(s) to {new_name}.",
            'updated_count': updated_count
        })

    @action(
        detail=False,
        methods=['post'],
        url_path='import',
        parser_classes=[parsers.MultiPartParser, parsers.FormParser],
    )
    def import_leads(self, request):
        """
        Bulk Lead Import API:
        Accepts a CSV file upload and creates leads row by row.
        Expected columns (case-insensitive): Name, Phone, Email, Company,
        Source, Priority, Expected Value, Address.
        Rows that fail validation are skipped and reported per row.
        """
        user = request.user
        upload = request.FILES.get('file')
        if not upload:
            return Response({
                'success': False,
                'message': 'No CSV file was provided. Attach the file as "file".'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not upload.name.lower().endswith('.csv'):
            return Response({
                'success': False,
                'message': 'Invalid file type. Please upload a .csv file.'
            }, status=status.HTTP_400_BAD_REQUEST)

        max_size = 10 * 1024 * 1024
        if upload.size > max_size:
            return Response({
                'success': False,
                'message': 'File is too large. Maximum allowed size is 10MB.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            text = upload.read().decode('utf-8-sig')
        except (UnicodeDecodeError, ValueError):
            return Response({
                'success': False,
                'message': 'Could not read the file. Please upload a UTF-8 encoded CSV.'
            }, status=status.HTTP_400_BAD_REQUEST)

        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames:
            return Response({
                'success': False,
                'message': 'The CSV is empty or missing a header row.'
            }, status=status.HTTP_400_BAD_REQUEST)

        header_aliases = {
            'name': 'name',
            'full_name': 'name',
            'full name': 'name',
            'lead_name': 'name',
            'lead name': 'name',
            'contact_name': 'name',
            'contact name': 'name',
            'contact': 'name',
            'prospect': 'name',
            'first_name': 'first_name',
            'first name': 'first_name',
            'firstname': 'first_name',
            'first': 'first_name',
            'last_name': 'last_name',
            'last name': 'last_name',
            'lastname': 'last_name',
            'last': 'last_name',
            'phone': 'phone',
            'phone_number': 'phone',
            'phone number': 'phone',
            'phonenumber': 'phone',
            'mobile': 'phone',
            'mobile_number': 'phone',
            'mobile number': 'phone',
            'cell': 'phone',
            'tel': 'phone',
            'telephone': 'phone',
            'contact_number': 'phone',
            'contact number': 'phone',
            'email': 'email',
            'email_address': 'email',
            'email address': 'email',
            'emailaddress': 'email',
            'mail': 'email',
            'company': 'company_name',
            'company name': 'company_name',
            'company_name': 'company_name',
            'organization': 'company_name',
            'organisation': 'company_name',
            'business': 'company_name',
            'source': 'source',
            'lead source': 'source',
            'lead_source': 'source',
            'priority': 'priority',
            'expected value': 'expected_value',
            'expected_value': 'expected_value',
            'expectedvalue': 'expected_value',
            'deal value': 'expected_value',
            'deal_value': 'expected_value',
            'value': 'expected_value',
            'amount': 'expected_value',
            'address': 'address',
            'location': 'address',
            'city': 'address',
            'stage': 'status',
            'status': 'status',
        }
        column_map = {}
        for header in reader.fieldnames:
            key = (header or '').strip().lower()
            if key in header_aliases:
                column_map[header] = header_aliases[key]

        # Support user-customized column mapping from the upload modal
        raw_mapping = request.data.get('column_mapping')
        if raw_mapping:
            if isinstance(raw_mapping, str):
                try:
                    custom_mapping = json.loads(raw_mapping)
                except Exception:
                    custom_mapping = {}
            elif isinstance(raw_mapping, dict):
                custom_mapping = raw_mapping
            else:
                custom_mapping = {}

            if custom_mapping:
                explicit_map = {}
                for header, target_field in custom_mapping.items():
                    target_field = str(target_field or '').strip().lower()
                    if target_field and target_field not in ('skip', 'ignore', 'none', '-'):
                        explicit_map[header] = target_field
                if explicit_map:
                    column_map = explicit_map

        if not column_map:
            return Response({
                'success': False,
                'message': 'No recognizable lead columns found in CSV header. Valid columns include: Name, Phone, Email, Company, Source, Priority, Expected Value, Address.'
            }, status=status.HTTP_400_BAD_REQUEST)

        default_stage = request.data.get('default_stage')
        default_priority = request.data.get('default_priority')
        default_source = request.data.get('default_source')

        rows = list(reader)
        max_rows = 1000
        if len(rows) > max_rows:
            return Response({
                'success': False,
                'message': f'Too many rows. Maximum {max_rows} leads per import.'
            }, status=status.HTTP_400_BAD_REQUEST)

        imported = 0
        skipped = 0
        row_errors = []

        for index, row in enumerate(rows, start=2):  # header is row 1
            values = {}
            for header, field in column_map.items():
                cell = row.get(header)
                values[field] = cell.strip() if isinstance(cell, str) else cell

            if not any(values.values()):
                continue  # silently skip blank rows

            # Auto-assign or infer name if missing/empty
            name_val = values.get('name')
            if not name_val or not str(name_val).strip():
                fn = values.pop('first_name', '') or ''
                ln = values.pop('last_name', '') or ''
                combined = f"{fn} {ln}".strip()
                if combined:
                    values['name'] = combined
                elif values.get('company_name'):
                    values['name'] = f"{values['company_name']} Contact"
                elif values.get('email'):
                    local = str(values['email']).split('@')[0].replace('.', ' ').replace('_', ' ').title()
                    values['name'] = local or f"Prospect #{index}"
                elif values.get('phone'):
                    values['name'] = f"Prospect {values['phone']}"
                else:
                    values['name'] = f"Prospect #{index}"
            else:
                values.pop('first_name', None)
                values.pop('last_name', None)

            # Sanitize phone: optional; default to empty string if missing or placeholder
            phone_val = values.get('phone')
            if not phone_val or str(phone_val).strip().upper() in ('', 'N/A', 'NONE', 'NOT PROVIDED', '-', 'UNKNOWN', 'NULL', 'NO PHONE'):
                values['phone'] = ''

            if values.get('source'):
                source = LeadSource.objects.filter(name__iexact=values['source']).first()
                if not source:
                    skipped += 1
                    row_errors.append({
                        'row': index,
                        'message': f"Source '{values['source']}' was not found. Create it first or leave it blank."
                    })
                    continue
                values['source'] = source.id
            else:
                if default_source:
                    values['source'] = default_source
                else:
                    values.pop('source', None)

            if values.get('priority'):
                values['priority'] = values['priority'].upper()
            elif default_priority:
                values['priority'] = str(default_priority).upper()
            else:
                values.pop('priority', None)

            if not values.get('stage') and not values.get('status') and default_stage:
                values['stage'] = default_stage

            # Handle location fields: city, state, country, postal_code
            location_parts = []
            for loc_key in ('city', 'state', 'country', 'postal_code', 'zip', 'zip_code'):
                loc_val = values.pop(loc_key, None)
                if loc_val and str(loc_val).strip():
                    location_parts.append(str(loc_val).strip())
            if location_parts:
                loc_str = ', '.join(location_parts)
                if values.get('address'):
                    values['address'] = f"{values['address']}, {loc_str}"
                else:
                    values['address'] = loc_str

            # Extract note or comment fields
            note_content = (
                values.pop('notes', None) or
                values.pop('note', None) or
                values.pop('comment', None) or
                values.pop('comments', None) or
                ''
            )

            # Extract any remaining custom fields
            standard_lead_keys = {
                'name', 'phone', 'email', 'company_name', 'source',
                'stage', 'status', 'priority', 'expected_value',
                'address', 'lost_reason', 'assigned_to', 'product_ids'
            }
            custom_entries = []
            for k in list(values.keys()):
                if k not in standard_lead_keys:
                    val = values.pop(k)
                    if val is not None and str(val).strip():
                        label = k.replace('_', ' ').title()
                        custom_entries.append(f"{label}: {str(val).strip()}")

            for optional in ('email', 'company_name', 'address', 'expected_value'):
                if not values.get(optional):
                    values.pop(optional, None)

            serializer = LeadCreateUpdateSerializer(
                data=values, context={'request': request}
            )
            if serializer.is_valid():
                new_lead = serializer.save()
                imported += 1

                # Save custom fields and/or initial notes as LeadNote
                note_blocks = []
                if note_content and str(note_content).strip():
                    note_blocks.append(str(note_content).strip())
                if custom_entries:
                    note_blocks.append("Custom CRM Fields:\n" + "\n".join(f"• {e}" for e in custom_entries))

                if note_blocks:
                    LeadNote.objects.create(
                        lead=new_lead,
                        note_type=LeadNote.NoteType.GENERAL,
                        note_text="\n\n".join(note_blocks),
                        user=user if user.is_authenticated else None
                    )
            else:
                skipped += 1
                messages = []
                for field, field_errors in serializer.errors.items():
                    detail = '; '.join(str(e) for e in field_errors)
                    messages.append(f'{field}: {detail}')
                row_errors.append({'row': index, 'message': ' | '.join(messages)})

        total = imported + skipped
        return Response({
            'success': True,
            'message': f'Imported {imported} of {total} lead(s).' + (f' {skipped} row(s) skipped.' if skipped else ''),
            'data': {
                'imported': imported,
                'skipped': skipped,
                'total': total,
                'errors': row_errors[:50],
            }
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='handovers')
    def handovers(self, request, pk=None):
        """
        List handover history for this lead.
        """
        lead = self.get_object()
        history = lead.handovers.select_related('previous_assignee', 'new_assignee', 'handed_over_by').order_by('-created_at')
        serializer = LeadHandoverSerializer(history, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })

    @action(detail=True, methods=['get', 'post'])
    def notes(self, request, pk=None):
        """
        List communication notes or add a new note to this lead.
        """
        lead = self.get_object()

        if request.method == 'GET':
            notes = lead.notes.select_related('user').all().order_by('-created_at')
            serializer = LeadNoteSerializer(notes, many=True)
            return Response({
                'success': True,
                'data': serializer.data
            })

        # POST: add note
        serializer = LeadNoteSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        note = serializer.save(lead=lead, user=request.user)

        log_activity(
            entity_type=ActivityLog.EntityType.LEAD,
            entity_id=lead.id,
            action=ActivityLog.ActionType.NOTE_ADDED,
            new_value={'note_type': note.note_type, 'note_text': note.note_text[:100]},
            performed_by=request.user,
            notes=f"Added {note.get_note_type_display()} note"
        )

        return Response({
            'success': True,
            'message': 'Note added successfully.',
            'data': LeadNoteSerializer(note).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        """
        Retrieve complete activity audit timeline for this specific lead.
        """
        lead = self.get_object()
        activities = ActivityLog.objects.filter(
            entity_type=ActivityLog.EntityType.LEAD,
            entity_id=str(lead.id)
        ).select_related('performed_by').order_by('-created_at')

        serializer = ActivityLogSerializer(activities, many=True)
        return Response({
            'success': True,
            'data': serializer.data
        })

    @action(detail=True, methods=['patch', 'post'], url_path='custom-properties')
    def update_custom_properties(self, request, pk=None):
        """
        Update or batch-set custom properties on a lead.
        Accepts: {"properties": {"key": "val", ...}} or directly {"key": "val", ...}
        """
        lead = self.get_object()
        data = request.data.get('properties', request.data)
        if not isinstance(data, dict):
            return Response({'error': 'Invalid format. Expected key-value dictionary of properties.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for key, val in data.items():
                lookup = Q(name=str(key))
                if str(key).isdigit():
                    lookup |= Q(id=int(key))
                prop_def = CustomPropertyDefinition.objects.filter(lookup).first()
                if not prop_def:
                    continue
                val_obj, _ = CustomPropertyValue.objects.get_or_create(lead=lead, property_def=prop_def)
                if isinstance(val, (dict, list)):
                    val_obj.value_json = val
                    val_obj.value_text = json.dumps(val)
                else:
                    val_obj.value_text = str(val) if val is not None else ''
                    val_obj.value_json = None
                val_obj.save()

        # Log activity
        log_activity(
            entity_type=ActivityLog.EntityType.LEAD,
            entity_id=lead.id,
            action=ActivityLog.ActionType.LEAD_UPDATED,
            notes=f"Updated custom properties for {lead.name}",
            performed_by=request.user
        )

        fresh_lead = Lead.objects.prefetch_related('custom_property_values__property_def', 'lead_products__product').get(id=lead.id)
        serializer = LeadDetailSerializer(fresh_lead, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'])
    def ai_summary(self, request, pk=None):
        """
        AI Lead Synthesis & Summary feature (Optional AI Module).
        """
        lead = self.get_object()
        notes = lead.notes.all().order_by('created_at')
        followups = lead.follow_ups.all().order_by('follow_up_at')

        notes_count = notes.count()
        notes_text = " ".join([n.note_text for n in notes])
        
        summary_text = (
            f"Prospect {lead.name} from {lead.company_name or 'Independent'} is currently in {lead.status} stage "
            f"with an estimated pipeline opportunity of ${lead.expected_value:,.2f}. "
            f"The account has logged {notes_count} touchpoints and {followups.count()} scheduled activities."
        )

        requirements = []
        objections = []
        
        if "expansion" in notes_text.lower() or "scale" in notes_text.lower() or "grow" in notes_text.lower():
            requirements.append("Infrastructure scaling and multi-seat team automation")
        if "security" in notes_text.lower() or "compliance" in notes_text.lower() or "review" in notes_text.lower():
            requirements.append("Enterprise security compliance and SLA guarantees")
        if not requirements:
            requirements.append("Custom workflow integration and initial team onboarding")

        if "discount" in notes_text.lower() or "budget" in notes_text.lower() or "cost" in notes_text.lower() or "price" in notes_text.lower():
            objections.append("Pricing sensitivity: Customer requested discount/tier adjustment")
        if "competitor" in notes_text.lower() or "alternative" in notes_text.lower():
            objections.append("Evaluating competing alternatives in the market")
        if not objections and lead.stage and lead.stage.slug == 'lost':
            objections.append(f"Recorded lost factor: {lead.lost_reason or 'Competitor / Budget'}")
        if not objections:
            objections.append("Standard timeline alignment and stakeholder consensus")

        # Next recommended follow-up action
        slug = lead.stage.slug if lead.stage else ''
        if slug == 'qualified':
            next_action = "Initiate commercial proposal review and schedule executive customer conversion meeting."
        elif slug == 'demo-scheduled':
            next_action = "Prepare customized product demo tailored to highlighted operational requirements."
        elif slug == 'negotiation':
            next_action = "Follow up with procurement team regarding approved SLA and payment terms."
        elif slug == 'lost':
            next_action = "Enroll in quarterly re-engagement nurture campaign."
        else:
            next_action = "Conduct discovery call to map decision makers and technical timeline."

        return Response({
            'success': True,
            'is_ai_generated': True,
            'disclaimer': 'This summary is synthesized by CRM Lite AI Assistant. Review information before making business commitments.',
            'data': {
                'lead_id': lead.id,
                'lead_name': lead.name,
                'current_stage': lead.status,
                'executive_summary': summary_text,
                'customer_requirements': requirements,
                'main_objections': objections,
                'recommended_next_action': next_action,
                'generated_at': timezone.now().isoformat()
            }
        })

    @action(detail=True, methods=['get', 'post'], url_path='stage-tasks')
    def stage_tasks(self, request, pk=None):
        """
        GET: Return all stage tasks for this lead, grouped by stage, plus summary.
        POST: Create a custom stage task for this lead.
        """
        lead = self.get_object()

        if request.method == 'POST':
            data = request.data.copy()
            data['lead'] = lead.id
            if not data.get('stage'):
                data['stage'] = lead.stage_id
            serializer = LeadStageTaskSerializer(data=data, context={'request': request})
            serializer.is_valid(raise_exception=True)
            task = serializer.save()
            return Response({
                'success': True,
                'message': f"Task '{task.title}' created.",
                'data': serializer.data,
                'stage_task_summary': lead.get_stage_task_summary(),
            }, status=status.HTTP_201_CREATED)

        stage_id = request.query_params.get('stage')
        target_stage = lead.stage
        if stage_id:
            try:
                target_stage = LeadStage.objects.get(id=int(stage_id))
            except (LeadStage.DoesNotExist, ValueError):
                target_stage = lead.stage

        if target_stage:
            rules_count = StageTaskRule.objects.filter(stage=target_stage, is_active=True).count()
            existing_count = lead.stage_tasks.filter(stage=target_stage).count()
            if rules_count > 0 and existing_count == 0:
                from leads.services.progression import instantiate_stage_tasks
                instantiate_stage_tasks(lead, target_stage, actor=request.user)

        qs = lead.stage_tasks.select_related('stage', 'assigned_to', 'completed_by', 'dependency').all()
        if stage_id:
            try:
                qs = qs.filter(stage_id=int(stage_id))
            except (ValueError, TypeError):
                pass

        tasks_data = LeadStageTaskSerializer(qs, many=True).data
        summary = lead.get_stage_task_summary()

        return Response({
            'success': True,
            'data': {
                'lead_id': lead.id,
                'lead_name': lead.name,
                'current_stage': {
                    'id': lead.stage.id if lead.stage else None,
                    'name': lead.stage.name if lead.stage else '',
                    'color': lead.stage.color if lead.stage else '#6366F1',
                },
                'summary': summary,
                'tasks': tasks_data,
            }
        })

    @action(detail=True, methods=['get'], url_path='progression-status')
    def progression_status(self, request, pk=None):
        """
        Detailed progression readiness check.
        Evaluates whether this lead can move to a target stage.
        """
        lead = self.get_object()
        target_stage_id = request.query_params.get('target_stage')
        target_stage = None
        if target_stage_id:
            try:
                target_stage = LeadStage.objects.filter(pk=int(target_stage_id)).first()
            except (ValueError, TypeError):
                pass

        if not target_stage:
            current_order = lead.stage.display_order if lead.stage else 0
            target_stage = LeadStage.objects.filter(
                is_active=True,
                display_order__gt=current_order
            ).exclude(slug__in=['lost', 'won']).order_by('display_order').first()

        can_progress, missing_tasks, message = check_stage_progression(
            lead, target_stage, actor=request.user
        )

        return Response({
            'success': True,
            'data': {
                'lead_id': lead.id,
                'lead_name': lead.name,
                'current_stage': {
                    'id': lead.stage.id if lead.stage else None,
                    'name': lead.stage.name if lead.stage else '',
                    'color': lead.stage.color if lead.stage else '#6366F1',
                },
                'target_stage': {
                    'id': target_stage.id if target_stage else None,
                    'name': target_stage.name if target_stage else '',
                } if target_stage else None,
                'can_progress': can_progress,
                'message': message,
                'missing_tasks': missing_tasks,
                'summary': lead.get_stage_task_summary(),
            }
        })

    @action(detail=False, methods=['get'])
    def pipeline(self, request):
        """
        Visual pipeline view: dynamically loads stages from LeadStage ordered by display_order.
        """
        qs = self.filter_queryset(self.get_queryset())
        prod_filter = request.query_params.get('product') or request.query_params.get('product_id')
        if prod_filter:
            if str(prod_filter).isdigit():
                qs = qs.filter(lead_products__product_id=int(prod_filter)).distinct()
            else:
                qs = qs.filter(lead_products__product__code__iexact=prod_filter).distinct()
        stages = LeadStage.objects.filter(is_active=True).order_by('display_order', 'id')

        pipeline_data = {}
        for stage in stages:
            leads_in_stage = qs.filter(stage=stage)
            pipeline_data[stage.slug] = {
                'id': stage.id,
                'stage': stage.slug,
                'label': stage.name,
                'color': stage.color,
                'display_order': stage.display_order,
                'win_probability': getattr(stage, 'win_probability', 10),
                'win_probability_reason': getattr(stage, 'win_probability_reason', ''),
                'count': leads_in_stage.count(),
                'leads': LeadListSerializer(leads_in_stage, many=True).data
            }

        return Response({
            'success': True,
            'data': pipeline_data
        })



class LeadStageTaskViewSet(viewsets.ModelViewSet):
    """
    API for managing individual Lead Stage Tasks.
    - View stage tasks across leads (filtered by lead, stage, status, assignee, priority, is_mandatory)
    - Create ad-hoc stage tasks
    - Update task details (status, notes, outcome, assignee, due date)
    - Quick completion/reopen action (toggle_complete)
    - Reassignment action
    - Centralized manager overview dashboard endpoint
    """
    queryset = LeadStageTask.objects.select_related(
        'lead', 'stage', 'assigned_to', 'completed_by', 'approved_by', 'dependency', 'rule'
    ).all()
    serializer_class = LeadStageTaskSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return LeadStageTask.objects.none()

        qs = LeadStageTask.objects.select_related(
            'lead', 'stage', 'assigned_to', 'completed_by', 'approved_by', 'dependency', 'rule'
        ).all()

        lead_id = self.request.query_params.get('lead') or self.request.query_params.get('lead_id')
        if lead_id:
            try:
                qs = qs.filter(lead_id=int(lead_id))
            except (ValueError, TypeError):
                pass

        stage_id = self.request.query_params.get('stage') or self.request.query_params.get('stage_id')
        if stage_id:
            try:
                qs = qs.filter(stage_id=int(stage_id))
            except (ValueError, TypeError):
                pass

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status__iexact=status_param.strip())

        assigned_to = self.request.query_params.get('assigned_to')
        if assigned_to:
            if assigned_to == 'me':
                qs = qs.filter(assigned_to=user)
            elif assigned_to == 'unassigned':
                qs = qs.filter(assigned_to__isnull=True)
            else:
                try:
                    qs = qs.filter(assigned_to_id=int(assigned_to))
                except (ValueError, TypeError):
                    pass

        mandatory_param = self.request.query_params.get('is_mandatory')
        if mandatory_param is not None:
            if mandatory_param.lower() in ['true', '1']:
                qs = qs.filter(is_mandatory=True)
            elif mandatory_param.lower() in ['false', '0']:
                qs = qs.filter(is_mandatory=False)

        overdue_param = self.request.query_params.get('overdue')
        if overdue_param is not None and overdue_param.lower() in ['true', '1']:
            qs = qs.filter(
                status__in=[LeadStageTask.Status.PENDING, LeadStageTask.Status.IN_PROGRESS],
                due_date__lt=timezone.now()
            )

        if user.role == User.Role.EXECUTIVE and not user.is_superuser:
            qs = qs.filter(
                Q(assigned_to=user) |
                Q(lead__assigned_to=user) |
                Q(lead__created_by=user)
            )

        return qs.order_by('stage__display_order', 'order', 'due_date', 'id')

    def perform_create(self, serializer):
        task = serializer.save()
        log_activity(
            entity_type='stage_task',
            entity_id=task.id,
            action='stage_task_created',
            new_value={
                'title': task.title,
                'lead_id': task.lead_id,
                'stage': task.stage.name,
                'is_mandatory': task.is_mandatory,
                'assigned_to': task.assigned_to.get_full_name() if task.assigned_to else None,
            },
            performed_by=self.request.user,
            notes=f"Created stage task '{task.title}' on Lead #{task.lead_id} ({task.stage.name})."
        )

    def perform_destroy(self, instance):
        lead_id = instance.lead_id
        title = instance.title
        stage_name = instance.stage.name
        if instance.follow_up:
            instance.follow_up.delete()
        instance.delete()
        log_activity(
            entity_type='stage_task',
            entity_id=instance.id,
            action='stage_task_deleted',
            performed_by=self.request.user,
            notes=f"Deleted stage task '{title}' from Lead #{lead_id} ({stage_name})."
        )

    @action(detail=True, methods=['post'], url_path='toggle-complete')
    def toggle_complete(self, request, pk=None):
        task = self.get_object()
        outcome_notes = request.data.get('outcome_notes', '').strip()

        if task.status == LeadStageTask.Status.COMPLETED:
            reopen_stage_task(task, actor=request.user)
            action_label = 'reopened'
        else:
            complete_stage_task(task, actor=request.user, outcome_notes=outcome_notes)
            action_label = 'completed'

        serializer = self.get_serializer(task)
        summary = task.lead.get_stage_task_summary()
        return Response({
            'success': True,
            'message': f"Task '{task.title}' marked as {action_label}.",
            'data': serializer.data,
            'stage_task_summary': summary,
        })

    @action(detail=True, methods=['post'], url_path='reassign')
    def reassign(self, request, pk=None):
        task = self.get_object()
        user = request.user
        if user.role == User.Role.EXECUTIVE and not user.is_superuser:
            if task.assigned_to != user and task.lead.assigned_to != user:
                return Response({
                    'success': False,
                    'message': 'Only Managers and Admins (or the lead owner) can reassign stage tasks.'
                }, status=status.HTTP_403_FORBIDDEN)

        new_user_id = request.data.get('assigned_to')
        new_user = User.objects.filter(pk=new_user_id, is_active=True).first() if new_user_id else None

        old_assignee = task.assigned_to
        task.assigned_to = new_user
        task.save(update_fields=['assigned_to', 'updated_at'])

        if task.follow_up:
            task.follow_up.assigned_to = new_user
            task.follow_up.save(update_fields=['assigned_to', 'updated_at'])

        log_activity(
            entity_type='stage_task',
            entity_id=task.id,
            action='stage_task_reassigned',
            old_value={'assigned_to': old_assignee.get_full_name() if old_assignee else None},
            new_value={'assigned_to': new_user.get_full_name() if new_user else None},
            performed_by=user,
            notes=f"Reassigned task '{task.title}' to {new_user.get_full_name() if new_user else 'Unassigned'}."
        )

        return Response({
            'success': True,
            'message': f"Task reassigned to {new_user.get_full_name() if new_user else 'Unassigned'}.",
            'data': self.get_serializer(task).data
        })

    @action(detail=False, methods=['get'], url_path='manager-overview')
    def manager_overview(self, request):
        now = timezone.now()
        qs = LeadStageTask.objects.select_related('lead', 'stage', 'assigned_to').all()

        total = qs.count()
        pending = qs.filter(status=LeadStageTask.Status.PENDING).count()
        in_progress = qs.filter(status=LeadStageTask.Status.IN_PROGRESS).count()
        completed = qs.filter(status=LeadStageTask.Status.COMPLETED).count()
        overdue = qs.filter(
            status__in=[LeadStageTask.Status.PENDING, LeadStageTask.Status.IN_PROGRESS],
            due_date__lt=now
        ).count()
        mandatory_pending = qs.filter(
            is_mandatory=True,
            status__in=[LeadStageTask.Status.PENDING, LeadStageTask.Status.IN_PROGRESS]
        ).count()

        by_assignee = []
        for rep in User.objects.filter(role=User.Role.EXECUTIVE, is_active=True):
            rep_tasks = qs.filter(assigned_to=rep)
            rep_total = rep_tasks.count()
            rep_pending = rep_tasks.filter(status__in=[LeadStageTask.Status.PENDING, LeadStageTask.Status.IN_PROGRESS]).count()
            rep_completed = rep_tasks.filter(status=LeadStageTask.Status.COMPLETED).count()
            rep_overdue = rep_tasks.filter(
                status__in=[LeadStageTask.Status.PENDING, LeadStageTask.Status.IN_PROGRESS],
                due_date__lt=now
            ).count()
            by_assignee.append({
                'id': rep.id,
                'name': rep.get_full_name(),
                'email': rep.email,
                'total': rep_total,
                'pending': rep_pending,
                'completed': rep_completed,
                'overdue': rep_overdue,
            })

        by_stage = []
        for stg in LeadStage.objects.filter(is_active=True).order_by('display_order'):
            stg_tasks = qs.filter(stage=stg)
            stg_total = stg_tasks.count()
            stg_mandatory = stg_tasks.filter(is_mandatory=True).count()
            stg_completed = stg_tasks.filter(status=LeadStageTask.Status.COMPLETED).count()
            by_stage.append({
                'id': stg.id,
                'name': stg.name,
                'color': stg.color,
                'total': stg_total,
                'mandatory': stg_mandatory,
                'completed': stg_completed,
            })

        return Response({
            'success': True,
            'data': {
                'total': total,
                'pending': pending,
                'in_progress': in_progress,
                'completed': completed,
                'overdue': overdue,
                'mandatory_pending': mandatory_pending,
                'by_assignee': by_assignee,
                'by_stage': by_stage,
            }
        })
