from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ICPQualificationDetailView,
    ICPQuestionViewSet,
    ICPScoringConfigView,
)

router = DefaultRouter()
router.register(r'questions', ICPQuestionViewSet, basename='icp-question')

urlpatterns = [
    path('config/', ICPScoringConfigView.as_view(), name='icp-config'),
    path('qualifications/<int:pk>/', ICPQualificationDetailView.as_view(), name='icp-qualification-detail'),
    path('', include(router.urls)),
]