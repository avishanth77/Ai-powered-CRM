"""
Production CRM AI Copilot service.
Connects to real AI Provider (Gemini) with controlled CRM Tools and safety boundaries for write actions.
"""
import logging
import re
from typing import Dict, Any, Optional, List
from django.utils import timezone
from django.db.models import Q
from django.utils.dateparse import parse_datetime, parse_date
from .crm_tools import CRMTools
from .ai_provider import get_ai_provider, AIProviderException
from accounts.models import User
from leads.models import Lead, LeadStage
from followups.models import FollowUp
from activity.services import log_activity
from activity.models import ActivityLog

logger = logging.getLogger(__name__)


class ChatbotService:
    """
    Real AI assistant service backed by live CRM tools and the configured AI Provider.
    """

    @staticmethod
    def _detect_write_intent(user, prompt: str) -> Optional[Dict[str, Any]]:
        """
        Detects if user prompt requests a mutating CRM action (e.g., stage change, schedule follow-up)
        and constructs a confirmation payload instead of executing immediately.
        """
        prompt_lower = prompt.lower().strip()

        # Check for stage change intent (e.g., "move ABC Technologies to Negotiation")
        move_match = re.search(r'(?:move|change|set|update)\s+(?:lead\s+)?([a-zA-Z0-9\s]+?)\s+(?:to|stage to)\s+([a-zA-Z0-9\s]+)', prompt_lower)
        if move_match:
            lead_query = move_match.group(1).strip()
            stage_query = move_match.group(2).strip()

            # Find matching lead
            matched_lead = None
            if lead_query.isdigit():
                matched_lead = Lead.objects.filter(pk=int(lead_query)).first()
            if not matched_lead:
                leads_pool = Lead.objects.all() if CRMTools._is_privileged(user) else CRMTools.get_scoped_leads_qs(user)
                for ld in leads_pool:
                    if ld.name.lower() in lead_query or lead_query in ld.name.lower():
                        matched_lead = ld
                        break

            # Find matching stage
            matched_stage = LeadStage.objects.filter(name__icontains=stage_query).first()

            if matched_lead and matched_stage:
                return {
                    "action_type": "UPDATE_LEAD_STAGE",
                    "description": f"Move {matched_lead.name} to {matched_stage.name} stage",
                    "parameters": {
                        "lead_id": matched_lead.id,
                        "lead_name": matched_lead.name,
                        "stage_id": matched_stage.id,
                        "stage_name": matched_stage.name,
                    }
                }

        # Check for reassign intent (e.g., "reassign Don Bosco to john@crmlite.com", "assign lead 11 to alex@crmlite.com")
        reassign_match = re.search(
            r'(?:reassign|assign|transfer)\s+(?:lead\s+)?(?:#\s*)?([a-zA-Z0-9\s]+?)\s+(?:to)\s+([a-zA-Z0-9@\.\s_-]+)',
            prompt_lower
        )
        if reassign_match:
            lead_query = reassign_match.group(1).strip()
            target_query = reassign_match.group(2).strip()

            matched_lead = None
            if lead_query.isdigit():
                matched_lead = Lead.objects.filter(pk=int(lead_query)).first()
            if not matched_lead:
                leads_pool = Lead.objects.all() if CRMTools._is_privileged(user) else CRMTools.get_scoped_leads_qs(user)
                for ld in leads_pool:
                    if ld.name.lower() in lead_query or lead_query in ld.name.lower():
                        matched_lead = ld
                        break

            target_user = None
            if '@' in target_query:
                target_user = User.objects.filter(email__iexact=target_query).first()
            if not target_user:
                target_user = User.objects.filter(
                    Q(email__icontains=target_query) |
                    Q(first_name__icontains=target_query) |
                    Q(last_name__icontains=target_query)
                ).first()

            if matched_lead:
                target_display = target_user.get_full_name() or target_user.email if target_user else target_query
                return {
                    "action_type": "REASSIGN_LEAD",
                    "description": f"Reassign {matched_lead.name} (ID: {matched_lead.id}) to {target_display}",
                    "parameters": {
                        "lead_id": matched_lead.id,
                        "lead_name": matched_lead.name,
                        "user_id": target_user.id if target_user else None,
                        "user_email": target_user.email if target_user else target_query,
                    }
                }

        return None

    @staticmethod
    def _build_live_crm_context(user, prompt: str) -> Dict[str, Any]:
        """
        Extracts relevant live CRM records tailored to the user's inquiry.
        """
        crm_context = {
            "current_user": {
                "name": f"{user.first_name} {user.last_name}".strip() or user.email,
                "role": getattr(user, 'role', 'EXECUTIVE'),
            },
            "today_date": timezone.now().strftime('%Y-%m-%d'),
        }

        prompt_lower = prompt.lower()

        # 1. Pipeline summary
        if any(w in prompt_lower for w in ['pipeline', 'funnel', 'revenue', 'overview', 'summary', 'status']):
            crm_context["pipeline_summary"] = CRMTools.get_pipeline_summary(user)

        # 2. Overdue followups
        if any(w in prompt_lower for w in ['overdue', 'pending', 'late', 'missed', 'slipping']):
            crm_context["overdue_followups"] = CRMTools.get_overdue_followups(user)

        # 3. Today's agenda
        if any(w in prompt_lower for w in ['today', 'agenda', 'schedule', 'task', 'call']):
            crm_context["today_followups"] = CRMTools.get_today_followups(user)

        # 4. Team members for assignment context
        if any(w in prompt_lower for w in ['reassign', 'assign', 'team', 'rep', 'executive', 'manager', 'owner', 'member', 'who']):
            crm_context["team_members"] = CRMTools.get_team_members()

        # 5. Search for specific lead mention
        # Check against top leads or query
        leads_qs = CRMTools.get_scoped_leads_qs(user)
        for ld in leads_qs[:15]:
            if ld.name.lower() in prompt_lower or (ld.company_name and ld.company_name.lower() in prompt_lower):
                crm_context["target_lead"] = CRMTools.get_lead_details(user, ld.id)
                break

        # If user asks for high-value leads
        if any(w in prompt_lower for w in ['high-value', 'high value', 'top deal', 'biggest']):
            crm_context["top_leads"] = CRMTools.get_my_leads(user, limit=5)

        # Recent activity
        if any(w in prompt_lower for w in ['recent', 'activity', 'touchpoint', 'history']):
            crm_context["recent_activity"] = CRMTools.get_recent_activity(user, limit=5)

        # If context is sparse, always include basic pipeline and overdue stats
        if "pipeline_summary" not in crm_context and "overdue_followups" not in crm_context:
            crm_context["pipeline_summary"] = CRMTools.get_pipeline_summary(user)
            crm_context["overdue_followups"] = CRMTools.get_overdue_followups(user)

        return crm_context

    @staticmethod
    def process_query(
        user,
        prompt: str,
        context: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Executes query against real AI provider with authorized live CRM context.
        """
        prompt_clean = (prompt or '').strip()
        if not prompt_clean:
            return {
                "response": "Please ask a question about your CRM leads, pipeline, or follow-ups.",
                "intent": "GENERAL",
                "suggestions": ["Show my overdue leads", "What should I do today?", "Summarize my pipeline"],
                "action_required": False,
                "action_payload": None,
            }

        # Step 1: Detect if a WRITE action was proposed
        write_proposal = ChatbotService._detect_write_intent(user, prompt_clean)
        if write_proposal:
            desc = write_proposal["description"]
            return {
                "response": f"I can execute this action for you:\n\n**{desc}**\n\nPlease confirm to apply this change to the CRM.",
                "intent": "ACTION_CONFIRMATION",
                "suggestions": ["Confirm action", "Cancel action"],
                "action_required": True,
                "action_payload": write_proposal,
            }

        # Step 2: Build authorized live CRM data context
        crm_context = ChatbotService._build_live_crm_context(user, prompt_clean)

        # Step 3: Query real AI provider
        try:
            provider = get_ai_provider()
            ai_result = provider.chat(
                message=prompt_clean,
                crm_context=crm_context,
                conversation_history=conversation_history
            )
            return ai_result
        except AIProviderException as ae:
            logger.warning("AI provider call failed (%s). Falling back to direct CRM summary response.", ae)
            # Fallback to direct authoritative CRM-grounded response if AI key is missing or offline
            return ChatbotService._generate_direct_crm_response(user, prompt_clean, crm_context)
        except Exception as e:
            logger.error("Unexpected error in ChatbotService: %s", e, exc_info=True)
            return ChatbotService._generate_direct_crm_response(user, prompt_clean, crm_context)

    @staticmethod
    def _generate_direct_crm_response(user, prompt: str, crm_context: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generates a 100% accurate, factual response directly from the authorized CRM query context.
        Ensures system remains functional even if external AI provider encounters a temporary rate limit or outage.
        """
        prompt_lower = prompt.lower()

        # Overdue leads
        if 'overdue' in prompt_lower:
            od = crm_context.get("overdue_followups") or CRMTools.get_overdue_followups(user)
            count = od.get("count", 0)
            items = od.get("followups", [])
            lines = []
            for it in items:
                lines.append(f"• **{it['lead_name']}** ({it.get('company_name') or 'N/A'}) — Due {it.get('scheduled_at')}: {it.get('notes') or it.get('purpose')}")

            content = f"You currently have **{count} overdue follow-up task(s)** requiring attention:\n\n"
            if lines:
                content += "\n".join(lines) + "\n\nRecommended action: Contact these accounts promptly to keep opportunities moving forward."
            else:
                content += "Great job! You have no overdue follow-ups right now."

            return {
                "response": content,
                "intent": "OVERDUE_LEADS",
                "suggestions": ["What should I do today?", "Summarize my pipeline"],
                "action_required": False,
                "action_payload": None,
            }

        # Target lead summary
        target_lead = crm_context.get("target_lead")
        if target_lead or ('summarize' in prompt_lower and 'lead' in prompt_lower):
            if not target_lead:
                target_lead = CRMTools.get_my_leads(user, limit=1)
                target_lead = target_lead[0] if target_lead else None

            if target_lead:
                val = f"₹{target_lead.get('expected_value', 0):,.2f}"
                content = (
                    f"**Lead Summary: {target_lead['name']}**\n\n"
                    f"• **Company:** {target_lead.get('company_name') or 'Independent'}\n"
                    f"• **Current Stage:** {target_lead.get('stage')}\n"
                    f"• **Opportunity Value:** {val}\n"
                    f"• **Phone:** {target_lead.get('phone') or 'Not provided'}\n"
                    f"• **Email:** {target_lead.get('email') or 'Not provided'}\n\n"
                )
                recent_calls = target_lead.get("recent_calls", [])
                if recent_calls:
                    content += "**Recent Call Intelligence:**\n"
                    for c in recent_calls:
                        content += f"• *{c.get('started_at')}* ({c.get('call_type')}): {c.get('summary') or 'Call recorded'}\n"
                        if c.get('next_action'):
                            content += f"  *Next Action:* {c.get('next_action')}\n"

                return {
                    "response": content,
                    "intent": "LEAD_SUMMARY",
                    "suggestions": ["What should I do today?", "Show my overdue leads"],
                    "action_required": False,
                    "action_payload": None,
                }

        # Daily agenda
        if any(w in prompt_lower for w in ['today', 'agenda', 'do today', 'schedule']):
            td = CRMTools.get_today_followups(user)
            od = CRMTools.get_overdue_followups(user)
            content = f"**Daily Action Briefing for Today:**\n\n"
            content += f"• **{od.get('count', 0)} overdue tasks** requiring immediate attention\n"
            content += f"• **{td.get('count', 0)} activities scheduled** for today\n\n"

            for it in td.get("followups", []):
                content += f"  - [{it.get('scheduled_at')}] {it.get('lead_name')} • {it.get('purpose')}\n"

            return {
                "response": content,
                "intent": "DAILY_AGENDA",
                "suggestions": ["Show my overdue leads", "Summarize my pipeline"],
                "action_required": False,
                "action_payload": None,
            }

        # Pipeline summary
        pipe = CRMTools.get_pipeline_summary(user)
        total_leads = pipe.get("total_leads", 0)
        total_val = f"₹{pipe.get('total_pipeline_value', 0):,.2f}"
        stage_lines = [f"• **{s['stage_name']}:** {s['count']} leads (~₹{s['value']:,.2f})" for s in pipe.get("stages", [])]

        return {
            "response": (
                f"**Live Pipeline Summary:**\n\n"
                f"• **Total Active Opportunities:** {total_leads} leads\n"
                f"• **Aggregate Value:** {total_val}\n\n"
                f"**Breakdown by Stage:**\n" + ("\n".join(stage_lines) if stage_lines else "No deals currently active.")
            ),
            "intent": "PIPELINE_SUMMARY",
            "suggestions": ["Show my overdue leads", "What should I do today?"],
            "action_required": False,
            "action_payload": None,
        }

    @staticmethod
    def execute_confirmed_action(user, action_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes a user-confirmed write action safely through Django permissions and business rules.
        """
        action_type = action_payload.get("action_type")
        params = action_payload.get("parameters", {}) or {}
        act_type_norm = str(action_type or '').strip().upper().replace(' ', '_').replace('-', '_')

        # -------------------------------------------------------------
        # Action 1: UPDATE_LEAD_STAGE
        # -------------------------------------------------------------
        if act_type_norm in ["UPDATE_LEAD_STAGE", "CHANGE_LEAD_STAGE", "MOVE_LEAD_STAGE", "UPDATE_STAGE", "CHANGE_STAGE", "MOVE_STAGE"]:
            lead_id = params.get("lead_id")
            stage_id = params.get("stage_id")
            stage_name = params.get("stage_name") or params.get("stage")

            lead = None
            if lead_id:
                try:
                    lead = Lead.objects.filter(pk=int(lead_id)).first()
                except (ValueError, TypeError):
                    pass

            if not lead and params.get("lead_name"):
                lead = Lead.objects.filter(name__icontains=str(params["lead_name"]).strip()).first()

            if not lead:
                desc = action_payload.get("description", "")
                id_match = re.search(r'\b(?:ID:\s*|#)(\d+)\b', desc, re.IGNORECASE)
                if id_match:
                    lead = Lead.objects.filter(pk=int(id_match.group(1))).first()

            if not lead:
                raise ValueError("Target lead was not found.")

            # Permission check: Executive can only modify assigned leads
            if user.role not in ['ADMIN', 'MANAGER'] and not user.is_superuser:
                if lead.assigned_to != user and lead.created_by != user:
                    raise PermissionError("You do not have permission to modify this lead.")

            stage = None
            if stage_id:
                try:
                    stage = LeadStage.objects.filter(pk=int(stage_id)).first()
                except (ValueError, TypeError):
                    pass

            if not stage and stage_name:
                stage = LeadStage.objects.filter(name__iexact=str(stage_name).strip()).first()
                if not stage:
                    stage = LeadStage.objects.filter(name__icontains=str(stage_name).strip()).first()

            if not stage:
                raise ValueError("Target lead stage was not found.")

            old_stage_name = lead.stage.name if lead.stage else getattr(lead, 'status', 'New')
            lead.stage = stage
            lead.save(update_fields=['stage', 'updated_at'])

            # Log activity
            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=str(lead.id),
                action='STATUS_CHANGED',
                old_value={'stage': old_stage_name},
                new_value={'stage': stage.name},
                performed_by=user,
                notes=f"Lead stage updated to {stage.name} via AI Assistant confirmation."
            )

            return {
                "success": True,
                "message": f"Successfully moved **{lead.name}** to **{stage.name}**.",
                "lead_id": lead.id,
                "new_stage": stage.name,
            }

        # -------------------------------------------------------------
        # Action 2: REASSIGN_LEAD / ASSIGN_LEAD
        # -------------------------------------------------------------
        if act_type_norm in ["REASSIGN_LEAD", "ASSIGN_LEAD", "REASSIGN", "ASSIGN", "TRANSFER_LEAD"]:
            # Permission check: In CRM Lite RBAC, only Managers and Admins can assign or reassign leads
            if user.role == 'EXECUTIVE' and not user.is_superuser:
                raise PermissionError("Only Managers and Admins have permission to assign or reassign leads.")

            lead_id = params.get("lead_id")
            lead_name = params.get("lead_name") or params.get("lead")

            lead = None
            if lead_id:
                try:
                    lead = Lead.objects.filter(pk=int(lead_id)).first()
                except (ValueError, TypeError):
                    pass

            if not lead and lead_name:
                lead = Lead.objects.filter(name__icontains=str(lead_name).strip()).first()
                if not lead:
                    lead = Lead.objects.filter(company_name__icontains=str(lead_name).strip()).first()

            if not lead:
                desc = action_payload.get("description", "")
                id_match = re.search(r'\b(?:ID:\s*|#)(\d+)\b', desc, re.IGNORECASE)
                if id_match:
                    lead = Lead.objects.filter(pk=int(id_match.group(1))).first()

            if not lead:
                raise ValueError("Target lead was not found.")

            # Identify target user
            target_user_id = params.get("user_id") or params.get("assignee_id") or params.get("new_assigned_to_id") or params.get("target_user_id")
            target_email = (
                params.get("user_email")
                or params.get("new_assignee_email")
                or params.get("assignee_email")
                or params.get("email")
                or params.get("target_email")
                or params.get("new_assignee")
                or params.get("assigned_to")
                or params.get("assignee")
            )

            if not target_user_id and not target_email:
                desc = action_payload.get("description", "")
                email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', desc)
                if email_match:
                    target_email = email_match.group(0)

            target_user = None
            if target_user_id:
                try:
                    target_user = User.objects.filter(pk=int(target_user_id)).first()
                except (ValueError, TypeError):
                    pass

            if not target_user and target_email:
                target_str = str(target_email).strip()
                # 1. Exact email match
                target_user = User.objects.filter(email__iexact=target_str).first()

                # 2. Substring or name match
                if not target_user:
                    email_prefix = target_str.split('@')[0]
                    target_user = User.objects.filter(email__icontains=target_str).first()
                    if not target_user and len(email_prefix) >= 3:
                        target_user = User.objects.filter(
                            Q(email__icontains=email_prefix) |
                            Q(first_name__icontains=email_prefix) |
                            Q(last_name__icontains=email_prefix)
                        ).first()

                # 3. If target_str is a valid email but doesn't exist, create it if admin/manager requested it
                if not target_user and '@' in target_str and '.' in target_str:
                    target_user, created = User.objects.get_or_create(
                        email=target_str.lower(),
                        defaults={
                            'username': target_str.lower(),
                            'first_name': target_str.split('@')[0].capitalize(),
                            'role': User.Role.EXECUTIVE,
                            'is_active': True,
                        }
                    )
                    if created:
                        target_user.set_password('Crmlite@123')
                        target_user.save()

            if not target_user:
                active_users = list(User.objects.filter(is_active=True).values_list('email', flat=True))
                available_str = ", ".join(active_users) if active_users else "None"
                identifier = target_email or target_user_id or "unspecified"
                raise ValueError(
                    f"Team member '{identifier}' was not found. Available active team members: {available_str}"
                )

            old_user = lead.assigned_to
            lead.assigned_to = target_user
            lead.save(update_fields=['assigned_to', 'updated_at'])

            # Log activity
            act_type = ActivityLog.ActionType.LEAD_REASSIGNED if old_user else ActivityLog.ActionType.LEAD_ASSIGNED
            old_name = old_user.get_full_name() or old_user.email if old_user else None
            new_name = target_user.get_full_name() or target_user.email
            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=str(lead.id),
                action=act_type,
                old_value={'assigned_to': old_name},
                new_value={'assigned_to': new_name},
                performed_by=user,
                notes=f"Lead reassigned to {new_name} via AI Assistant confirmation."
            )

            # Notification
            try:
                from notifications.services.notification_service import NotificationService
                NotificationService.notify_lead_assigned(
                    lead=lead,
                    assignee=target_user,
                    actor=user
                )
            except Exception as ne:
                logger.warning("Failed to dispatch assignment notification: %s", ne)

            return {
                "success": True,
                "message": f"Successfully reassigned **{lead.name}** to **{new_name}**.",
                "lead_id": lead.id,
                "new_assigned_to": target_user.email,
            }

        # -------------------------------------------------------------
        # Action 3: SCHEDULE_FOLLOWUP
        # -------------------------------------------------------------
        if act_type_norm in ["SCHEDULE_FOLLOWUP", "CREATE_FOLLOWUP", "SCHEDULE_TASK", "CREATE_TASK"]:
            lead_id = params.get("lead_id")
            lead = Lead.objects.filter(pk=lead_id).first() if lead_id else None
            if not lead and params.get("lead_name"):
                lead = Lead.objects.filter(name__icontains=str(params["lead_name"]).strip()).first()
            if not lead:
                raise ValueError("Target lead was not found for scheduling follow-up.")

            follow_up_date_str = params.get("date") or params.get("follow_up_at") or params.get("scheduled_at")
            purpose = params.get("purpose") or "Follow-up"
            notes = params.get("notes") or "Scheduled via AI Assistant"

            follow_up_dt = None
            if follow_up_date_str:
                dt_parsed = parse_datetime(str(follow_up_date_str))
                if not dt_parsed:
                    d_parsed = parse_date(str(follow_up_date_str))
                    if d_parsed:
                        dt_parsed = timezone.datetime.combine(d_parsed, timezone.datetime.min.time().replace(hour=10))
                if dt_parsed:
                    if timezone.is_naive(dt_parsed):
                        follow_up_dt = timezone.make_aware(dt_parsed)
                    else:
                        follow_up_dt = dt_parsed

            if not follow_up_dt:
                follow_up_dt = timezone.now() + timezone.timedelta(days=1)

            followup = FollowUp.objects.create(
                lead=lead,
                assigned_to=lead.assigned_to or user,
                follow_up_at=follow_up_dt,
                purpose=purpose,
                notes=notes,
                status=FollowUp.Status.PENDING
            )

            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=str(lead.id),
                action='FOLLOW_UP_SCHEDULED',
                new_value={'follow_up_id': followup.id, 'follow_up_at': follow_up_dt.isoformat()},
                performed_by=user,
                notes=f"Scheduled {purpose} for {follow_up_dt:%Y-%m-%d %H:%M} via AI Assistant confirmation."
            )

            return {
                "success": True,
                "message": f"Successfully scheduled follow-up for **{lead.name}** on **{follow_up_dt:%Y-%m-%d %H:%M}**.",
                "lead_id": lead.id,
                "followup_id": followup.id,
            }

        # -------------------------------------------------------------
        # Action 4: UPDATE_LEAD_PRIORITY
        # -------------------------------------------------------------
        if act_type_norm in ["UPDATE_LEAD_PRIORITY", "SET_PRIORITY", "CHANGE_PRIORITY"]:
            lead_id = params.get("lead_id")
            priority = str(params.get("priority") or "MEDIUM").strip().upper()
            lead = Lead.objects.filter(pk=lead_id).first() if lead_id else None
            if not lead and params.get("lead_name"):
                lead = Lead.objects.filter(name__icontains=str(params["lead_name"]).strip()).first()
            if not lead:
                raise ValueError("Target lead was not found.")

            if priority not in Lead.Priority.values:
                raise ValueError(f"Invalid priority '{priority}'. Allowed: {', '.join(Lead.Priority.values)}")

            old_priority = lead.priority
            lead.priority = priority
            lead.save(update_fields=['priority', 'updated_at'])

            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=str(lead.id),
                action='LEAD_UPDATED',
                old_value={'priority': old_priority},
                new_value={'priority': priority},
                performed_by=user,
                notes=f"Lead priority updated from {old_priority} to {priority} via AI Assistant confirmation."
            )

            return {
                "success": True,
                "message": f"Successfully updated priority of **{lead.name}** to **{priority}**.",
                "lead_id": lead.id,
                "new_priority": priority,
            }

        raise ValueError(f"Unknown or unsupported action type: {action_type}")
