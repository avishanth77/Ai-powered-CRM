import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q

from .models import Lead, InternalComment, CommentMention
from .serializers_comments import (
    InternalCommentSerializer,
    InternalCommentCreateSerializer,
    CommentAuthorSerializer,
)
from notifications.services import NotificationService

User = get_user_model()


def check_lead_access(lead, user):
    """
    Ensures an executive can only interact with leads they are assigned to
    or created. Managers and Admins have access to all leads.
    """
    if user.is_superuser or user.role in [User.Role.ADMIN, User.Role.MANAGER]:
        return True
    return (lead.assigned_to_id == user.id) or (lead.created_by_id == user.id)


class LeadCommentsView(APIView):
    """
    API for listing and creating internal comments on a lead.
    Strictly restricted to internal staff with access to the lead.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, lead_id):
        lead = get_object_or_404(Lead, id=lead_id)
        if not check_lead_access(lead, request.user):
            return Response(
                {'success': False, 'message': 'You do not have permission to view internal comments on this lead.'},
                status=status.HTTP_403_FORBIDDEN
            )

        comments = (
            InternalComment.objects.filter(lead=lead)
            .select_related('author')
            .prefetch_related('mentions__mentioned_user', 'replies')
            .order_by('created_at')
        )
        serializer = InternalCommentSerializer(comments, many=True)
        return Response({
            'count': comments.count(),
            'results': serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request, lead_id):
        lead = get_object_or_404(Lead, id=lead_id)
        if not check_lead_access(lead, request.user):
            return Response(
                {'success': False, 'message': 'You do not have permission to comment on this lead.'},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = InternalCommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        content = serializer.validated_data['content']
        parent_id = serializer.validated_data.get('parent')
        mentioned_user_ids = serializer.validated_data.get('mentioned_user_ids') or []

        parent = None
        if parent_id:
            parent = get_object_or_404(InternalComment, id=parent_id, lead=lead)

        with transaction.atomic():
            comment = InternalComment.objects.create(
                lead=lead,
                author=request.user,
                parent=parent,
                content=content
            )

            # Mentions parsing & recording
            # 1. From explicit user IDs
            users_to_mention = set(
                User.objects.filter(id__in=mentioned_user_ids, is_active=True).exclude(id=request.user.id)
            )

            # 2. From text pattern @username or @email
            # Matches @word or @email
            email_matches = re.findall(r'@([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)', content)
            if email_matches:
                email_users = User.objects.filter(email__in=email_matches, is_active=True).exclude(id=request.user.id)
                users_to_mention.update(email_users)

            # Create CommentMention records and dispatch notifications
            for mentioned_user in users_to_mention:
                CommentMention.objects.get_or_create(
                    comment=comment,
                    mentioned_user=mentioned_user
                )
                NotificationService.notify_mention(
                    comment=comment,
                    mentioned_user=mentioned_user,
                    actor=request.user
                )

            # If replying to a parent comment, notify parent author if not already notified
            if parent and parent.author_id != request.user.id and parent.author not in users_to_mention:
                NotificationService.notify_internal_comment(
                    comment=comment,
                    parent_comment=parent,
                    actor=request.user
                )

        full_comment = (
            InternalComment.objects.filter(id=comment.id)
            .select_related('author')
            .prefetch_related('mentions__mentioned_user')
            .first()
        )
        return Response(
            InternalCommentSerializer(full_comment).data,
            status=status.HTTP_201_CREATED
        )


class InternalCommentDetailView(APIView):
    """
    API for updating (editing) or soft-deleting an internal comment.
    Allowed only for comment author or managers/admins.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        comment = get_object_or_404(InternalComment, id=pk)
        user = request.user

        # Permission check: Author or Manager/Admin
        if comment.author_id != user.id and user.role not in [User.Role.ADMIN, User.Role.MANAGER] and not user.is_superuser:
            return Response(
                {'success': False, 'message': 'You can only edit your own comments.'},
                status=status.HTTP_403_FORBIDDEN
            )

        if comment.is_deleted:
            return Response(
                {'success': False, 'message': 'Cannot edit a deleted comment.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        content = request.data.get('content')
        if not content or not str(content).strip():
            return Response(
                {'success': False, 'message': 'Comment content cannot be empty.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        comment.content = str(content).strip()
        comment.is_edited = True
        comment.save(update_fields=['content', 'is_edited', 'updated_at'])

        # Check for newly added mentions
        mentioned_user_ids = request.data.get('mentioned_user_ids') or []
        if mentioned_user_ids:
            new_users = User.objects.filter(
                id__in=mentioned_user_ids, is_active=True
            ).exclude(id=user.id)

            for u in new_users:
                created = CommentMention.objects.get_or_create(comment=comment, mentioned_user=u)[1]
                if created:
                    NotificationService.notify_mention(
                        comment=comment,
                        mentioned_user=u,
                        actor=user
                    )

        full_comment = (
            InternalComment.objects.filter(id=comment.id)
            .select_related('author')
            .prefetch_related('mentions__mentioned_user')
            .first()
        )
        return Response(InternalCommentSerializer(full_comment).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        comment = get_object_or_404(InternalComment, id=pk)
        user = request.user

        # Permission check: Author or Manager/Admin
        if comment.author_id != user.id and user.role not in [User.Role.ADMIN, User.Role.MANAGER] and not user.is_superuser:
            return Response(
                {'success': False, 'message': 'You can only delete your own comments.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Soft-delete preserves reply tree integrity
        comment.is_deleted = True
        comment.save(update_fields=['is_deleted', 'updated_at'])
        return Response(
            {'success': True, 'message': 'Comment deleted successfully.'},
            status=status.HTTP_200_OK
        )


class MentionSuggestionsView(APIView):
    """
    Returns active team members for autocomplete when typing '@' in comment inputs.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        users_qs = User.objects.filter(is_active=True).exclude(id=request.user.id)

        if q:
            users_qs = users_qs.filter(
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q) |
                Q(email__icontains=q)
            )

        users_qs = users_qs.order_by('first_name', 'last_name')[:20]
        serializer = CommentAuthorSerializer(users_qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
