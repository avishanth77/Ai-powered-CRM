from django.contrib import admin
from .models import ActivityLog

@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'action', 'entity_type', 'entity_id', 'performed_by')
    list_filter = ('action', 'entity_type', 'created_at')
    search_fields = ('action', 'entity_id', 'notes', 'performed_by__email')
    readonly_fields = ('created_at', 'entity_type', 'entity_id', 'action', 'old_value', 'new_value', 'performed_by', 'notes')
    ordering = ('-created_at',)
