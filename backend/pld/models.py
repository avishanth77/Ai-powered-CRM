from decimal import Decimal

from django.conf import settings
from django.db import models


class PLDSeverity(models.TextChoices):
    LOW = 'LOW', 'Low'
    MEDIUM = 'MEDIUM', 'Medium'
    HIGH = 'HIGH', 'High'
    CRITICAL = 'CRITICAL', 'Critical'


class PLDStatus(models.TextChoices):
    NOT_ASSESSED = 'NOT_ASSESSED', 'Not Assessed'
    UNQUALIFIED = 'UNQUALIFIED', 'Unqualified'
    QUALIFIED_PLD = 'QUALIFIED_PLD', 'Qualified PLD'


#: Ordering used when a stage gate asks for a minimum ICP fit level.
ICP_RANK = {
    'NOT_TESTED': 0,
    'POOR_FIT': 1,
    'POTENTIAL_FIT': 2,
    'GOOD_FIT': 3,
    'STRONG_ICP_FIT': 4,
}

#: ICP fit levels a gate may require. ``NOT_TESTED`` cannot be a requirement.
ICP_MIN_STATUS_CHOICES = [
    (ICPStatus, label)
    for ICPStatus, label in [
        ('POOR_FIT', 'Poor Fit'),
        ('POTENTIAL_FIT', 'Potential Fit'),
        ('GOOD_FIT', 'Good Fit'),
        ('STRONG_ICP_FIT', 'Strong ICP Fit'),
    ]
]


class PLDProblem(models.Model):
    """Admin-configured problem statement that contributes points to the PLD score."""

    stage = models.ForeignKey(
        'leads.LeadStage',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pld_problems',
        help_text='Stage this problem/question belongs to. Blank applies globally or when stage has no specific questions.',
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    points = models.PositiveIntegerField(
        default=10,
        help_text='Points awarded when this problem is selected for a lead.',
    )
    severity = models.CharField(
        max_length=12,
        choices=PLDSeverity.choices,
        default=PLDSeverity.MEDIUM,
        db_index=True,
    )
    is_active = models.BooleanField(default=True, db_index=True)
    display_order = models.PositiveIntegerField(default=1, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pld_problems_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'id']
        verbose_name = 'PLD Problem'
        verbose_name_plural = 'PLD Problems'

    def __str__(self):
        stage_label = f' [{self.stage.name}]' if self.stage else ''
        return f'{self.name}{stage_label} ({self.points} pts)'

    @property
    def max_points(self):
        return self.points

    def snapshot(self):
        """Immutable copy of the problem configuration captured at assessment time."""
        return {
            'id': self.id,
            'stage_id': self.stage_id,
            'stage_name': self.stage.name if self.stage else None,
            'name': self.name,
            'description': self.description or '',
            'points': self.points,
            'severity': self.severity,
            'display_order': self.display_order,
        }


class PLDScoringConfig(models.Model):
    """Singleton row (pk=1) holding the percentage threshold for a Qualified PLD result."""

    qualified_min_percentage = models.PositiveIntegerField(
        default=60,
        help_text='Minimum percentage of the active problem pool needed to qualify.',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'PLD Scoring Config'
        verbose_name_plural = 'PLD Scoring Config'

    def __str__(self):
        return 'PLD Scoring Config'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def as_dict(self):
        return {'qualified_min_percentage': self.qualified_min_percentage}


def get_scoring_config():
    """Return the singleton config, creating it with defaults on first use."""
    config, _ = PLDScoringConfig.objects.get_or_create(pk=1)
    return config


class PLDAssessment(models.Model):
    """One immutable PLD assessment. Never updated after creation."""

    lead = models.ForeignKey(
        'leads.Lead',
        on_delete=models.CASCADE,
        related_name='pld_assessments',
    )
    stage = models.ForeignKey(
        'leads.LeadStage',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pld_assessments',
        help_text='The pipeline stage this assessment was completed for.',
    )
    assessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='pld_assessments',
    )
    total_score = models.PositiveIntegerField(default=0)
    max_score = models.PositiveIntegerField(default=0)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    pld_status = models.CharField(
        max_length=20,
        choices=[(value, label) for value, label in PLDStatus.choices if value != PLDStatus.NOT_ASSESSED],
        db_index=True,
    )
    problems_snapshot = models.JSONField(default=list, blank=True)
    config_snapshot = models.JSONField(default=dict, blank=True)
    assessed_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-assessed_at', '-id']
        verbose_name = 'PLD Assessment'
        verbose_name_plural = 'PLD Assessments'

    def __str__(self):
        stage_label = f' [{self.stage.name}]' if self.stage else ''
        return f'{self.lead}{stage_label} - {self.total_score}/{self.max_score} ({self.get_pld_status_display()})'


class PLDAssessmentProblem(models.Model):
    """A single selected problem with the frozen name/points/severity at assessment time."""

    assessment = models.ForeignKey(
        PLDAssessment,
        on_delete=models.CASCADE,
        related_name='problems',
    )
    problem = models.ForeignKey(
        PLDProblem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assessment_problems',
        help_text='Kept for reference only. Snapshots guarantee historical results never change.',
    )
    problem_snapshot = models.JSONField(default=dict, blank=True)
    points_earned = models.PositiveIntegerField(default=0)
    display_order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['display_order', 'id']
        verbose_name = 'PLD Assessment Problem'
        verbose_name_plural = 'PLD Assessment Problems'

    def __str__(self):
        return f'{(self.problem_snapshot or {}).get("name", self.problem_id)} - {self.points_earned} pts'


class PLDStageGate(models.Model):
    """
    Configurable requirements a lead must satisfy before it may sit in a stage.

    One row per gated stage. Absence of a row means the stage is ungated.
    """

    stage = models.OneToOneField(
        'leads.LeadStage',
        on_delete=models.CASCADE,
        related_name='pld_gate',
    )
    require_icp_min_status = models.CharField(
        max_length=20,
        choices=ICP_MIN_STATUS_CHOICES,
        blank=True,
        default='',
        help_text='Leave blank to skip the ICP fit requirement.',
    )
    require_pld_qualified = models.BooleanField(
        default=False,
        help_text='Require the lead to hold the Qualified PLD status for this stage.',
    )
    require_problems_assessed = models.BooleanField(
        default=False,
        help_text='Require a completed PLD assessment for this stage.',
    )
    qualified_min_percentage = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Optional stage-specific percentage threshold. If blank, uses global scoring config.',
    )
    notes = models.CharField(max_length=300, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['stage__display_order', 'stage__id']
        verbose_name = 'PLD Stage Gate'
        verbose_name_plural = 'PLD Stage Gates'

    def __str__(self):
        return f'Gate: {self.stage.name}'

    @property
    def has_requirements(self):
        return bool(
            self.require_icp_min_status
            or self.require_pld_qualified
            or self.require_problems_assessed
        )
