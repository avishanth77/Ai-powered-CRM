import calendar
from datetime import datetime, time, date
from decimal import Decimal
from django.utils import timezone
from django.db.models import Sum, Q, Count

TARGET_PRESETS = {
    'STANDARD': {
        'name': 'Standard Sales Representative',
        'daily_calls_target': 15,
        'daily_leads_target': 5,
        'daily_revenue_target': Decimal('5000.00'),
        'monthly_calls_target': 300,
        'monthly_leads_target': 80,
        'monthly_deals_won_target': 8,
        'monthly_revenue_target': Decimal('150000.00'),
        'description': 'Balanced prospect-to-close targets for full-cycle sales reps.',
    },
    'SDR': {
        'name': 'Outbound Prospector / SDR',
        'daily_calls_target': 30,
        'daily_leads_target': 10,
        'daily_revenue_target': Decimal('0.00'),
        'monthly_calls_target': 600,
        'monthly_leads_target': 180,
        'monthly_deals_won_target': 4,
        'monthly_revenue_target': Decimal('75000.00'),
        'description': 'High volume outbound calling and initial qualification focus.',
    },
    'CLOSER': {
        'name': 'Account Executive / Closer',
        'daily_calls_target': 8,
        'daily_leads_target': 2,
        'daily_revenue_target': Decimal('20000.00'),
        'monthly_calls_target': 150,
        'monthly_leads_target': 30,
        'monthly_deals_won_target': 6,
        'monthly_revenue_target': Decimal('400000.00'),
        'description': 'High-ticket deal closing, demos, and enterprise contracts.',
    },
}


def get_current_period_month():
    """Returns the current month in YYYY-MM format."""
    now = timezone.localdate()
    return f"{now.year:04d}-{now.month:02d}"


def get_or_create_staff_target(user, period_month=None, admin_user=None):
    """
    Retrieves the StaffTarget for a user in the requested period_month.
    If none exists for this specific month, checks if the user has an earlier active target
    to use as a baseline, or creates a standard default target.
    """
    from accounts.models import StaffTarget

    if not period_month:
        period_month = get_current_period_month()

    target = StaffTarget.objects.filter(user=user, period_month=period_month).first()
    if target:
        return target

    # Look for the most recent target of this user to copy baseline
    last_target = StaffTarget.objects.filter(user=user).order_by('-period_month').first()
    if last_target:
        return StaffTarget.objects.create(
            user=user,
            period_month=period_month,
            daily_calls_target=last_target.daily_calls_target,
            daily_leads_target=last_target.daily_leads_target,
            daily_revenue_target=last_target.daily_revenue_target,
            monthly_calls_target=last_target.monthly_calls_target,
            monthly_leads_target=last_target.monthly_leads_target,
            monthly_deals_won_target=last_target.monthly_deals_won_target,
            monthly_revenue_target=last_target.monthly_revenue_target,
            notes=last_target.notes,
            set_by=admin_user or last_target.set_by,
        )

    # Otherwise create standard initial target
    preset = TARGET_PRESETS['STANDARD']
    return StaffTarget.objects.create(
        user=user,
        period_month=period_month,
        daily_calls_target=preset['daily_calls_target'],
        daily_leads_target=preset['daily_leads_target'],
        daily_revenue_target=preset['daily_revenue_target'],
        monthly_calls_target=preset['monthly_calls_target'],
        monthly_leads_target=preset['monthly_leads_target'],
        monthly_deals_won_target=preset['monthly_deals_won_target'],
        monthly_revenue_target=preset['monthly_revenue_target'],
        notes='Standard initial target assigned by system.',
        set_by=admin_user,
    )


