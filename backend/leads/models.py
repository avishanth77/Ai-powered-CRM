from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal

class LeadSource(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Lead Source'
        verbose_name_plural = 'Lead Sources'

    def __str__(self):
        return self.name


class LeadStage(models.Model):
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True)
    description = models.TextField(blank=True, null=True)
    color = models.CharField(max_length=30, default='#6366F1')
    display_order = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    is_system = models.BooleanField(default=False)
    require_manager_approval = models.BooleanField(default=False, help_text='Require manager approval before a lead can advance beyond this stage.')
    win_probability = models.PositiveIntegerField(
        default=10,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Win probability percentage for leads in this stage (0-100%).'
    )
    win_probability_reason = models.TextField(
        blank=True,
        default='',
        help_text='Rationale or milestone justification for this stage win probability.'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'id']
        verbose_name = 'Lead Stage'
        verbose_name_plural = 'Lead Stages'

    def __str__(self):
        return self.name


def get_default_stage():
    stage = LeadStage.objects.filter(is_system=True, slug='new').first() or LeadStage.objects.order_by('display_order').first()
    return stage.id if stage else None


class Lead(models.Model):
    class Status:
        NEW = 'New'
        CONTACTED = 'Contacted'
        DEMO_SCHEDULED = 'Demo Scheduled'
        NEGOTIATION = 'Negotiation'
        QUALIFIED = 'Qualified'
        WON = 'Won'
        LOST = 'Lost'
        choices = [
            ('NEW', 'New'),
            ('CONTACTED', 'Contacted'),
            ('DEMO_SCHEDULED', 'Demo Scheduled'),
            ('NEGOTIATION', 'Negotiation'),
            ('QUALIFIED', 'Qualified'),
            ('WON', 'Won'),
            ('LOST', 'Lost'),
        ]

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    class ICPStatus(models.TextChoices):
        NOT_TESTED = 'NOT_TESTED', 'Not Tested'
        POOR_FIT = 'POOR_FIT', 'Poor Fit'
        POTENTIAL_FIT = 'POTENTIAL_FIT', 'Potential Fit'
        GOOD_FIT = 'GOOD_FIT', 'Good Fit'
        STRONG_ICP_FIT = 'STRONG_ICP_FIT', 'Strong ICP Fit'

    class PLDStatus(models.TextChoices):
        NOT_ASSESSED = 'NOT_ASSESSED', 'Not Assessed'
        UNQUALIFIED = 'UNQUALIFIED', 'Unqualified'
        QUALIFIED_PLD = 'QUALIFIED_PLD', 'Qualified PLD'

    class LeadType(models.TextChoices):
        INBOUND = 'INBOUND', 'Inbound'
        OUTBOUND = 'OUTBOUND', 'Outbound'
        REFERRAL = 'REFERRAL', 'Referral'
        PARTNER = 'PARTNER', 'Partner'
        EVENT = 'EVENT', 'Event / Trade Show'
        EXISTING_CUSTOMER = 'EXISTING_CUSTOMER', 'Existing Customer'
        OTHER = 'OTHER', 'Other'

    class BuyingRole(models.TextChoices):
        DECISION_MAKER = 'DECISION_MAKER', 'Decision Maker'
        INFLUENCER = 'INFLUENCER', 'Influencer'
        BUDGET_HOLDER = 'BUDGET_HOLDER', 'Budget Holder'
        CHAMPION = 'CHAMPION', 'Champion'
        END_USER = 'END_USER', 'End User'
        GATEKEEPER = 'GATEKEEPER', 'Gatekeeper'
        OTHER = 'OTHER', 'Other'

    class CompanySize(models.TextChoices):
        SIZE_1_10 = '1-10', '1-10 employees'
        SIZE_11_50 = '11-50', '11-50 employees'
        SIZE_51_200 = '51-200', '51-200 employees'
        SIZE_201_500 = '201-500', '201-500 employees'
        SIZE_501_1000 = '501-1000', '501-1000 employees'
        SIZE_1000_PLUS = '1000+', '1000+ employees'

    class BuyingIntent(models.TextChoices):
        HIGH = 'HIGH', 'High'
        MEDIUM = 'MEDIUM', 'Medium'
        LOW = 'LOW', 'Low'

    class PurchasingTimeline(models.TextChoices):
        IMMEDIATE = 'IMMEDIATE', 'Immediate (< 1 month)'
        M_1_3 = '1_3_MONTHS', '1 - 3 months'
        M_3_6 = '3_6_MONTHS', '3 - 6 months'
        M_6_12 = '6_12_MONTHS', '6 - 12 months'
        NO_TIMELINE = 'NO_TIMELINE', 'No immediate plan'

    name = models.CharField(max_length=150, blank=True, default='Prospect Lead')
    phone = models.CharField(max_length=25, blank=True, default='', db_index=True)
    email = models.EmailField(blank=True, null=True, db_index=True)
    company_name = models.CharField(max_length=150, blank=True, null=True, db_index=True)
    source = models.ForeignKey(
        LeadSource,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='leads'
    )
    stage = models.ForeignKey(
        LeadStage,
        on_delete=models.PROTECT,
        related_name='leads',
        db_index=True
    )
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
        db_index=True
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_leads',
        db_index=True
    )
    expected_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    address = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_leads'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    converted_at = models.DateTimeField(null=True, blank=True)
    lost_reason = models.TextField(blank=True, null=True)
    icp_status = models.CharField(
        max_length=20,
        choices=ICPStatus.choices,
        default=ICPStatus.NOT_TESTED,
        db_index=True
    )
    pld_score = models.PositiveIntegerField(
        default=0,
        help_text='Points earned by the most recent PLD assessment.',
    )
    pld_status = models.CharField(
        max_length=20,
        choices=PLDStatus.choices,
        default=PLDStatus.NOT_ASSESSED,
        db_index=True
    )
    win_probability_override = models.PositiveIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text='Custom win probability override (0-100%). If empty, defaults to stage win probability.'
    )
    win_probability_reason = models.TextField(
        blank=True,
        default='',
        help_text='Reason for deal win probability or override justification.'
    )

    # --- HubSpot Extended Fields ---
    # Contact Information
    first_name = models.CharField(max_length=80, blank=True, default='')
    last_name = models.CharField(max_length=80, blank=True, default='')
    mobile_phone = models.CharField(max_length=25, blank=True, default='')
    job_title = models.CharField(max_length=100, blank=True, default='')
    department = models.CharField(max_length=100, blank=True, default='')
    linkedin_url = models.URLField(blank=True, null=True)
    buying_role = models.CharField(
        max_length=50,
        choices=BuyingRole.choices,
        blank=True,
        default=''
    )

    # Company Information
    website = models.URLField(blank=True, null=True)
    industry = models.CharField(max_length=100, blank=True, default='')
    company_size = models.CharField(
        max_length=50,
        choices=CompanySize.choices,
        blank=True,
        default=''
    )
    annual_revenue = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    country = models.CharField(max_length=100, blank=True, default='')
    state = models.CharField(max_length=100, blank=True, default='')
    city = models.CharField(max_length=100, blank=True, default='')

    # Lead Qualification
    lead_score = models.IntegerField(default=0)
    buying_intent = models.CharField(
        max_length=20,
        choices=BuyingIntent.choices,
        default=BuyingIntent.MEDIUM,
        blank=True
    )
    estimated_budget = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0.00'))]
    )
    customer_requirements = models.TextField(blank=True, default='')
    purchasing_timeline = models.CharField(
        max_length=50,
        choices=PurchasingTimeline.choices,
        blank=True,
        default=''
    )
    decision_maker = models.CharField(max_length=150, blank=True, default='')
    competitor_info = models.TextField(blank=True, default='')
    qualification_notes = models.TextField(blank=True, default='')

    # Sales Information
    lead_type = models.CharField(
        max_length=50,
        choices=LeadType.choices,
        default=LeadType.INBOUND,
        blank=True
    )
    previous_stage = models.ForeignKey(
        'LeadStage',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='exited_leads'
    )
    stage_entered_at = models.DateTimeField(null=True, blank=True)
    expected_close_date = models.DateField(null=True, blank=True)
    next_followup_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['phone']),
            models.Index(fields=['email']),
            models.Index(fields=['stage']),
            models.Index(fields=['assigned_to']),
            models.Index(fields=['created_at']),
        ]

    @property
    def status(self):
        return self.stage.name if self.stage else ''

    @status.setter
    def status(self, value):
        if isinstance(value, LeadStage):
            self.stage = value
        elif isinstance(value, str):
            val = value.strip()
            stage = LeadStage.objects.filter(
                models.Q(slug__iexact=val.lower().replace('_', '-')) |
                models.Q(slug__iexact=val) |
                models.Q(name__iexact=val)
            ).first()
            if stage:
                self.stage = stage

    @property
    def effective_win_probability(self):
        if self.stage and (self.stage.slug == 'lost' or self.stage.name.lower() == 'lost'):
            return 0
        if self.win_probability_override is not None:
            return self.win_probability_override
        if self.stage and hasattr(self.stage, 'win_probability'):
            return self.stage.win_probability
        return 0

    @property
    def effective_win_probability_reason(self):
        if self.stage and (self.stage.slug == 'lost' or self.stage.name.lower() == 'lost'):
            return self.lost_reason or self.win_probability_reason or "Deal marked as lost"
        if self.win_probability_reason:
            return self.win_probability_reason
        if self.stage and hasattr(self.stage, 'win_probability_reason'):
            return self.stage.win_probability_reason
        return ''

    @property
    def weighted_value(self):
        val = self.expected_value or Decimal('0.00')
        prob = Decimal(self.effective_win_probability)
        return (val * prob / Decimal('100.00')).quantize(Decimal('0.01'))

    def get_stage_task_summary(self, stage=None):
        target_stage = stage or self.stage
        if not target_stage or not getattr(self, 'pk', None):
            return {
                'total': 0,
                'completed': 0,
                'mandatory_total': 0,
                'mandatory_completed': 0,
                'mandatory_pending': 0,
                'percent': 100,
                'status': 'STAGE_COMPLETED',
                'status_label': 'Stage Completed',
                'can_progress': True,
            }
        tasks = list(self.stage_tasks.filter(stage=target_stage))
        total = len(tasks)
        if total == 0:
            return {
                'total': 0,
                'completed': 0,
                'mandatory_total': 0,
                'mandatory_completed': 0,
                'mandatory_pending': 0,
                'percent': 100,
                'status': 'STAGE_COMPLETED',
                'status_label': 'Stage Completed',
                'can_progress': True,
            }

        completed = sum(1 for t in tasks if t.status == 'COMPLETED')
        mandatory_tasks = [t for t in tasks if t.is_mandatory]
        mandatory_total = len(mandatory_tasks)
        mandatory_completed = sum(1 for t in mandatory_tasks if t.status == 'COMPLETED')
        mandatory_pending = mandatory_total - mandatory_completed
        percent = int(round((completed / total) * 100)) if total > 0 else 100

        if mandatory_total > 0 and mandatory_pending > 0:
            has_progress = any(t.status in ('IN_PROGRESS', 'COMPLETED') for t in tasks)
            status_code = 'TASKS_IN_PROGRESS' if has_progress else 'TASKS_PENDING'
            status_label = 'Tasks In Progress' if has_progress else 'Tasks Pending'
            can_progress = False
        else:
            status_code = 'READY_FOR_NEXT_STAGE' if completed < total else 'STAGE_COMPLETED'
            status_label = 'Ready for Next Stage' if completed < total else 'Stage Completed'
            can_progress = True

        return {
            'total': total,
            'completed': completed,
            'mandatory_total': mandatory_total,
            'mandatory_completed': mandatory_completed,
            'mandatory_pending': mandatory_pending,
            'percent': percent,
            'status': status_code,
            'status_label': status_label,
            'can_progress': can_progress,
        }

    def save(self, *args, **kwargs):
        from django.utils import timezone
        if not self.stage_id:
            default_stage = LeadStage.objects.filter(is_system=True, slug='new').first() or LeadStage.objects.order_by('display_order').first()
            if default_stage:
                self.stage = default_stage

        # Stage change tracking
        if self.pk:
            orig = Lead.objects.filter(pk=self.pk).only('stage_id').first()
            if orig and orig.stage_id != self.stage_id:
                self.previous_stage_id = orig.stage_id
                self.stage_entered_at = timezone.now()
        elif not self.stage_entered_at:
            self.stage_entered_at = timezone.now()

        # Synchronize first_name/last_name with name
        if (self.first_name or self.last_name) and (not self.name or self.name == 'Prospect Lead'):
            self.name = f"{self.first_name} {self.last_name}".strip()
        elif self.name and self.name != 'Prospect Lead' and not self.first_name and not self.last_name:
            parts = self.name.strip().split(' ', 1)
            self.first_name = parts[0]
            if len(parts) > 1:
                self.last_name = parts[1]

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.company_name or 'No Company'}) - {self.status}"


