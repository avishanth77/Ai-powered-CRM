import logging
import re
from decimal import Decimal
from django.db import transaction, models
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, status
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle

from accounts.models import User
from activity.models import ActivityLog
from activity.services import log_activity
from notifications.models import Notification
from notifications.services.notification_service import NotificationService
from .models import Lead, LeadNote, LeadSource, LeadStage
from .services import execute_stage_task_automations

logger = logging.getLogger(__name__)


class PublicContactThrottle(AnonRateThrottle):
    scope = 'public_contact'


@method_decorator(csrf_exempt, name='dispatch')
class PublicContactLeadView(APIView):
    """
    Public Web-to-Lead HTTP POST endpoint.
    Allows external website contact forms to submit inquiries directly into the CRM.

    Key Features:
    - Unauthenticated (permission_classes = [AllowAny], authentication_classes = [])
    - Rate limited via PublicContactThrottle to prevent spam & resource exhaustion
    - CSRF-exempt to accept cross-origin and standard HTML <form> POST requests
    - Honeypot anti-spam protection (detects hidden bot fields)
    - Deduplication: If a lead with matching email/phone already exists in an active stage,
      it appends a new LeadNote and alerts the assigned sales rep rather than failing.
    - Automatic assignment: Uses round-robin / least-loaded active Sales Executive.
    - Automatic Stage Tasks: Instantiates checkpoint tasks for the initial stage (New).
    - Activity Logging & In-App Notifications dispatched immediately.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [PublicContactThrottle]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response['Access-Control-Allow-Headers'] = '*'
        return response

    def options(self, request, *args, **kwargs):
        response = Response(status=status.HTTP_200_OK)
        response['Access-Control-Allow-Origin'] = '*'
        response['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        response['Access-Control-Allow-Headers'] = '*'
        return response

    def post(self, request, *args, **kwargs):
        data = request.data or {}

        # 1. Anti-spam honeypot detection
        # Bots typically fill hidden inputs like 'website_url_hp', 'hp', '_gotcha', or 'honeypot'
        honeypot_fields = ['website_url_hp', 'hp', '_gotcha', 'honeypot', 'form_hp']
        for hp_field in honeypot_fields:
            if data.get(hp_field):
                logger.info(f"[Web-to-Lead] Bot honeypot triggered on field '{hp_field}'. Silently ignoring.")
                return Response({
                    'success': True,
                    'message': 'Thank you! Your message has been received.',
                    'is_new': False
                }, status=status.HTTP_200_OK)

        # 2. Extract incoming contact form parameters flexibly
        name = (data.get('name') or data.get('full_name') or data.get('contact_name') or '').strip()
        email = (data.get('email') or data.get('email_address') or '').strip()
        phone = (data.get('phone') or data.get('mobile') or data.get('telephone') or data.get('phone_number') or '').strip()
        company_name = (data.get('company_name') or data.get('company') or data.get('organization') or '').strip()
        message = (data.get('message') or data.get('inquiry') or data.get('notes') or data.get('comment') or data.get('description') or data.get('body') or '').strip()
        subject = (data.get('subject') or data.get('topic') or data.get('title') or '').strip()
        address = (data.get('address') or data.get('location') or data.get('city') or '').strip()
        custom_source = (data.get('source') or data.get('lead_source') or 'Website').strip()

        # Parse deal value / budget
        raw_val = data.get('expected_value') or data.get('deal_value') or data.get('budget')
        expected_value = Decimal('0.00')
        if raw_val is not None:
            try:
                # Strip currency symbols and commas e.g. "$1,500" -> "1500"
                cleaned_val = re.sub(r'[^\d.]', '', str(raw_val))
                if cleaned_val:
                    expected_value = Decimal(cleaned_val)
            except Exception:
                expected_value = Decimal('0.00')

        # 3. Validation
        if not name:
            return Response({
                'success': False,
                'message': 'Name is required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not email and not phone:
            return Response({
                'success': False,
                'message': 'Please provide an email address or phone number so our team can contact you.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate email format if provided
        if email and '@' not in email:
            return Response({
                'success': False,
                'message': 'Please provide a valid email address.'
            }, status=status.HTTP_400_BAD_REQUEST)

        # 4. Resolve Stage (Target: "New" or lowest order active stage)
        initial_stage = (
            LeadStage.objects.filter(slug='new', is_active=True).first()
            or LeadStage.objects.filter(name__iexact='new', is_active=True).first()
            or LeadStage.objects.filter(is_active=True).order_by('display_order', 'id').first()
        )
        if not initial_stage:
            initial_stage, _ = LeadStage.objects.get_or_create(
                slug='new',
                defaults={'name': 'New', 'display_order': 1, 'is_active': True}
            )

        # 5. Resolve Lead Source ("Website" or custom specified source)
        lead_source = (
            LeadSource.objects.filter(name__iexact=custom_source, is_active=True).first()
            or LeadSource.objects.filter(name__iexact='Website', is_active=True).first()
        )
        if not lead_source:
            lead_source, _ = LeadSource.objects.get_or_create(
                name='Website',
                defaults={'is_active': True}
            )

        # 6. Check for duplicate re-contact from active lead
        # If an active lead already exists with the same phone or email, record as note and notify rep
        existing_lead = None
        if phone:
            phone_digits = re.sub(r'\D', '', phone)
            if len(phone_digits) >= 7:
                existing_lead = (
                    Lead.objects.filter(phone=phone)
                    .exclude(stage__slug__in=['won', 'lost'])
                    .select_related('assigned_to', 'stage')
                    .first()
                )

        if not existing_lead and email:
            existing_lead = (
                Lead.objects.filter(email__iexact=email)
                .exclude(stage__slug__in=['won', 'lost'])
                .select_related('assigned_to', 'stage')
                .first()
            )

        if existing_lead:
            # Re-contact scenario: update company name if missing, append note, and alert team
            with transaction.atomic():
                if company_name and not existing_lead.company_name:
                    existing_lead.company_name = company_name
                    existing_lead.save(update_fields=['company_name', 'updated_at'])

                note_body = "Website Re-Contact Form Submission:\n"
                if subject:
                    note_body += f"Subject: {subject}\n"
                if message:
                    note_body += f"Message: {message}\n"
                if not message and not subject:
                    note_body += "User submitted contact form again without message details."

                LeadNote.objects.create(
                    lead=existing_lead,
                    user=None,
                    note_type=LeadNote.NoteType.GENERAL,
                    note_text=note_body
                )

                log_activity(
                    entity_type=ActivityLog.EntityType.LEAD,
                    entity_id=existing_lead.id,
                    action=ActivityLog.ActionType.NOTE_ADDED,
                    new_value={'note': note_body[:100], 'source': 'Website Web-to-Lead'},
                    performed_by=None,
                    notes=f"Received repeat website inquiry from {existing_lead.name}"
                )

                if existing_lead.assigned_to:
                    NotificationService.create_notification(
                        recipient=existing_lead.assigned_to,
                        notification_type=Notification.NotificationType.LEAD_UPDATED,
                        title="Website Lead Re-contacted",
                        message=f"{existing_lead.name} submitted another inquiry from the website contact form.",
                        entity_type='lead',
                        entity_id=existing_lead.id,
                        action_url=f"/leads/{existing_lead.id}",
                        priority=Notification.Priority.HIGH,
                        allow_self=True
                    )

            return Response({
                'success': True,
                'message': 'Thank you! We received your inquiry and will follow up with you shortly.',
                'lead_id': existing_lead.id,
                'is_new': False,
                'lead': {
                    'id': existing_lead.id,
                    'name': existing_lead.name,
                    'company_name': existing_lead.company_name,
                    'email': existing_lead.email,
                    'phone': existing_lead.phone,
                    'stage': existing_lead.stage.name if existing_lead.stage else None,
                    'assigned_to': existing_lead.assigned_to.get_full_name() if existing_lead.assigned_to else None,
                }
            }, status=status.HTTP_200_OK)

        # Database requires phone not-null: use provided phone or fallback
        final_phone = phone if phone else "Not provided"

        # 8. Create New Lead
        with transaction.atomic():
            lead = Lead.objects.create(
                name=name,
                phone=final_phone,
                email=email if email else None,
                company_name=company_name if company_name else None,
                source=lead_source,
                stage=initial_stage,
                priority=Lead.Priority.MEDIUM,
                expected_value=expected_value,
                address=address,
                assigned_to=None,
                created_by=None
            )

            # Optional product association from website inquiry
            prod = None
            product_val = data.get('product') or data.get('product_code') or data.get('product_id')
            if product_val:
                try:
                    from products.models import Product, LeadProduct
                    if str(product_val).isdigit():
                        prod = Product.objects.filter(id=int(product_val), is_active=True).first()
                    if not prod:
                        prod = Product.objects.filter(code__iexact=str(product_val).strip(), is_active=True).first()
                    if not prod:
                        prod = Product.objects.filter(name__icontains=str(product_val).strip(), is_active=True).first()
                    if prod:
                        LeadProduct.objects.create(lead=lead, product=prod, unit_price=prod.unit_price, quantity=1)
                        if expected_value == Decimal('0.00'):
                            lead.expected_value = prod.unit_price
                            lead.save(update_fields=['expected_value'])
                except Exception as ex:
                    logger.warning(f"Could not link web-to-lead product: {ex}")

            # Execute Auto-Assignment Engine using customized rules/pools
            from leads.services.assignment import assign_lead_to_salesman
            assigned_user = assign_lead_to_salesman(lead, channel='web_to_lead', product=prod, commit=True)

            # Record initial message inquiry as LeadNote
            if message or subject:
                note_content = "Website Inquiry:\n"
                if subject:
                    note_content += f"Subject: {subject}\n"
                if message:
                    note_content += f"Message: {message}\n"

                LeadNote.objects.create(
                    lead=lead,
                    user=None,
                    note_type=LeadNote.NoteType.GENERAL,
                    note_text=note_content
                )

            # Instantiate stage automated tasks
            execute_stage_task_automations(
                lead=lead,
                new_stage=initial_stage,
                old_stage=None,
                actor=None
            )

            # Log lead creation in activity log
            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=lead.id,
                action=ActivityLog.ActionType.LEAD_CREATED,
                new_value={
                    'name': lead.name,
                    'phone': lead.phone,
                    'email': lead.email,
                    'company_name': lead.company_name,
                    'source': lead.source.name if lead.source else 'Website',
                    'stage': lead.stage.name if lead.stage else 'New',
                    'priority': lead.priority,
                    'assigned_to': lead.assigned_to.get_full_name() if lead.assigned_to else None,
                },
                performed_by=None,
                notes="Lead captured via Website Contact Form (Web-to-Lead)"
            )

            # 9. In-App Notifications
            if assigned_user:
                NotificationService.notify_lead_assigned(
                    lead=lead,
                    assignee=assigned_user,
                    actor=None
                )

            # Notify administrators & managers
            supervisors = User.objects.filter(
                role__in=[User.Role.ADMIN, User.Role.MANAGER],
                is_active=True
            )
            if assigned_user:
                supervisors = supervisors.exclude(id=assigned_user.id)

            for supervisor in supervisors:
                NotificationService.create_notification(
                    recipient=supervisor,
                    notification_type=Notification.NotificationType.SYSTEM,
                    title="New Website Lead Received",
                    message=f"New inquiry from {lead.name} ({lead.company_name or 'Individual'}) via Website contact form.",
                    entity_type='lead',
                    entity_id=lead.id,
                    action_url=f"/leads/{lead.id}",
                    priority=Notification.Priority.NORMAL,
                    allow_self=True
                )

        return Response({
            'success': True,
            'message': 'Thank you! Your inquiry has been submitted successfully.',
            'lead_id': lead.id,
            'is_new': True,
            'lead': {
                'id': lead.id,
                'name': lead.name,
                'company_name': lead.company_name,
                'email': lead.email,
                'phone': lead.phone,
                'stage': lead.stage.name if lead.stage else None,
                'assigned_to': lead.assigned_to.get_full_name() if lead.assigned_to else None,
                'created_at': lead.created_at.isoformat(),
            }
        }, status=status.HTTP_201_CREATED)

