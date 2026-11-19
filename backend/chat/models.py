from django.db import models
from django.conf import settings
from django.utils import timezone


class ChatMessage(models.Model):
    """
    Internal one-on-one direct message between team members in the CRM.
    """
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_chat_messages',
        db_index=True
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_chat_messages',
        db_index=True
    )
    message = models.TextField(help_text='Message content')
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['sender', 'recipient', 'created_at']),
            models.Index(fields=['recipient', 'is_read']),
        ]

    def mark_as_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])

    def __str__(self):
        return f"{self.sender} -> {self.recipient}: {self.message[:30]}"
