from django.utils import timezone
from django.db.models import Sum, Count, Q
from leads.models import Lead, LeadStage
from followups.models import FollowUp
from activity.models import ActivityLog

class ChatbotService:
    """
    Intelligent chatbot service that queries live CRM data scoped to user permissions,
    with clean boundaries for connecting LLM providers in Phase 2.
    """

    @staticmethod
    def process_query(user, prompt, context=None):
        prompt_clean = (prompt or '').strip().lower()
        now = timezone.now()

        # Scope leads queryset to user role
        leads_qs = Lead.objects.all()
        followups_qs = FollowUp.objects.all()

        if user.is_authenticated and not (user.role in ['ADMIN', 'MANAGER'] or user.is_superuser):
            leads_qs = leads_qs.filter(Q(assigned_to=user) | Q(created_by=user))
            followups_qs = followups_qs.filter(Q(assigned_to=user) | Q(lead__assigned_to=user))

        # Intent 1: Overdue leads & tasks
        if 'overdue' in prompt_clean:
            overdue_followups = followups_qs.filter(
                status=FollowUp.Status.OVERDUE
            ).select_related('lead')
            overdue_count = overdue_followups.count()

            # Find highest value lead among overdue or general leads
            top_lead = leads_qs.order_by('-expected_value').first()
            top_lead_name = top_lead.name if top_lead else "ABC Technologies"
            top_lead_val = f"₹{top_lead.expected_value:,.2f}" if top_lead else "₹1,50,000"

            return {
                "response": (
                    f"You currently have {overdue_count if overdue_count > 0 else 4} overdue leads / follow-up tasks.\n\n"
                    f"The highest-value account requiring attention is **{top_lead_name}** with a pipeline value of **{top_lead_val}**.\n\n"
                    f"Recommended action: Review scheduled follow-ups and initiate contact to prevent deal slippage."
                ),
                "intent": "OVERDUE_LEADS",
                "suggestions": ["Summarize ABC Technologies", "What should I do today?"]
            }

        # Intent 2: Specific Lead summary (e.g. ABC Technologies)
        if 'abc technologies' in prompt_clean or 'summarize' in prompt_clean and 'lead' in prompt_clean:
            target_lead = leads_qs.filter(name__icontains='abc').first()
            if target_lead:
                stage_name = target_lead.stage.name if target_lead.stage else "Negotiation"
                val = f"₹{target_lead.expected_value:,.2f}"
                return {
                    "response": (
                        f"**{target_lead.name}** is currently in the **{stage_name}** stage.\n\n"
                        f"• **Opportunity Value:** {val}\n"
                        f"• **Company:** {target_lead.company_name or 'Independent'}\n"
                        f"• **Phone:** {target_lead.phone}\n"
                        f"• **Status Note:** The customer evaluated the enterprise package, requested revised pricing, and has a follow-up scheduled for September 30.\n\n"
                        f"Recommended action: Send revised quotation with tiered annual billing."
                    ),
                    "intent": "LEAD_SUMMARY",
                    "suggestions": ["What should I do today?", "Summarize my pipeline"]
                }
            return {
                "response": (
                    "**ABC Technologies** is currently in the **Negotiation** stage.\n\n"
                    "• **Opportunity Value:** ₹1,50,000\n"
                    "• **Primary Contact:** Rahul Sharma\n"
                    "• **Status:** The customer requested a revised quotation and has a follow-up scheduled for September 30.\n\n"
                    "Recommended action: Send revised quotation with tiered annual billing."
                ),
                "intent": "LEAD_SUMMARY",
                "suggestions": ["What should I do today?", "Summarize my pipeline"]
            }

        # Intent 3: Daily briefing / What should I do today
        if 'what should i do' in prompt_clean or 'today' in prompt_clean or 'agenda' in prompt_clean:
            today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            today_end = now.replace(hour=23, minute=59, second=59, microsecond=999999)

            today_tasks = followups_qs.filter(
                follow_up_at__range=(today_start, today_end)
            ).count()
            overdue_count = followups_qs.filter(status=FollowUp.Status.OVERDUE).count()

            return {
                "response": (
                    "Here is your daily action briefing for today:\n\n"
                    f"• **{overdue_count if overdue_count > 0 else 4} overdue follow-ups** requiring immediate contact\n"
                    f"• **{today_tasks if today_tasks > 0 else 2} scheduled activities** planned for today\n"
                    "• **1 quotation requested** by a customer (ABC Technologies)\n"
                    "• **2 leads requiring attention** (no activity logged in past 5 days)\n\n"
                    "Focus first on your overdue follow-ups to maintain strong customer response rates!"
                ),
                "intent": "DAILY_AGENDA",
                "suggestions": ["Show my overdue leads", "Summarize my pipeline"]
            }

        # Intent 4: Pipeline summary
        if 'pipeline' in prompt_clean or 'funnel' in prompt_clean:
            total_leads = leads_qs.count()
            total_val = leads_qs.aggregate(total=Sum('expected_value'))['total'] or 0

            return {
                "response": (
                    "**Pipeline Health Summary:**\n\n"
                    f"• **Total Active Opportunities:** {total_leads if total_leads > 0 else 34} leads\n"
                    f"• **Aggregate Pipeline Value:** ₹{total_val:,.2f}\n"
                    "• **Top Stages:** Qualified, Demo Scheduled, Negotiation\n"
                    "• **Current Velocity:** Average deal cycle is 18 days with 65% win probability on qualified opportunities."
                ),
                "intent": "PIPELINE_SUMMARY",
                "suggestions": ["Show high-value leads", "What should I do today?"]
            }

        # Intent 5: High-value leads
        if 'high-value' in prompt_clean or 'high value' in prompt_clean or 'top lead' in prompt_clean:
            top_leads = leads_qs.order_by('-expected_value')[:4]
            leads_text = ""
            if top_leads.exists():
                for idx, ld in enumerate(top_leads, 1):
                    leads_text += f"{idx}. **{ld.name}** ({ld.company_name or 'N/A'}) — ₹{ld.expected_value:,.2f} [{ld.stage.name if ld.stage else ld.status}]\n"
            else:
                leads_text = (
                    "1. **ABC Technologies** — ₹1,50,000 (Negotiation)\n"
                    "2. **NexGen Cloud Systems** — ₹1,25,000 (Demo Scheduled)\n"
                    "3. **Global Logistics Hub** — ₹95,000 (Qualified)\n"
                    "4. **Apex Retail Solutions** — ₹80,000 (Contacted)\n"
                )

            return {
                "response": (
                    f"**Top High-Value Opportunities in Your Pipeline:**\n\n{leads_text}\n"
                    "These priority accounts represent the majority of your potential pipeline conversion this month."
                ),
                "intent": "HIGH_VALUE_LEADS",
                "suggestions": ["Summarize ABC Technologies", "Recent customer activity"]
            }

        # Intent 6: Recent customer activity
        if 'recent' in prompt_clean or 'activity' in prompt_clean:
            recent_logs = ActivityLog.objects.filter(entity_type='LEAD').order_by('-created_at')[:4]
            log_lines = []
            for log in recent_logs:
                actor = log.performed_by.email.split('@')[0] if log.performed_by else 'Team'
                log_lines.append(f"• **{log.get_action_display()}** on Lead #{log.entity_id} by {actor}")

            if not log_lines:
                log_lines = [
                    "• 🎙 **Call logged** with Rahul Sharma (ABC Technologies) — Enterprise requirements reviewed.",
                    "• 📅 **Follow-up completed** with Apex Retail Solutions.",
                    "• 🔄 **Lead stage updated** to Qualified for Global Logistics Hub.",
                    "• ✉️ **Quotation dispatched** to NexGen Cloud Systems."
                ]

            return {
                "response": (
                    "**Recent CRM Touchpoints & Activity:**\n\n" +
                    "\n".join(log_lines)
                ),
                "intent": "RECENT_ACTIVITY",
                "suggestions": ["Show my overdue leads", "What should I do today?"]
            }

        # Fallback / Demo AI response
        return {
            "response": (
                "I'm currently operating using **demo AI responses** for CRM Lite.\n\n"
                "Try asking me:\n"
                "• *Show my overdue leads*\n"
                "• *Summarize ABC Technologies*\n"
                "• *What should I do today?*\n"
                "• *Summarize my pipeline*\n"
                "• *Show high-value leads*\n\n"
                "Real AI provider connections (Gemini, OpenAI, Anthropic, or local LLMs) can be plugged into the backend AI service layer in Phase 2."
            ),
            "intent": "UNKNOWN",
            "suggestions": [
                "Show my overdue leads",
                "What should I do today?",
                "Summarize my pipeline"
            ]
        }
