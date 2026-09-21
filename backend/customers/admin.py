from django.contrib import admin
from .models import Customer

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('name', 'company_name', 'phone', 'email', 'converted_at', 'created_by')
    list_filter = ('converted_at',)
    search_fields = ('name', 'phone', 'email', 'company_name')
    readonly_fields = ('converted_at', 'created_at', 'updated_at')
    ordering = ('-converted_at',)
