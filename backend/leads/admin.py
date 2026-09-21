from django.contrib import admin
from .models import LeadSource, Lead, LeadNote

class LeadNoteInline(admin.TabularInline):
    model = LeadNote
    extra = 0
    readonly_fields = ('user', 'created_at')

@admin.register(LeadSource)
class LeadSourceAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'description')

@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ('name', 'company_name', 'phone', 'email', 'status', 'priority', 'assigned_to', 'expected_value', 'created_at')
    list_filter = ('status', 'priority', 'source', 'assigned_to')
    search_fields = ('name', 'phone', 'email', 'company_name')
    readonly_fields = ('created_at', 'updated_at', 'converted_at')
    inlines = [LeadNoteInline]
    ordering = ('-created_at',)

@admin.register(LeadNote)
class LeadNoteAdmin(admin.ModelAdmin):
    list_display = ('lead', 'user', 'note_type', 'created_at')
    list_filter = ('note_type', 'created_at')
    search_fields = ('lead__name', 'note_text', 'user__email')
    readonly_fields = ('created_at',)
