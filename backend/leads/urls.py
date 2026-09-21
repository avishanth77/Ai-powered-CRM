from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LeadViewSet, LeadSourceViewSet

router = DefaultRouter()
router.register(r'sources', LeadSourceViewSet, basename='lead-source')
router.register(r'', LeadViewSet, basename='lead')

urlpatterns = [
    path('', include(router.urls)),
]
