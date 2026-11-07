from decimal import Decimal
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator


class Product(models.Model):
    """
    Catalog of products and services offered in the CRM.
    Supports pricing, categories, SKU identification, and billing cycles.
    """
    class BillingCycle(models.TextChoices):
        ONE_TIME = 'ONE_TIME', 'One-time'
        MONTHLY = 'MONTHLY', 'Monthly Recurring'
        ANNUAL = 'ANNUAL', 'Annual Recurring'

    name = models.CharField(max_length=200, db_index=True)
    code = models.CharField(
        max_length=50,
        unique=True,
        db_index=True,
        help_text="Product Code, SKU, or unique short identifier"
    )
    description = models.TextField(blank=True, default='')
    category = models.CharField(
        max_length=100,
        blank=True,
        default='Software',
        db_index=True
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Standard unit / base price"
    )
    currency = models.CharField(max_length=10, default='INR')
    billing_cycle = models.CharField(
        max_length=20,
        choices=BillingCycle.choices,
        default=BillingCycle.ONE_TIME
    )
    is_active = models.BooleanField(
        default=True,
        db_index=True,
        help_text="Active products can be attached to deals"
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_products'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['is_active', 'category']),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class LeadProduct(models.Model):
    """
    Line item connecting a Lead to a Product.
    Enables multi-product opportunities with quantity, custom pricing, and discounts.
    """
    lead = models.ForeignKey(
        'leads.Lead',
        on_delete=models.CASCADE,
        related_name='lead_products'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name='product_leads'
    )
    quantity = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)]
    )
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal('0.00'))],
        help_text="Custom negotiated price per unit"
    )
    discount_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal('0.00'),
        validators=[MinValueValidator(Decimal('0.00')), MaxValueValidator(Decimal('100.00'))]
    )
    total_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    notes = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('lead', 'product')
        ordering = ['created_at']

    def calculate_total(self):
        unit = Decimal(self.unit_price if self.unit_price is not None else (self.product.unit_price or 0))
        qty = Decimal(self.quantity or 1)
        gross = unit * qty
        disc = gross * (Decimal(self.discount_percent or 0) / Decimal('100.00'))
        return (gross - disc).quantize(Decimal('0.01'))

    def save(self, *args, **kwargs):
        if self.unit_price is None and self.product_id:
            self.unit_price = self.product.unit_price
        self.total_price = self.calculate_total()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.lead.name} - {self.product.name} (x{self.quantity})"


class CustomerProduct(models.Model):
    """
    Line item connecting a converted Customer to their purchased Products.
    """
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        TRIAL = 'TRIAL', 'Trial'
        CANCELLED = 'CANCELLED', 'Cancelled'
        EXPIRED = 'EXPIRED', 'Expired'

    customer = models.ForeignKey(
        'customers.Customer',
        on_delete=models.CASCADE,
        related_name='customer_products'
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name='customer_purchases'
    )
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    total_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal('0.00')
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE
    )
    purchased_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-purchased_at']

    def __str__(self):
        return f"{self.customer.name} - {self.product.name}"

