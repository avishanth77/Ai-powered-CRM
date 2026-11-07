import React from 'react';
import { Inbox, RefreshCw, PlusCircle, SearchX } from 'lucide-react';

/**
 * Standardized SaaS 5-State Empty State component.
 * Clear copy: States what this is, why it's empty, and provides one clear primary action.
 */
export const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No records found',
  message = 'There are currently no items to display in this view.',
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = 'default', // 'default' | 'search-no-results' | 'clean'
}) => {
  const ResolvedIcon = variant === 'search-no-results' ? SearchX : Icon;

  return (
    <div className={`empty-state-box empty-state-${variant}`} role="status">
      <div className="empty-state-icon">
        <ResolvedIcon size={36} aria-hidden="true" />
      </div>

      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-message">{message}</p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="empty-state-actions">
          {actionLabel && onAction && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onAction}
            >
              {variant === 'default' && !actionLabel.includes('+') ? (
                <PlusCircle size={16} aria-hidden="true" />
              ) : null}
              <span>{actionLabel}</span>
            </button>
          )}

          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onSecondaryAction}
            >
              <RefreshCw size={14} aria-hidden="true" />
              <span>{secondaryActionLabel}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
