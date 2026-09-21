import React from 'react';
import { Inbox } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No records found',
  message = 'There are no items matching your criteria at this moment.',
  actionLabel,
  onAction,
}) => {
  return (
    <div className="empty-state-box">
      <div className="empty-state-icon">
        <Icon size={40} />
      </div>
      <h4 className="empty-state-title">{title}</h4>
      <p className="empty-state-message">{message}</p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary mt-3" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};
