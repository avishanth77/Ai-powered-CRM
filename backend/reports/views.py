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

from leads.models import Lead, LeadSource, LeadStage, LeadHandover
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
        new_leads = leads_qs.filter(stage__slug='new').count()
        contacted_leads = leads_qs.filter(stage__slug='contacted').count()
        demo_scheduled_leads = leads_qs.filter(stage__slug='demo-scheduled').count()
        negotiation_leads = leads_qs.filter(stage__slug='negotiation').count()
        qualified_leads = leads_qs.filter(stage__slug='qualified').count()
        won_leads = leads_qs.filter(stage__slug='won').count()
        lost_leads = leads_qs.filter(stage__slug='lost').count()

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

        # 1. Leads by status / stage (Dynamic from database)
        status_data = []
        for st in LeadStage.objects.all().order_by('display_order', 'id'):
            cnt = leads_qs.filter(stage=st).count()
            status_data.append({
                'status': st.slug.upper().replace('-', '_'),
                'stage_id': st.id,
                'stage_slug': st.slug,
                'label': st.name,
                'color': st.color,
                'count': cnt
            })

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

        # 5. User performance & Leads by Executive (for Manager / Admin)
        user_performance = []
        leads_by_executive = []
        recent_handovers = []

        if user.role in ['ADMIN', 'MANAGER'] or user.is_superuser:
            executives = User.objects.filter(is_active=True).order_by('first_name')
            for exec_user in executives:
                user_leads = Lead.objects.filter(assigned_to=exec_user)
                user_won = user_leads.filter(stage__slug='won').count()
                cnt = user_leads.count()
                user_performance.append({
                    'user_id': exec_user.id,
                    'name': exec_user.get_full_name() or exec_user.email,
                    'role': exec_user.role,
                    'total_leads': cnt,
                    'won_leads': user_won,
                    'expected_value': user_leads.aggregate(s=Sum('expected_value'))['s'] or 0,
                    'pending_followups': FollowUp.objects.filter(assigned_to=exec_user, status=FollowUp.Status.PENDING).count()
                })
                if exec_user.role == User.Role.EXECUTIVE:
                    leads_by_executive.append({
                        'user_id': exec_user.id,
                        'name': exec_user.get_full_name() or exec_user.email,
                        'email': exec_user.email,
                        'count': cnt,
                        'leads_count': cnt,
                    })

            # Recent handovers
            handovers_qs = LeadHandover.objects.select_related('lead', 'previous_assignee', 'new_assignee', 'handed_over_by').order_by('-created_at')[:8]
            for h in handovers_qs:
                recent_handovers.append({
                    'id': h.id,
                    'lead_id': h.lead_id,
                    'lead_name': h.lead.name,
                    'company_name': h.lead.company_name or '',
                    'previous_assignee': h.previous_assignee.get_full_name() or h.previous_assignee.email if h.previous_assignee else 'Unassigned',
                    'new_assignee': h.new_assignee.get_full_name() or h.new_assignee.email if h.new_assignee else 'None',
                    'reason': h.reason,
                    'handed_over_by': h.handed_over_by.get_full_name() or h.handed_over_by.email if h.handed_over_by else 'Admin',
                    'created_at': h.created_at.isoformat(),
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
                        'active': total_leads - closed_leads
                    }
                },
                'user_performance': user_performance,
                'leads_by_executive': leads_by_executive,
                'recent_handovers': recent_handovers,
            }
        })


from rest_framework.renderers import BaseRenderer

class CSVRenderer(BaseRenderer):
    media_type = 'text/csv'
    format = 'csv'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        return data


def get_filtered_leads_queryset(user, query_params):
    qs = Lead.objects.select_related('source', 'stage', 'assigned_to', 'created_by').all()

    if user.role == 'EXECUTIVE' and not user.is_superuser:
        qs = qs.filter(Q(assigned_to=user) | Q(created_by=user))

    status_param = query_params.get('status')
    source_param = query_params.get('source')
    priority_param = query_params.get('priority')
    assigned_to_param = query_params.get('assigned_to')
    from_date = query_params.get('from_date')
    to_date = query_params.get('to_date')
    keyword_param = query_params.get('keyword')

    if status_param:
        qs = qs.filter(Q(stage__slug__iexact=status_param) | Q(stage__name__iexact=status_param))
    if source_param:
        qs = qs.filter(source_id=source_param)
    if priority_param:
        qs = qs.filter(priority=priority_param)
    if assigned_to_param:
        qs = qs.filter(assigned_to_id=assigned_to_param)
    if from_date:
        if 'T' in from_date:
            qs = qs.filter(created_at__gte=from_date)
        else:
            qs = qs.filter(created_at__date__gte=from_date)
    if to_date:
        if 'T' in to_date:
            qs = qs.filter(created_at__lte=to_date)
        else:
            qs = qs.filter(created_at__date__lte=to_date)
    if keyword_param:
        qs = qs.filter(
            Q(name__icontains=keyword_param) |
            Q(phone__icontains=keyword_param) |
            Q(email__icontains=keyword_param) |
            Q(company_name__icontains=keyword_param)
        )

    return qs.order_by('-created_at')


