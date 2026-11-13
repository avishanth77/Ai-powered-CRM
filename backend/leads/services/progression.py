import logging

from datetime import timedelta

from django.utils import timezone

from django.conf import settings

from activity.services import log_activity

from activity.models import ActivityLog

from notifications.services import NotificationService



logger = logging.getLogger(__name__)





def check_stage_progression(lead, target_stage, actor=None):

    """

    Evaluates whether `lead` can legally progress into `target_stage`.



    Rules:

    1. Moving to 'lost' is always permitted regardless of task status.

    2. Moving to the current stage (no change) is always permitted.

    3. Creating a new lead is always permitted (new leads hold no prior tasks).

    4. Moving to a new stage requires ALL mandatory tasks (is_mandatory=True)

       of the CURRENT stage to be in 'COMPLETED' status.

    5. If the current stage has `require_manager_approval=True`, only a

       Manager or Admin can advance the lead to the next stage.



    Returns:

    - (can_progress: bool, missing_tasks: list[dict], message: str)

    """

    if not lead or not getattr(lead, 'pk', None) or not target_stage:

        return True, [], ""



    from leads.models import LeadStage, LeadStageTask, StageTaskRule



    # Moving to 'lost' is always allowed

    if target_stage.slug == 'lost' or target_stage.name.lower() == 'lost':

        return True, [], ""



    current_stage = lead.stage

    if not current_stage or current_stage.id == target_stage.id:

        return True, [], ""



    # Check ICP Qualification policy if current stage is ICP

    if current_stage and (current_stage.slug.lower() == 'icp' or current_stage.name.lower() == 'icp'):

        if target_stage.display_order > current_stage.display_order:

            from icp.models import ICPStatus

            is_icp_qualified = lead.icp_status in [

                ICPStatus.POTENTIAL_FIT,

                ICPStatus.GOOD_FIT,

                ICPStatus.STRONG_ICP_FIT,

            ]

            if not is_icp_qualified:

                status_display = lead.get_icp_status_display() if hasattr(lead, 'get_icp_status_display') else lead.icp_status

                message = (

                    f"Cannot advance beyond '{current_stage.name}': ICP Qualification must be completed "

                    f"with a qualifying result first (Current status: {status_display})."

                )

                return False, [{

                    'id': 'icp_qualification_required',

                    'title': 'Complete & Pass ICP Qualification',

                    'purpose': 'ICP Qualification',

                    'priority': 'HIGH',

                    'assigned_to': lead.assigned_to.get_full_name() if lead.assigned_to else 'Unassigned',

                    'assigned_to_id': lead.assigned_to_id,

                    'status': 'PENDING',

                    'is_mandatory': True,

                    'is_overdue': False,

                    'stage_id': current_stage.id,

                    'stage_name': current_stage.name,

                    'code': 'icp_qualification_required',

                    'icp_status': lead.icp_status,

                }], message



    # Ensure stage tasks for the current stage exist if rules are defined

    # (handles leads that were in a stage before rules were created)

    rules_count = StageTaskRule.objects.filter(stage=current_stage, is_active=True).count()

    existing_tasks_count = lead.stage_tasks.filter(stage=current_stage).count()

    if rules_count > 0 and existing_tasks_count == 0:

        instantiate_stage_tasks(lead, current_stage, actor=actor)



    # Check incomplete mandatory tasks for the current stage

    mandatory_tasks = lead.stage_tasks.filter(stage=current_stage, is_mandatory=True)

    incomplete_tasks = [

        t for t in mandatory_tasks

        if t.status != LeadStageTask.Status.COMPLETED

    ]



    if incomplete_tasks:

        missing_details = []

        for t in incomplete_tasks:

            missing_details.append({

                'id': t.id,

                'title': t.title,

                'purpose': t.purpose,

                'priority': t.priority,

                'assigned_to': t.assigned_to.get_full_name() if t.assigned_to else 'Unassigned',

                'assigned_to_id': t.assigned_to_id,

                'due_date': t.due_date.isoformat() if t.due_date else None,

                'status': t.status,

                'is_mandatory': t.is_mandatory,

                'is_overdue': t.is_overdue,

                'stage_id': current_stage.id,

                'stage_name': current_stage.name,

            })



        count = len(incomplete_tasks)

        task_plural = "task" if count == 1 else "tasks"

        task_names = ", ".join(f"'{t.title}'" for t in incomplete_tasks[:3])

        if count > 3:

            task_names += f" and {count - 3} more"



        message = (

            f"Cannot advance to stage '{target_stage.name}': {count} mandatory {task_plural} "

            f"in '{current_stage.name}' ({task_names}) must be completed first."

        )

        return False, missing_details, message



    # Check Manager Approval policy on current stage

    if current_stage.require_manager_approval:

        if actor and getattr(actor, 'role', None) == 'EXECUTIVE' and not getattr(actor, 'is_superuser', False):

            message = (

                f"Cannot advance beyond '{current_stage.name}': This stage requires Manager approval. "

                f"Please ask a Manager or Admin to approve this stage transition."

            )

            return False, [{

                'code': 'manager_approval_required',

                'message': message,

                'stage_id': current_stage.id,

                'stage_name': current_stage.name,

            }], message







    # Check ICP Qualification policy if current stage is ICP
    if current_stage and (current_stage.slug.lower() == 'icp' or current_stage.name.lower() == 'icp'):
        if target_stage.display_order > current_stage.display_order:
            from icp.models import ICPStatus
            is_icp_qualified = lead.icp_status in [
                ICPStatus.POTENTIAL_FIT,
                ICPStatus.GOOD_FIT,
                ICPStatus.STRONG_ICP_FIT,
            ]
            if not is_icp_qualified:
                status_display = lead.get_icp_status_display() if hasattr(lead, 'get_icp_status_display') else lead.icp_status
                message = (
                    f"Cannot advance beyond '{current_stage.name}': ICP Qualification must be completed "
                    f"with a qualifying result first (Current status: {status_display})."
                )
                return False, [{
                    'id': 'icp_qualification_required',
                    'title': 'Complete & Pass ICP Qualification',
                    'purpose': 'ICP Qualification',
                    'priority': 'HIGH',
                    'assigned_to': lead.assigned_to.get_full_name() if lead.assigned_to else 'Unassigned',
                    'assigned_to_id': lead.assigned_to_id,
                    'status': 'PENDING',
                    'is_mandatory': True,
                    'is_overdue': False,
                    'stage_id': current_stage.id,
                    'stage_name': current_stage.name,
                    'code': 'icp_qualification_required',
                    'icp_status': lead.icp_status,
                }], message

    return True, [], ""





