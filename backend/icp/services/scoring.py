"""ICP scoring service.

The frontend never sends scores or points. Every number written to the database
is derived here from the stored question configuration.
"""
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction

from icp.models import (
    CHOICE_BASED_TYPES,
    ICPQualification,
    ICPQualificationAnswer,
    ICPStatus,
    QuestionType,
    get_scoring_config,
)


class ICPValidationError(Exception):
    """Raised when the submitted answers are not a valid ICP test submission."""

    def __init__(self, message, errors=None):
        super().__init__(message)
        self.message = message
        self.errors = errors or {}


def get_active_questions():
    """Active questions in configured display order, with options prefetched."""
    from icp.models import ICPQuestion
    return list(
        ICPQuestion.objects.filter(is_active=True).prefetch_related('options').order_by('display_order', 'id')
    )


def classify_score(percentage, config=None):
    config = config or get_scoring_config()
    if percentage <= config.poor_fit_max:
        return ICPStatus.POOR_FIT
    if percentage <= config.potential_fit_max:
        return ICPStatus.POTENTIAL_FIT
    if percentage <= config.good_fit_max:
        return ICPStatus.GOOD_FIT
    return ICPStatus.STRONG_ICP_FIT


def get_question_max_points(question, options=None):
    """Maximum points a single answer to this question can earn."""
    if question.question_type == QuestionType.TEXT:
        return question.max_points

    if question.question_type == QuestionType.NUMBER:
        rules = question.scoring_rules or []
        return max((_as_int(rule.get('points')) for rule in rules), default=0)

    options = options if options is not None else list(question.options.all())
    if not options:
        return 0
    if question.question_type == QuestionType.MULTI_CHOICE:
        return sum(option.points for option in options)
    return max(option.points for option in options)


def _as_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def normalise_answer_payload(payload):
    """Convert the incoming answers list into {question_id: raw_value}."""
    if not isinstance(payload, list):
        raise ICPValidationError('Answers must be supplied as a list.')

    normalised = {}
    for entry in payload:
        if not isinstance(entry, dict):
            raise ICPValidationError('Each answer must be an object with a question_id.')

        question_id = entry.get('question_id')
        if question_id in (None, ''):
            raise ICPValidationError('Each answer must reference a question_id.')

        try:
            question_id = int(question_id)
        except (TypeError, ValueError):
            raise ICPValidationError(f"Invalid question_id '{question_id}'.")

        value = entry.get('value')
        if value is None:
            value = entry.get('option_ids')

        if isinstance(value, (list, tuple)):
            value = [item for item in value if item not in (None, '')]
        elif isinstance(value, str):
            value = value.strip()

        normalised[question_id] = value

    return normalised


def _is_blank(value):
    if value in (None, '', [], {}):
        return True
    if isinstance(value, str):
        return not value.strip()
    return False


def score_answer(question, value):
    """Return (points_earned, answer_value, selected_options) for a single answer."""
    options = list(question.options.all())

    if question.question_type in CHOICE_BASED_TYPES:
        if _is_blank(value):
            return 0, '', []

        if question.question_type == QuestionType.MULTI_CHOICE:
            raw_ids = value if isinstance(value, (list, tuple)) else [value]
            selected = []
            total = 0
            for raw in raw_ids:
                option = _find_option(options, raw)
                if option is None:
                    raise ICPValidationError(
                        f"'{question.question_text}' was answered with an option that no longer exists."
                    )
                if any(item['id'] == option.id for item in selected):
                    continue
                total += option.points
                selected.append({'id': option.id, 'text': option.option_text, 'points': option.points})
            answer_value = ', '.join(item['text'] for item in selected)
            return total, answer_value, selected

        if isinstance(value, (list, tuple)):
            value = value[0] if value else None
        option = _find_option(options, value)
        if option is None:
            raise ICPValidationError(
                f"'{question.question_text}' was answered with an option that no longer exists."
            )
        return option.points, option.option_text, [{'id': option.id, 'text': option.option_text, 'points': option.points}]

    if question.question_type == QuestionType.NUMBER:
        if _is_blank(value):
            return 0, '', []
        number = _to_float(value)
        if number is None:
            raise ICPValidationError(f"'{question.question_text}' requires a numeric answer.")
        points = _match_number_rule(question, number)
        return points, format(number, 'g'), []

    # Text: flat points when answered.
    if _is_blank(value):
        return 0, '', []
    text = str(value).strip()
    return question.max_points, text, []


