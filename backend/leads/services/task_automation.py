def execute_stage_task_automations(lead, new_stage, old_stage=None, actor=None):
    """
    Executes automated task assignments when a lead transitions to `new_stage`.
    Instantiates both LeadStageTask records and synchronized FollowUp records.

    Parameters:
    - lead (Lead): The Lead instance that changed stage.
    - new_stage (LeadStage or int or str): The new stage being entered.
    - old_stage (LeadStage or int or str, optional): The previous stage.
    - actor (User, optional): The user triggering the stage change.

    Returns:
    - list[FollowUp]: List of created FollowUp task instances.
    """
    if not lead:
        return []

    from leads.models import Lead, LeadStage
    from leads.services.progression import instantiate_stage_tasks

    # Resolve new_stage to LeadStage instance
    if isinstance(new_stage, int):
        new_stage = LeadStage.objects.filter(pk=new_stage).first()
    elif isinstance(new_stage, str):
        new_stage = (
            LeadStage.objects.filter(slug__iexact=new_stage).first()
            or LeadStage.objects.filter(name__iexact=new_stage).first()
        )

    if not new_stage:
        return []

    # If stage didn't actually change, skip
    old_stage_id = getattr(old_stage, 'id', old_stage) if old_stage else None
    if old_stage_id and old_stage_id == new_stage.id:
        return []

    stage_tasks = instantiate_stage_tasks(lead, new_stage, actor=actor)
    return [t.follow_up for t in stage_tasks if getattr(t, 'follow_up', None)] or stage_tasks
