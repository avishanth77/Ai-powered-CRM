from django.urls import path
from .views import ReportSummaryView, ExportReportView, ReportPreviewView

urlpatterns = [
    path('summary/', ReportSummaryView.as_view(), name='reports-summary'),
    path('export/', ExportReportView.as_view(), name='reports-export'),
    path('preview/', ReportPreviewView.as_view(), name='reports-preview'),
]