def instantiate_stage_tasks(lead, stage, actor=None):

    """

    Instantiates LeadStageTask records for `lead` when it transitions into `stage`.

    Checks active StageTaskRule entries for `stage` and creates both LeadStageTask

    and a synchronized FollowUp task.



    Prevents duplicate task generation if tasks for a rule already exist for this lead.

    """

    if not lead or not stage:

        return []



    from leads.models import LeadStage, LeadStageTask, StageTaskRule

    from followups.models import FollowUp



    if isinstance(stage, int):

        stage = LeadStage.objects.filter(pk=stage).first()

    elif isinstance(stage, str):

        stage = (

            LeadStage.objects.filter(slug__iexact=stage).first()

            or LeadStage.objects.filter(name__iexact=stage).first()

        )



    if not stage:

        return []



    rules = (

        StageTaskRule.objects.filter(stage=stage, is_active=True)

        .prefetch_related('round_robin_users')

        .select_related('stage', 'specific_user', 'fallback_user', 'created_by')

        .order_by('order', 'id')

    )



    if not rules.exists():

        return []



    created_tasks = []

    now = timezone.now()



    for rule in rules:

        try:

            # 1. Condition check: Priority filter

            if rule.priority_filter and rule.priority_filter != 'ALL':

                lead_priority = (lead.priority or '').upper()

                rule_priority = rule.priority_filter.upper()

                if lead_priority != rule_priority:

                    continue



            # 2. Condition check: Prevent duplicate task for this rule/stage

            if rule.prevent_duplicate:

                has_existing = lead.stage_tasks.filter(

                    stage=stage,

                    rule=rule

                ).exclude(status=LeadStageTask.Status.CANCELLED).exists()

                if has_existing:

                    continue



            # 3. Assignee Determination

            assignee = None

            strategy = rule.assignee_strategy



            if strategy == StageTaskRule.AssigneeStrategy.LEAD_OWNER:

                assignee = lead.assigned_to or rule.fallback_user or (actor if actor and actor.is_authenticated else None) or rule.created_by



            elif strategy == StageTaskRule.AssigneeStrategy.SPECIFIC_USER:

                assignee = rule.specific_user or rule.fallback_user or lead.assigned_to



            elif strategy == StageTaskRule.AssigneeStrategy.STAGE_MOVER:

                assignee = (actor if actor and actor.is_authenticated else None) or lead.assigned_to or rule.fallback_user



            elif strategy == StageTaskRule.AssigneeStrategy.LEAD_CREATOR:

                assignee = lead.created_by or lead.assigned_to or rule.fallback_user



            elif strategy == StageTaskRule.AssigneeStrategy.ROUND_ROBIN:

                active_pool = list(rule.round_robin_users.filter(is_active=True).order_by('id'))

                if not active_pool:

                    assignee = rule.fallback_user or lead.assigned_to or (actor if actor and actor.is_authenticated else None)

                else:

                    last_id = rule.last_round_robin_user_id

                    next_user = None

                    if last_id:

                        for i, u in enumerate(active_pool):

                            if u.id == last_id:

                                next_user = active_pool[(i + 1) % len(active_pool)]

                                break

                    if not next_user:

                        next_user = active_pool[0]



                    assignee = next_user

                    rule.last_round_robin_user = next_user

                    rule.save(update_fields=['last_round_robin_user'])



            if not assignee:

                assignee = rule.fallback_user or lead.assigned_to or (actor if actor and actor.is_authenticated else None) or rule.created_by



            # 4. Due Date Offset Calculation

            offset_val = max(1, rule.due_offset_value or 1)

            unit = rule.due_offset_unit



            if unit == StageTaskRule.OffsetUnit.MINUTES:

                delta = timedelta(minutes=offset_val)

            elif unit == StageTaskRule.OffsetUnit.HOURS:

                delta = timedelta(hours=offset_val)

            elif unit == StageTaskRule.OffsetUnit.WEEKS:

                delta = timedelta(weeks=offset_val)

            else:  # DAYS

                delta = timedelta(days=offset_val)



            due_datetime = now + delta



            # 5. Template & Description Rendering

            base_template = rule.description_template.strip() if rule.description_template else ""

            if not base_template:

                base_template = (

                    f"Task for {lead.name} in '{stage.name}' stage."

                )



            placeholders = {

                '{lead_name}': lead.name or '',

                '{company_name}': lead.company_name or 'N/A',

                '{phone}': lead.phone or 'N/A',

                '{email}': lead.email or 'N/A',

                '{stage_name}': stage.name,

                '{priority}': lead.priority or 'MEDIUM',

                '{expected_value}': f"${lead.expected_value:,.2f}" if lead.expected_value else "$0.00",

                '{assigned_to}': assignee.get_full_name() if assignee else 'Unassigned',

                '{rule_name}': rule.name,

            }



            rendered_desc = base_template

            for ph, val in placeholders.items():

                rendered_desc = rendered_desc.replace(ph, str(val))



            task_title = rule.title.strip() if rule.title and rule.title.strip() else rule.name



            # 6. Create synchronized FollowUp task for calendar & reminders

            followup = FollowUp.objects.create(

                lead=lead,

                assigned_to=assignee,

                follow_up_at=due_datetime,

                purpose=rule.purpose,

                status=FollowUp.Status.PENDING,

                notes=f"[{task_title}]\n{rendered_desc}"

            )



            # 7. Create LeadStageTask

            stage_task = LeadStageTask.objects.create(

                lead=lead,

                stage=stage,

                rule=rule,

                follow_up=followup,

                title=task_title,

                description=rendered_desc,

                purpose=rule.purpose,

                priority=rule.task_priority,

                assigned_to=assignee,

                due_date=due_datetime,

                status=LeadStageTask.Status.PENDING,

                is_mandatory=rule.is_mandatory,

                order=rule.order,

                requires_approval=rule.requires_approval

            )



            created_tasks.append(stage_task)



            # 8. Activity Log

            actor_user = actor if (actor and actor.is_authenticated) else None

            log_activity(

                entity_type=ActivityLog.EntityType.FOLLOW_UP,

                entity_id=followup.id,

                action=ActivityLog.ActionType.FOLLOW_UP_CREATED,

                new_value={

                    'task_id': stage_task.id,

                    'title': stage_task.title,

                    'is_mandatory': stage_task.is_mandatory,

                    'purpose': stage_task.purpose,

                    'assigned_to': assignee.get_full_name() if assignee else None,

                    'due_date': stage_task.due_date.isoformat(),

                    'stage': stage.name,

                },

                performed_by=actor_user,

                notes=(

                    f"Stage task '{stage_task.title}' ({'Mandatory' if stage_task.is_mandatory else 'Optional'}) "

                    f"assigned to {assignee.get_full_name() if assignee else 'Unassigned'} "

                    f"in {stage.name}."

                )

            )



            # 9. Notification

            try:

                NotificationService.notify_stage_task_assigned(task=stage_task, actor=actor_user, allow_self=True)

                NotificationService.notify_followup_created(followup=followup, actor=actor_user)

            except Exception as notif_err:

                logger.warning(f"[Progression] Notification error for task #{stage_task.id}: {notif_err}")



        except Exception as e:

            logger.exception(f"[Progression] Failed to instantiate rule #{rule.id} on Lead #{lead.id}: {e}")



    return created_tasks





