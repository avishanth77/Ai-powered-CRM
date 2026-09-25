from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.utils import timezone
from django.utils.dateparse import parse_datetime, parse_date
from datetime import datetime, timedelta
from django.contrib.auth import get_user_model

from .models import FollowUp

User = get_user_model()


class CalendarEventsView(APIView):
    """
    API endpoint for retrieving CRM Calendar Events based on existing FollowUp records.
    Supports Month, Week, and Day range queries, role-based scoping, and filters.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        qs = FollowUp.objects.select_related('lead', 'customer', 'assigned_to').all()

        # Strict Role-based access control
        if user.role == User.Role.EXECUTIVE and not user.is_superuser:
            qs = qs.filter(assigned_to=user)
        else:
            # Manager or Admin can filter by specific user
            assigned_to_param = request.query_params.get('assigned_to')
            if assigned_to_param:
                qs = qs.filter(assigned_to_id=assigned_to_param)

        # Date range filtering (start & end)
        start_param = request.query_params.get('start')
        end_param = request.query_params.get('end')

        if start_param:
            clean_start = start_param.strip().replace(' ', '+')
            dt_start = parse_datetime(clean_start) or parse_datetime(start_param)
            if not dt_start:
                d_start = parse_date(start_param)
                if d_start:
                    dt_start = timezone.make_aware(datetime.combine(d_start, datetime.min.time()))
            if dt_start:
                qs = qs.filter(follow_up_at__gte=dt_start)

        if end_param:
            clean_end = end_param.strip().replace(' ', '+')
            dt_end = parse_datetime(clean_end) or parse_datetime(end_param)
            if not dt_end:
                d_end = parse_date(end_param)
                if d_end:
                    dt_end = timezone.make_aware(datetime.combine(d_end, datetime.max.time()))
            if dt_end:
                qs = qs.filter(follow_up_at__lte=dt_end)

        # Status filter
        status_param = request.query_params.get('status')
        if status_param and status_param.upper() != 'ALL':
            qs = qs.filter(status=status_param.upper())

        # Purpose / Type filter
        purpose_param = request.query_params.get('purpose')
        if purpose_param and purpose_param.lower() != 'all':
            qs = qs.filter(purpose__iexact=purpose_param)

        # Order chronologically
        qs = qs.order_by('follow_up_at')

        now = timezone.now()
        events = []

        for fu in qs:
            target_name = fu.lead.name if fu.lead else (fu.customer.name if fu.customer else 'Unlinked')
            company_name = (
                fu.lead.company_name if fu.lead and fu.lead.company_name
                else (fu.customer.company_name if fu.customer and fu.customer.company_name else '')
            )
            title = f"{fu.get_purpose_display() if hasattr(fu, 'get_purpose_display') else fu.purpose.capitalize()} — {target_name}"
            if company_name:
                title += f" ({company_name})"

            # Default duration: 30 minutes for calendar block display
            start_iso = fu.follow_up_at.isoformat()
            end_iso = (fu.follow_up_at + timedelta(minutes=30)).isoformat()

            is_overdue = (fu.status == FollowUp.Status.PENDING and fu.follow_up_at < now)

            lead_data = None
            if fu.lead:
                lead_data = {
                    'id': fu.lead.id,
                    'name': fu.lead.name,
                    'company_name': fu.lead.company_name,
                    'phone': fu.lead.phone,
                    'email': fu.lead.email,
                    'stage': fu.lead.stage.name if fu.lead.stage else None,
                }

            customer_data = None
            if fu.customer:
                customer_data = {
                    'id': fu.customer.id,
                    'name': fu.customer.name,
                    'company_name': fu.customer.company_name,
                    'phone': fu.customer.phone,
                    'email': fu.customer.email,
                }

            assigned_data = None
            if fu.assigned_to:
                assigned_data = {
                    'id': fu.assigned_to.id,
                    'email': fu.assigned_to.email,
                    'full_name': fu.assigned_to.get_full_name() or fu.assigned_to.email,
                }

            events.append({
                'id': fu.id,
                'title': title,
                'start': start_iso,
                'end': end_iso,
                'follow_up_at': start_iso,
                'status': fu.status,
                'purpose': fu.purpose,
                'outcome': fu.outcome,
                'notes': fu.notes,
                'is_overdue': is_overdue,
                'lead': lead_data,
                'customer': customer_data,
                'assigned_to': assigned_data,
                'action_url': f"/leads/{fu.lead.id}" if fu.lead else (f"/customers/{fu.customer.id}" if fu.customer else None),
            })

        return Response({
            'count': len(events),
            'results': events
        }, status=status.HTTP_200_OK)
