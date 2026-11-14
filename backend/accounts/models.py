from decimal import Decimal
from django.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.core.validators import MinValueValidator

class UserManager(BaseUserManager):
    """Custom user manager where email is the unique identifier for auth."""
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('The Email field must be set.')
        email = self.normalize_email(email)
        extra_fields.setdefault('username', email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', User.Role.ADMIN)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = 'ADMIN', 'Admin / Mentor'
        MANAGER = 'MANAGER', 'Sales Manager'
        EXECUTIVE = 'EXECUTIVE', 'Sales Executive / Intern'

    email = models.EmailField('email address', unique=True, db_index=True)
    phone = models.CharField(max_length=25, blank=True, null=True, db_index=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.EXECUTIVE, db_index=True)
    reset_otp = models.CharField(max_length=10, blank=True, null=True)
    reset_otp_expires_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['first_name', 'last_name']

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def save(self, *args, **kwargs):
        if not self.username:
            self.username = self.email
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.get_full_name() or self.email} ({self.role})"

    @property
    def is_admin_role(self):
        return self.role == self.Role.ADMIN or self.is_superuser

    @property
    def is_manager_role(self):
        return self.role == self.Role.MANAGER

    @property
    def is_executive_role(self):
        return self.role == self.Role.EXECUTIVE


class StaffTarget(models.Model):
    """
    Customizable sales targets for staff members / sales representatives,
    configured and managed by Admin or Sales Managers.
    Includes both Daily Targets (calls, leads, revenue) and
    Monthly Targets (calls, leads, deals won, revenue quota).
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='targets',
        help_text='Staff member / sales representative assigned to this target.'
    )
    period_month = models.CharField(
        max_length=7,
        db_index=True,
        help_text='Target month in YYYY-MM format (e.g. 2026-11).'
    )

    # --- Daily Targets ---
    daily_calls_target = models.PositiveIntegerField(
        default=10,
        validators=[MinValueValidator(0)],
        help_text='Daily completed calls/follow-ups target.'
    )
    daily_leads_target = models.PositiveIntegerField(
        default=3,
        validators=[MinValueValidator(0)],
        help_text='Daily new leads acquired / contacted target.'
    )
    daily_revenue_target = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Daily won/closed revenue target (in ₹).'
    )

    # --- Monthly Targets ---
    monthly_calls_target = models.PositiveIntegerField(
        default=200,
        validators=[MinValueValidator(0)],
        help_text='Monthly completed calls/follow-ups target.'
    )
    monthly_leads_target = models.PositiveIntegerField(
        default=50,
        validators=[MinValueValidator(0)],
        help_text='Monthly leads target.'
    )
    monthly_deals_won_target = models.PositiveIntegerField(
        default=5,
        validators=[MinValueValidator(0)],
        help_text='Monthly closed-won deals target.'
    )
    monthly_revenue_target = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('50000.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text='Monthly won sales revenue target (in ₹).'
    )

    notes = models.TextField(
        blank=True,
        default='',
        help_text='Admin guidance, expectations, or incentives for this staff member.'
    )
    is_active = models.BooleanField(
        default=True,
        help_text='Whether this target is currently active.'
    )
    set_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_targets',
        help_text='Admin who set or last customized this target.'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-period_month', '-updated_at']
        unique_together = ['user', 'period_month']
        verbose_name = 'Staff Target'
        verbose_name_plural = 'Staff Targets'

    def __str__(self):
        return f"Target for {self.user.email} ({self.period_month}): {self.daily_calls_target}/day calls, ₹{self.monthly_revenue_target}/mo"

