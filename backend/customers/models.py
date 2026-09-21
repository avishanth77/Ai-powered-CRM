from django.db import models
from django.conf import settings
from django.utils import timezone

class Customer(models.Model):
    lead = models.OneToOneField(
        'leads.Lead',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='customer_profile'
    )
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=25, db_index=True)
    email = models.EmailField(blank=True, null=True, db_index=True)
    company_name = models.CharField(max_length=150, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    converted_at = models.DateTimeField(default=timezone.now)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_customers'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-converted_at']
        indexes = [
            models.Index(fields=['phone']),
            models.Index(fields=['email']),
            models.Index(fields=['converted_at']),
        ]

    def __str__(self):
        return f"{self.name} ({self.company_name or 'Individual'})"
