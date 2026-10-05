from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
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

    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=25, db_index=True)
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

    def save(self, *args, **kwargs):
        if not self.stage_id:
            default_stage = LeadStage.objects.filter(is_system=True, slug='new').first() or LeadStage.objects.order_by('display_order').first()
            if default_stage:
                self.stage = default_stage
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

