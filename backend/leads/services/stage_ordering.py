import logging
from django.db import transaction
from django.db.models import F, Max

logger = logging.getLogger(__name__)


def resequence_stages():
    """
    Ensures all LeadStage records have contiguous, 1-indexed display_order
    values (1, 2, 3, ..., N) with zero gaps and zero duplicate orders.
    Maintains relative order based on (display_order, id).
    """
    from leads.models import LeadStage

    stages = list(LeadStage.objects.all().order_by('display_order', 'id'))
    stages_to_update = []
    for idx, stage in enumerate(stages, start=1):
        if stage.display_order != idx:
            stage.display_order = idx
            stages_to_update.append(stage)

    if stages_to_update:
        LeadStage.objects.bulk_update(stages_to_update, ['display_order'])
        logger.info(f"Resequenced {len(stages_to_update)} LeadStages to contiguous display_order.")


def shift_stages_for_insert(target_order):
    """
    When inserting a new stage at target_order, shifts all existing stages
    with display_order >= target_order up by 1.
    """
    from leads.models import LeadStage

    if target_order is not None and target_order >= 1:
        LeadStage.objects.filter(display_order__gte=target_order).update(
            display_order=F('display_order') + 1
        )


def shift_stages_for_update(stage_id, new_order, old_order):
    """
    When an existing stage moves from old_order to new_order:
    - If new_order < old_order (moving earlier in pipeline): intermediate stages shift down (+1)
    - If new_order > old_order (moving later in pipeline): intermediate stages shift up (-1)
    """
    from leads.models import LeadStage

    if new_order == old_order:
        return

    if new_order < old_order:
        LeadStage.objects.filter(
            display_order__gte=new_order,
            display_order__lt=old_order
        ).exclude(id=stage_id).update(display_order=F('display_order') + 1)
    else:
        LeadStage.objects.filter(
            display_order__gt=old_order,
            display_order__lte=new_order
        ).exclude(id=stage_id).update(display_order=F('display_order') - 1)

