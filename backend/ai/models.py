from django.db import models
from django.conf import settings
from django.utils import timezone

class Call(models.Model):
    """
    Call record with attached audio, transcript, and AI-extracted deal intelligence.
    """
    class CallType(models.TextChoices):
        OUTBOUND = 'Outbound', 'Outbound'
        INBOUND = 'Inbound', 'Inbound'

    lead = models.ForeignKey(
        'leads.Lead',
        on_delete=models.CASCADE,
        related_name='calls',
        db_index=True
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='logged_calls',
        db_index=True
    )
    call_type = models.CharField(
        max_length=20,
        choices=CallType.choices,
        default=CallType.OUTBOUND
    )
    started_at = models.DateTimeField(default=timezone.now, db_index=True)
    duration_seconds = models.PositiveIntegerField(default=0)
    audio_file = models.FileField(
        upload_to='calls/audio/%Y/%m/',
        null=True,
        blank=True
    )
    transcript = models.TextField(blank=True, default='')
    ai_summary = models.TextField(blank=True, default='')
    key_points = models.JSONField(default=list, blank=True)
    customer_requirements = models.JSONField(default=list, blank=True)
    objections = models.JSONField(default=list, blank=True)
    customer_intent = models.CharField(max_length=100, blank=True, default='')
    next_action = models.TextField(blank=True, default='')
    follow_up_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-started_at', '-created_at']
        indexes = [
            models.Index(fields=['lead', '-started_at']),
            models.Index(fields=['created_by', '-started_at']),
        ]

    def __str__(self):
        lead_name = self.lead.name if self.lead else f"Lead #{self.lead_id}"
        return f"{self.call_type} Call with {lead_name} at {self.started_at:%Y-%m-%d %H:%M}"
