import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Standardized SaaS 5-State Error Recovery component.
 * Plain, specific copy with clear remediation path.
 */
export const ErrorState = ({
  title = 'Unable to load data',
  message = 'A network or server issue prevented this information from loading.',
  onRetry,
  retryLabel = 'Retry Connection',
  className = '',
}) => {
  return (
    <div className={`card error-recovery-card ${className}`} role="alert">
      <div className="error-icon-wrapper">
        <AlertCircle size={32} aria-hidden="true" />
      </div>
      <h3 className="error-card-title">{title}</h3>
      <p className="error-card-message">{message}</p>
      {onRetry && (
        <button
          type="button"
          className="btn btn-secondary mt-3"
          onClick={onRetry}
        >
          <RefreshCw size={14} aria-hidden="true" />
          <span>{retryLabel}</span>
        </button>
      )}
    </div>
  );
};