def complete_stage_task(task, actor=None, outcome_notes=''):

    """

    Marks a stage task as COMPLETED, records audit details,

    synchronizes the linked FollowUp, and returns the updated task.

    """

    from leads.models import LeadStageTask

    from followups.models import FollowUp



    now = timezone.now()

    task.status = LeadStageTask.Status.COMPLETED

    task.completed_at = now

    task.completed_by = actor if (actor and actor.is_authenticated) else None

    if outcome_notes:

        task.outcome_notes = outcome_notes

    task.save(update_fields=['status', 'completed_at', 'completed_by', 'outcome_notes', 'updated_at'])



    # Synchronize linked follow-up

    if task.follow_up:

        task.follow_up.status = FollowUp.Status.COMPLETED

        task.follow_up.completed_at = now

        if outcome_notes:

            task.follow_up.outcome = outcome_notes

        task.follow_up.save(update_fields=['status', 'completed_at', 'outcome', 'updated_at'])



    actor_user = actor if (actor and actor.is_authenticated) else None

    log_activity(

        entity_type='stage_task',

        entity_id=task.id,

        action='stage_task_completed',

        new_value={

            'title': task.title,

            'is_mandatory': task.is_mandatory,

            'completed_by': actor_user.get_full_name() if actor_user else 'System',

            'outcome': outcome_notes,

        },

        performed_by=actor_user,

        notes=f"Completed stage task '{task.title}' for Lead #{task.lead_id} ({task.stage.name})."

    )

    try:
        from notifications.services import NotificationService
        NotificationService.notify_stage_task_completed(task=task, actor=actor_user)
        if getattr(task, 'requires_approval', False) and not getattr(task, 'is_approved', False):
            NotificationService.notify_stage_task_approval_requested(task=task, actor=actor_user)
    except Exception as notif_err:
        logger.warning(f"[Progression] Notification error on completing task #{task.id}: {notif_err}")

    return task





def reopen_stage_task(task, actor=None):

    """

    Reopens a completed stage task back to PENDING.

    Revokes progression eligibility if the lead is still in this stage.

    """

    from leads.models import LeadStageTask

    from followups.models import FollowUp



    task.status = LeadStageTask.Status.PENDING

    task.completed_at = None

    task.completed_by = None

    task.save(update_fields=['status', 'completed_at', 'completed_by', 'updated_at'])



    if task.follow_up:

        task.follow_up.status = FollowUp.Status.PENDING

        task.follow_up.completed_at = None

        task.follow_up.save(update_fields=['status', 'completed_at', 'updated_at'])



    actor_user = actor if (actor and actor.is_authenticated) else None

    log_activity(

        entity_type='stage_task',

        entity_id=task.id,

        action='stage_task_reopened',

        new_value={

            'title': task.title,

            'is_mandatory': task.is_mandatory,

            'reopened_by': actor_user.get_full_name() if actor_user else 'System',

        },

        performed_by=actor_user,

        notes=f"Reopened stage task '{task.title}' for Lead #{task.lead_id} ({task.stage.name})."

    )

    return task