class LeadNote(models.Model):
    class NoteType(models.TextChoices):
        CALL = 'CALL', 'Phone Call'
        WHATSAPP = 'WHATSAPP', 'WhatsApp'
        EMAIL = 'EMAIL', 'Email'
        MEETING = 'MEETING', 'Meeting'
        DEMO = 'DEMO', 'Demo'
        OBJECTION = 'OBJECTION', 'Objection'
        GENERAL = 'GENERAL', 'General'

    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name='notes'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='lead_notes'
    )
    note_type = models.CharField(
        max_length=20,
        choices=NoteType.choices,
        default=NoteType.GENERAL
    )
    note_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.note_type} on Lead #{self.lead_id} by {self.user}"


class LeadHandover(models.Model):
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name='handovers'
    )
    previous_assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='handovers_from'
    )
    new_assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='handovers_to'
    )
    reason = models.TextField()
    handed_over_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='handovers_performed'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Lead Handover'
        verbose_name_plural = 'Lead Handovers'

    def __str__(self):
        prev = self.previous_assignee.get_full_name() if self.previous_assignee else 'Unassigned'
        new = self.new_assignee.get_full_name() if self.new_assignee else 'None'
        return f"Handover for Lead #{self.lead_id}: {prev} -> {new}"


class InternalComment(models.Model):
    """
    Internal discussion system for team members on leads.
    Completely separated from customer communication notes (LeadNote).
    Supports threaded replies, editing, soft-deletion, and mentions.
    """
    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name='internal_comments'
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='internal_comments'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='replies'
    )
    content = models.TextField()
    is_edited = models.BooleanField(default=False)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Internal Comment'
        verbose_name_plural = 'Internal Comments'

    def __str__(self):
        return f"Comment #{self.id} on Lead #{self.lead_id} by {self.author}"


