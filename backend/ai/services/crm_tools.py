"""
Controlled CRM Tools for AI Assistant.
Provides safe, read-only data access functions scoped authoritatively to the authenticated user's role,
and validation helpers for confirmation-required write actions.
"""
import logging
from typing import Dict, Any, List, Optional
from django.utils import timezone
from django.db.models import Sum, Count, Q
from leads.models import Lead, LeadStage
from followups.models import FollowUp
from activity.models import ActivityLog
from customers.models import Customer

logger = logging.getLogger(__name__)


class CRMTools:
    """
    Controlled query tools scoped strictly to the authenticated user's permissions.
    """

    @staticmethod
    def _is_privileged(user) -> bool:
        return bool(user.is_superuser or (hasattr(user, 'role') and user.role in ['ADMIN', 'MANAGER']))

    @staticmethod
    def get_scoped_leads_qs(user):
        qs = Lead.objects.select_related('stage', 'assigned_to', 'created_by').all()
        if not user.is_authenticated:
            return qs.none()
        if CRMTools._is_privileged(user):
            return qs
        return qs.filter(Q(assigned_to=user) | Q(created_by=user))

    @staticmethod
    def get_scoped_followups_qs(user):
        qs = FollowUp.objects.select_related('lead', 'assigned_to').all()
        if not user.is_authenticated:
            return qs.none()
        if CRMTools._is_privileged(user):
            return qs
        return qs.filter(Q(assigned_to=user) | Q(lead__assigned_to=user) | Q(lead__created_by=user))

    @staticmethod
    def get_my_leads(user, limit: int = 10) -> List[Dict[str, Any]]:
        """Retrieve active leads accessible to the user."""
        leads = CRMTools.get_scoped_leads_qs(user).order_by('-created_at')[:limit]
        return [
            {
                "id": ld.id,
                "name": ld.name,
                "company_name": ld.company_name or "",
                "stage": ld.stage.name if ld.stage else (getattr(ld, 'status', '') or 'New'),
                "expected_value": float(ld.expected_value or 0),
                "priority": ld.priority,
                "phone": ld.phone or "",
                "email": ld.email or "",
            }
            for ld in leads
        ]

    @staticmethod
    def get_lead_details(user, query: Any) -> Optional[Dict[str, Any]]:
        """Retrieve comprehensive details of a specific lead by ID or name."""
        qs = CRMTools.get_scoped_leads_qs(user)
        target = None
        if str(query).isdigit():
            target = qs.filter(pk=int(query)).first()
        if not target and isinstance(query, str):
            target = qs.filter(name__icontains=query.strip()).first()
            if not target:
                target = qs.filter(company_name__icontains=query.strip()).first()

        if not target:
            return None

        # Fetch recent calls on this lead
        recent_calls = []
        if hasattr(target, 'calls'):
            for c in target.calls.order_by('-started_at')[:3]:
                recent_calls.append({
                    "id": c.id,
                    "call_type": c.call_type,
                    "started_at": c.started_at.strftime('%Y-%m-%d %H:%M') if c.started_at else "",
                    "duration_seconds": c.duration_seconds,
                    "summary": c.ai_summary,
                    "next_action": c.next_action,
                })

        # Fetch upcoming followups
        upcoming_followups = []
        if hasattr(target, 'follow_ups'):
            for f in target.follow_ups.order_by('follow_up_at')[:3]:
                upcoming_followups.append({
                    "id": f.id,
                    "follow_up_at": f.follow_up_at.strftime('%Y-%m-%d %H:%M') if f.follow_up_at else "",
                    "status": f.status,
                    "purpose": f.purpose,
                    "notes": f.notes or "",
                })

        return {
            "id": target.id,
            "name": target.name,
            "company_name": target.company_name or "",
            "stage": target.stage.name if target.stage else (getattr(target, 'status', '') or 'New'),
            "expected_value": float(target.expected_value or 0),
            "priority": target.priority,
            "phone": target.phone or "",
            "email": target.email or "",
            "assigned_to": target.assigned_to.email if target.assigned_to else "Unassigned",
            "recent_calls": recent_calls,
            "upcoming_followups": upcoming_followups,
        }

    @staticmethod
    def get_overdue_followups(user) -> Dict[str, Any]:
        """Retrieve overdue follow-ups accessible to user."""
        now = timezone.now()
        qs = CRMTools.get_scoped_followups_qs(user).filter(
            Q(status=FollowUp.Status.OVERDUE) | (Q(status=FollowUp.Status.PENDING) & Q(follow_up_at__lt=now))
        ).order_by('follow_up_at')

        count = qs.count()
        items = []
        for fu in qs[:5]:
            lead_name = fu.lead.name if fu.lead else "Unknown Lead"
            company = fu.lead.company_name if fu.lead else ""
            val = float(fu.lead.expected_value or 0) if fu.lead else 0
            items.append({
                "id": fu.id,
                "lead_id": fu.lead_id,
                "lead_name": lead_name,
                "company_name": company,
                "expected_value": val,
                "scheduled_at": fu.follow_up_at.strftime('%Y-%m-%d %H:%M') if fu.follow_up_at else "",
                "purpose": fu.purpose,
                "notes": fu.notes or "",
            })

        return {
            "count": count,
            "followups": items,
        }

    @staticmethod
    def get_today_followups(user) -> Dict[str, Any]:
        """Retrieve tasks and followups scheduled for today."""
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

        qs = CRMTools.get_scoped_followups_qs(user).filter(
            follow_up_at__range=(today_start, today_end)
        ).order_by('follow_up_at')

        count = qs.count()
        items = []
        for fu in qs[:6]:
            lead_name = fu.lead.name if fu.lead else "Unknown Lead"
            items.append({
                "id": fu.id,
                "lead_id": fu.lead_id,
                "lead_name": lead_name,
                "scheduled_at": fu.follow_up_at.strftime('%H:%M') if fu.follow_up_at else "",
                "purpose": fu.purpose,
                "status": fu.status,
                "notes": fu.notes or "",
            })

        return {
            "count": count,
            "followups": items,
        }

    @staticmethod
    def get_pipeline_summary(user) -> Dict[str, Any]:
        """Retrieve aggregated pipeline metrics for accessible leads."""
        qs = CRMTools.get_scoped_leads_qs(user)
        total_leads = qs.count()
        total_value = qs.aggregate(total=Sum('expected_value'))['total'] or 0

        # Group by stage
        stages_data = []
        stages = LeadStage.objects.all().order_by('display_order')
        for st in stages:
            count = qs.filter(stage=st).count()
            val = qs.filter(stage=st).aggregate(total=Sum('expected_value'))['total'] or 0
            if count > 0:
                stages_data.append({
                    "stage_name": st.name,
                    "count": count,
                    "value": float(val),
                })

        return {
            "total_leads": total_leads,
            "total_pipeline_value": float(total_value),
            "stages": stages_data,
        }

    @staticmethod
    def get_recent_activity(user, lead_id: Optional[int] = None, limit: int = 5) -> List[Dict[str, Any]]:
        """Retrieve recent activity logs."""
        qs = ActivityLog.objects.filter(entity_type=ActivityLog.EntityType.LEAD)
        if lead_id:
            qs = qs.filter(entity_id=str(lead_id))
        elif not CRMTools._is_privileged(user):
            user_lead_ids = list(CRMTools.get_scoped_leads_qs(user).values_list('id', flat=True))
            qs = qs.filter(entity_id__in=[str(i) for i in user_lead_ids])

        logs = qs.select_related('performed_by').order_by('-created_at')[:limit]
        return [
            {
                "id": l.id,
                "action": l.get_action_display(),
                "entity_id": l.entity_id,
                "performed_by": l.performed_by.email if l.performed_by else "System",
                "notes": l.notes or "",
                "created_at": l.created_at.strftime('%Y-%m-%d %H:%M') if l.created_at else "",
            }
            for l in logs
        ]

    @staticmethod
    def get_customer_details(user, query: Any) -> Optional[Dict[str, Any]]:
        """Retrieve customer details."""
        qs = Customer.objects.all()
        target = None
        if str(query).isdigit():
            target = qs.filter(pk=int(query)).first()
        if not target and isinstance(query, str):
            target = qs.filter(name__icontains=query.strip()).first()
            if not target:
                target = qs.filter(company_name__icontains=query.strip()).first()

        if not target:
            return None

        return {
            "id": target.id,
            "name": target.name,
            "company_name": target.company_name or "",
            "email": target.email or "",
            "phone": target.phone or "",
            "is_active": target.is_active,
        }

    @staticmethod
    def get_team_members(limit: int = 25) -> List[Dict[str, Any]]:
        """Retrieve active team members for assignment context."""
        from accounts.models import User
        users = User.objects.filter(is_active=True).order_by('role', 'first_name')[:limit]
        return [
            {
                "id": u.id,
                "email": u.email,
                "name": u.get_full_name() or u.email,
                "role": u.role,
            }
            for u in users
        ]
