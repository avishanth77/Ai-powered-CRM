import logging
from django.db import transaction
from django.db.models import F, Max

logger = logging.getLogger(__name__)


def resequence_stages(pipeline=None):
    """
    Ensures LeadStage records within each pipeline have contiguous, 1-indexed
    display_order values (1, 2, 3, ..., N) with zero gaps and zero duplicate orders.
    Maintains relative order based on (display_order, id).
    """
    from leads.models import LeadStage

    if pipeline is not None:
        pid = getattr(pipeline, 'id', pipeline)
        pipeline_ids = [pid]
    else:
        pipeline_ids = list(
            LeadStage.objects.values_list('pipeline_id', flat=True).distinct()
        )

    stages_to_update = []
    for pid in pipeline_ids:
        qs = LeadStage.objects.filter(pipeline_id=pid).order_by('display_order', 'id')
        for idx, stage in enumerate(qs, start=1):
            if stage.display_order != idx:
                stage.display_order = idx
                stages_to_update.append(stage)

    if stages_to_update:
        LeadStage.objects.bulk_update(stages_to_update, ['display_order'])
        logger.info(f"Resequenced {len(stages_to_update)} LeadStages to contiguous display_order.")


def shift_stages_for_insert(target_order, pipeline=None):
    """
    When inserting a new stage at target_order inside a pipeline, shifts all
    existing stages in that pipeline with display_order >= target_order up by 1.
    """
    from leads.models import LeadStage, Pipeline

    if target_order is not None and target_order >= 1:
        pid = getattr(pipeline, 'id', pipeline) if pipeline is not None else Pipeline.get_default().id
        LeadStage.objects.filter(
            pipeline_id=pid,
            display_order__gte=target_order
        ).update(display_order=F('display_order') + 1)


def shift_stages_for_update(stage_id, new_order, old_order, pipeline=None):
    """
    When an existing stage moves from old_order to new_order within its pipeline:
    - If new_order < old_order (moving earlier in pipeline): intermediate stages shift down (+1)
    - If new_order > old_order (moving later in pipeline): intermediate stages shift up (-1)
    """
    from leads.models import LeadStage

    if new_order == old_order:
        return

    pid = getattr(pipeline, 'id', pipeline) if pipeline is not None else (
        LeadStage.objects.filter(id=stage_id).values_list('pipeline_id', flat=True).first()
    )

    if new_order < old_order:
        LeadStage.objects.filter(
            pipeline_id=pid,
            display_order__gte=new_order,
            display_order__lt=old_order
        ).exclude(id=stage_id).update(display_order=F('display_order') + 1)
    else:
        LeadStage.objects.filter(
            pipeline_id=pid,
            display_order__gt=old_order,
            display_order__lte=new_order
        ).exclude(id=stage_id).update(display_order=F('display_order') - 1)

