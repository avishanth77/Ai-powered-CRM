import React from 'react';
import { LEAD_PRIORITY_CONFIG } from '../utils/constants';

export const PriorityBadge = ({ priority }) => {
  const config = LEAD_PRIORITY_CONFIG[priority] || {
    label: priority,
    color: '#64748b',
    bg: '#f1f5f9',
  };

  return (
    <span
      className="priority-badge"
      style={{
        color: config.color,
        backgroundColor: config.bg,
      }}
    >
      {config.label}
    </span>
  );
};
