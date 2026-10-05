from decimal import Decimal

from django.conf import settings
from django.db import models


class ICPStatus(models.TextChoices):
    """Ideal Customer Profile fit levels. Shared with Lead.ICPStatus."""

    NOT_TESTED = 'NOT_TESTED', 'Not Tested'
    POOR_FIT = 'POOR_FIT', 'Poor Fit'
    POTENTIAL_FIT = 'POTENTIAL_FIT', 'Potential Fit'
    GOOD_FIT = 'GOOD_FIT', 'Good Fit'
    STRONG_ICP_FIT = 'STRONG_ICP_FIT', 'Strong ICP Fit'


class QuestionType(models.TextChoices):
    SINGLE_CHOICE = 'SINGLE_CHOICE', 'Single Choice'
    MULTI_CHOICE = 'MULTI_CHOICE', 'Multiple Choice'
    YES_NO = 'YES_NO', 'Yes / No'
    NUMBER = 'NUMBER', 'Number'
    TEXT = 'TEXT', 'Text'
    DROPDOWN = 'DROPDOWN', 'Dropdown'


#: Question types that are scored through ``ICPQuestionOption`` rows.
CHOICE_BASED_TYPES = (
    QuestionType.SINGLE_CHOICE,
    QuestionType.MULTI_CHOICE,
    QuestionType.YES_NO,
    QuestionType.DROPDOWN,
)


class ICPQuestion(models.Model):
    question_text = models.CharField(max_length=300)
    description = models.TextField(blank=True, null=True, help_text='Optional help text shown under the question.')
    question_type = models.CharField(
        max_length=20,
        choices=QuestionType.choices,
        default=QuestionType.SINGLE_CHOICE,
        db_index=True,
    )
    is_required = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=1, db_index=True)
    max_points = models.PositiveIntegerField(
        default=0,
        help_text='Maximum points for this question. Auto-derived for choice and number questions, '
                  'configured manually for text questions.',
    )
    scoring_rules = models.JSONField(
        default=list,
        blank=True,
        help_text='Number questions only. Ordered list of {"min": number, "max": number, "points": number}. '
                  'The first matching range wins.',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='icp_questions_created',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['display_order', 'id']
        verbose_name = 'ICP Question'
        verbose_name_plural = 'ICP Questions'

    def __str__(self):
        return self.question_text

    @property
    def is_choice_based(self):
        return self.question_type in CHOICE_BASED_TYPES

    def options_snapshot(self):
        return [
            {'id': option.id, 'text': option.option_text, 'points': option.points}
            for option in self.options.all()
        ]

    def snapshot(self):
        """Immutable copy of the question configuration used at qualification time."""
        return {
            'id': self.id,
            'question_text': self.question_text,
            'description': self.description or '',
            'question_type': self.question_type,
            'is_required': self.is_required,
            'display_order': self.display_order,
            'max_points': self.max_points,
            'scoring_rules': self.scoring_rules or [],
            'options': self.options_snapshot(),
        }


class ICPQuestionOption(models.Model):
    question = models.ForeignKey(
        ICPQuestion,
        on_delete=models.CASCADE,
        related_name='options',
    )
    option_text = models.CharField(max_length=200)
    points = models.PositiveIntegerField(default=0)
    display_order = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['display_order', 'id']
        verbose_name = 'ICP Question Option'
        verbose_name_plural = 'ICP Question Options'

    def __str__(self):
        return f'{self.option_text} ({self.points} pts)'


class ICPScoringConfig(models.Model):
    """Singleton row (pk=1) holding the percentage thresholds used to classify a score."""

    poor_fit_max = models.PositiveIntegerField(default=39)
    potential_fit_max = models.PositiveIntegerField(default=59)
    good_fit_max = models.PositiveIntegerField(default=79)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'ICP Scoring Config'
        verbose_name_plural = 'ICP Scoring Config'

    def __str__(self):
        return 'ICP Scoring Config'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    def as_dict(self):
        return {
            'poor_fit_max': self.poor_fit_max,
            'potential_fit_max': self.potential_fit_max,
            'good_fit_max': self.good_fit_max,
        }


def get_scoring_config():
    """Return the singleton config, creating it with defaults on first use."""
    config, _ = ICPScoringConfig.objects.get_or_create(pk=1)
    return config


class ICPQualification(models.Model):
    """One immutable snapshot of an ICP test attempt. Never updated after creation."""

    lead = models.ForeignKey(
        'leads.Lead',
        on_delete=models.CASCADE,
        related_name='icp_qualifications',
    )
    qualified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='icp_qualifications',
    )
    total_score = models.PositiveIntegerField(default=0)
    max_score = models.PositiveIntegerField(default=0)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal('0.00'))
    icp_status = models.CharField(
        max_length=20,
        choices=[(value, label) for value, label in ICPStatus.choices if value != ICPStatus.NOT_TESTED],
        db_index=True,
    )
    thresholds_snapshot = models.JSONField(default=dict, blank=True)
    qualified_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-qualified_at', '-id']
        verbose_name = 'ICP Qualification'
        verbose_name_plural = 'ICP Qualifications'

    def __str__(self):
        return f'{self.lead} - {self.total_score}/{self.max_score} ({self.get_icp_status_display()})'


class ICPQualificationAnswer(models.Model):
    """A single answer with the question/answer/points snapshot frozen at qualification time."""

    qualification = models.ForeignKey(
        ICPQualification,
        on_delete=models.CASCADE,
        related_name='answers',
    )
    question = models.ForeignKey(
        ICPQuestion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='qualification_answers',
        help_text='Kept for reference only. Snapshots guarantee historical results never change.',
    )
    question_snapshot = models.JSONField(default=dict, blank=True)
    answer_value = models.TextField(blank=True, default='')
    selected_options = models.JSONField(
        default=list,
        blank=True,
        help_text='Choice questions only. Frozen list of {"id", "text", "points"}.',
    )
    points_earned = models.PositiveIntegerField(default=0)
    display_order = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ['display_order', 'id']
        verbose_name = 'ICP Qualification Answer'
        verbose_name_plural = 'ICP Qualification Answers'

    def __str__(self):
        return f'{self.question_id} - {self.points_earned} pts'