import React from 'react';
import { LEAD_STATUS_CONFIG, FOLLOWUP_STATUS_CONFIG } from '../utils/constants';

export const StatusBadge = ({ status, color, stage, type = 'lead' }) => {
  // If stage object passed
  const stageName = stage?.name || (typeof status === 'object' ? status?.name : status) || 'Unknown';
  const stageColor = color || stage?.color || (typeof status === 'object' ? status?.color : null);

  let badgeColor = stageColor;
  let badgeBg = stageColor ? `${stageColor}1f` : null;
  let badgeBorder = stageColor ? `${stageColor}4d` : null;
  let label = stageName;

  if (!badgeColor) {
    const config =
      type === 'lead'
        ? LEAD_STATUS_CONFIG[status] || { label: stageName, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)' }
        : FOLLOWUP_STATUS_CONFIG[status] || { label: stageName, color: '#64748b', bg: '#f1f5f9' };
    badgeColor = config.color;
    badgeBg = config.bg;
    badgeBorder = config.border || 'transparent';
    label = config.label || stageName;
  }

  return (
    <span
      className="status-badge"
      style={{
        color: badgeColor,
        backgroundColor: badgeBg,
        borderColor: badgeBorder || 'transparent',
      }}
    >
      <span className="badge-dot" style={{ backgroundColor: badgeColor }} />
      {label}
    </span>
  );
};
