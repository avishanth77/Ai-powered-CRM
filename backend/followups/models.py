from django.db import models
from django.conf import settings
from django.utils import timezone

class FollowUp(models.Model):
    class Purpose(models.TextChoices):
        PHONE_CALL = 'Phone Call', 'Phone Call'
        WHATSAPP = 'WhatsApp', 'WhatsApp'
        MEETING = 'Meeting', 'Meeting'
        DEMO = 'Demo', 'Demo'
        EMAIL = 'Email', 'Email'
        PROPOSAL = 'Proposal', 'Proposal'
        PAYMENT = 'Payment Follow-up', 'Payment Follow-up'
        OTHER = 'Other', 'Other'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        OVERDUE = 'OVERDUE', 'Overdue'

    lead = models.ForeignKey(
        'leads.Lead',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='follow_ups'
    )
    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='follow_ups'
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='follow_ups'
    )
    follow_up_at = models.DateTimeField(db_index=True)
    purpose = models.CharField(max_length=50, choices=Purpose.choices, default=Purpose.PHONE_CALL)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    notes = models.TextField(blank=True, null=True)
    outcome = models.TextField(blank=True, null=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-follow_up_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['follow_up_at']),
            models.Index(fields=['assigned_to']),
        ]

    def __str__(self):
        target = f"Lead #{self.lead_id}" if self.lead else f"Customer #{self.customer_id}"
        return f"{self.purpose} on {target} at {self.follow_up_at:%Y-%m-%d %H:%M} ({self.status})"

    def check_and_update_overdue(self):
        if self.status == self.Status.PENDING and self.follow_up_at < timezone.now():
            self.status = self.Status.OVERDUE
            self.save(update_fields=['status'])
            return True
        return False
