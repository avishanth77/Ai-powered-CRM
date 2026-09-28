from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AIChatView,
    AIActionExecuteView,
    AICallSummaryView,
    CallViewSet,
    LeadCallsView,
)

router = DefaultRouter()
router.register(r'calls', CallViewSet, basename='calls')

urlpatterns = [
    path('ai/chat/', AIChatView.as_view(), name='ai-chat'),
    path('ai/execute-action/', AIActionExecuteView.as_view(), name='ai-execute-action'),
    path('ai/call-summary/', AICallSummaryView.as_view(), name='ai-call-summary'),
    path('leads/<int:lead_id>/calls/', LeadCallsView.as_view(), name='lead-calls'),
    path('', include(router.urls)),
]