def _find_option(options, raw):
    if raw in (None, ''):
        return None
    for option in options:
        if str(option.id) == str(raw):
            return option
    text = str(raw).strip().lower()
    for option in options:
        if option.option_text.strip().lower() == text:
            return option
    return None


def _to_float(value, default=None):
    try:
        return float(str(value).strip())
    except (TypeError, ValueError):
        return default


def _match_number_rule(question, number):
    for rule in question.scoring_rules or []:
        minimum = rule.get('min')
        maximum = rule.get('max')
        lower_ok = minimum is None or number >= _to_float(minimum, number)
        upper_ok = maximum is None or number <= _to_float(maximum, number)
        if lower_ok and upper_ok:
            return _as_int(rule.get('points'))
    return 0


def classify_score(percentage, config=None):
    config = config or get_scoring_config()
    if percentage <= config.poor_fit_max:
        return ICPStatus.POOR_FIT
    if percentage <= config.potential_fit_max:
        return ICPStatus.POTENTIAL_FIT
    if percentage <= config.good_fit_max:
        return ICPStatus.GOOD_FIT
    return ICPStatus.STRONG_ICP_FIT


def calculate_percentage(total_score, max_score):
    if not max_score:
        return Decimal('0.00')
    percentage = (Decimal(total_score) / Decimal(max_score)) * Decimal(100)
    return percentage.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


@transaction.atomic
def submit_qualification(lead, user, answers_payload):
    """Validate, score and persist an ICP qualification attempt for a lead."""
    questions = get_active_questions()
    if not questions:
        raise ICPValidationError('There are no active ICP questions configured yet.')

    submitted = normalise_answer_payload(answers_payload)

    question_ids = {question.id for question in questions}
    unknown_ids = [qid for qid in submitted if qid not in question_ids]
    if unknown_ids:
        raise ICPValidationError('One or more answers refer to questions that are no longer active.')

    errors = {}
    rows = []
    total_score = 0
    max_score = 0

    for question in questions:
        options = list(question.options.all())
        max_score += get_question_max_points(question, options)

        raw_value = submitted.get(question.id)
        if _is_blank(raw_value):
            if question.is_required:
                errors[str(question.id)] = [f"'{question.question_text}' is required."]
            continue

        points, answer_value, selected = score_answer(question, raw_value)
        total_score += points
        rows.append({
            'question': question,
            'question_snapshot': question.snapshot(),
            'answer_value': answer_value,
            'selected_options': selected,
            'points_earned': points,
            'display_order': question.display_order,
        })

    if errors:
        raise ICPValidationError('Please complete all required questions before submitting.', errors)

    config = get_scoring_config()
    percentage = calculate_percentage(total_score, max_score)
    icp_status = classify_score(percentage, config)

    qualification = ICPQualification.objects.create(
        lead=lead,
        qualified_by=user if (user and user.is_authenticated) else None,
        total_score=total_score,
        max_score=max_score,
        percentage=percentage,
        icp_status=icp_status,
        thresholds_snapshot=config.as_dict(),
    )

    ICPQualificationAnswer.objects.bulk_create([
        ICPQualificationAnswer(qualification=qualification, **row) for row in rows
    ])

    lead.icp_status = icp_status
    lead.save(update_fields=['icp_status', 'updated_at'])

    return qualification