import React from 'react';
import { ICP_STATUS, ICP_STATUS_CONFIG } from '../utils/constants';

export const IcpStatusBadge = ({ status, size = 'md' }) => {
  const config = ICP_STATUS_CONFIG[status] || ICP_STATUS_CONFIG[ICP_STATUS.NOT_TESTED];
  const fontSize = size === 'sm' ? '0.7rem' : '0.75rem';

  return (
    <span
      className="status-badge"
      style={{
        color: config.color,
        backgroundColor: config.bg,
        borderColor: config.border,
        border: '1px solid transparent',
        fontSize,
        padding: size === 'sm' ? '0.15rem 0.5rem' : '0.2rem 0.6rem',
      }}
    >
      {config.label}
    </span>
  );
};