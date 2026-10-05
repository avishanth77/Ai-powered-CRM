from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    PLDAssessmentDetailView,
    PLDProblemViewSet,
    PLDScoringConfigView,
    PLDStageGateViewSet,
)

router = DefaultRouter()
router.register(r'problems', PLDProblemViewSet, basename='pld-problem')
router.register(r'gates', PLDStageGateViewSet, basename='pld-gate')

urlpatterns = [
    path('config/', PLDScoringConfigView.as_view(), name='pld-config'),
    path('assessments/<int:pk>/', PLDAssessmentDetailView.as_view(), name='pld-assessment-detail'),
    path('', include(router.urls)),
]
