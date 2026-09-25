import logging
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

    @staticmethod
    def create_notification(
        recipient,
        notification_type,
        title,
        message,
        entity_type=None,
        entity_id=None,
        action_url=None,
        actor=None,
        priority=Notification.Priority.NORMAL
    ):
        """
        Creates an in-app notification record safely.
        Skips if recipient is missing, inactive, or if actor == recipient.
        """
        if not recipient:
            return None

        # Do not notify an inactive user
        if hasattr(recipient, 'is_active') and not recipient.is_active:
            return None

        # Do not create self-notifications for own actions
        if actor and recipient.id == actor.id:
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
    def notify_mention(cls, mentioned_user, actor, lead, comment_text, comment_id=None):
        """
        Notifies a user when they are @mentioned in an internal team comment.
        """
        if not mentioned_user:
            return None

        actor_name = actor.get_full_name() or actor.email if actor else "A team member"
        lead_name = lead.name if hasattr(lead, 'name') else f"Lead #{lead.id if hasattr(lead, 'id') else ''}"

        title = f"You were mentioned by {actor_name}"
        snippet = f'"{comment_text[:120]}..."' if len(comment_text) > 120 else f'"{comment_text}"'
        message = f"{actor_name} mentioned you in an internal comment on {lead_name}: {snippet}"
        action_url = f"/leads/{lead.id}?tab=comments"

        return cls.create_notification(
            recipient=mentioned_user,
            notification_type=Notification.NotificationType.INTERNAL_MENTION,
            title=title,
            message=message,
            entity_type='lead',
            entity_id=lead.id,
            action_url=action_url,
            actor=actor,
            priority=Notification.Priority.HIGH
        )

    @classmethod
    def notify_internal_comment(cls, lead, actor, comment_text, comment_id=None):
        """
        Notifies the lead assignee when another team member adds an internal comment.
        """
        recipient = getattr(lead, 'assigned_to', None)
        if not recipient or (actor and recipient.id == actor.id):
            return None

        actor_name = actor.get_full_name() or actor.email if actor else "A team member"
        title = f"New Internal Comment on {lead.name}"
        snippet = f'"{comment_text[:120]}..."' if len(comment_text) > 120 else f'"{comment_text}"'
        message = f"{actor_name} commented on your lead {lead.name}: {snippet}"
        action_url = f"/leads/{lead.id}?tab=comments"

        return cls.create_notification(
            recipient=recipient,
            notification_type=Notification.NotificationType.INTERNAL_COMMENT,
            title=title,
            message=message,
            entity_type='lead',
            entity_id=lead.id,
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
