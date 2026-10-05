from django.urls import path

from .views import (
    LeadICPHistoryView,
    LeadICPQualifyView,
    LeadICPView,
)

urlpatterns = [
    path('<int:lead_id>/icp/', LeadICPView.as_view(), name='lead-icp'),
    path('<int:lead_id>/icp/qualify/', LeadICPQualifyView.as_view(), name='lead-icp-qualify'),
    path('<int:lead_id>/icp/history/', LeadICPHistoryView.as_view(), name='lead-icp-history'),
]