def calculate_staff_progress(user, target=None, target_date=None):
    """
    Calculates comprehensive daily and monthly target achievements for a given user.
    """
    from followups.models import FollowUp
    from leads.models import Lead
    from accounts.models import StaffTarget

    today = target_date or timezone.localdate()
    period_month = f"{today.year:04d}-{today.month:02d}"

    if target is None:
        target = StaffTarget.objects.filter(user=user, period_month=period_month).first()
        if not target:
            target = StaffTarget.objects.filter(user=user).order_by('-period_month').first()

    # Time bounds
    now = timezone.now()
    start_of_day = timezone.make_aware(datetime.combine(today, time.min))
    end_of_day = timezone.make_aware(datetime.combine(today, time.max))

    _, days_in_month = calendar.monthrange(today.year, today.month)
    start_of_month = timezone.make_aware(datetime(today.year, today.month, 1, 0, 0, 0))
    end_of_month = timezone.make_aware(datetime(today.year, today.month, days_in_month, 23, 59, 59))

    # --- 1. DAILY ACTUALS ---
    # Calls / Follow-ups completed today by this user
    calls_completed_today = FollowUp.objects.filter(
        assigned_to=user,
        status=FollowUp.Status.COMPLETED
    ).filter(
        Q(completed_at__range=(start_of_day, end_of_day)) |
        (Q(completed_at__isnull=True) & Q(updated_at__range=(start_of_day, end_of_day)))
    ).count()

    # Leads acquired or assigned today
    leads_handled_today = Lead.objects.filter(
        Q(assigned_to=user) | Q(created_by=user)
    ).filter(
        created_at__range=(start_of_day, end_of_day)
    ).count()

    # Deals won today
    won_leads_today_qs = Lead.objects.filter(
        assigned_to=user,
        stage__slug='won'
    ).filter(
        Q(converted_at__range=(start_of_day, end_of_day)) |
        (Q(converted_at__isnull=True) & Q(updated_at__range=(start_of_day, end_of_day)))
    )
    deals_won_today = won_leads_today_qs.count()
    revenue_won_today = won_leads_today_qs.aggregate(total=Sum('expected_value'))['total'] or Decimal('0.00')

    # --- 2. MONTHLY ACTUALS ---
    # Calls completed in the entire month
    calls_completed_month = FollowUp.objects.filter(
        assigned_to=user,
        status=FollowUp.Status.COMPLETED
    ).filter(
        Q(completed_at__range=(start_of_month, end_of_month)) |
        (Q(completed_at__isnull=True) & Q(updated_at__range=(start_of_month, end_of_month)))
    ).count()

    # Leads acquired in the entire month
    leads_handled_month = Lead.objects.filter(
        Q(assigned_to=user) | Q(created_by=user)
    ).filter(
        created_at__range=(start_of_month, end_of_month)
    ).count()

    # Deals won in the entire month
    won_leads_month_qs = Lead.objects.filter(
        assigned_to=user,
        stage__slug='won'
    ).filter(
        Q(converted_at__range=(start_of_month, end_of_month)) |
        (Q(converted_at__isnull=True) & Q(updated_at__range=(start_of_month, end_of_month)))
    )
    deals_won_month = won_leads_month_qs.count()
    revenue_won_month = won_leads_month_qs.aggregate(total=Sum('expected_value'))['total'] or Decimal('0.00')

    # Targets fallback if target not configured yet
    daily_calls_tgt = target.daily_calls_target if target else 10
    daily_leads_tgt = target.daily_leads_target if target else 3
    daily_rev_tgt = target.daily_revenue_target if target else Decimal('0.00')

    monthly_calls_tgt = target.monthly_calls_target if target else 200
    monthly_leads_tgt = target.monthly_leads_target if target else 50
    monthly_deals_tgt = target.monthly_deals_won_target if target else 5
    monthly_rev_tgt = target.monthly_revenue_target if target else Decimal('50000.00')

    # Calculate percentages
    def safe_pct(actual, target_val):
        if not target_val or target_val <= 0:
            return 100.0 if actual > 0 else 0.0
        return round(float(actual) / float(target_val) * 100.0, 1)

    daily_calls_pct = safe_pct(calls_completed_today, daily_calls_tgt)
    daily_leads_pct = safe_pct(leads_handled_today, daily_leads_tgt)
    daily_rev_pct = safe_pct(revenue_won_today, daily_rev_tgt)

    monthly_calls_pct = safe_pct(calls_completed_month, monthly_calls_tgt)
    monthly_leads_pct = safe_pct(leads_handled_month, monthly_leads_tgt)
    monthly_deals_pct = safe_pct(deals_won_month, monthly_deals_tgt)
    monthly_rev_pct = safe_pct(revenue_won_month, monthly_rev_tgt)

    # Composite scores (average of percentages capped at 100% for score calculation)
    daily_score = round(
        (min(daily_calls_pct, 100.0) + min(daily_leads_pct, 100.0) + (min(daily_rev_pct, 100.0) if daily_rev_tgt > 0 else 100.0)) /
        (3.0 if daily_rev_tgt > 0 else 2.0),
        1
    )

    monthly_score = round(
        (min(monthly_calls_pct, 100.0) + min(monthly_leads_pct, 100.0) + min(monthly_deals_pct, 100.0) + min(monthly_rev_pct, 100.0)) / 4.0,
        1
    )

    def determine_status(score, deals_pct=0, calls_pct=0):
        if score >= 100.0 or (deals_pct >= 100.0 and calls_pct >= 100.0):
            return 'ACHIEVED'
        elif score >= 70.0:
            return 'ON_TRACK'
        elif score >= 40.0:
            return 'IN_PROGRESS'
        return 'BEHIND'

    daily_status = determine_status(daily_score, daily_calls_pct, daily_leads_pct)
    monthly_status = determine_status(monthly_score, monthly_deals_pct, monthly_calls_pct)

    return {
        'target_id': target.id if target else None,
        'user_id': user.id,
        'user_name': user.get_full_name() or user.email,
        'user_email': user.email,
        'user_role': user.role,
        'period_month': period_month,
        'is_active': target.is_active if target else True,
        'is_customized': target is not None,
        'notes': target.notes if target else '',
        'set_by_name': target.set_by.get_full_name() or target.set_by.email if (target and target.set_by) else None,
        'updated_at': target.updated_at if target else None,

        'daily': {
            'calls': {
                'target': daily_calls_tgt,
                'actual': calls_completed_today,
                'percentage': daily_calls_pct,
                'remaining': max(0, daily_calls_tgt - calls_completed_today),
                'achieved': calls_completed_today >= daily_calls_tgt,
            },
            'leads': {
                'target': daily_leads_tgt,
                'actual': leads_handled_today,
                'percentage': daily_leads_pct,
                'remaining': max(0, daily_leads_tgt - leads_handled_today),
                'achieved': leads_handled_today >= daily_leads_tgt,
            },
            'revenue': {
                'target': float(daily_rev_tgt),
                'actual': float(revenue_won_today),
                'percentage': daily_rev_pct,
                'remaining': max(0.0, float(daily_rev_tgt) - float(revenue_won_today)),
                'achieved': revenue_won_today >= daily_rev_tgt if daily_rev_tgt > 0 else True,
            },
            'overall_score': daily_score,
            'status': daily_status,
        },

        'monthly': {
            'calls': {
                'target': monthly_calls_tgt,
                'actual': calls_completed_month,
                'percentage': monthly_calls_pct,
                'remaining': max(0, monthly_calls_tgt - calls_completed_month),
                'achieved': calls_completed_month >= monthly_calls_tgt,
            },
            'leads': {
                'target': monthly_leads_tgt,
                'actual': leads_handled_month,
                'percentage': monthly_leads_pct,
                'remaining': max(0, monthly_leads_tgt - leads_handled_month),
                'achieved': leads_handled_month >= monthly_leads_tgt,
            },
            'deals_won': {
                'target': monthly_deals_tgt,
                'actual': deals_won_month,
                'percentage': monthly_deals_pct,
                'remaining': max(0, monthly_deals_tgt - deals_won_month),
                'achieved': deals_won_month >= monthly_deals_tgt,
            },
            'revenue': {
                'target': float(monthly_rev_tgt),
                'actual': float(revenue_won_month),
                'percentage': monthly_rev_pct,
                'remaining': max(0.0, float(monthly_rev_tgt) - float(revenue_won_month)),
                'achieved': revenue_won_month >= monthly_rev_tgt,
            },
            'overall_score': monthly_score,
            'status': monthly_status,
        },
    }


