from django.contrib import admin
from .models import FollowUp

@admin.register(FollowUp)
class FollowUpAdmin(admin.ModelAdmin):
    list_display = ('purpose', 'lead', 'customer', 'assigned_to', 'follow_up_at', 'status', 'completed_at')
    list_filter = ('status', 'purpose', 'follow_up_at', 'assigned_to')
    search_fields = ('purpose', 'outcome', 'lead__name', 'customer__name', 'assigned_to__email')
    readonly_fields = ('created_at', 'updated_at', 'completed_at')
    ordering = ('follow_up_at',)
