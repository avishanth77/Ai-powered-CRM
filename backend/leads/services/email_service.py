import logging
import threading
from django.core.mail import EmailMultiAlternatives
from django.core.validators import validate_email, ValidationError
from django.template.loader import render_to_string
from django.conf import settings

logger = logging.getLogger(__name__)


def send_lead_stage_update_email(lead, old_stage, new_stage, async_dispatch=True):
    """
    Sends a dual-format (HTML + Plain-Text fallback) customer notification email
    when a lead's stage/status changes.

    Robust Edge-Case Protections:
    1. Gracefully handles missing, empty, or whitespace email addresses.
    2. Validates email structure using Django's validate_email validator.
    3. Handles unassigned leads and missing customer/company names with friendly fallbacks.
    4. Renders responsive HTML and clean Plain-Text using Django templates.
    5. Dispatches via EmailMultiAlternatives in a background daemon thread (when async_dispatch=True)
       to ensure zero latency and non-blocking instant UI feedback for end users.
    6. Catches all transmission exceptions and logs full stack trace.
    7. Never raises an uncaught exception, ensuring lead persistence is never broken.

    Parameters:
    - lead (Lead): The updated Lead model instance.
    - old_stage (LeadStage or str): The previous stage prior to saving.
    - new_stage (LeadStage or str): The newly assigned stage.
    - async_dispatch (bool): If True (default), sends the email in a background daemon thread
      so the HTTP request returns immediately without waiting for SMTP network handshake.

    Returns:
    - bool: True if the email was dispatched or queued for background transmission, False otherwise.
    """
    if not lead:
        logger.warning("[EmailService] No lead instance provided. Skipping notification.")
        return False

    raw_email = getattr(lead, 'email', None)
    customer_email = raw_email.strip() if raw_email else ''

    if not customer_email:
        logger.warning(
            f"[EmailService] Lead #{getattr(lead, 'id', 'Unknown')} ({getattr(lead, 'name', 'Unknown')}) "
            f"has no email address. Skipping stage update email notification."
        )
        return False

    # Validate email format
    try:
        validate_email(customer_email)
    except ValidationError:
        logger.warning(
            f"[EmailService] Lead #{getattr(lead, 'id', 'Unknown')} has an invalid email format: '{customer_email}'. "
            f"Skipping stage update email notification."
        )
        return False

    lead_id = getattr(lead, 'id', 'Unknown')
    customer_name = getattr(lead, 'name', None) or "Valued Customer"
    company_name = getattr(lead, 'company_name', None) or customer_name

    # Extract friendly stage names and accent colors
    old_stage_name = old_stage.name if hasattr(old_stage, 'name') else (str(old_stage) if old_stage else 'Initial')
    new_stage_name = new_stage.name if hasattr(new_stage, 'name') else (str(new_stage) if new_stage else 'Updated')
    new_stage_color = getattr(new_stage, 'color', '#4f46e5') if hasattr(new_stage, 'color') else '#4f46e5'

    # Sales executive details (if assigned)
    assigned_to = getattr(lead, 'assigned_to', None)
    if assigned_to:
        sales_executive_name = assigned_to.get_full_name() or assigned_to.email
    else:
        sales_executive_name = "CRM Lite Sales Team"

    # Format the updated timestamp
    updated_at = getattr(lead, 'updated_at', None)
    updated_time = (
        updated_at.strftime('%B %d, %Y at %I:%M %p UTC')
        if updated_at
        else "Recently"
    )

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'crm-notifications@example.com')
    subject = f"Your Lead Status Has Been Updated: {new_stage_name}"

    # Template context for both plain text and HTML versions
    context = {
        'lead': lead,
        'customer_name': customer_name,
        'company_name': company_name,
        'old_stage_name': old_stage_name,
        'new_stage_name': new_stage_name,
        'new_stage_color': new_stage_color,
        'sales_executive_name': sales_executive_name,
        'updated_time': updated_time,
    }

    try:
        # Render plain-text fallback and HTML templates in-memory (< 1ms)
        text_content = render_to_string('emails/lead_stage_updated.txt', context)
        html_content = render_to_string('emails/lead_stage_updated.html', context)

        def _send_worker():
            try:
                # Construct multipart email message
                msg = EmailMultiAlternatives(
                    subject=subject,
                    body=text_content,
                    from_email=from_email,
                    to=[customer_email],
                )
                msg.attach_alternative(html_content, "text/html")
                sent_count = msg.send(fail_silently=False)

                logger.info(
                    f"[EmailService] Successfully sent HTML stage update email to {customer_email} "
                    f"for Lead #{lead_id} ({old_stage_name} -> {new_stage_name})."
                )
                return bool(sent_count > 0)
            except Exception as e:
                logger.error(
                    f"[EmailService] Failed to send stage update email to {customer_email} "
                    f"for Lead #{lead_id}: {str(e)}",
                    exc_info=True
                )
                return False

        if async_dispatch:
            thread = threading.Thread(
                target=_send_worker,
                daemon=True,
                name=f"EmailWorker-Lead-{lead_id}"
            )
            thread.start()
            return True
        else:
            return _send_worker()

    except Exception as e:
        logger.error(
            f"[EmailService] Failed to prepare stage update email for Lead #{lead_id}: {str(e)}",
            exc_info=True
        )
        return False

