import secrets
from datetime import timedelta
from django.db import models
from django.utils import timezone
from accounts.models import User


class TelegramProfile(models.Model):
    """
    Links a CRM User account to a Telegram Chat ID for two-way chat control and real-time push alerts.
    """
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='telegram_profile'
    )
    chat_id = models.BigIntegerField(
        unique=True,
        null=True,
        blank=True,
        db_index=True,
        help_text="Telegram private chat ID corresponding to this CRM user"
    )
    telegram_username = models.CharField(max_length=255, null=True, blank=True)
    first_name = models.CharField(max_length=255, blank=True)
    last_name = models.CharField(max_length=255, blank=True)

    # 6-digit connection PIN verification
    verification_code = models.CharField(max_length=6, blank=True, null=True, db_index=True)
    code_expires_at = models.DateTimeField(blank=True, null=True)
    is_verified = models.BooleanField(default=False)

    # Notification preferences
    notify_new_leads = models.BooleanField(
        default=True,
        help_text="Receive alerts when new leads are assigned or created via Web-to-Lead"
    )
    notify_followups = models.BooleanField(
        default=True,
        help_text="Receive reminders for scheduled or overdue follow-ups"
    )
    notify_stage_changes = models.BooleanField(
        default=True,
        help_text="Receive updates when assigned leads change pipeline stages"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Telegram Profile'
        verbose_name_plural = 'Telegram Profiles'
        ordering = ['-created_at']

    def __str__(self):
        status = "Verified" if self.is_verified else "Pending"
        handle = f"@{self.telegram_username}" if self.telegram_username else f"Chat: {self.chat_id}"
        return f"{self.user.email} -> {handle} ({status})"

    def generate_verification_code(self, expiry_minutes=15) -> str:
        """Generates a secure 6-digit one-time PIN for linking the Telegram account."""
        code = str(secrets.randbelow(900000) + 100000)  # Cryptographic 6-digit number
        self.verification_code = code
        self.code_expires_at = timezone.now() + timedelta(minutes=expiry_minutes)
        self.save(update_fields=['verification_code', 'code_expires_at'])
        return code

    def verify_code(self, code: str, chat_id: int, username: str = '', first_name: str = '', last_name: str = '') -> bool:
        """Validates incoming code against stored PIN and binds chat_id to this user."""
        if not self.verification_code or not self.code_expires_at:
            return False

        if timezone.now() > self.code_expires_at:
            return False

        if self.verification_code.strip() != code.strip():
            return False

        # If another profile was bound to this chat_id, unlink it first
        TelegramProfile.objects.filter(chat_id=chat_id).exclude(pk=self.pk).update(
            chat_id=None,
            is_verified=False,
            telegram_username=None
        )

        self.chat_id = chat_id
        self.telegram_username = username or self.telegram_username
        self.first_name = first_name
        self.last_name = last_name
        self.is_verified = True
        self.verification_code = None
        self.code_expires_at = None
        self.save()
        return True

    def unlink(self):
        """Unlinks the Telegram account from the CRM user."""
        self.chat_id = None
        self.telegram_username = None
        self.first_name = ''
        self.last_name = ''
        self.is_verified = False
        self.verification_code = None
        self.code_expires_at = None
        self.save()


class TelegramActionSession(models.Model):
    """
    Stores proposed mutating CRM actions (e.g. stage transition, reassignment)
    requiring interactive button confirmation in Telegram before execution.
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending Confirmation'
        EXECUTED = 'EXECUTED', 'Executed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        EXPIRED = 'EXPIRED', 'Expired'

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='telegram_actions')
    chat_id = models.BigIntegerField(db_index=True)
    action_type = models.CharField(max_length=64)
    action_description = models.CharField(max_length=255)
    action_payload = models.JSONField(default=dict)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def is_valid(self) -> bool:
        return self.status == self.Status.PENDING and timezone.now() <= self.expires_at

