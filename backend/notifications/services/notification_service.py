import logging
from datetime import datetime, timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model
from notifications.models import Notification

User = get_user_model()
logger = logging.getLogger(__name__)


class NotificationService:
    """
    Centralized service for dispatching, retrieving, and updating in-app notifications.
    Ensures safe creation, avoids self-notifications, and enforces business event consistency.
    """

    @classmethod
    def create_notification(
        cls,
        recipient,
        notification_type,
        title,
        message,
        entity_type=None,
        entity_id=None,
        action_url=None,
        actor=None,
        priority=Notification.Priority.NORMAL,
        allow_self=False
    ):
        """
        Creates an in-app notification record safely.
        Skips if recipient is missing, inactive, or if actor == recipient (unless allow_self=True).
        """
        if not recipient:
            return None

        # Do not notify an inactive user
        if hasattr(recipient, 'is_active') and not recipient.is_active:
            return None

        # Do not create self-notifications for own actions unless explicitly allowed
        if not allow_self and actor and recipient.id == actor.id:
            return None

        try:
            notification = Notification.objects.create(
                recipient=recipient,
                actor=actor,
                notification_type=notification_type,
                title=title[:255],
                message=message,
                entity_type=str(entity_type).lower() if entity_type else None,
                entity_id=str(entity_id) if entity_id else None,
                action_url=action_url,
                priority=priority,
            )

            # Proactively dispatch alert to Telegram if recipient has linked account
            try:
                from telegram_bot.services.telegram_dispatcher import TelegramNotificationDispatcher
                TelegramNotificationDispatcher.dispatch(notification)
            except Exception as te:
                logger.debug(f"[NotificationService] Telegram dispatch skipped: {te}")

            return notification
        except Exception as e:
            logger.error(f"[NotificationService] Failed to create notification for {recipient.email}: {e}", exc_info=True)
            return None

    @classmethod
    def notify_lead_assigned(cls, lead, assignee, actor=None):
        """
        Notifies a sales executive that a new lead has been assigned to them.
        """
        if not assignee:
            return None

        actor_name = actor.get_full_name() or actor.email if actor else "The system"
        lead_display = lead.name or f"Lead #{lead.id}"
        company_display = f" ({lead.company_name})" if lead.company_name else ""

        title = "New Lead Assigned"
        message = f"{lead_display}{company_display} was assigned to you by {actor_name}."
        action_url = f"/leads/{lead.id}"

        return cls.create_notification(
            recipient=assignee,
            notification_type=Notification.NotificationType.LEAD_ASSIGNED,
            title=title,
            message=message,
            entity_type='lead',
            entity_id=lead.id,
            action_url=action_url,
            actor=actor,
            priority=Notification.Priority.HIGH
        )

    @classmethod
    def notify_lead_handed_over(cls, lead, new_assignee, old_assignee=None, handed_over_by=None, reason=None):
        """
        Notifies the new executive that a lead was handed over to them.
        """
        if not new_assignee:
            return None

        actor_name = handed_over_by.get_full_name() or handed_over_by.email if handed_over_by else "A manager"
        old_name = old_assignee.get_full_name() or old_assignee.email if old_assignee else "previous owner"
        lead_display = lead.name or f"Lead #{lead.id}"
        company_display = f" ({lead.company_name})" if lead.company_name else ""

        reason_text = f' Reason: "{reason}"' if reason else ""
        title = "Lead Handed Over To You"
        message = f"{lead_display}{company_display} was transferred to you from {old_name} by {actor_name}.{reason_text}"
        action_url = f"/leads/{lead.id}"

        return cls.create_notification(
            recipient=new_assignee,
            notification_type=Notification.NotificationType.LEAD_HANDED_OVER,
            title=title,
            message=message,
            entity_type='lead',
            entity_id=lead.id,
            action_url=action_url,
            actor=handed_over_by,
            priority=Notification.Priority.HIGH
        )

    @classmethod
    def notify_stage_change(cls, lead, old_stage, new_stage, actor=None):
        """
        Notifies lead owner if a manager or admin changes their lead's stage.
        """
        recipient = lead.assigned_to
        if not recipient or (actor and recipient.id == actor.id):
            return None

        actor_name = actor.get_full_name() or actor.email if actor else "System"
        old_name = old_stage.name if hasattr(old_stage, 'name') else str(old_stage)
        new_name = new_stage.name if hasattr(new_stage, 'name') else str(new_stage)

        title = f"Lead Stage Changed: {new_name}"
        message = f"{lead.name} stage was moved from '{old_name}' to '{new_name}' by {actor_name}."
        action_url = f"/leads/{lead.id}"

        return cls.create_notification(
            recipient=recipient,
            notification_type=Notification.NotificationType.LEAD_STAGE_CHANGED,
            title=title,
            message=message,
            entity_type='lead',
            entity_id=lead.id,
            action_url=action_url,
            actor=actor
        )

    @classmethod
    def notify_followup_created(cls, followup, actor=None):
        """
        Notifies assignee when a follow-up task is scheduled for them.
        """
        recipient = followup.assigned_to
        if not recipient or (actor and recipient.id == actor.id):
            return None

        target_name = (
            followup.lead.name if followup.lead
            else (followup.customer.name if followup.customer else "Client")
        )
        time_str = followup.follow_up_at.strftime('%b %d, %Y at %I:%M %p')
        title = f"Follow-up Scheduled: {followup.purpose}"
        message = f"New {followup.purpose} with {target_name} scheduled for {time_str}."
        action_url = "/follow-ups"

        return cls.create_notification(
            recipient=recipient,
            notification_type=Notification.NotificationType.FOLLOW_UP_CREATED,
            title=title,
            message=message,
            entity_type='followup',
            entity_id=followup.id,
            action_url=action_url,
            actor=actor
        )

    @classmethod
    def notify_followup_due(cls, followup):
        """
        Notifies the assigned rep 30 minutes before or when follow-up is due.
        """
        recipient = followup.assigned_to
        if not recipient:
            return None

        target_name = (
            followup.lead.name if followup.lead
            else (followup.customer.name if followup.customer else "Client")
        )
        time_str = followup.follow_up_at.strftime('%I:%M %p')
        title = f"Follow-up Due: {followup.purpose}"
        message = f"Reminder: Scheduled {followup.purpose} with {target_name} at {time_str}."
        action_url = "/follow-ups"

        return cls.create_notification(
            recipient=recipient,
            notification_type=Notification.NotificationType.FOLLOW_UP_DUE_SOON,
            title=title,
            message=message,
            entity_type='followup',
            entity_id=followup.id,
            action_url=action_url,
            priority=Notification.Priority.HIGH
        )

    @classmethod
    def notify_followup_overdue(cls, followup):
        """
        Notifies rep when a scheduled follow-up becomes overdue.
        """
        recipient = followup.assigned_to
        if not recipient:
            return None

        target_name = (
            followup.lead.name if followup.lead
            else (followup.customer.name if followup.customer else "Client")
        )
        title = f"Follow-up Overdue: {followup.purpose}"
        message = f"Action Required: {followup.purpose} with {target_name} is overdue. Please complete or reschedule."
        action_url = "/follow-ups"

        return cls.create_notification(
            recipient=recipient,
            notification_type=Notification.NotificationType.FOLLOW_UP_OVERDUE,
            title=title,
            message=message,
            entity_type='followup',
            entity_id=followup.id,
            action_url=action_url,
            priority=Notification.Priority.URGENT
        )

    @classmethod
    def notify_followup_completed(cls, followup, actor=None):
        """
        Notifies the lead creator or supervisor when an important follow-up is completed with outcome.
        """
        if not followup.lead or not followup.lead.created_by:
            return None

        recipient = followup.lead.created_by
        if actor and recipient.id == actor.id:
            return None

        actor_name = actor.get_full_name() or actor.email if actor else "Assigned rep"
        title = f"Follow-up Completed: {followup.lead.name}"
        outcome_snippet = f' Outcome: "{followup.outcome[:80]}..."' if followup.outcome else ""
        message = f"{actor_name} completed {followup.purpose} for {followup.lead.name}.{outcome_snippet}"
        action_url = f"/leads/{followup.lead_id}"

        return cls.create_notification(
            recipient=recipient,
            notification_type=Notification.NotificationType.FOLLOW_UP_COMPLETED,
            title=title,
            message=message,
            entity_type='lead',
            entity_id=followup.lead_id,
            action_url=action_url,
            actor=actor
        )

    @classmethod
    def notify_customer_conversion(cls, customer, actor=None):
        """
        Notifies the original lead creator or managers when a lead converts to customer.
        """
        lead = customer.lead
        recipients = set()

        if lead and lead.created_by and lead.created_by.is_active:
            recipients.add(lead.created_by)
        if lead and lead.assigned_to and lead.assigned_to.is_active:
            recipients.add(lead.assigned_to)

        actor_name = actor.get_full_name() or actor.email if actor else "Sales Team"
        title = f"Lead Converted to Customer: {customer.name}"
        message = f"Congratulations! {customer.name} was successfully converted into an active Customer Account by {actor_name}."
        action_url = f"/customers/{customer.id}"

        for r in recipients:
            if actor and r.id == actor.id:
                continue
            cls.create_notification(
                recipient=r,
                notification_type=Notification.NotificationType.CUSTOMER_CONVERTED,
                title=title,
                message=message,
                entity_type='customer',
                entity_id=customer.id,
                action_url=action_url,
                actor=actor,
                priority=Notification.Priority.HIGH
            )

    @classmethod
    def notify_mention(cls, mentioned_user=None, actor=None, lead=None, comment_text=None, comment_id=None, comment=None):
        """
        Notifies a user when they are @mentioned in an internal team comment.
        """
        if comment:
            lead = lead or comment.lead
            actor = actor or comment.author
            comment_text = comment_text or comment.content
            comment_id = comment_id or comment.id

        if not mentioned_user:
            return None

        actor_name = actor.get_full_name() or actor.email if actor else "A team member"
        lead_name = lead.name if hasattr(lead, 'name') else f"Lead #{getattr(lead, 'id', '')}"

        title = f"{actor_name} mentioned you in a comment"
        snippet = f'"{comment_text[:120]}..."' if comment_text and len(comment_text) > 120 else f'"{comment_text or ""}"'
        message = f"{actor_name} mentioned you in an internal comment on {lead_name}: {snippet}"
        action_url = f"/leads/{lead.id}?tab=comments" if lead else "/leads"

        return cls.create_notification(
            recipient=mentioned_user,
            notification_type=Notification.NotificationType.INTERNAL_MENTION,
            title=title,
            message=message,
            entity_type='lead',
            entity_id=getattr(lead, 'id', None),
            action_url=action_url,
            actor=actor,
            priority=Notification.Priority.HIGH
        )

    @classmethod
    def notify_internal_comment(cls, lead=None, actor=None, comment_text=None, comment_id=None, comment=None, parent_comment=None, recipient=None):
        """
        Notifies the lead assignee or parent comment author when another team member adds/replies with an internal comment.
        """
        if comment:
            lead = lead or comment.lead
            actor = actor or comment.author
            comment_text = comment_text or comment.content
            comment_id = comment_id or comment.id
            if parent_comment and not recipient:
                recipient = parent_comment.author

        if not recipient and lead:
            recipient = getattr(lead, 'assigned_to', None)

        if not recipient or (actor and recipient.id == actor.id):
            return None

        actor_name = actor.get_full_name() or actor.email if actor else "A team member"
        lead_name = getattr(lead, 'name', f"Lead #{getattr(lead, 'id', '')}") if lead else "Lead"
        title = f"New Internal Comment from {actor_name}"
        snippet = f'"{comment_text[:120]}..."' if comment_text and len(comment_text) > 120 else f'"{comment_text or ""}"'
        message = f"{actor_name} commented on {lead_name}: {snippet}"
        action_url = f"/leads/{lead.id}?tab=comments" if lead else "/leads"

        return cls.create_notification(
            recipient=recipient,
            notification_type=Notification.NotificationType.INTERNAL_COMMENT,
            title=title,
            message=message,
            entity_type='lead',
            entity_id=getattr(lead, 'id', None),
            action_url=action_url,
            actor=actor
        )

    @staticmethod
    def get_unread_count(user):
        """
        Returns unread notification count for authenticated user.
        """
        if not user or not user.is_authenticated:
            return 0
        return Notification.objects.filter(recipient=user, is_read=False).count()

    @staticmethod
    def mark_all_as_read(user):
        """
        Marks all unread notifications for user as read.
        """
        if not user or not user.is_authenticated:
            return 0
        updated = Notification.objects.filter(recipient=user, is_read=False).update(
            is_read=True,
            read_at=timezone.now()
        )
        return updated

    @staticmethod
    def mark_as_read(notification_id, user):
        """
        Marks a specific notification as read, ensuring it belongs to the user.
        """
        if not user or not user.is_authenticated:
            return None
        notification = Notification.objects.filter(id=notification_id, recipient=user).first()
        if notification:
            notification.mark_as_read()
            return notification
        return None

    @classmethod
    def sync_user_followups(cls, user):
        """
        Scans pending follow-ups for the user and generates overdue or due-soon notifications
        if not already present. Also guarantees new/unseeded users receive initial system alerts.
        """
        if not user or not user.is_authenticated:
            return

        from followups.models import FollowUp
        now = timezone.now()
        upcoming_window = now + timedelta(days=2)

        # 1. Overdue follow-ups
        overdue_qs = FollowUp.objects.filter(
            assigned_to=user,
            status=FollowUp.Status.PENDING,
            follow_up_at__lt=now
        ).select_related('lead', 'customer')

        for fu in overdue_qs:
            exists = Notification.objects.filter(
                recipient=user,
                notification_type=Notification.NotificationType.FOLLOW_UP_OVERDUE,
                entity_type='followup',
                entity_id=str(fu.id)
            ).exists()

            if not exists:
                target_name = fu.lead.name if fu.lead else (fu.customer.name if fu.customer else 'Client')
                target_url = f"/leads/{fu.lead.id}" if fu.lead else (f"/customers/{fu.customer.id}" if fu.customer else "/follow-ups")
                cls.create_notification(
                    recipient=user,
                    notification_type=Notification.NotificationType.FOLLOW_UP_OVERDUE,
                    title="Follow-up Overdue",
                    message=f"Overdue: {fu.purpose.capitalize()} with {target_name} was scheduled for {fu.follow_up_at.strftime('%b %d, %H:%M')}.",
                    entity_type='followup',
                    entity_id=fu.id,
                    action_url=target_url,
                    priority=Notification.Priority.URGENT,
                    actor=None,
                    allow_self=True
                )

        # 2. Due soon follow-ups (next 48 hours)
        due_soon_qs = FollowUp.objects.filter(
            assigned_to=user,
            status=FollowUp.Status.PENDING,
            follow_up_at__range=(now, upcoming_window)
        ).select_related('lead', 'customer')

        for fu in due_soon_qs:
            exists = Notification.objects.filter(
                recipient=user,
                notification_type=Notification.NotificationType.FOLLOW_UP_DUE_SOON,
                entity_type='followup',
                entity_id=str(fu.id)
            ).exists()

            if not exists:
                target_name = fu.lead.name if fu.lead else (fu.customer.name if fu.customer else 'Client')
                target_url = f"/leads/{fu.lead.id}" if fu.lead else (f"/customers/{fu.customer.id}" if fu.customer else "/follow-ups")
                cls.create_notification(
                    recipient=user,
                    notification_type=Notification.NotificationType.FOLLOW_UP_DUE_SOON,
                    title=f"Upcoming {fu.purpose.capitalize()}",
                    message=f"Scheduled {fu.purpose.capitalize()} with {target_name} on {fu.follow_up_at.strftime('%b %d at %H:%M')}.",
                    entity_type='followup',
                    entity_id=fu.id,
                    action_url=target_url,
                    priority=Notification.Priority.HIGH,
                    actor=None,
                    allow_self=True
                )

        # 3. For Admin / Manager, notify about team overdue follow-ups
        user_role = getattr(user, 'role', '')
        if user_role in ['ADMIN', 'MANAGER']:
            system_overdue = FollowUp.objects.filter(
                status=FollowUp.Status.PENDING,
                follow_up_at__lt=now
            ).exclude(assigned_to=user).select_related('lead', 'assigned_to')[:5]

            for s_fu in system_overdue:
                s_exists = Notification.objects.filter(
                    recipient=user,
                    notification_type=Notification.NotificationType.FOLLOW_UP_OVERDUE,
                    entity_type='followup',
                    entity_id=str(s_fu.id)
                ).exists()
                if not s_exists:
                    rep_name = s_fu.assigned_to.get_full_name() or s_fu.assigned_to.email if s_fu.assigned_to else "Unassigned"
                    target_name = s_fu.lead.name if s_fu.lead else "Client"
                    cls.create_notification(
                        recipient=user,
                        notification_type=Notification.NotificationType.FOLLOW_UP_OVERDUE,
                        title=f"Team Overdue: {s_fu.purpose.capitalize()}",
                        message=f"{rep_name}'s {s_fu.purpose} with {target_name} is overdue ({s_fu.follow_up_at.strftime('%b %d')}).",
                        entity_type='followup',
                        entity_id=s_fu.id,
                        action_url="/calendar",
                        priority=Notification.Priority.HIGH,
                        actor=None,
                        allow_self=True
                    )

        # Synchronize stage tasks (overdue & due-soon)
        cls.sync_user_tasks(user)

    @classmethod
    def notify_stage_task_assigned(cls, task, actor=None, allow_self=False):
        """
        Notifies a user when a lead stage task is assigned or reassigned to them.
        """
        recipient = getattr(task, 'assigned_to', None)
        if not recipient:
            return None

        actor_name = actor.get_full_name() or actor.email if actor else "Automated Progression"
        lead_name = task.lead.name if getattr(task, 'lead', None) else f"Lead #{task.lead_id}"
        stage_name = task.stage.name if getattr(task, 'stage', None) else "Pipeline"
        due_str = task.due_date.strftime('%b %d at %H:%M') if getattr(task, 'due_date', None) else "No due date"

        title = f"Task Assigned: {task.title}"
        prefix = "Mandatory stage task" if getattr(task, 'is_mandatory', False) else "Stage task"
        message = f"{prefix} '{task.title}' for {lead_name} ({stage_name}) was assigned to you by {actor_name}. Due: {due_str}."
        action_url = f"/leads/{task.lead_id}?tab=stage-tasks"

        return cls.create_notification(
            recipient=recipient,
            notification_type=Notification.NotificationType.STAGE_TASK_ASSIGNED,
            title=title,
            message=message,
            entity_type='stage_task',
            entity_id=task.id,
            action_url=action_url,
            actor=actor,
            priority=Notification.Priority.HIGH if getattr(task, 'is_mandatory', False) else Notification.Priority.NORMAL,
            allow_self=allow_self
        )

    @classmethod
    def notify_stage_task_completed(cls, task, actor=None):
        """
        Notifies the lead owner or creator when a stage task is completed.
        """
        lead = getattr(task, 'lead', None)
        if not lead:
            return None

        recipient = None
        if lead.assigned_to and (not actor or lead.assigned_to.id != actor.id):
            recipient = lead.assigned_to
        elif lead.created_by and (not actor or lead.created_by.id != actor.id):
            recipient = lead.created_by

        if not recipient:
            return None

        actor_name = actor.get_full_name() or actor.email if actor else "Sales Rep"
        lead_name = lead.name or f"Lead #{lead.id}"
        stage_name = task.stage.name if getattr(task, 'stage', None) else "Pipeline"

        title = f"Task Completed: {task.title}"
        outcome_snippet = f' Notes: "{task.outcome_notes[:80]}..."' if getattr(task, 'outcome_notes', None) else ""
        message = f"{actor_name} completed task '{task.title}' on {lead_name} ({stage_name}).{outcome_snippet}"
        action_url = f"/leads/{task.lead_id}?tab=stage-tasks"

        return cls.create_notification(
            recipient=recipient,
            notification_type=Notification.NotificationType.STAGE_TASK_COMPLETED,
            title=title,
            message=message,
            entity_type='stage_task',
            entity_id=task.id,
            action_url=action_url,
            actor=actor,
            priority=Notification.Priority.NORMAL
        )

    @classmethod
    def notify_stage_task_approval_requested(cls, task, actor=None):
        """
        Notifies managers and admins when a stage task requiring approval is completed.
        """
        lead = getattr(task, 'lead', None)
        lead_name = lead.name if lead else f"Lead #{task.lead_id}"
        stage_name = task.stage.name if getattr(task, 'stage', None) else "Pipeline"
        actor_name = actor.get_full_name() or actor.email if actor else "Sales Rep"

        managers = User.objects.filter(
            role__in=[User.Role.MANAGER, User.Role.ADMIN],
            is_active=True
        )
        notifications = []
        for manager in managers:
            if actor and manager.id == actor.id:
                continue
            n = cls.create_notification(
                recipient=manager,
                notification_type=Notification.NotificationType.STAGE_TASK_APPROVAL_REQUESTED,
                title=f"Approval Required: {task.title}",
                message=f"{actor_name} completed task '{task.title}' on {lead_name} ({stage_name}) which requires manager approval.",
                entity_type='stage_task',
                entity_id=task.id,
                action_url=f"/leads/{task.lead_id}?tab=stage-tasks",
                actor=actor,
                priority=Notification.Priority.HIGH,
                allow_self=False
            )
            if n:
                notifications.append(n)
        return notifications

    @classmethod
    def sync_user_tasks(cls, user):
        """
        Scans pending stage tasks for the user and generates overdue or due-soon notifications.
        Also notifies managers of overdue stage tasks across the team.
        """
        if not user or not user.is_authenticated:
            return

        try:
            from leads.models import LeadStageTask
        except ImportError:
            return

        now = timezone.now()
        upcoming_window = now + timedelta(days=2)

        # 1. Overdue stage tasks for assigned user
        overdue_tasks = LeadStageTask.objects.filter(
            assigned_to=user,
            status__in=[LeadStageTask.Status.PENDING, LeadStageTask.Status.IN_PROGRESS],
            due_date__lt=now
        ).select_related('lead', 'stage')

        for task in overdue_tasks:
            exists = Notification.objects.filter(
                recipient=user,
                notification_type=Notification.NotificationType.STAGE_TASK_OVERDUE,
                entity_type='stage_task',
                entity_id=str(task.id)
            ).exists()

            if not exists:
                lead_name = task.lead.name if task.lead else f"Lead #{task.lead_id}"
                cls.create_notification(
                    recipient=user,
                    notification_type=Notification.NotificationType.STAGE_TASK_OVERDUE,
                    title=f"Task Overdue: {task.title}",
                    message=f"Action Required: Task '{task.title}' on {lead_name} is overdue (was due {task.due_date.strftime('%b %d, %H:%M')}).",
                    entity_type='stage_task',
                    entity_id=task.id,
                    action_url=f"/leads/{task.lead_id}?tab=stage-tasks",
                    priority=Notification.Priority.URGENT,
                    actor=None,
                    allow_self=True
                )

        # 2. Due soon stage tasks (next 48 hours)
        due_soon_tasks = LeadStageTask.objects.filter(
            assigned_to=user,
            status__in=[LeadStageTask.Status.PENDING, LeadStageTask.Status.IN_PROGRESS],
            due_date__range=(now, upcoming_window)
        ).select_related('lead', 'stage')

        for task in due_soon_tasks:
            exists = Notification.objects.filter(
                recipient=user,
                notification_type=Notification.NotificationType.STAGE_TASK_DUE_SOON,
                entity_type='stage_task',
                entity_id=str(task.id)
            ).exists()

            if not exists:
                lead_name = task.lead.name if task.lead else f"Lead #{task.lead_id}"
                cls.create_notification(
                    recipient=user,
                    notification_type=Notification.NotificationType.STAGE_TASK_DUE_SOON,
                    title=f"Task Due Soon: {task.title}",
                    message=f"Reminder: Task '{task.title}' on {lead_name} is due {task.due_date.strftime('%b %d at %H:%M')}.",
                    entity_type='stage_task',
                    entity_id=task.id,
                    action_url=f"/leads/{task.lead_id}?tab=stage-tasks",
                    priority=Notification.Priority.HIGH,
                    actor=None,
                    allow_self=True
                )

        # 3. For Admin / Manager, notify about team overdue stage tasks
        user_role = getattr(user, 'role', '')
        if user_role in ['ADMIN', 'MANAGER']:
            team_overdue = LeadStageTask.objects.filter(
                status__in=[LeadStageTask.Status.PENDING, LeadStageTask.Status.IN_PROGRESS],
                due_date__lt=now
            ).exclude(assigned_to=user).select_related('lead', 'assigned_to')[:5]

            for s_task in team_overdue:
                s_exists = Notification.objects.filter(
                    recipient=user,
                    notification_type=Notification.NotificationType.STAGE_TASK_OVERDUE,
                    entity_type='stage_task',
                    entity_id=str(s_task.id)
                ).exists()
                if not s_exists:
                    rep_name = s_task.assigned_to.get_full_name() or s_task.assigned_to.email if s_task.assigned_to else "Unassigned"
                    lead_name = s_task.lead.name if s_task.lead else f"Lead #{s_task.lead_id}"
                    cls.create_notification(
                        recipient=user,
                        notification_type=Notification.NotificationType.STAGE_TASK_OVERDUE,
                        title=f"Team Task Overdue: {s_task.title}",
                        message=f"{rep_name}'s task '{s_task.title}' on {lead_name} is overdue ({s_task.due_date.strftime('%b %d')}).",
                        entity_type='stage_task',
                        entity_id=s_task.id,
                        action_url=f"/leads/{s_task.lead_id}?tab=stage-tasks",
                        priority=Notification.Priority.HIGH,
                        actor=None,
                        allow_self=True
                    )
