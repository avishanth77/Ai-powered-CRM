"""
Custom Email Backend for CRM Lite with Resend HTTPS API support.
Bypasses cloud firewall restrictions on outbound SMTP ports (25, 465, 587) on platforms like Render.
"""
import logging
import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.backends.smtp import EmailBackend as SmtpEmailBackend

logger = logging.getLogger(__name__)


class ResendEmailBackend(BaseEmailBackend):
    """
    Sends email via Resend's HTTPS REST API (Port 443).
    If RESEND_API_KEY is not configured, transparently delegates to Django's standard SMTP EmailBackend.
    """

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.api_key = getattr(settings, 'RESEND_API_KEY', '').strip()
        self.resend_from = getattr(settings, 'RESEND_FROM_EMAIL', 'CRM Lite <onboarding@resend.dev>').strip()
        # Initialize standard SMTP backend as fallback
        self.smtp_fallback = SmtpEmailBackend(fail_silently=fail_silently, **kwargs)

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        # If Resend API key is not configured, delegate to standard SMTP backend
        if not self.api_key:
            logger.debug("RESEND_API_KEY not configured; falling back to SMTP EmailBackend.")
            return self.smtp_fallback.send_messages(email_messages)

        num_sent = 0
        endpoint = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        for msg in email_messages:
            try:
                # Resend requires either onboarding@resend.dev or a domain verified in Resend.
                # If msg.from_email is a Gmail address or demo domain, Resend requires using RESEND_FROM_EMAIL.
                from_email = self.resend_from
                if msg.from_email and not any(d in msg.from_email.lower() for d in ['@gmail.com', '@crmlite.com', '@example.com']):
                    from_email = msg.from_email

                payload = {
                    "from": from_email,
                    "to": list(msg.to),
                    "subject": msg.subject or "Notification from CRM Lite",
                }

                if getattr(msg, 'cc', None):
                    payload["cc"] = list(msg.cc)
                if getattr(msg, 'bcc', None):
                    payload["bcc"] = list(msg.bcc)
                if getattr(msg, 'reply_to', None):
                    payload["reply_to"] = list(msg.reply_to)

                # Extract HTML content from alternatives if present
                html_body = None
                if hasattr(msg, 'alternatives') and msg.alternatives:
                    for content, mimetype in msg.alternatives:
                        if mimetype == 'text/html':
                            html_body = content
                            break

                if html_body:
                    payload["html"] = html_body
                if msg.body:
                    payload["text"] = msg.body
                elif not html_body:
                    payload["text"] = "No content"

                response = requests.post(endpoint, json=payload, headers=headers, timeout=getattr(settings, 'EMAIL_TIMEOUT', 15))

                if response.status_code in (200, 201):
                    res_data = response.json()
                    logger.info(f"Email sent successfully via Resend to {msg.to} (ID: {res_data.get('id')})")
                    num_sent += 1
                else:
                    err_msg = ""
                    try:
                        err_json = response.json()
                        err_msg = err_json.get('message', '')
                    except Exception:
                        pass
                    if not err_msg:
                        err_msg = response.text or f"HTTP {response.status_code}"

                    logger.error(f"Resend API error sending to {msg.to}: {err_msg} (Status: {response.status_code})")
                    if not self.fail_silently:
                        raise RuntimeError(f"Resend error ({response.status_code}): {err_msg}")

            except Exception as exc:
                logger.error(f"Failed to dispatch email via Resend to {msg.to}: {exc}")
                if not self.fail_silently:
                    raise

        return num_sent

