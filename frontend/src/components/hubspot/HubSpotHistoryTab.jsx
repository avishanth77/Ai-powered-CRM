import React from 'react';
import {
  History,
  Activity,
  User,
  ArrowRight,
  Clock,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';

export const HubSpotHistoryTab = ({ timeline = [], handovers = [] }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Handover History if any */}
      {handovers.length > 0 && (
        <div className="hs-card">
          <div className="hs-card-header">
            <h3 className="hs-card-title">
              <User size={16} color="var(--primary, #6366f1)" />
              <span>Lead Reassignment & Handover History ({handovers.length})</span>
            </h3>
          </div>
          <div className="hs-card-body" style={{ padding: '0.75rem' }}>
            <table className="table" style={{ margin: 0, fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Reason</th>
                  <th>Handed Over By</th>
                </tr>
              </thead>
              <tbody>
                {handovers.map((h) => (
                  <tr key={h.id}>
                    <td>{formatDateTime(h.created_at)}</td>
                    <td>{h.previous_assignee?.full_name || h.previous_assignee?.email || 'Unassigned'}</td>
                    <td><strong style={{ color: 'var(--primary)' }}>{h.new_assignee?.full_name || h.new_assignee?.email}</strong></td>
                    <td style={{ maxWidth: '240px' }}>{h.reason}</td>
                    <td>{h.handed_over_by?.full_name || h.handed_over_by?.email || 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Complete Audit Log */}
      <div className="hs-card">
        <div className="hs-card-header">
          <h3 className="hs-card-title">
            <History size={16} color="#38bdf8" />
            <span>Field-Level Change Audit Trail ({timeline.length})</span>
          </h3>
        </div>
        <div className="hs-card-body">
          {timeline.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-dim)' }}>
              No audit logs recorded for this lead yet.
            </div>
          ) : (
            <div className="hs-timeline-feed">
              {timeline.map((act) => {
                const actionLabel = act.action?.replace(/_/g, ' ') || 'Action';
                const hasDiff = act.old_value || act.new_value;

                return (
                  <div key={act.id} className="hs-timeline-item">
                    <div className="hs-timeline-icon system">
                      <Activity size={16} />
                    </div>
                    <div className="hs-timeline-content">
                      <div className="hs-timeline-header">
                        <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.875rem' }}>
                          {actionLabel}
                        </span>
                        <span className="hs-timeline-meta" title={formatDateTime(act.created_at)}>
                          {formatRelativeTime(act.created_at)} • by <strong>{act.performed_by_name || act.performed_by?.email || 'System'}</strong>
                        </span>
                      </div>

                      {act.notes && (
                        <p className="hs-timeline-text" style={{ marginBottom: hasDiff ? '0.5rem' : 0 }}>
                          {act.notes}
                        </p>
                      )}

                      {/* Diff Comparison if old_value / new_value exist */}
                      {hasDiff && (
                        <div
                          style={{
                            background: 'rgba(0, 0, 0, 0.25)',
                            padding: '0.6rem 0.85rem',
                            borderRadius: 'var(--radius-sm, 6px)',
                            fontSize: '0.75rem',
                            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.35rem',
                          }}
                        >
                          {act.old_value && (
                            <div style={{ color: 'var(--danger, #ef4444)' }}>
                              <strong>Old:</strong> {JSON.stringify(act.old_value)}
                            </div>
                          )}
                          {act.new_value && (
                            <div style={{ color: 'var(--success, #10b981)' }}>
                              <strong>New:</strong> {JSON.stringify(act.new_value)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HubSpotHistoryTab;