class ReportExportView(APIView):
    """
    CSV Data Export Endpoint.
    Generates downloadable CSV for Leads, Customers, or Follow-ups.
    """
    permission_classes = [permissions.IsAuthenticated]
    renderer_classes = [CSVRenderer]


    def get(self, request):
        user = request.user
        export_type = request.query_params.get('type', 'leads').lower()

        # Sales Executive can only export their own assigned records
        if export_type == 'leads':
            return self.export_leads(request, user)
        elif export_type == 'customers':
            return self.export_customers(request, user)
        elif export_type == 'followups':
            return self.export_followups(request, user)
        else:
            return Response(
                {'error': 'Invalid export type. Must be leads, customers, or followups.'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def export_leads(self, request, user):
        qs = get_filtered_leads_queryset(user, request.query_params)

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

    def export_customers(self, request, user):
        qs = Customer.objects.select_related('created_by', 'lead').all()
        if user.role == 'EXECUTIVE' and not user.is_superuser:
            qs = qs.filter(created_by=user)

        response = HttpResponse(content_type='text/csv')
        filename = f"crm_lite_customers_report_{timezone.now():%Y%m%d_%H%M%S}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow(['Customer ID', 'Name', 'Company', 'Phone', 'Email', 'Converted Date', 'Created By'])

        for c in qs:
            writer.writerow([
                c.id,
                c.name,
                c.company_name or '',
                c.phone,
                c.email or '',
                c.converted_at.strftime('%Y-%m-%d %H:%M:%S') if c.converted_at else '',
                c.created_by.get_full_name() if c.created_by else 'System'
            ])

        return response

    def export_followups(self, request, user):
        qs = FollowUp.objects.select_related('lead', 'assigned_to', 'created_by').all()
        if user.role == 'EXECUTIVE' and not user.is_superuser:
            qs = qs.filter(assigned_to=user)

        response = HttpResponse(content_type='text/csv')
        filename = f"crm_lite_followups_report_{timezone.now():%Y%m%d_%H%M%S}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow(['Follow-up ID', 'Lead Name', 'Purpose', 'Scheduled At', 'Status', 'Assigned To', 'Outcome'])

        for f in qs:
            writer.writerow([
                f.id,
                f.lead.name if f.lead else 'N/A',
                f.purpose,
                f.follow_up_at.strftime('%Y-%m-%d %H:%M:%S'),
                f.status,
                f.assigned_to.get_full_name() if f.assigned_to else 'Unassigned',
                f.outcome or ''
            ])

        return response


ExportReportView = ReportExportView


class ReportPreviewView(APIView):
    """
    Real-time preview API for Report Filters & Export Criteria.
    Returns matched count, total expected sales value, average deal size,
    and a preview list of matching lead records for the export.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        export_type = request.query_params.get('type', 'leads').lower()

        if export_type != 'leads':
            return Response(
                {'error': 'Preview is currently supported for leads.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        qs = get_filtered_leads_queryset(user, request.query_params)

        total_count = qs.count()
        aggregates = qs.aggregate(
            total_value=Sum('expected_value'),
            avg_value=Avg('expected_value')
        )
        total_value = float(aggregates['total_value'] or 0.0)
        avg_value = round(float(aggregates['avg_value'] or 0.0), 2)

        try:
            limit = min(max(int(request.query_params.get('limit', 10)), 1), 50)
        except (ValueError, TypeError):
            limit = 10

        records = []
        for lead in qs[:limit]:
            records.append({
                'id': lead.id,
                'name': lead.name,
                'company_name': lead.company_name or '',
                'phone': lead.phone or '',
                'email': lead.email or '',
                'source': lead.source.name if lead.source else 'N/A',
                'source_id': lead.source_id,
                'status': lead.status,
                'stage_slug': lead.stage.slug if lead.stage else '',
                'stage_name': lead.stage.name if lead.stage else (lead.status or 'New'),
                'stage_color': getattr(lead.stage, 'color', None) if lead.stage else None,
                'priority': lead.priority,
                'expected_value': float(lead.expected_value or 0.0),
                'assigned_to': lead.assigned_to.get_full_name() or lead.assigned_to.email if lead.assigned_to else 'Unassigned',
                'assigned_to_id': lead.assigned_to_id,
                'created_by': lead.created_by.get_full_name() or lead.created_by.email if lead.created_by else 'System',
                'created_at': lead.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'created_date': lead.created_at.strftime('%Y-%m-%d'),
            })

        return Response({
            'success': True,
            'data': {
                'total_count': total_count,
                'total_expected_value': total_value,
                'avg_expected_value': avg_value,
                'preview_limit': limit,
                'records': records,
            }
        })

