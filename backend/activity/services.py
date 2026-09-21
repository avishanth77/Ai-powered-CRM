import logging
from .models import ActivityLog

logger = logging.getLogger(__name__)

def log_activity(entity_type, entity_id, action, old_value=None, new_value=None, performed_by=None, notes=None):
    """
    Utility service to create an ActivityLog entry.
    """
    try:
        log_entry = ActivityLog.objects.create(
            entity_type=entity_type,
            entity_id=str(entity_id),
            action=action,
            old_value=old_value,
            new_value=new_value,
            performed_by=performed_by,
            notes=notes
        )
        return log_entry
    except Exception as e:
        logger.error(f"Failed to log activity for {entity_type} {entity_id}: {e}", exc_info=True)
        return None
