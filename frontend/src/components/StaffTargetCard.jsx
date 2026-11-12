import React from 'react';
import { formatCurrency } from '../utils/formatters';
import {
  PhoneCall,
  UserPlus,
  Briefcase,
  IndianRupee,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sparkles,
  Settings,
  Target,
} from 'lucide-react';

export const StaffTargetCard = ({ report, onEditTarget, canManage = false }) => {
  if (!report) return null;

  const {
    user_name,
    user_email,
    user_role,
    period_month,
    daily = {},
    monthly = {},
    notes,
    is_customized,
  } = report;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACHIEVED':
        return (
          <span className="badge badge-success" style={{ gap: '4px', fontSize: '0.72rem' }}>
            <CheckCircle2 size={12} /> Target Met 🎯
          </span>
        );
      case 'ON_TRACK':
        return (
          <span className="badge badge-primary" style={{ gap: '4px', fontSize: '0.72rem' }}>
            <Sparkles size={12} /> On Track
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="badge badge-warning" style={{ gap: '4px', fontSize: '0.72rem' }}>
            <Clock size={12} /> In Progress
          </span>
        );
      default:
        return (
          <span className="badge badge-danger" style={{ gap: '4px', fontSize: '0.72rem' }}>
            <AlertTriangle size={12} /> Needs Focus
          </span>
        );
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'Admin / Mentor';
      case 'MANAGER':
        return 'Sales Manager';
      default:
        return 'Sales Executive';
    }
  };

  const dCalls = daily.calls || { target: 10, actual: 0, percentage: 0 };
  const dLeads = daily.leads || { target: 3, actual: 0, percentage: 0 };
  const mDeals = monthly.deals_won || { target: 5, actual: 0, percentage: 0 };
  const mRev = monthly.revenue || { target: 50000, actual: 0, percentage: 0 };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        padding: '1.25rem',
        backgroundColor: 'var(--bg-surface)',
        transition: 'all var(--transition-fast)',
      }}
    >
      {/* Top Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1rem',
                flexShrink: 0,
              }}
            >
              {user_name ? user_name.slice(0, 2).toUpperCase() : 'SR'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user_name}
                </h4>
                {is_customized ? (
                  <span style={{ fontSize: '0.6875rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--bg-surface-elevated)', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)' }}>
                    Custom
                  </span>
                ) : (
                  <span style={{ fontSize: '0.6875rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'var(--bg-surface-elevated)', color: 'var(--text-dim)', border: '1px solid var(--border-subtle)' }}>
                    Standard
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {user_email} • <span style={{ fontWeight: 600 }}>{getRoleLabel(user_role)}</span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            {getStatusBadge(monthly.status)}
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-dim)' }}>
              {monthly.overall_score}% Month Pacing
            </span>
          </div>
        </div>

        {/* DAILY PERFORMANCE BLOCK */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 0.875rem',
            marginBottom: '0.875rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={13} color="var(--primary)" /> Today's Daily Target
            </span>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Score: {daily.overall_score}%
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {/* Daily Calls */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px' }}>
                <span className="text-muted"><PhoneCall size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />Calls</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  {dCalls.actual} / {dCalls.target}
                </span>
              </div>
              <div className="bar-track" style={{ height: '6px' }}>
                <div
                  className="bar-fill"
                  style={{
                    width: `${Math.min(dCalls.percentage, 100)}%`,
                    backgroundColor: dCalls.achieved ? 'var(--success)' : 'var(--primary)',
                  }}
                />
              </div>
            </div>

            {/* Daily Leads */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px' }}>
                <span className="text-muted"><UserPlus size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />Leads</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  {dLeads.actual} / {dLeads.target}
                </span>
              </div>
              <div className="bar-track" style={{ height: '6px' }}>
                <div
                  className="bar-fill"
                  style={{
                    width: `${Math.min(dLeads.percentage, 100)}%`,
                    backgroundColor: dLeads.achieved ? 'var(--success)' : '#38bdf8',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* MONTHLY PERFORMANCE BLOCK */}
        <div
          style={{
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 0.875rem',
            marginBottom: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Target size={13} color="#6366f1" /> Monthly Quota ({period_month})
            </span>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              {mRev.percentage}% Quota
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Deals Won */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px' }}>
                <span className="text-muted"><Briefcase size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />Deals Won</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  {mDeals.actual} / {mDeals.target} ({mDeals.percentage}%)
                </span>
              </div>
              <div className="bar-track" style={{ height: '6px' }}>
                <div
                  className="bar-fill"
                  style={{
                    width: `${Math.min(mDeals.percentage, 100)}%`,
                    backgroundColor: mDeals.achieved ? 'var(--success)' : '#8b5cf6',
                  }}
                />
              </div>
            </div>

            {/* Revenue Quota */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '3px' }}>
                <span className="text-muted"><IndianRupee size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />Revenue Quota</span>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  {formatCurrency(mRev.actual)} / {formatCurrency(mRev.target)}
                </span>
              </div>
              <div className="bar-track" style={{ height: '6px' }}>
                <div
                  className="bar-fill"
                  style={{
                    width: `${Math.min(mRev.percentage, 100)}%`,
                    backgroundColor: mRev.achieved ? 'var(--success)' : '#10b981',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Notes if any */}
        {notes && (
          <p
            style={{
              margin: '0 0 0.875rem 0',
              fontSize: '0.75rem',
              color: 'var(--text-dim)',
              fontStyle: 'italic',
              background: 'var(--bg-surface)',
              padding: '0.35rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              borderLeft: '2px solid var(--primary)',
            }}
          >
            "{notes}"
          </p>
        )}
      </div>

      {/* Action Footer */}
      {canManage && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onEditTarget(report)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem' }}
          >
            <Settings size={14} /> Customize Target
          </button>
        </div>
      )}
    </div>
  );
};
