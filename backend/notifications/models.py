from django.db import models
from django.conf import settings
from django.utils import timezone


class Notification(models.Model):
    class NotificationType(models.TextChoices):
        LEAD_ASSIGNED = 'LEAD_ASSIGNED', 'Lead Assigned'
        LEAD_HANDED_OVER = 'LEAD_HANDED_OVER', 'Lead Handed Over'
        LEAD_STAGE_CHANGED = 'LEAD_STAGE_CHANGED', 'Lead Stage Changed'
        FOLLOW_UP_CREATED = 'FOLLOW_UP_CREATED', 'Follow-up Created'
        FOLLOW_UP_ASSIGNED = 'FOLLOW_UP_ASSIGNED', 'Follow-up Assigned'
        FOLLOW_UP_DUE_SOON = 'FOLLOW_UP_DUE_SOON', 'Follow-up Due Soon'
        FOLLOW_UP_OVERDUE = 'FOLLOW_UP_OVERDUE', 'Follow-up Overdue'
        FOLLOW_UP_COMPLETED = 'FOLLOW_UP_COMPLETED', 'Follow-up Completed'
        INTERNAL_MENTION = 'INTERNAL_MENTION', 'Internal Mention'
        INTERNAL_COMMENT = 'INTERNAL_COMMENT', 'Internal Team Comment'
        CUSTOMER_CONVERTED = 'CUSTOMER_CONVERTED', 'Customer Converted'
        LEAD_UPDATED = 'LEAD_UPDATED', 'Important Lead Update'
        DUPLICATE_WARNING = 'DUPLICATE_WARNING', 'Duplicate Lead Warning'
        SYSTEM = 'SYSTEM', 'System Notification'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        NORMAL = 'NORMAL', 'Normal'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        db_index=True
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='triggered_notifications'
    )
    notification_type = models.CharField(
        max_length=50,
        choices=NotificationType.choices,
        default=NotificationType.SYSTEM,
        db_index=True
    )
    title = models.CharField(max_length=255)
    message = models.TextField()
    entity_type = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    entity_id = models.CharField(max_length=64, blank=True, null=True, db_index=True)
    action_url = models.CharField(max_length=255, blank=True, null=True)
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.NORMAL,
        db_index=True
    )
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read']),
            models.Index(fields=['recipient', 'created_at']),
            models.Index(fields=['entity_type', 'entity_id']),
            models.Index(fields=['notification_type']),
        ]
        verbose_name = 'Notification'
        verbose_name_plural = 'Notifications'

    def __str__(self):
        return f"[{self.notification_type}] To: {self.recipient.email} - {self.title}"

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])
            return True
        return False
