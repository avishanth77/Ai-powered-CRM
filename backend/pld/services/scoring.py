"""PLD scoring service.

The frontend never sends scores or points. Every number written to the database
is derived here from the stored problem configuration.
"""
from decimal import Decimal, ROUND_HALF_UP

from django.db import transaction

from pld.models import PLDAssessment, PLDAssessmentProblem, PLDStatus, get_scoring_config


class PLDValidationError(Exception):
    """Raised when the submitted problem selection is not a valid assessment."""

    def __init__(self, message, errors=None):
        super().__init__(message)
        self.message = message
        self.errors = errors or {}


def get_active_problems(stage=None):
    """Active problems in configured display order.

    If ``stage`` is provided, returns active problems configured for that stage.
    If no problems are configured specifically for that stage, falls back to
    global problems (where stage is null).
    """
    from leads.models import LeadStage
    from pld.models import PLDProblem

    if isinstance(stage, int):
        stage = LeadStage.objects.filter(id=stage).first()

    if stage is not None:
        stage_qs = PLDProblem.objects.filter(is_active=True, stage=stage).order_by('display_order', 'id')
        if stage_qs.exists():
            return list(stage_qs)
        # Fallback to global problems if this stage has no problems configured
        return list(PLDProblem.objects.filter(is_active=True, stage__isnull=True).order_by('display_order', 'id'))

    return list(PLDProblem.objects.filter(is_active=True).order_by('display_order', 'id'))


def calculate_percentage(total_score, max_score):
    if not max_score:
        return Decimal('0.00')
    percentage = (Decimal(total_score) / Decimal(max_score)) * Decimal(100)
    return percentage.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def classify_score(percentage, stage=None, config=None):
    from pld.models import PLDStageGate
    threshold = None
    if stage is not None:
        gate = PLDStageGate.objects.filter(stage=stage).first()
        if gate and gate.qualified_min_percentage is not None:
            threshold = gate.qualified_min_percentage

    if threshold is None:
        config = config or get_scoring_config()
        threshold = config.qualified_min_percentage

    return PLDStatus.QUALIFIED_PLD if percentage >= threshold else PLDStatus.UNQUALIFIED


def normalise_problem_ids(payload):
    """Convert the incoming payload into a de-duplicated list of ints."""
    if payload is None:
        return []
    if not isinstance(payload, (list, tuple)):
        raise PLDValidationError("Provide 'problem_ids' as a list of problem ids.")

    normalised = []
    seen = set()
    for raw in payload:
        if raw in (None, ''):
            continue
        try:
            problem_id = int(raw)
        except (TypeError, ValueError):
            raise PLDValidationError(f"Invalid problem id '{raw}'.")
        if problem_id in seen:
            continue
        seen.add(problem_id)
        normalised.append(problem_id)
    return normalised


@transaction.atomic
def submit_assessment(lead, user, problem_ids_payload, stage=None):
    """Validate, score and persist an immutable PLD assessment for a lead and stage."""
    from leads.models import LeadStage
    if isinstance(stage, int):
        stage = LeadStage.objects.filter(id=stage).first()

    problems = get_active_problems(stage=stage)
    if not problems:
        stage_name = f"stage '{stage.name}'" if stage else 'any stage'
        raise PLDValidationError(f'There are no active PLD problems configured for {stage_name} yet.')

    selected_ids = normalise_problem_ids(problem_ids_payload)
    if not selected_ids:
        raise PLDValidationError('Select at least one problem before submitting.')

    by_id = {problem.id: problem for problem in problems}
    unknown = [pid for pid in selected_ids if pid not in by_id]
    if unknown:
        raise PLDValidationError(
            'One or more selected problems are no longer active.',
            {'problem_ids': [str(pid) for pid in unknown]},
        )

    # Denominator is the full active problem pool for this stage, frozen into the snapshot.
    max_score = sum(problem.points for problem in problems)
    total_score = 0
    rows = []
    snapshot = []

    for order, problem_id in enumerate(selected_ids, start=1):
        problem = by_id[problem_id]
        total_score += problem.points
        frozen = problem.snapshot()
        snapshot.append(frozen)
        rows.append({
            'problem': problem,
            'problem_snapshot': frozen,
            'points_earned': problem.points,
            'display_order': order,
        })

    config = get_scoring_config()
    percentage = calculate_percentage(total_score, max_score)
    pld_status = classify_score(percentage, stage=stage, config=config)

    config_dict = config.as_dict()
    if stage:
        from pld.models import PLDStageGate
        gate = PLDStageGate.objects.filter(stage=stage).first()
        if gate and gate.qualified_min_percentage is not None:
            config_dict['stage_qualified_min_percentage'] = gate.qualified_min_percentage

    assessment = PLDAssessment.objects.create(
        lead=lead,
        stage=stage,
        assessed_by=user if (user and user.is_authenticated) else None,
        total_score=total_score,
        max_score=max_score,
        percentage=percentage,
        pld_status=pld_status,
        problems_snapshot=snapshot,
        config_snapshot=config_dict,
    )

    PLDAssessmentProblem.objects.bulk_create([
        PLDAssessmentProblem(assessment=assessment, **row) for row in rows
    ])

    lead.pld_score = total_score
    lead.pld_status = pld_status
    lead.save(update_fields=['pld_score', 'pld_status', 'updated_at'])

    return assessment
