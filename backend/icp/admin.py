from django.contrib import admin

from .models import (
    ICPQuestion,
    ICPQuestionOption,
    ICPQualification,
    ICPQualificationAnswer,
    ICPScoringConfig,
)


class ICPQuestionOptionInline(admin.TabularInline):
    model = ICPQuestionOption
    extra = 1


@admin.register(ICPQuestion)
class ICPQuestionAdmin(admin.ModelAdmin):
    list_display = ('question_text', 'question_type', 'is_required', 'is_active', 'display_order', 'max_points')
    list_filter = ('question_type', 'is_required', 'is_active')
    search_fields = ('question_text', 'description')
    ordering = ('display_order', 'id')
    inlines = [ICPQuestionOptionInline]


@admin.register(ICPQualification)
class ICPQualificationAdmin(admin.ModelAdmin):
    list_display = ('lead', 'total_score', 'max_score', 'percentage', 'icp_status', 'qualified_by', 'qualified_at')
    list_filter = ('icp_status',)
    readonly_fields = ('qualified_at',)


@admin.register(ICPScoringConfig)
class ICPScoringConfigAdmin(admin.ModelAdmin):
    list_display = ('pk', 'poor_fit_max', 'potential_fit_max', 'good_fit_max', 'updated_at')

    def has_add_permission(self, request):
        return not ICPScoringConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False