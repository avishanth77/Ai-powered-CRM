from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .models import Lead, LeadSource, LeadNote
from .serializers import (
    LeadSourceSerializer,
    LeadListSerializer,
    LeadDetailSerializer,
    LeadCreateUpdateSerializer,
    LeadNoteSerializer,
    LeadAssignSerializer,
    LeadStatusChangeSerializer,
)
from .permissions import LeadPermission, LeadSourcePermission
from .filters import LeadFilter
from activity.services import log_activity
from activity.models import ActivityLog
from activity.serializers import ActivityLogSerializer
from customers.models import Customer
from customers.serializers import CustomerSerializer

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


class LeadViewSet(viewsets.ModelViewSet):
    """
    Comprehensive Lead Management ViewSet:
    - Full CRUD with role-based scoping
    - Custom actions: convert, assign, notes, timeline, pipeline
    """
    permission_classes = [LeadPermission]
    filterset_class = LeadFilter
    search_fields = ['name', 'phone', 'email', 'company_name']
    ordering_fields = ['created_at', 'updated_at', 'name', 'expected_value', 'status', 'priority']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Lead.objects.select_related('source', 'assigned_to', 'created_by') \
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
                'priority': lead.priority,
                'assigned_to': lead.assigned_to.get_full_name() if lead.assigned_to else None,
            },
            performed_by=self.request.user,
            notes=f"Lead created by {self.request.user.get_full_name() or self.request.user.email}"
        )

    def perform_update(self, serializer):
        old_lead = self.get_object()
        old_status = old_lead.status
        old_assigned = old_lead.assigned_to

        lead = serializer.save()

        # Status change logging
        if old_status != lead.status:
            action = ActivityLog.ActionType.LEAD_MARKED_LOST if lead.status == Lead.Status.LOST else ActivityLog.ActionType.STATUS_CHANGED
            notes = f"Status changed from {old_status} to {lead.status}"
            if lead.status == Lead.Status.LOST and lead.lost_reason:
                notes += f" (Reason: {lead.lost_reason})"
            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=lead.id,
                action=action,
                old_value={'status': old_status},
                new_value={'status': lead.status, 'lost_reason': lead.lost_reason},
                performed_by=self.request.user,
                notes=notes
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

        # General update logging if no specific change logged
        if old_status == lead.status and old_assigned == lead.assigned_to:
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
        Preserves original lead, sets status to WON, and records activity.
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
        if lead.status != Lead.Status.QUALIFIED:
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

        # Atomic conversion
        with transaction.atomic():
            lead.status = Lead.Status.WON
            lead.converted_at = timezone.now()
            lead.save(update_fields=['status', 'converted_at', 'updated_at'])

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
                old_value={'status': Lead.Status.QUALIFIED},
                new_value={'status': Lead.Status.WON, 'customer_id': customer.id},
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

        return Response({
            'success': True,
            'message': f'Lead assigned to {new_user.get_full_name() or new_user.email}.',
            'data': LeadDetailSerializer(lead).data
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
        Analyzes lead notes, stage, and engagement history to extract:
        - Executive Summary
        - Identified Requirements
        - Primary Objections / Risk Factors
        - Recommended Next Action
        Clearly marked as AI-generated.
        """
        lead = self.get_object()
        notes = lead.notes.all().order_by('created_at')
        followups = lead.follow_ups.all().order_by('follow_up_at')

        notes_count = notes.count()
        notes_text = " ".join([n.note_text for n in notes])
        
        # Rule-based NLP extraction heuristic
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
        if not objections and lead.status == Lead.Status.LOST:
            objections.append(f"Recorded lost factor: {lead.lost_reason or 'Competitor / Budget'}")
        if not objections:
            objections.append("Standard timeline alignment and stakeholder consensus")

        # Next recommended follow-up action
        if lead.status == Lead.Status.QUALIFIED:
            next_action = "Initiate commercial proposal review and schedule executive customer conversion meeting."
        elif lead.status == Lead.Status.DEMO_SCHEDULED:
            next_action = "Prepare customized product demo tailored to highlighted operational requirements."
        elif lead.status == Lead.Status.NEGOTIATION:
            next_action = "Follow up with procurement team regarding approved SLA and payment terms."
        elif lead.status == Lead.Status.LOST:
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
        Visual pipeline view: returns leads grouped into columns by status.
        """
        qs = self.filter_queryset(self.get_queryset())
        
        stages = [
            Lead.Status.NEW,
            Lead.Status.CONTACTED,
            Lead.Status.DEMO_SCHEDULED,
            Lead.Status.NEGOTIATION,
            Lead.Status.QUALIFIED,
            Lead.Status.WON,
            Lead.Status.LOST,
        ]

        pipeline_data = {}
        for stage in stages:
            leads_in_stage = qs.filter(status=stage)
            pipeline_data[stage] = {
                'stage': stage,
                'label': dict(Lead.Status.choices).get(stage, stage),
                'count': leads_in_stage.count(),
                'leads': LeadListSerializer(leads_in_stage, many=True).data
            }

        return Response({
            'success': True,
            'data': pipeline_data
        })
