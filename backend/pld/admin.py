from django.contrib import admin

from .models import (
    PLDAssessment,
    PLDAssessmentProblem,
    PLDProblem,
    PLDScoringConfig,
    PLDStageGate,
)


@admin.register(PLDProblem)
class PLDProblemAdmin(admin.ModelAdmin):
    list_display = ('name', 'points', 'severity', 'is_active', 'display_order')
    list_filter = ('severity', 'is_active')
    search_fields = ('name', 'description')
    ordering = ('display_order', 'id')


@admin.register(PLDAssessment)
class PLDAssessmentAdmin(admin.ModelAdmin):
    list_display = ('lead', 'total_score', 'max_score', 'percentage', 'pld_status', 'assessed_by', 'assessed_at')
    list_filter = ('pld_status',)
    readonly_fields = ('assessed_at',)


@admin.register(PLDStageGate)
class PLDStageGateAdmin(admin.ModelAdmin):
    list_display = ('stage', 'require_icp_min_status', 'require_pld_qualified', 'require_problems_assessed')
    list_filter = ('require_pld_qualified', 'require_problems_assessed')


@admin.register(PLDScoringConfig)
class PLDScoringConfigAdmin(admin.ModelAdmin):
    list_display = ('pk', 'qualified_min_percentage', 'updated_at')

    def has_add_permission(self, request):
        return not PLDScoringConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


admin.site.register(PLDAssessmentProblem)
