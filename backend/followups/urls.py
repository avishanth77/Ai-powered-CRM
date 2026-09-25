from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import FollowUpViewSet
from .views_calendar import CalendarEventsView

router = DefaultRouter()
router.register(r'', FollowUpViewSet, basename='followup')

urlpatterns = [
    path('calendar/events/', CalendarEventsView.as_view(), name='calendar-events'),
    path('', include(router.urls)),
]
