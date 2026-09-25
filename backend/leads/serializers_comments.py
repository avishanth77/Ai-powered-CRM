from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import InternalComment, CommentMention

User = get_user_model()


class CommentAuthorSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'role']


class CommentMentionSerializer(serializers.ModelSerializer):
    user_details = CommentAuthorSerializer(source='mentioned_user', read_only=True)

    class Meta:
        model = CommentMention
        fields = ['id', 'mentioned_user', 'user_details', 'created_at']


class InternalCommentSerializer(serializers.ModelSerializer):
    author_details = CommentAuthorSerializer(source='author', read_only=True)
    mentions = CommentMentionSerializer(many=True, read_only=True)
    replies_count = serializers.SerializerMethodField()
    display_content = serializers.SerializerMethodField()

    class Meta:
        model = InternalComment
        fields = [
            'id',
            'lead',
            'author',
            'author_details',
            'parent',
            'content',
            'display_content',
            'is_edited',
            'is_deleted',
            'mentions',
            'replies_count',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'author',
            'author_details',
            'lead',
            'is_edited',
            'is_deleted',
            'created_at',
            'updated_at',
        ]

    def get_replies_count(self, obj):
        return obj.replies.count()

    def get_display_content(self, obj):
        if obj.is_deleted:
            return "[This comment has been deleted]"
        return obj.content


class InternalCommentCreateSerializer(serializers.Serializer):
    content = serializers.CharField(required=True, allow_blank=False, max_length=5000)
    parent = serializers.IntegerField(required=False, allow_null=True)
    mentioned_user_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )
