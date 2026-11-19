import logging
from django.db.models import Q
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .models import ChatMessage
from .serializers import (
    ChatMessageSerializer,
    ChatMessageCreateSerializer,
    ConversationSerializer,
    ChatUserSummarySerializer,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class ConversationListView(APIView):
    """
    Lists all active CRM teammates available for 1-on-1 direct chat,
    along with the snippet of the most recent message and unread count.
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: ConversationSerializer(many=True)})
    def get(self, request, *args, **kwargs):
        current_user = request.user
        other_users = User.objects.filter(is_active=True).exclude(id=current_user.id).order_by('first_name', 'last_name', 'email')

        conversations = []
        for other in other_users:
            last_msg = ChatMessage.objects.filter(
                Q(sender=current_user, recipient=other) | Q(sender=other, recipient=current_user)
            ).order_by('-created_at').first()

            unread_count = ChatMessage.objects.filter(
                sender=other,
                recipient=current_user,
                is_read=False
            ).count()

            conversations.append({
                'user': other,
                'last_message': last_msg.message if last_msg else None,
                'last_message_at': last_msg.created_at if last_msg else None,
                'last_message_sender_id': last_msg.sender_id if last_msg else None,
                'unread_count': unread_count,
            })

        # Split: contacts with active messages first (newest first), then remaining alphabetically
        with_messages = [c for c in conversations if c['last_message_at'] is not None]
        without_messages = [c for c in conversations if c['last_message_at'] is None]

        with_messages.sort(key=lambda c: c['last_message_at'], reverse=True)
        without_messages.sort(
            key=lambda c: (
                (c['user'].first_name or '').lower(),
                (c['user'].last_name or '').lower(),
                (c['user'].email or '').lower()
            )
        )

        sorted_conversations = with_messages + without_messages

        serializer = ConversationSerializer(sorted_conversations, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': len(sorted_conversations),
            'data': serializer.data
        }, status=status.HTTP_200_OK)


class MessageListCreateView(APIView):
    """
    Get message history between current user and a teammate, or send a new message.
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[OpenApiParameter(name='user_id', description='Teammate User ID to chat with', required=True, type=int)],
        responses={200: ChatMessageSerializer(many=True)}
    )
    def get(self, request, *args, **kwargs):
        current_user = request.user
        other_user_id = request.query_params.get('user_id')

        if not other_user_id:
            return Response({
                'success': False,
                'message': 'Parameter user_id is required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            other_user = User.objects.get(id=int(other_user_id), is_active=True)
        except (User.DoesNotExist, ValueError):
            return Response({
                'success': False,
                'message': 'User not found or inactive.'
            }, status=status.HTTP_404_NOT_FOUND)

        # Mark all unread incoming messages from this user as read
        ChatMessage.objects.filter(
            sender=other_user,
            recipient=current_user,
            is_read=False
        ).update(is_read=True, read_at=timezone.now())

        # Fetch entire message stream between these two users
        messages = ChatMessage.objects.filter(
            Q(sender=current_user, recipient=other_user) | Q(sender=other_user, recipient=current_user)
        ).select_related('sender', 'recipient').order_by('created_at')

        serializer = ChatMessageSerializer(messages, many=True, context={'request': request})
        return Response({
            'success': True,
            'count': messages.count(),
            'other_user': ChatUserSummarySerializer(other_user).data,
            'data': serializer.data
        }, status=status.HTTP_200_OK)

    @extend_schema(request=ChatMessageCreateSerializer, responses={201: ChatMessageSerializer})
    def post(self, request, *args, **kwargs):
        serializer = ChatMessageCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        recipient = serializer.validated_data['recipient']
        content = serializer.validated_data['message']

        message = ChatMessage.objects.create(
            sender=request.user,
            recipient=recipient,
            message=content
        )

        # Dispatch internal notification to recipient
        try:
            from notifications.models import Notification
            sender_display = request.user.get_full_name() or request.user.email
            preview = (content[:90] + '...') if len(content) > 90 else content
            Notification.objects.create(
                recipient=recipient,
                actor=request.user,
                notification_type=Notification.NotificationType.INTERNAL_COMMENT,
                priority=Notification.Priority.NORMAL,
                title=f"Direct message from {sender_display}",
                message=f'"{preview}"',
                action_url=f"/chat/{request.user.id}",
                entity_type='chat_message',
                entity_id=str(message.id)
            )
        except Exception as notify_err:
            logger.warning(f"Could not create notification for direct message: {notify_err}")

        out_serializer = ChatMessageSerializer(message, context={'request': request})
        return Response({
            'success': True,
            'message': 'Message sent successfully.',
            'data': out_serializer.data
        }, status=status.HTTP_201_CREATED)


class MarkReadView(APIView):
    """
    Marks all unread messages from a specific teammate as read.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        sender_id = request.data.get('sender_id')
        if not sender_id:
            return Response({
                'success': False,
                'message': 'sender_id is required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        updated_count = ChatMessage.objects.filter(
            sender_id=sender_id,
            recipient=request.user,
            is_read=False
        ).update(is_read=True, read_at=timezone.now())

        return Response({
            'success': True,
            'updated_count': updated_count,
            'message': f'Marked {updated_count} messages as read.'
        }, status=status.HTTP_200_OK)


class UnreadCountView(APIView):
    """
    Returns total unread 1-on-1 chat messages for the current user.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        count = ChatMessage.objects.filter(recipient=request.user, is_read=False).count()
        return Response({
            'success': True,
            'unread_count': count
        }, status=status.HTTP_200_OK)
