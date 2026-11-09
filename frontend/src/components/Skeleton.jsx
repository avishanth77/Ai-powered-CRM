import React from 'react';

/**
 * Modern, accessible content-aware skeleton components for SaaS loading states.
 * Respects prefers-reduced-motion and dark mode tokens.
 */
export const Skeleton = ({
  variant = 'text', // 'text' | 'rect' | 'circle' | 'pill'
  width,
  height,
  borderRadius,
  className = '',
  style = {},
  ...props
}) => {
  const inlineStyles = {
    width: width || (variant === 'circle' ? 36 : '100%'),
    height: height || (variant === 'text' ? '1rem' : variant === 'circle' ? 36 : '2.5rem'),
    borderRadius: borderRadius || (variant === 'circle' ? '50%' : variant === 'pill' ? '9999px' : 'var(--radius-sm, 6px)'),
    ...style,
  };

  return (
    <div
      className={`saas-skeleton saas-skeleton-${variant} ${className}`}
      style={inlineStyles}
      aria-hidden="true"
      {...props}
    />
  );
};

export const SkeletonKpiGrid = ({ count = 4, cols = 4 }) => {
  return (
    <div className={`dashboard-stats-grid cols-${cols}`} aria-busy="true" aria-label="Loading metrics...">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="kpi-card skeleton-kpi-card">
          <div className="kpi-card-header">
            <Skeleton width="45%" height="12px" />
            <Skeleton variant="circle" width="36px" height="36px" />
          </div>
          <Skeleton width="60%" height="32px" style={{ margin: '0.5rem 0' }} />
          <Skeleton width="75%" height="14px" />
        </div>
      ))}
    </div>
  );
};

export const SkeletonTable = ({ rows = 6, cols = 6 }) => {
  return (
    <div className="table-responsive" aria-busy="true" aria-label="Loading table data...">
      <table className="crm-table">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, c) => (
              <th key={c}>
                <Skeleton width={c === 0 ? '70%' : '50%'} height="12px" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}>
                  {c === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <Skeleton width="70%" height="14px" />
                      <Skeleton width="40%" height="10px" />
                    </div>
                  ) : c === cols - 1 ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Skeleton variant="circle" width="28px" height="28px" />
                      <Skeleton variant="circle" width="28px" height="28px" />
                    </div>
                  ) : (
                    <Skeleton width={c === 1 ? '85%' : '60%'} height="14px" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const SkeletonCardList = ({ count = 3 }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Skeleton width="40%" height="18px" />
            <Skeleton variant="pill" width="80px" height="24px" />
          </div>
          <Skeleton width="85%" height="14px" />
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
            <Skeleton width="25%" height="12px" />
            <Skeleton width="25%" height="12px" />
          </div>
        </div>
      ))}
    </div>
  );
};

