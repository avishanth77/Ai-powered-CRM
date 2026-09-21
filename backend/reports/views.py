import csv
from datetime import datetime, time, timedelta
from decimal import Decimal
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Count, Sum, Q, Avg
from django.db.models.functions import TruncMonth, TruncDate
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status

from leads.models import Lead, LeadSource
from customers.models import Customer
from followups.models import FollowUp
from accounts.models import User

class ReportSummaryView(APIView):
    """
    Summary KPIs and charts data for CRM Dashboard.
    Calculated in real-time from the database.
    Scoped by user role:
    - Admin & Manager: Organization/Team-wide
    - Executive: Own assigned leads and metrics
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        leads_qs = Lead.objects.all()
        followups_qs = FollowUp.objects.all()
        customers_qs = Customer.objects.all()

        # Role scoping
        if user.role == 'EXECUTIVE' and not user.is_superuser:
            leads_qs = leads_qs.filter(Q(assigned_to=user) | Q(created_by=user))
            followups_qs = followups_qs.filter(assigned_to=user)
            customers_qs = customers_qs.filter(created_by=user)

        total_leads = leads_qs.count()
        new_leads = leads_qs.filter(status=Lead.Status.NEW).count()
        contacted_leads = leads_qs.filter(status=Lead.Status.CONTACTED).count()
        demo_scheduled_leads = leads_qs.filter(status=Lead.Status.DEMO_SCHEDULED).count()
        negotiation_leads = leads_qs.filter(status=Lead.Status.NEGOTIATION).count()
        qualified_leads = leads_qs.filter(status=Lead.Status.QUALIFIED).count()
        won_leads = leads_qs.filter(status=Lead.Status.WON).count()
        lost_leads = leads_qs.filter(status=Lead.Status.LOST).count()

        total_customers = customers_qs.count()

        # Follow-ups metrics
        now = timezone.now()
        start_of_day = timezone.make_aware(datetime.combine(now.date(), time.min))
        end_of_day = timezone.make_aware(datetime.combine(now.date(), time.max))

        today_followups = followups_qs.filter(
            follow_up_at__range=(start_of_day, end_of_day)
        ).count()

        overdue_followups = followups_qs.filter(
            status=FollowUp.Status.PENDING,
            follow_up_at__lt=now
        ).count()

        completed_followups = followups_qs.filter(status=FollowUp.Status.COMPLETED).count()
        total_followups = followups_qs.count()
        followup_completion_rate = round((completed_followups / total_followups * 100), 1) if total_followups > 0 else 0.0

        # Financials & Conversion
        total_expected_value = leads_qs.aggregate(total=Sum('expected_value'))['total'] or Decimal('0.00')
        closed_leads = won_leads + lost_leads
        conversion_rate = round((won_leads / closed_leads * 100), 1) if closed_leads > 0 else (
            round((won_leads / total_leads * 100), 1) if total_leads > 0 else 0.0
        )

        # Charts Data

        # 1. Leads by status
        status_data = []
        for st_key, st_label in Lead.Status.choices:
            cnt = leads_qs.filter(status=st_key).count()
            status_data.append({'status': st_key, 'label': st_label, 'count': cnt})

        # 2. Leads by source
        source_counts = leads_qs.values('source__name').annotate(count=Count('id')).order_by('-count')
        source_data = [
            {'source': item['source__name'] or 'Unknown / Unassigned', 'count': item['count']}
            for item in source_counts
        ]

        # 3. Leads by priority
        priority_data = []
        for pr_key, pr_label in Lead.Priority.choices:
            cnt = leads_qs.filter(priority=pr_key).count()
            priority_data.append({'priority': pr_key, 'label': pr_label, 'count': cnt})

        # 4. Monthly lead creation (last 6 months)
        six_months_ago = now - timedelta(days=180)
        monthly_counts = leads_qs.filter(created_at__gte=six_months_ago) \
                                 .annotate(month=TruncMonth('created_at')) \
                                 .values('month') \
                                 .annotate(count=Count('id')) \
                                 .order_by('month')
        monthly_data = [
            {'month': item['month'].strftime('%b %Y') if item['month'] else 'N/A', 'count': item['count']}
            for item in monthly_counts
        ]

        # 5. User performance (for Manager / Admin)
        user_performance = []
        if user.role in ['ADMIN', 'MANAGER'] or user.is_superuser:
            executives = User.objects.filter(is_active=True).order_by('first_name')
            for exec_user in executives:
                user_leads = Lead.objects.filter(assigned_to=exec_user)
                user_won = user_leads.filter(status=Lead.Status.WON).count()
                user_performance.append({
                    'user_id': exec_user.id,
                    'name': exec_user.get_full_name() or exec_user.email,
                    'role': exec_user.role,
                    'total_leads': user_leads.count(),
                    'won_leads': user_won,
                    'expected_value': user_leads.aggregate(s=Sum('expected_value'))['s'] or 0,
                    'pending_followups': FollowUp.objects.filter(assigned_to=exec_user, status=FollowUp.Status.PENDING).count()
                })

        return Response({
            'success': True,
            'data': {
                'kpis': {
                    'total_leads': total_leads,
                    'new_leads': new_leads,
                    'contacted_leads': contacted_leads,
                    'demo_scheduled_leads': demo_scheduled_leads,
                    'negotiation_leads': negotiation_leads,
                    'qualified_leads': qualified_leads,
                    'won_leads': won_leads,
                    'lost_leads': lost_leads,
                    'total_customers': total_customers,
                    'today_followups': today_followups,
                    'overdue_followups': overdue_followups,
                    'expected_sales_value': float(total_expected_value),
                    'conversion_rate': conversion_rate,
                    'followup_completion_rate': followup_completion_rate,
                },
                'charts': {
                    'by_status': status_data,
                    'by_source': source_data,
                    'by_priority': priority_data,
                    'monthly_trend': monthly_data,
                    'won_vs_lost': {
                        'won': won_leads,
                        'lost': lost_leads,
                        'active': total_leads - (won_leads + lost_leads)
                    },
                    'followup_stats': {
                        'completed': completed_followups,
                        'overdue': overdue_followups,
                        'pending': followups_qs.filter(status=FollowUp.Status.PENDING, follow_up_at__gte=now).count(),
                        'cancelled': followups_qs.filter(status=FollowUp.Status.CANCELLED).count()
                    }
                },
                'user_performance': user_performance
            }
        })


from rest_framework.renderers import BaseRenderer

class CSVRenderer(BaseRenderer):
    media_type = 'text/csv'
    format = 'csv'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data

class ExportReportView(APIView):
    """
    Export leads & CRM performance records as a formatted CSV file.
    Supports filters for date range, status, priority, and source.
    Available to Admin and Sales Manager.
    """
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [CSVRenderer]

    def get(self, request):
        user = request.user
        if user.role == 'EXECUTIVE' and not user.is_superuser:
            return Response({
                'success': False,
                'message': 'Permission denied. Only Managers and Admins can export CRM reports.'
            }, status=status.HTTP_403_FORBIDDEN)

        qs = Lead.objects.select_related('source', 'assigned_to', 'created_by').all().order_by('-created_at')

        # Filters
        status_param = request.query_params.get('status')
        source_param = request.query_params.get('source')
        priority_param = request.query_params.get('priority')
        assigned_to_param = request.query_params.get('assigned_to')
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')

        if status_param:
            qs = qs.filter(status=status_param)
        if source_param:
            qs = qs.filter(source_id=source_param)
        if priority_param:
            qs = qs.filter(priority=priority_param)
        if assigned_to_param:
            qs = qs.filter(assigned_to_id=assigned_to_param)
        if from_date:
            qs = qs.filter(created_at__gte=from_date)
        if to_date:
            qs = qs.filter(created_at__lte=to_date)

        response = HttpResponse(content_type='text/csv')
        filename = f"crm_lite_leads_report_{timezone.now():%Y%m%d_%H%M%S}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow([
            'Lead ID',
            'Name',
            'Company',
            'Phone',
            'Email',
            'Source',
            'Status',
            'Priority',
            'Expected Value',
            'Assigned To',
            'Created By',
            'Created Date',
            'Converted Date',
            'Lost Reason',
            'Address'
        ])

        for lead in qs:
            writer.writerow([
                lead.id,
                lead.name,
                lead.company_name or '',
                lead.phone,
                lead.email or '',
                lead.source.name if lead.source else 'N/A',
                lead.status,
                lead.priority,
                str(lead.expected_value),
                lead.assigned_to.get_full_name() if lead.assigned_to else 'Unassigned',
                lead.created_by.get_full_name() if lead.created_by else 'System',
                lead.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                lead.converted_at.strftime('%Y-%m-%d %H:%M:%S') if lead.converted_at else '',
                lead.lost_reason or '',
                lead.address or ''
            ])

        return response
