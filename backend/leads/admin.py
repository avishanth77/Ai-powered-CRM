from django.contrib import admin
from .models import LeadSource, LeadStage, Lead, LeadNote, LeadHandover

class LeadNoteInline(admin.TabularInline):
    model = LeadNote
    extra = 0
    readonly_fields = ('user', 'created_at')

@admin.register(LeadSource)
class LeadSourceAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'description')

@admin.register(LeadStage)
class LeadStageAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'color', 'display_order', 'is_active', 'is_system', 'created_at')
    list_filter = ('is_active', 'is_system')
    search_fields = ('name', 'slug', 'description')
    ordering = ('display_order',)

@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ('name', 'company_name', 'phone', 'email', 'stage', 'priority', 'assigned_to', 'expected_value', 'created_at')
    list_filter = ('stage', 'priority', 'source', 'assigned_to')
    search_fields = ('name', 'phone', 'email', 'company_name')
    readonly_fields = ('created_at', 'updated_at', 'converted_at')
    inlines = [LeadNoteInline]
    ordering = ('-created_at',)

@admin.register(LeadHandover)
class LeadHandoverAdmin(admin.ModelAdmin):
    list_display = ('lead', 'previous_assignee', 'new_assignee', 'handed_over_by', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('lead__name', 'reason', 'previous_assignee__email', 'new_assignee__email')

@admin.register(LeadNote)
class LeadNoteAdmin(admin.ModelAdmin):
    list_display = ('lead', 'user', 'note_type', 'created_at')
    list_filter = ('note_type', 'created_at')
    search_fields = ('lead__name', 'note_text', 'user__email')
    readonly_fields = ('created_at',)