class CommentMention(models.Model):
    """
    Tracks internal @mentions within comments for active team members.
    """
    comment = models.ForeignKey(
        InternalComment,
        on_delete=models.CASCADE,
        related_name='mentions'
    )
    mentioned_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='comment_mentions'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('comment', 'mentioned_user')
        verbose_name = 'Comment Mention'
        verbose_name_plural = 'Comment Mentions'

    def __str__(self):
        return f"Mention of {self.mentioned_user} in Comment #{self.comment_id}"



class StageTaskRule(models.Model):
    """
    Automated task assignment rule triggered when a lead transitions to a specific stage.
    Completely customizable: trigger stage, task purpose, custom title & template notes,
    assignment strategy (Lead Owner, Specific User, Round Robin, Stage Mover, Lead Creator),
    dynamic due date offset (minutes, hours, days, weeks), and lead priority filtering.
    """
    class AssigneeStrategy(models.TextChoices):
        LEAD_OWNER = 'LEAD_OWNER', 'Lead Owner / Assigned Rep'
        SPECIFIC_USER = 'SPECIFIC_USER', 'Specific User'
        ROUND_ROBIN = 'ROUND_ROBIN', 'Round Robin'
        STAGE_MOVER = 'STAGE_MOVER', 'User Moving Stage'
        LEAD_CREATOR = 'LEAD_CREATOR', 'Lead Creator'

    class OffsetUnit(models.TextChoices):
        MINUTES = 'MINUTES', 'Minutes'
        HOURS = 'HOURS', 'Hours'
        DAYS = 'DAYS', 'Days'
        WEEKS = 'WEEKS', 'Weeks'

    TASK_PURPOSES = [
        ('Phone Call', 'Phone Call'),
        ('WhatsApp', 'WhatsApp'),
        ('Meeting', 'Meeting'),
        ('Demo', 'Demo'),
        ('Email', 'Email'),
        ('Proposal', 'Proposal'),
        ('Payment Follow-up', 'Payment Follow-up'),
        ('Other', 'Other'),
    ]

    stage = models.ForeignKey(
        LeadStage,
        on_delete=models.CASCADE,
        related_name='task_rules',
        help_text='Pipeline stage that triggers this task automation.'
    )
    name = models.CharField(
        max_length=150,
        help_text='Descriptive name for the automated task rule.'
    )
    purpose = models.CharField(
        max_length=50,
        choices=TASK_PURPOSES,
        default='Phone Call',
        help_text='Follow-up task purpose/type.'
    )
    title = models.CharField(
        max_length=200,
        blank=True,
        default='',
        help_text='Task summary or headline.'
    )
    description_template = models.TextField(
        blank=True,
        default='',
        help_text='Template for task instructions/notes. Placeholders: {lead_name}, {company_name}, {phone}, {email}, {stage_name}, {priority}, {assigned_to}.'
    )
    assignee_strategy = models.CharField(
        max_length=30,
        choices=AssigneeStrategy.choices,
        default=AssigneeStrategy.LEAD_OWNER,
        help_text='How the task assignee is determined.'
    )
    specific_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='specific_stage_task_rules',
        help_text='Target user when strategy is Specific User.'
    )
    fallback_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text='Fallback assignee when lead owner is unset or strategy yields no assignee.'
    )
    round_robin_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='round_robin_stage_task_rules',
        help_text='Pool of users to rotate assignments among when strategy is Round Robin.'
    )
    last_round_robin_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+',
        help_text='Last user selected in round-robin sequence.'
    )
    due_offset_value = models.PositiveIntegerField(
        default=1,
        help_text='Number of units after stage transition when task is due.'
    )
    due_offset_unit = models.CharField(
        max_length=20,
        choices=OffsetUnit.choices,
        default=OffsetUnit.DAYS,
        help_text='Offset unit (Minutes, Hours, Days, Weeks).'
    )
    priority_filter = models.CharField(
        max_length=20,
        default='ALL',
        help_text='Condition: Trigger only for leads with matching priority, or ALL.'
    )
    is_mandatory = models.BooleanField(
        default=True,
        help_text='If true, this task must be completed before the lead can advance to the next stage.'
    )
    order = models.PositiveIntegerField(
        default=1,
        help_text='Display and execution order in the stage sequence.'
    )
    dependency = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dependent_rules',
        help_text='Prerequisite rule in this stage that must be completed first.'
    )
    task_priority = models.CharField(
        max_length=20,
        choices=Lead.Priority.choices,
        default=Lead.Priority.MEDIUM,
        help_text='Priority assigned to the instantiated task.'
    )
    requires_approval = models.BooleanField(
        default=False,
        help_text='If true, completing this task requires manager sign-off.'
    )
    prevent_duplicate = models.BooleanField(
        default=True,
        help_text='Prevent creating duplicate task if a pending task of same purpose exists for this lead.'
    )
    is_active = models.BooleanField(
        default=True,
        help_text='Enable or disable this automation rule.'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_stage_task_rules'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['stage', 'id']
        verbose_name = 'Stage Task Automation Rule'
        verbose_name_plural = 'Stage Task Automation Rules'

    def __str__(self):
        return f"Rule: {self.name} [{self.stage.name} -> {self.purpose}]"


class LeadStageTask(models.Model):
    """
    An instantiated task assigned to a lead for a specific pipeline stage.
    Controls lead progression: leads cannot advance to the next stage
    until all mandatory stage tasks are completed.
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    lead = models.ForeignKey(
        Lead,
        on_delete=models.CASCADE,
        related_name='stage_tasks',
        help_text='The lead this task belongs to.'
    )
    stage = models.ForeignKey(
        LeadStage,
        on_delete=models.CASCADE,
        related_name='lead_stage_tasks',
        help_text='The pipeline stage this task must be performed in.'
    )
    rule = models.ForeignKey(
        StageTaskRule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='instantiated_tasks',
        help_text='The automated rule that spawned this task, if any.'
    )
    follow_up = models.ForeignKey(
        'followups.FollowUp',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='stage_task_links',
        help_text='Corresponding FollowUp record for calendar and notifications.'
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    purpose = models.CharField(max_length=50, default='Other')
    priority = models.CharField(
        max_length=20,
        choices=Lead.Priority.choices,
        default=Lead.Priority.MEDIUM
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_stage_tasks'
    )
    due_date = models.DateTimeField(db_index=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True
    )
    is_mandatory = models.BooleanField(
        default=True,
        help_text='If true, this task must be completed before the lead can advance.'
    )
    order = models.PositiveIntegerField(default=1)
    dependency = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='dependents',
        help_text='Prerequisite task on this lead that should be completed first.'
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_stage_tasks'
    )
    outcome_notes = models.TextField(blank=True, default='')
    requires_approval = models.BooleanField(default=False)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_stage_tasks'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['stage__display_order', 'order', 'due_date', 'id']
        indexes = [
            models.Index(fields=['lead', 'stage', 'status']),
            models.Index(fields=['assigned_to', 'status']),
            models.Index(fields=['due_date']),
        ]
        verbose_name = 'Lead Stage Task'
        verbose_name_plural = 'Lead Stage Tasks'

    def __str__(self):
        return f"[{self.stage.name}] {self.title} ({self.status}) for Lead #{self.lead_id}"

    @property
    def is_overdue(self):
        from django.utils import timezone
        return self.status in [self.Status.PENDING, self.Status.IN_PROGRESS] and self.due_date < timezone.now()

    @property
    def is_blocked_by_dependency(self):
        if not self.dependency_id:
            return False
        return self.dependency.status != self.Status.COMPLETED


class CustomPropertyDefinition(models.Model):
    """
    Dynamic property configuration enabling managers to define custom lead fields
    with rich validation, custom sections, ordering, and field types.
    """
    class FieldType(models.TextChoices):
        TEXT = 'text', 'Single-line Text'
        NUMBER = 'number', 'Number'
        EMAIL = 'email', 'Email Address'
        PHONE = 'phone', 'Phone Number'
        URL = 'url', 'URL / Website'
        DATE = 'date', 'Date'
        DROPDOWN = 'dropdown', 'Dropdown Select'
        MULTI_SELECT = 'multi_select', 'Multi-Select'
        CHECKBOX = 'checkbox', 'Checkbox (Boolean)'
        CURRENCY = 'currency', 'Currency'
        TEXTAREA = 'textarea', 'Multi-line Textarea'

    class Section(models.TextChoices):
        CONTACT = 'contact', 'Contact Information'
        COMPANY = 'company', 'Company Information'
        QUALIFICATION = 'qualification', 'Lead Qualification'
        SALES = 'sales', 'Sales Information'
        CUSTOM = 'custom', 'Custom Properties'

    name = models.SlugField(max_length=60, unique=True, help_text='Machine-safe key (e.g. region_tier)')
    label = models.CharField(max_length=100, help_text='User-facing label')
    field_type = models.CharField(max_length=30, choices=FieldType.choices, default=FieldType.TEXT)
    section = models.CharField(max_length=30, choices=Section.choices, default=Section.CUSTOM)
    options = models.JSONField(blank=True, default=list, help_text='Dropdown / multi-select options list')
    is_mandatory = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=1)
    placeholder = models.CharField(max_length=150, blank=True, default='')
    help_text = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['section', 'display_order', 'id']
        verbose_name = 'Custom Property Definition'
        verbose_name_plural = 'Custom Property Definitions'

    def __str__(self):
        return f"{self.label} ({self.name}) [{self.field_type}]"


class CustomPropertyValue(models.Model):
    """
    Stores lead-specific values for defined custom properties.
    Supports both scalar text representation and structured JSON data.
    """
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='custom_property_values')
    property_def = models.ForeignKey(CustomPropertyDefinition, on_delete=models.CASCADE, related_name='values')
    value_text = models.TextField(blank=True, default='')
    value_json = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('lead', 'property_def')
        indexes = [
            models.Index(fields=['lead', 'property_def']),
        ]
        verbose_name = 'Custom Property Value'
        verbose_name_plural = 'Custom Property Values'

    def __str__(self):
        return f"{self.property_def.label} for Lead #{self.lead_id}"

