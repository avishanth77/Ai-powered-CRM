from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .models import Lead, LeadStage, LeadSource, LeadNote, LeadHandover
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
)
from .permissions import LeadPermission, LeadSourcePermission, LeadStagePermission
from .filters import LeadFilter
from activity.services import log_activity
from activity.models import ActivityLog
from activity.serializers import ActivityLogSerializer
from customers.models import Customer
from customers.serializers import CustomerSerializer
from .services import send_lead_stage_update_email
from notifications.services import NotificationService

User = get_user_model()


class LeadStageViewSet(viewsets.ModelViewSet):
    """
    CRUD and dynamic management API for Lead Stages.
    - Admin: Full management (Create, Update, Delete, Reorder, Toggle Active)
    - Others: Read-only access to active stages
    """
    queryset = LeadStage.objects.annotate(leads_count=Count('leads')).order_by('display_order', 'id')
    serializer_class = LeadStageSerializer
    permission_classes = [LeadStagePermission]
    search_fields = ['name', 'description', 'slug']
    filterset_fields = ['is_active', 'is_system']

    def get_queryset(self):
        user = self.request.user
        qs = LeadStage.objects.annotate(leads_count=Count('leads')).order_by('display_order', 'id')
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
        lead=lead,
        actor=user
    )
    return customer


class LeadViewSet(viewsets.ModelViewSet):
    """
    Comprehensive Lead Management ViewSet:
    - Full CRUD with role-based scoping
    - Custom actions: convert, assign, handover, bulk-handover, notes, timeline, pipeline
    """
    permission_classes = [LeadPermission]
    filterset_class = LeadFilter
    search_fields = ['name', 'phone', 'email', 'company_name']
    ordering_fields = ['created_at', 'updated_at', 'name', 'expected_value', 'priority']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Lead.objects.select_related('source', 'stage', 'assigned_to', 'created_by') \
                         .annotate(
                             notes_count=Count('notes', distinct=True),
                             pending_followups_count=Count('follow_ups', filter=Q(follow_ups__status='PENDING'), distinct=True)
                         )

        if not user.is_authenticated:
            return qs.none()

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
            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=lead.id,
                action=action,
                old_value={'status': old_status, 'stage_id': old_stage.id if old_stage else None},
                new_value={'status': lead.status, 'stage_id': lead.stage.id, 'lost_reason': lead.lost_reason},
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
            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=lead.id,
                action=ActivityLog.ActionType.LEAD_UPDATED,
                performed_by=self.request.user,
                notes="Lead details updated"
            )

    def perform_destroy(self, instance):
        log_activity(
            entity_type=ActivityLog.EntityType.LEAD,
            entity_id=instance.id,
            action=ActivityLog.ActionType.LEAD_UPDATED,
            performed_by=self.request.user,
            notes=f"Lead {instance.name} was deleted."
        )
        instance.delete()

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

    @action(detail=False, methods=['get'])
    def pipeline(self, request):
        """
        Visual pipeline view: dynamically loads stages from LeadStage ordered by display_order.
        """
        qs = self.filter_queryset(self.get_queryset())
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
                'count': leads_in_stage.count(),
                'leads': LeadListSerializer(leads_in_stage, many=True).data
            }

        return Response({
            'success': True,
            'data': pipeline_data
        })
