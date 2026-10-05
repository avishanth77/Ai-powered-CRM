from django.urls import path

from .views import (
    LeadPLDAssessView,
    LeadPLDGateCheckView,
    LeadPLDHistoryView,
    LeadPLDView,
)

urlpatterns = [
    path('<int:lead_id>/pld/', LeadPLDView.as_view(), name='lead-pld'),
    path('<int:lead_id>/pld/assess/', LeadPLDAssessView.as_view(), name='lead-pld-assess'),
    path('<int:lead_id>/pld/history/', LeadPLDHistoryView.as_view(), name='lead-pld-history'),
    path('<int:lead_id>/pld/gate-check/', LeadPLDGateCheckView.as_view(), name='lead-pld-gate-check'),
]
