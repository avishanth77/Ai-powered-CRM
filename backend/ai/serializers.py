from rest_framework import serializers
from .models import Call
from leads.models import Lead


class CallSerializer(serializers.ModelSerializer):
    lead_name = serializers.CharField(source='lead.name', read_only=True)
    lead_company = serializers.CharField(source='lead.company_name', read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Call
        fields = [
            'id',
            'lead',
            'lead_name',
            'lead_company',
            'created_by',
            'created_by_name',
            'call_type',
            'started_at',
            'duration_seconds',
            'audio_file',
            'transcript',
            'ai_summary',
            'key_points',
            'customer_requirements',
            'objections',
            'customer_intent',
            'next_action',
            'follow_up_date',
            'ai_provider',
            'ai_model',
            'processing_status',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            name = f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
            return name or obj.created_by.email
        return 'System'

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class AIChatRequestSerializer(serializers.Serializer):
    prompt = serializers.CharField(required=True, max_length=2000)
    context = serializers.DictField(required=False, default=dict)
    conversation_history = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list
    )


class CallSummaryRequestSerializer(serializers.Serializer):
    ALLOWED_AUDIO_EXTENSIONS = ('.mp3', '.wav', '.m4a', '.ogg', '.webm', '.flac', '.aac')
    MAX_AUDIO_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

    lead_id = serializers.IntegerField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default='')
    audio_file = serializers.FileField(required=False, allow_null=True)
    call_type = serializers.CharField(required=False, default='Outbound')
    duration_seconds = serializers.IntegerField(required=False, default=0)
    call_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_audio_file(self, value):
        if value:
            import os
            ext = os.path.splitext(value.name)[1].lower()
            if ext not in self.ALLOWED_AUDIO_EXTENSIONS:
                raise serializers.ValidationError(
                    f"Unsupported audio format '{ext}'. Allowed: {', '.join(self.ALLOWED_AUDIO_EXTENSIONS)}"
                )
            if value.size > self.MAX_AUDIO_SIZE_BYTES:
                raise serializers.ValidationError(
                    f"Audio file exceeds 50MB limit ({value.size / (1024*1024):.1f}MB received)."
                )
        return value


class UpdateTranscriptSerializer(serializers.Serializer):
    transcript = serializers.CharField(required=True)
    reanalyze = serializers.BooleanField(required=False, default=False)
