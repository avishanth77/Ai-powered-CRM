import React, { useState, useEffect } from 'react';
import { targetApi } from '../api/targetApi';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/validation';
import { useDialogA11y } from '../hooks/useDialogA11y';
import {
  Target,
  X,
  Save,
  Calendar,
  PhoneCall,
  UserPlus,
  IndianRupee,
  Briefcase,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';

const PRESETS = {
  STANDARD: {
    id: 'STANDARD',
    name: 'Standard Rep',
    badge: 'Balanced',
    daily_calls_target: 15,
    daily_leads_target: 5,
    daily_revenue_target: '5000',
    monthly_calls_target: 300,
    monthly_leads_target: 80,
    monthly_deals_won_target: 8,
    monthly_revenue_target: '150000',
    description: 'Balanced prospect-to-close targets for full-cycle sales reps.',
  },
  SDR: {
    id: 'SDR',
    name: 'Outbound SDR',
    badge: 'Prospecting',
    daily_calls_target: 30,
    daily_leads_target: 10,
    daily_revenue_target: '0',
    monthly_calls_target: 600,
    monthly_leads_target: 180,
    monthly_deals_won_target: 4,
    monthly_revenue_target: '75000',
    description: 'High volume outbound calling and initial qualification focus.',
  },
  CLOSER: {
    id: 'CLOSER',
    name: 'Account Executive',
    badge: 'High Ticket',
    daily_calls_target: 8,
    daily_leads_target: 2,
    daily_revenue_target: '20000',
    monthly_calls_target: 150,
    monthly_leads_target: 30,
    monthly_deals_won_target: 6,
    monthly_revenue_target: '400000',
    description: 'Focus on high-value deals, product demos, and contract closes.',
  },
};

export const StaffTargetModal = ({
  isOpen,
  onClose,
  staffUser,
  initialPeriodMonth,
  existingTarget,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const dialogRef = useDialogA11y(isOpen, onClose);

  const getCurrentMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const [periodMonth, setPeriodMonth] = useState(initialPeriodMonth || getCurrentMonthStr());
  const [selectedPreset, setSelectedPreset] = useState('CUSTOM');
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    daily_calls_target: 15,
    daily_leads_target: 5,
    daily_revenue_target: '0',
    monthly_calls_target: 300,
    monthly_leads_target: 80,
    monthly_deals_won_target: 8,
    monthly_revenue_target: '100000',
    notes: '',
    is_active: true,
  });

  useEffect(() => {
    if (isOpen) {
      if (initialPeriodMonth) {
        setPeriodMonth(initialPeriodMonth);
      }
      if (existingTarget) {
        setFormData({
          daily_calls_target: existingTarget.daily_calls_target ?? 15,
          daily_leads_target: existingTarget.daily_leads_target ?? 5,
          daily_revenue_target: String(existingTarget.daily_revenue_target ?? '0'),
          monthly_calls_target: existingTarget.monthly_calls_target ?? 300,
          monthly_leads_target: existingTarget.monthly_leads_target ?? 80,
          monthly_deals_won_target: existingTarget.monthly_deals_won_target ?? 8,
          monthly_revenue_target: String(existingTarget.monthly_revenue_target ?? '100000'),
          notes: existingTarget.notes || '',
          is_active: existingTarget.is_active ?? true,
        });
        setSelectedPreset('CUSTOM');
      } else {
        // Load default preset
        applyPreset('STANDARD');
      }
    }
  }, [isOpen, existingTarget, initialPeriodMonth]);

  const applyPreset = (presetKey) => {
    setSelectedPreset(presetKey);
    const p = PRESETS[presetKey];
    if (p) {
      setFormData((prev) => ({
        ...prev,
        daily_calls_target: p.daily_calls_target,
        daily_leads_target: p.daily_leads_target,
        daily_revenue_target: p.daily_revenue_target,
        monthly_calls_target: p.monthly_calls_target,
        monthly_leads_target: p.monthly_leads_target,
        monthly_deals_won_target: p.monthly_deals_won_target,
        monthly_revenue_target: p.monthly_revenue_target,
        notes: prev.notes || p.description,
      }));
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setSelectedPreset('CUSTOM');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!staffUser?.id) return;

    setSaving(true);
    try {
      const payload = {
        user: staffUser.id,
        period_month: periodMonth,
        daily_calls_target: Math.max(0, parseInt(formData.daily_calls_target, 10) || 0),
        daily_leads_target: Math.max(0, parseInt(formData.daily_leads_target, 10) || 0),
        daily_revenue_target: Math.max(0, parseFloat(formData.daily_revenue_target) || 0).toFixed(2),
        monthly_calls_target: Math.max(0, parseInt(formData.monthly_calls_target, 10) || 0),
        monthly_leads_target: Math.max(0, parseInt(formData.monthly_leads_target, 10) || 0),
        monthly_deals_won_target: Math.max(0, parseInt(formData.monthly_deals_won_target, 10) || 0),
        monthly_revenue_target: Math.max(0, parseFloat(formData.monthly_revenue_target) || 0).toFixed(2),
        notes: (formData.notes || '').trim(),
        is_active: formData.is_active,
      };

      await targetApi.saveTarget(payload);
      showToast(`Sales target customized successfully for ${staffUser.first_name || staffUser.email}!`, 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to save sales target.');
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !staffUser) return null;

  const staffDisplayName = staffUser.first_name
    ? `${staffUser.first_name} ${staffUser.last_name || ''}`.trim()
    : staffUser.email;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container modal-container-lg"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Set Staff Sales Targets"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Target size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Set Sales Target — {staffDisplayName}
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Customize day and monthly quota goals for this team member
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body form-layout" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Top Period & Preset Selector Bar */}
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem 1rem',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <Calendar size={18} color="var(--primary)" />
                <div>
                  <label htmlFor="target-period-month" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>
                    Target Month
                  </label>
                  <input
                    id="target-period-month"
                    type="month"
                    className="form-control"
                    style={{ padding: '0.25rem 0.5rem', height: '32px', fontSize: '0.875rem' }}
                    value={periodMonth}
                    onChange={(e) => setPeriodMonth(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  Quick Role Presets
                </span>
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {Object.values(PRESETS).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`btn btn-xs ${selectedPreset === p.id ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => applyPreset(p.id)}
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                    >
                      {p.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`btn btn-xs ${selectedPreset === 'CUSTOM' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSelectedPreset('CUSTOM')}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                  >
                    Custom
                  </button>
                </div>
              </div>
            </div>

            {/* SECTION 1: DAILY TARGETS */}
            <div
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.15rem',
                background: 'var(--bg-surface)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                <Sparkles size={16} color="var(--primary)" />
                <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Daily Targets (Per Day Expectations)
                </h4>
                <span className="badge badge-primary" style={{ fontSize: '0.6875rem', marginLeft: 'auto' }}>
                  Day Focus
                </span>
              </div>

              <div className="form-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="daily-calls">
                    <PhoneCall size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: '#0284c7' }} />
                    Calls / Follow-ups
                  </label>
                  <input
                    id="daily-calls"
                    name="daily_calls_target"
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="e.g. 15"
                    value={formData.daily_calls_target}
                    onChange={handleChange}
                    required
                  />
                  <span className="text-dim" style={{ fontSize: '0.7rem' }}>Calls to complete daily</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="daily-leads">
                    <UserPlus size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: '#10b981' }} />
                    Leads Handled
                  </label>
                  <input
                    id="daily-leads"
                    name="daily_leads_target"
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="e.g. 5"
                    value={formData.daily_leads_target}
                    onChange={handleChange}
                    required
                  />
                  <span className="text-dim" style={{ fontSize: '0.7rem' }}>New prospects contacted</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="daily-revenue">
                    <IndianRupee size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: '#f59e0b' }} />
                    Daily Revenue (₹)
                  </label>
                  <input
                    id="daily-revenue"
                    name="daily_revenue_target"
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    placeholder="e.g. 5000"
                    value={formData.daily_revenue_target}
                    onChange={handleChange}
                  />
                  <span className="text-dim" style={{ fontSize: '0.7rem' }}>Optional day deal value</span>
                </div>
              </div>
            </div>

            {/* SECTION 2: MONTHLY TARGETS */}
            <div
              style={{
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.15rem',
                background: 'var(--bg-surface)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                <Target size={16} color="#6366f1" />
                <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Monthly Targets (Full Month Quota)
                </h4>
                <span className="badge badge-info" style={{ fontSize: '0.6875rem', marginLeft: 'auto' }}>
                  Monthly Quota
                </span>
              </div>

              <div className="form-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="monthly-calls">
                    <PhoneCall size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: '#0284c7' }} />
                    Total Calls
                  </label>
                  <input
                    id="monthly-calls"
                    name="monthly_calls_target"
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="e.g. 300"
                    value={formData.monthly_calls_target}
                    onChange={handleChange}
                    required
                  />
                  <span className="text-dim" style={{ fontSize: '0.7rem' }}>Month call volume</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="monthly-leads">
                    <UserPlus size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: '#10b981' }} />
                    Total Leads
                  </label>
                  <input
                    id="monthly-leads"
                    name="monthly_leads_target"
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="e.g. 80"
                    value={formData.monthly_leads_target}
                    onChange={handleChange}
                    required
                  />
                  <span className="text-dim" style={{ fontSize: '0.7rem' }}>Leads assigned / scoped</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="monthly-deals">
                    <Briefcase size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: '#8b5cf6' }} />
                    Deals Won
                  </label>
                  <input
                    id="monthly-deals"
                    name="monthly_deals_won_target"
                    type="number"
                    min="0"
                    className="form-control"
                    placeholder="e.g. 8"
                    value={formData.monthly_deals_won_target}
                    onChange={handleChange}
                    required
                  />
                  <span className="text-dim" style={{ fontSize: '0.7rem' }}>Closed won deals</span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="monthly-revenue">
                    <IndianRupee size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: '#10b981' }} />
                    Revenue Quota (₹)
                  </label>
                  <input
                    id="monthly-revenue"
                    name="monthly_revenue_target"
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    placeholder="e.g. 150000"
                    value={formData.monthly_revenue_target}
                    onChange={handleChange}
                    required
                  />
                  <span className="text-dim" style={{ fontSize: '0.7rem' }}>Total monthly revenue</span>
                </div>
              </div>
            </div>

            {/* Notes / Instructions for Staff */}
            <div className="form-group">
              <label className="form-label" htmlFor="target-notes">
                <Info size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: 'var(--text-muted)' }} />
                Admin Guidance & Directive Notes (Visible to Staff)
              </label>
              <textarea
                id="target-notes"
                name="notes"
                rows={2}
                className="form-control"
                placeholder="e.g. Priority focus on closing Q4 Enterprise SaaS tier leads and conducting product demos..."
                value={formData.notes}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Save size={16} />
              <span>{saving ? 'Saving Target...' : 'Save Staff Target'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
