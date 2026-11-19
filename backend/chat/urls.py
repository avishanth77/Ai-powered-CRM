from django.urls import path
from .views import (
    ConversationListView,
    MessageListCreateView,
    MarkReadView,
    UnreadCountView,
)

urlpatterns = [
    path('conversations/', ConversationListView.as_view(), name='chat-conversations'),
    path('messages/', MessageListCreateView.as_view(), name='chat-messages'),
    path('messages/mark-read/', MarkReadView.as_view(), name='chat-mark-read'),
    path('unread-count/', UnreadCountView.as_view(), name='chat-unread-count'),
]
