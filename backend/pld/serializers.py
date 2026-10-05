from django.contrib.auth import get_user_model
from rest_framework import serializers

from leads.models import LeadStage
from pld.models import (
    PLDAssessment,
    PLDAssessmentProblem,
    PLDProblem,
    PLDScoringConfig,
    PLDStageGate,
)

User = get_user_model()


class UserRefSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'role']


class PLDProblemSerializer(serializers.ModelSerializer):
    created_by_details = UserRefSerializer(source='created_by', read_only=True)

    class Meta:
        model = PLDProblem
        fields = [
            'id',
            'name',
            'description',
            'points',
            'severity',
            'is_active',
            'display_order',
            'created_by',
            'created_by_details',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class PLDProblemCreateUpdateSerializer(serializers.ModelSerializer):
    display_order = serializers.IntegerField(required=False, min_value=1)
    points = serializers.IntegerField(required=True, min_value=0, max_value=10000)

    class Meta:
        model = PLDProblem
        fields = ['name', 'description', 'points', 'severity', 'is_active', 'display_order']

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Problem name is required.')
        queryset = PLDProblem.objects.filter(name__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('A problem with this name already exists.')
        return value

    def create(self, validated_data):
        if not validated_data.get('display_order'):
            last = PLDProblem.objects.order_by('-display_order', '-id').values_list(
                'display_order', flat=True
            ).first()
            validated_data['display_order'] = (last or 0) + 1

        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        return PLDProblem.objects.create(**validated_data)


class PLDScoringConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = PLDScoringConfig
        fields = ['qualified_min_percentage']

    def validate_qualified_min_percentage(self, value):
        if not (0 <= value <= 100):
            raise serializers.ValidationError('The qualified threshold must be between 0 and 100.')
        return value


class PLDStageGateSerializer(serializers.ModelSerializer):
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    stage_slug = serializers.CharField(source='stage.slug', read_only=True)

    class Meta:
        model = PLDStageGate
        fields = [
            'id',
            'stage',
            'stage_name',
            'stage_slug',
            'require_icp_min_status',
            'require_pld_qualified',
            'require_problems_assessed',
            'notes',
            'updated_at',
        ]
        read_only_fields = ['id', 'stage_name', 'stage_slug', 'updated_at']

    def validate_stage(self, value):
        if PLDStageGate.objects.filter(stage=value).exclude(pk=getattr(self.instance, 'pk', None)).exists():
            raise serializers.ValidationError('A gate already exists for this stage.')
        return value


class PLDAssessmentProblemSerializer(serializers.ModelSerializer):
    problem_name = serializers.SerializerMethodField()
    severity = serializers.SerializerMethodField()

    class Meta:
        model = PLDAssessmentProblem
        fields = ['id', 'problem', 'problem_name', 'severity', 'problem_snapshot', 'points_earned']

    def get_problem_name(self, obj):
        return (obj.problem_snapshot or {}).get('name', '')

    def get_severity(self, obj):
        return (obj.problem_snapshot or {}).get('severity', '')


class PLDAssessmentListSerializer(serializers.ModelSerializer):
    lead_name = serializers.CharField(source='lead.name', read_only=True)
    assessed_by_details = UserRefSerializer(source='assessed_by', read_only=True)
    pld_status_display = serializers.CharField(source='get_pld_status_display', read_only=True)

    class Meta:
        model = PLDAssessment
        fields = ['id', 'lead', 'lead_name', 'assessed_by', 'assessed_by_details', 'total_score',
                  'max_score', 'percentage', 'pld_status', 'pld_status_display', 'assessed_at']
        read_only_fields = fields


class PLDAssessmentDetailSerializer(PLDAssessmentListSerializer):
    problems = PLDAssessmentProblemSerializer(many=True, read_only=True)
    lead_details = serializers.SerializerMethodField()

    class Meta(PLDAssessmentListSerializer.Meta):
        fields = PLDAssessmentListSerializer.Meta.fields + [
            'problems', 'lead_details', 'problems_snapshot', 'config_snapshot',
        ]
        read_only_fields = fields

    def get_lead_details(self, obj):
        return {'id': obj.lead_id, 'name': obj.lead.name, 'company_name': obj.lead.company_name}


class PLDAssessSubmitSerializer(serializers.Serializer):
    """Only the raw problem ids are accepted. Scores are always computed server-side."""

    problem_ids = serializers.ListField(child=serializers.IntegerField(), allow_empty=True)


class LeadStageTargetSerializer(serializers.Serializer):
    stage = serializers.PrimaryKeyRelatedField(queryset=LeadStage.objects.all())
