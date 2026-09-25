from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LeadViewSet, LeadSourceViewSet
from .views_comments import LeadCommentsView, InternalCommentDetailView

router = DefaultRouter()
router.register(r'sources', LeadSourceViewSet, basename='lead-source')
router.register(r'', LeadViewSet, basename='lead')

urlpatterns = [
    path('<int:lead_id>/comments/', LeadCommentsView.as_view(), name='lead-comments'),
    path('comments/<int:pk>/', InternalCommentDetailView.as_view(), name='comment-detail'),
    path('', include(router.urls)),
]
