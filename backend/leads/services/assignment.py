import logging
from django.db import models, transaction
from accounts.models import User
from activity.models import ActivityLog
from activity.services import log_activity
from notifications.services.notification_service import NotificationService
from leads.models import Lead, LeadAssignmentConfig, LeadAssignmentRule

logger = logging.getLogger(__name__)


def _pick_salesman(strategy, specific_user, pool_qs, last_assigned_user, fallback_user):
    """
    Selects a salesman based on the configured strategy and candidate pool.
    """
    if strategy == LeadAssignmentConfig.Strategy.SPECIFIC_USER:
        if specific_user and specific_user.is_active:
            return specific_user
        if fallback_user and fallback_user.is_active:
            return fallback_user
        return None

    # Get active candidates in the pool
    candidates = list(pool_qs.filter(is_active=True).order_by('id'))
    if not candidates:
        # Default to all active Sales Executives if pool is empty
        candidates = list(User.objects.filter(role=User.Role.EXECUTIVE, is_active=True).order_by('id'))

    if not candidates:
        # Fall back to designated fallback or first active manager/admin
        if fallback_user and fallback_user.is_active:
            return fallback_user
        return User.objects.filter(role__in=[User.Role.MANAGER, User.Role.ADMIN], is_active=True).first()

    if strategy == LeadAssignmentConfig.Strategy.ROUND_ROBIN:
        if last_assigned_user and last_assigned_user in candidates:
            current_idx = candidates.index(last_assigned_user)
            next_user = candidates[(current_idx + 1) % len(candidates)]
        else:
            next_user = candidates[0]
        return next_user

    elif strategy == LeadAssignmentConfig.Strategy.LEAST_LOADED:
        candidate_ids = [u.id for u in candidates]
        ranked = (
            User.objects.filter(id__in=candidate_ids, is_active=True)
            .annotate(
                active_count=models.Count(
                    'assigned_leads',
                    filter=~models.Q(assigned_leads__stage__slug__in=['won', 'lost'])
                )
            )
            .order_by('active_count', 'id')
        )
        return ranked.first() or candidates[0]

    return candidates[0]


def assign_lead_to_salesman(lead, channel='manual', product=None, actor=None, commit=True, force=False):
    """
    Evaluates auto-assignment configuration and custom routing rules to assign
    a lead to the appropriate salesman.

    Channels:
    - 'web_to_lead': Public contact / website inquiry form
    - 'csv_import': Bulk lead import from CSV
    - 'manual': Lead created via CRM UI
    - 'api': External API integration

    Returns:
    - Assigned User instance, or None if assignment is disabled or no candidate available.
    """
    if not lead:
        return None

    # If lead is already assigned and not forcing reassignment, leave as is
    if lead.assigned_to and not force:
        return lead.assigned_to

    config = LeadAssignmentConfig.get_solo()
    if not config.is_enabled:
        logger.info(f"[AutoAssign] Auto-assignment disabled globally. Lead #{lead.id} remains unassigned.")
        return None

    # Check channel toggles
    if channel == 'web_to_lead' and not config.auto_assign_web_to_lead:
        return None
    if channel == 'csv_import' and not config.auto_assign_csv_import:
        return None
    if channel == 'manual' and not config.auto_assign_manual_create:
        return None

    # Check custom routing rules
    matched_rule = None
    active_rules = LeadAssignmentRule.objects.filter(is_active=True).order_by('order', 'id').prefetch_related('salesmen_pool')

    lead_source = getattr(lead, 'source', None)
    lead_type = getattr(lead, 'lead_type', '') or ''
    lead_country = getattr(lead, 'country', '') or ''

    for rule in active_rules:
        # Match source
        if rule.source_id and lead_source and rule.source_id != lead_source.id:
            continue
        if rule.source_id and not lead_source:
            continue

        # Match lead_type
        if rule.lead_type and lead_type and rule.lead_type.upper() != lead_type.upper():
            continue
        if rule.lead_type and not lead_type:
            continue

        # Match country
        if rule.country:
            if not lead_country or rule.country.lower() not in lead_country.lower():
                continue

        # Match product
        if rule.product_id:
            rule_prod_id = rule.product_id
            has_prod = False
            if product and getattr(product, 'id', None) == rule_prod_id:
                has_prod = True
            elif hasattr(lead, 'lead_products') and lead.lead_products.filter(product_id=rule_prod_id).exists():
                has_prod = True
            if not has_prod:
                continue

        # All defined criteria on this rule matched
        matched_rule = rule
        break

    target_user = None
    with transaction.atomic():
        if matched_rule:
            target_user = _pick_salesman(
                strategy=matched_rule.strategy,
                specific_user=matched_rule.specific_user,
                pool_qs=matched_rule.salesmen_pool.all(),
                last_assigned_user=matched_rule.last_assigned_user,
                fallback_user=config.fallback_user
            )
            if target_user:
                matched_rule.last_assigned_user = target_user
                matched_rule.save(update_fields=['last_assigned_user'])
        else:
            target_user = _pick_salesman(
                strategy=config.strategy,
                specific_user=config.specific_user,
                pool_qs=config.salesmen_pool.all(),
                last_assigned_user=config.last_assigned_user,
                fallback_user=config.fallback_user
            )
            if target_user:
                config.last_assigned_user = target_user
                config.save(update_fields=['last_assigned_user'])

        if not target_user:
            logger.warning(f"[AutoAssign] No eligible salesman could be found for lead #{lead.id}.")
            return None

        lead.assigned_to = target_user
        if commit and getattr(lead, 'pk', None):
            lead.save(update_fields=['assigned_to', 'updated_at'])

        # Notify assigned salesman
        if config.notify_salesman:
            try:
                NotificationService.notify_lead_assigned(
                    lead=lead,
                    assignee=target_user,
                    actor=actor
                )
            except Exception as ex:
                logger.warning(f"[AutoAssign] Failed to dispatch assignment notification: {ex}")

        # Activity log
        try:
            rule_label = f"Rule: '{matched_rule.name}'" if matched_rule else f"Global Strategy: {config.get_strategy_display()}"
            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=lead.id,
                action=ActivityLog.ActionType.LEAD_ASSIGNED,
                new_value={
                    'assigned_to': target_user.get_full_name() or target_user.email,
                    'strategy': matched_rule.strategy if matched_rule else config.strategy,
                    'rule': matched_rule.name if matched_rule else 'Global Default',
                    'channel': channel,
                },
                performed_by=actor,
                notes=f"Auto-assigned to {target_user.get_full_name() or target_user.email} via {rule_label}"
            )
        except Exception as ex:
            logger.warning(f"[AutoAssign] Failed to write activity log: {ex}")

    logger.info(f"[AutoAssign] Lead #{lead.id} successfully assigned to {target_user.email} ({channel})")
    return target_user

