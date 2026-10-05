from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    ICPQuestion,
    ICPQuestionOption,
    ICPQualification,
    ICPQualificationAnswer,
    ICPScoringConfig,
    QuestionType,
)
from .services.scoring import get_question_max_points

User = get_user_model()

CHOICE_TYPES = (
    QuestionType.SINGLE_CHOICE,
    QuestionType.MULTI_CHOICE,
    QuestionType.YES_NO,
    QuestionType.DROPDOWN,
)


class ICPQuestionOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ICPQuestionOption
        fields = ['id', 'option_text', 'points', 'display_order']
        read_only_fields = ['id']


class ICPQuestionOptionWriteSerializer(serializers.Serializer):
    option_text = serializers.CharField(max_length=200, required=True)
    points = serializers.IntegerField(required=True, min_value=0, max_value=10000)


class UserRefSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'role']


class ICPQuestionSerializer(serializers.ModelSerializer):
    """Admin-facing representation with nested options and scoring configuration."""

    options = ICPQuestionOptionSerializer(many=True, read_only=True)
    created_by_details = UserRefSerializer(source='created_by', read_only=True)

    class Meta:
        model = ICPQuestion
        fields = [
            'id',
            'question_text',
            'description',
            'question_type',
            'is_required',
            'is_active',
            'display_order',
            'max_points',
            'scoring_rules',
            'options',
            'created_by',
            'created_by_details',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at', 'max_points']


class ICPQuestionTestSerializer(serializers.ModelSerializer):
    """Question payload used to run the test. No admin-only data is exposed."""

    options = ICPQuestionOptionSerializer(many=True, read_only=True)

    class Meta:
        model = ICPQuestion
        fields = ['id', 'question_text', 'description', 'question_type', 'is_required', 'display_order', 'options']


class ICPQuestionCreateUpdateSerializer(serializers.ModelSerializer):
    options = ICPQuestionOptionWriteSerializer(many=True, required=False)
    display_order = serializers.IntegerField(required=False, min_value=1)
    max_points = serializers.IntegerField(required=False, min_value=0, max_value=10000)

    class Meta:
        model = ICPQuestion
        fields = [
            'question_text',
            'description',
            'question_type',
            'is_required',
            'is_active',
            'display_order',
            'max_points',
            'scoring_rules',
            'options',
        ]

    def validate_question_text(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Question text is required.')
        return value

    def validate_scoring_rules(self, value):
        if value in (None, ''):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError('Scoring rules must be a list.')
        return value

    def validate(self, attrs):
        question_type = attrs.get('question_type') or getattr(self.instance, 'question_type', None)
        options = attrs.get('options', None)
        rules = attrs.get('scoring_rules', None)
        if rules is None and self.instance:
            rules = self.instance.scoring_rules

        if question_type in CHOICE_TYPES:
            if options is not None:
                if not options:
                    raise serializers.ValidationError({'options': 'Add at least one answer option.'})
                seen = set()
                for option in options:
                    text = (option.get('option_text') or '').strip()
                    if not text:
                        raise serializers.ValidationError({'options': 'Every option needs a label.'})
                    if text.lower() in seen:
                        raise serializers.ValidationError({'options': f"Duplicate option '{text}'."})
                    seen.add(text.lower())
            elif not self.instance and question_type != QuestionType.YES_NO:
                # YES / No questions are auto-populated with Yes and No options.
                raise serializers.ValidationError({'options': 'Add at least one answer option.'})

        if question_type == QuestionType.YES_NO and options and len(options) != 2:
            raise serializers.ValidationError({'options': 'Yes / No questions must have exactly two options.'})

        if question_type == QuestionType.NUMBER:
            if not rules:
                raise serializers.ValidationError({'scoring_rules': 'Number questions need at least one scoring range.'})
            for index, rule in enumerate(rules):
                if not isinstance(rule, dict):
                    raise serializers.ValidationError({'scoring_rules': f'Rule {index + 1} is not valid.'})
                minimum = rule.get('min')
                maximum = rule.get('max')
                if minimum is None and maximum is None:
                    raise serializers.ValidationError({'scoring_rules': f'Rule {index + 1} needs a min or max value.'})
                if minimum is not None and maximum is not None and float(minimum) > float(maximum):
                    raise serializers.ValidationError(
                        {'scoring_rules': f'Rule {index + 1}: min cannot be greater than max.'}
                    )
                if rule.get('points') is None:
                    raise serializers.ValidationError({'scoring_rules': f'Rule {index + 1} needs points.'})
        elif rules:
            attrs['scoring_rules'] = []

        return attrs

    def _sync_options(self, question, options):
        question.options.all().delete()
        for index, option in enumerate(options):
            ICPQuestionOption.objects.create(
                question=question,
                option_text=option['option_text'].strip(),
                points=option['points'],
                display_order=index + 1,
            )
        return list(question.options.all())

    def _apply_max_points(self, question, question_type, options):
        """Text questions keep the admin-configured flat points; all others are derived."""
        if question_type != QuestionType.TEXT:
            question.max_points = get_question_max_points(question, options)
            question.save(update_fields=['max_points'])

    def create(self, validated_data):
        options = validated_data.pop('options', None)
        question_type = validated_data['question_type']

        if question_type == QuestionType.YES_NO and not options:
            options = [{'option_text': 'Yes', 'points': 0}, {'option_text': 'No', 'points': 0}]

        if not validated_data.get('display_order'):
            last = ICPQuestion.objects.order_by('-display_order', '-id').values_list('display_order', flat=True).first()
            validated_data['display_order'] = (last or 0) + 1

        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user

        if question_type != QuestionType.TEXT:
            validated_data['max_points'] = 0
        else:
            validated_data['max_points'] = validated_data.get('max_points') or 0

        question = ICPQuestion.objects.create(**validated_data)

        created_options = self._sync_options(question, options) if question_type in CHOICE_TYPES else []
        self._apply_max_points(question, question_type, created_options)
        return question

    def update(self, instance, validated_data):
        options = validated_data.pop('options', None)
        question_type = validated_data.get('question_type', instance.question_type)

        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        current_options = list(instance.options.all())
        if question_type in CHOICE_TYPES and options is not None:
            current_options = self._sync_options(instance, options)
        elif question_type not in CHOICE_TYPES:
            # Question type changed away from a choice type - drop the now unused options.
            instance.options.all().delete()
            current_options = []

        self._apply_max_points(instance, question_type, current_options)
        return instance


class ICPAnswerSerializer(serializers.ModelSerializer):
    """Historical answer rendered from the frozen snapshot, never from live config."""

    question_text = serializers.SerializerMethodField()

    class Meta:
        model = ICPQualificationAnswer
        fields = ['id', 'question_id', 'question_text', 'question_snapshot', 'answer_value',
                  'selected_options', 'points_earned', 'display_order']

    def get_question_text(self, obj):
        return (obj.question_snapshot or {}).get('question_text', '')


class ICPQualificationListSerializer(serializers.ModelSerializer):
    lead_name = serializers.CharField(source='lead.name', read_only=True)
    qualified_by_details = UserRefSerializer(source='qualified_by', read_only=True)
    icp_status_display = serializers.CharField(source='get_icp_status_display', read_only=True)

    class Meta:
        model = ICPQualification
        fields = ['id', 'lead', 'lead_name', 'qualified_by', 'qualified_by_details', 'total_score',
                  'max_score', 'percentage', 'icp_status', 'icp_status_display', 'qualified_at']
        read_only_fields = fields


class ICPQualificationDetailSerializer(ICPQualificationListSerializer):
    answers = ICPAnswerSerializer(many=True, read_only=True)
    lead_details = serializers.SerializerMethodField()

    class Meta(ICPQualificationListSerializer.Meta):
        fields = ICPQualificationListSerializer.Meta.fields + ['answers', 'lead_details', 'thresholds_snapshot']
        read_only_fields = fields

    def get_lead_details(self, obj):
        return {'id': obj.lead_id, 'name': obj.lead.name, 'company_name': obj.lead.company_name}


class ICPScoringConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ICPScoringConfig
        fields = ['poor_fit_max', 'potential_fit_max', 'good_fit_max']

    def validate(self, attrs):
        poor = attrs.get('poor_fit_max', getattr(self.instance, 'poor_fit_max', 39))
        potential = attrs.get('potential_fit_max', getattr(self.instance, 'potential_fit_max', 59))
        good = attrs.get('good_fit_max', getattr(self.instance, 'good_fit_max', 79))

        for label, value in (('Poor Fit', poor), ('Potential Fit', potential), ('Good Fit', good)):
            if not (0 <= value <= 100):
                raise serializers.ValidationError({f'{label} maximum must be between 0 and 100.'})

        if not (poor < potential < good):
            raise serializers.ValidationError(
                'Thresholds must be in ascending order: Poor Fit < Potential Fit < Good Fit.'
            )
        return attrs


class ICPQualificationSubmitSerializer(serializers.Serializer):
    """Only the raw answers are accepted. Scores are always computed server-side."""

    answers = serializers.ListField(child=serializers.DictField(), allow_empty=True)