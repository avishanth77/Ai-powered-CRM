import React from 'react';
import { LEAD_STATUS_CONFIG, FOLLOWUP_STATUS_CONFIG } from '../utils/constants';

export const StatusBadge = ({ status, type = 'lead' }) => {
  const config =
    type === 'lead'
      ? LEAD_STATUS_CONFIG[status] || { label: status, color: '#64748b', bg: '#f1f5f9' }
      : FOLLOWUP_STATUS_CONFIG[status] || { label: status, color: '#64748b', bg: '#f1f5f9' };

  return (
    <span
      className="status-badge"
      style={{
        color: config.color,
        backgroundColor: config.bg,
        borderColor: config.border || 'transparent',
      }}
    >
      <span className="badge-dot" style={{ backgroundColor: config.color }} />
      {config.label}
    </span>
  );
};
