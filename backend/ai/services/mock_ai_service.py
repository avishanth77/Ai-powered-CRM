from datetime import date, timedelta

def generate_mock_transcript(lead=None, notes=None):
    """
    Generate realistic mock transcription based on lead and notes context.
    """
    lead_name = lead.name if lead else "Rahul"
    company = lead.company_name if (lead and lead.company_name) else "the client organization"

    if notes and len(notes.strip()) > 10:
        cleaned_notes = notes.strip()
        return (
            f"Sales Executive:\n"
            f"Hello {lead_name}, thank you for taking the time to speak with us today regarding {company}.\n\n"
            f"Customer:\n"
            f"Thanks. Regarding our discussion: {cleaned_notes}\n\n"
            f"Sales Executive:\n"
            f"Understood. We can tailor the solution specifically for your operational timeline.\n\n"
            f"Customer:\n"
            f"Great. Please send over the revised proposal and commercial terms by tomorrow.\n\n"
            f"Sales Executive:\n"
            f"Will do! I'll have the updated quotation sent over promptly."
        )

    return (
        f"Sales Executive:\n"
        f"Hello {lead_name}, I'm calling regarding your inquiry about CRM Lite enterprise package for {company}.\n\n"
        f"Customer:\n"
        f"Yes, thanks for following up. We're very interested in the enterprise package for our sales force, but we need implementation within 30 days.\n\n"
        f"Sales Executive:\n"
        f"We can provide the implementation within 30 days, including migration and team onboarding.\n\n"
        f"Customer:\n"
        f"Can you provide a revised quotation with tiered annual billing?\n\n"
        f"Sales Executive:\n"
        f"Yes, absolutely. I'll send it by tomorrow morning and follow up on September 30.\n\n"
        f"Customer:\n"
        f"That sounds great, thank you."
    )

def generate_mock_call_summary(transcript=None, lead=None, notes=None):
    """
    Generate structured mock AI call intelligence.
    """
    lead_name = lead.name if lead else "The customer"
    company = lead.company_name if (lead and lead.company_name) else ""
    target_date = (date.today() + timedelta(days=3)).isoformat()

    return {
        "summary": (
            f"{lead_name}{f' from {company}' if company else ''} is interested in the enterprise package "
            f"and requested a revised quotation with structured payment terms."
        ),
        "key_points": [
            f"Customer is interested in enterprise package",
            "Pricing and multi-seat discount terms were discussed",
            "Customer requested revised quotation with tiered annual billing",
            "Implementation timeline of 30 days was agreed upon",
        ],
        "customer_requirements": [
            "Enterprise package license",
            "Implementation and data migration within 30 days",
            "Revised quotation with SLA terms",
        ],
        "customer_objections": [
            "Pricing and annual billing terms",
        ],
        "customer_intent": "High purchase interest",
        "next_action": "Send revised quotation with tiered annual billing",
        "follow_up_date": target_date,
    }