def get_team_target_overview(period_month=None):
    """
    Calculates aggregated team targets and leaderboard for Admin / Sales Manager.
    """
    from accounts.models import User, StaffTarget

    if not period_month:
        period_month = get_current_period_month()

    # Get active sales staff members (Executives & Managers)
    staff_qs = User.objects.filter(
        is_active=True
    ).exclude(
        is_superuser=True, role='ADMIN'
    ).order_by('first_name', 'last_name')

    # If no non-admin staff found, include all active users
    if not staff_qs.exists():
        staff_qs = User.objects.filter(is_active=True).order_by('first_name', 'last_name')

    staff_reports = []
    team_daily_calls_tgt = 0
    team_daily_calls_act = 0
    team_daily_leads_tgt = 0
    team_daily_leads_act = 0
    team_monthly_rev_tgt = Decimal('0.00')
    team_monthly_rev_act = Decimal('0.00')
    team_monthly_deals_tgt = 0
    team_monthly_deals_act = 0

    for member in staff_qs:
        target = StaffTarget.objects.filter(user=member, period_month=period_month).first()
        if not target:
            target = StaffTarget.objects.filter(user=member).order_by('-period_month').first()

        data = calculate_staff_progress(member, target=target)
        staff_reports.append(data)

        # Team aggregates
        team_daily_calls_tgt += data['daily']['calls']['target']
        team_daily_calls_act += data['daily']['calls']['actual']
        team_daily_leads_tgt += data['daily']['leads']['target']
        team_daily_leads_act += data['daily']['leads']['actual']
        team_monthly_rev_tgt += Decimal(str(data['monthly']['revenue']['target']))
        team_monthly_rev_act += Decimal(str(data['monthly']['revenue']['actual']))
        team_monthly_deals_tgt += data['monthly']['deals_won']['target']
        team_monthly_deals_act += data['monthly']['deals_won']['actual']

    # Sort leaderboard by monthly score descending
    leaderboard = sorted(staff_reports, key=lambda x: x['monthly']['overall_score'], reverse=True)

    team_rev_pct = round(
        float(team_monthly_rev_act) / float(team_monthly_rev_tgt) * 100.0, 1
    ) if team_monthly_rev_tgt > 0 else 0.0

    team_deals_pct = round(
        team_monthly_deals_act / team_monthly_deals_tgt * 100.0, 1
    ) if team_monthly_deals_tgt > 0 else 0.0

    return {
        'period_month': period_month,
        'total_staff_count': len(staff_reports),
        'team_aggregates': {
            'daily_calls': {
                'target': team_daily_calls_tgt,
                'actual': team_daily_calls_act,
                'percentage': round(team_daily_calls_act / team_daily_calls_tgt * 100.0, 1) if team_daily_calls_tgt > 0 else 0.0,
            },
            'daily_leads': {
                'target': team_daily_leads_tgt,
                'actual': team_daily_leads_act,
                'percentage': round(team_daily_leads_act / team_daily_leads_tgt * 100.0, 1) if team_daily_leads_tgt > 0 else 0.0,
            },
            'monthly_deals': {
                'target': team_monthly_deals_tgt,
                'actual': team_monthly_deals_act,
                'percentage': team_deals_pct,
            },
            'monthly_revenue': {
                'target': float(team_monthly_rev_tgt),
                'actual': float(team_monthly_rev_act),
                'percentage': team_rev_pct,
            },
        },
        'leaderboard': leaderboard,
        'presets': TARGET_PRESETS,
    }
