"""
Production CRM AI Copilot service.
Connects to real AI Provider (Gemini) with controlled CRM Tools and safety boundaries for write actions.
"""
import logging
import re
from typing import Dict, Any, Optional, List
from django.utils import timezone
from .crm_tools import CRMTools
from .ai_provider import get_ai_provider, AIProviderException
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

            lead = CRMTools.get_scoped_leads_qs(user).filter(
                Lead.objects.filter(name__icontains=lead_query).query.where if hasattr(Lead.objects, 'none') else None
            ).first() if False else None

            # Find matching lead
            matched_lead = None
            for ld in CRMTools.get_scoped_leads_qs(user):
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

        # 4. Search for specific lead mention
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
        params = action_payload.get("parameters", {})

        if action_type == "UPDATE_LEAD_STAGE":
            lead_id = params.get("lead_id")
            stage_id = params.get("stage_id")

            lead = Lead.objects.filter(pk=lead_id).first()
            if not lead:
                raise ValueError("Target lead was not found.")

            # Permission check: Executive can only modify assigned leads
            if user.role not in ['ADMIN', 'MANAGER'] and not user.is_superuser:
                if lead.assigned_to != user and lead.created_by != user:
                    raise PermissionError("You do not have permission to modify this lead.")

            stage = LeadStage.objects.filter(pk=stage_id).first()
            if not stage:
                raise ValueError("Target lead stage was not found.")

            old_stage_name = lead.stage.name if lead.stage else lead.status
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

        raise ValueError(f"Unknown or unsupported action type: {action_type}")
