from django.db import models
from django.conf import settings

class ActivityLog(models.Model):
    class EntityType(models.TextChoices):
        LEAD = 'LEAD', 'Lead'
        CUSTOMER = 'CUSTOMER', 'Customer'
        FOLLOW_UP = 'FOLLOW_UP', 'Follow Up'
        USER = 'USER', 'User'

    class ActionType(models.TextChoices):
        LEAD_CREATED = 'LEAD_CREATED', 'Lead Created'
        LEAD_UPDATED = 'LEAD_UPDATED', 'Lead Updated'
        STATUS_CHANGED = 'STATUS_CHANGED', 'Status Changed'
        LEAD_ASSIGNED = 'LEAD_ASSIGNED', 'Lead Assigned'
        LEAD_REASSIGNED = 'LEAD_REASSIGNED', 'Lead Reassigned'
        FOLLOW_UP_CREATED = 'FOLLOW_UP_CREATED', 'Follow-up Created'
        FOLLOW_UP_UPDATED = 'FOLLOW_UP_UPDATED', 'Follow-up Updated'
        FOLLOW_UP_COMPLETED = 'FOLLOW_UP_COMPLETED', 'Follow-up Completed'
        FOLLOW_UP_CANCELLED = 'FOLLOW_UP_CANCELLED', 'Follow-up Cancelled'
        NOTE_ADDED = 'NOTE_ADDED', 'Note Added'
        LEAD_CONVERTED = 'LEAD_CONVERTED', 'Lead Converted to Customer'
        LEAD_MARKED_LOST = 'LEAD_MARKED_LOST', 'Lead Marked Lost'
        CUSTOMER_CREATED = 'CUSTOMER_CREATED', 'Customer Created'
        CUSTOMER_UPDATED = 'CUSTOMER_UPDATED', 'Customer Updated'

    entity_type = models.CharField(max_length=50, choices=EntityType.choices, db_index=True)
    entity_id = models.CharField(max_length=64, db_index=True)
    action = models.CharField(max_length=50, choices=ActionType.choices, db_index=True)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='activity_logs'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        actor = self.performed_by.email if self.performed_by else 'System'
        return f"[{self.created_at:%Y-%m-%d %H:%M}] {actor} - {self.action} on {self.entity_type} #{self.entity_id}"
