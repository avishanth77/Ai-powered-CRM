from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LeadViewSet,
    LeadSourceViewSet,
    StageTaskRuleViewSet,
    LeadStageTaskViewSet,
    CustomPropertyDefinitionViewSet,
)
from .views_comments import LeadCommentsView, InternalCommentDetailView
from .views_public import PublicContactLeadView

router = DefaultRouter()
router.register(r'sources', LeadSourceViewSet, basename='lead-source')
router.register(r'stage-task-rules', StageTaskRuleViewSet, basename='lead-stage-task-rules')
router.register(r'stage-tasks', LeadStageTaskViewSet, basename='lead-stage-tasks')
router.register(r'custom-properties', CustomPropertyDefinitionViewSet, basename='custom-property')
router.register(r'', LeadViewSet, basename='lead')

urlpatterns = [
    # Public Web-to-Lead endpoint for external website contact forms
    path('web-to-lead/', PublicContactLeadView.as_view(), name='web-to-lead'),
    path('public/contact/', PublicContactLeadView.as_view(), name='public-contact-lead'),

    path('<int:lead_id>/comments/', LeadCommentsView.as_view(), name='lead-comments'),
    path('comments/<int:pk>/', InternalCommentDetailView.as_view(), name='comment-detail'),
    path('', include(router.urls)),
]
