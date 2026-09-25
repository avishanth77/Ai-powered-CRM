import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Calendar,
  Clock,
  User,
  Building,
  Phone,
  Mail,
  CheckCircle2,
  CalendarClock,
  Ban,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { calendarApi } from '../api/calendarApi';
import { useToast } from '../context/ToastContext';

export const CalendarEventModal = ({ event, onClose, onRefresh }) => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [mode, setMode] = useState('view'); // 'view', 'complete', 'reschedule'
  const [outcome, setOutcome] = useState('');
  const [newDateTime, setNewDateTime] = useState(
    event?.start ? new Date(event.start).toISOString().slice(0, 16) : ''
  );
  const [submitting, setSubmitting] = useState(false);

  if (!event) return null;

  const handleComplete = async (e) => {
    e.preventDefault();
    if (!outcome.trim()) {
      addToast('Please provide an outcome or notes for this follow-up.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await calendarApi.completeEvent(event.id, { outcome: outcome.trim() });
      addToast('Event marked as completed!', 'success');
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to complete event:', err);
      addToast(err.response?.data?.message || 'Failed to complete follow-up.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = async (e) => {
    e.preventDefault();
    if (!newDateTime) {
      addToast('Please select a new date and time.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await calendarApi.updateEvent(event.id, { follow_up_at: new Date(newDateTime).toISOString() });
      addToast('Event rescheduled successfully!', 'success');
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to reschedule event:', err);
      addToast(err.response?.data?.message || 'Failed to reschedule follow-up.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this event?')) return;
    setSubmitting(true);
    try {
      await calendarApi.cancelEvent(event.id);
      addToast('Event cancelled.', 'info');
      onRefresh();
      onClose();
    } catch (err) {
      console.error('Failed to cancel event:', err);
      addToast('Failed to cancel event.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    if (event.status === 'COMPLETED') {
      return (
        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <CheckCircle2 size={13} /> Completed
        </span>
      );
    }
    if (event.status === 'CANCELLED') {
      return <span className="badge badge-neutral">Cancelled</span>;
    }
    if (event.is_overdue) {
      return (
        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <AlertCircle size={13} /> Overdue
        </span>
      );
    }
    return <span className="badge badge-primary">Scheduled</span>;
  };

  const formattedDate = new Date(event.start).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              {getStatusBadge()}
              <span style={{ fontSize: '0.76rem', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
                {event.purpose}
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-main)' }}>{event.title}</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          {mode === 'view' && (
            <>
              {/* Date & Time */}
              <div className="calendar-modal-field">
                <div className="calendar-modal-label">Scheduled Date & Time</div>
                <div className="calendar-modal-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={16} style={{ color: 'var(--primary)' }} />
                  <span>{formattedDate}</span>
                </div>
              </div>

              {/* Lead or Customer Information */}
              {(event.lead || event.customer) && (
                <div className="calendar-modal-field" style={{ background: 'var(--bg-surface-elevated)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div className="calendar-modal-label">
                    {event.lead ? 'Lead Details' : 'Customer Details'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                      {event.lead ? event.lead.name : event.customer.name}
                    </div>
                    {(event.lead?.company_name || event.customer?.company_name) && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Building size={14} />
                        <span>{event.lead?.company_name || event.customer?.company_name}</span>
                      </div>
                    )}
                    {(event.lead?.phone || event.customer?.phone) && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone size={14} />
                        <span>{event.lead?.phone || event.customer?.phone}</span>
                      </div>
                    )}
                    {(event.lead?.email || event.customer?.email) && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={14} />
                        <span>{event.lead?.email || event.customer?.email}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Assigned To */}
              {event.assigned_to && (
                <div className="calendar-modal-field">
                  <div className="calendar-modal-label">Assigned Executive</div>
                  <div className="calendar-modal-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={15} style={{ color: 'var(--text-dim)' }} />
                    <span>{event.assigned_to.full_name} ({event.assigned_to.email})</span>
                  </div>
                </div>
              )}

              {/* Outcome if completed */}
              {event.outcome && (
                <div className="calendar-modal-field">
                  <div className="calendar-modal-label">Recorded Outcome</div>
                  <div className="calendar-modal-value" style={{ fontStyle: 'italic', background: 'var(--bg-surface-elevated)', padding: '10px', borderRadius: '6px' }}>
                    "{event.outcome}"
                  </div>
                </div>
              )}
            </>
          )}

          {/* Complete Mode */}
          {mode === 'complete' && (
            <form onSubmit={handleComplete}>
              <div className="form-group">
                <label className="form-label">
                  Follow-up Outcome & Notes <span className="required">*</span>
                </label>
                <textarea
                  className="form-textarea"
                  rows={4}
                  placeholder="Record summary of discussion, decisions made, or client response..."
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMode('view')}
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Submit & Complete'}
                </button>
              </div>
            </form>
          )}

          {/* Reschedule Mode */}
          {mode === 'reschedule' && (
            <form onSubmit={handleReschedule}>
              <div className="form-group">
                <label className="form-label">
                  New Scheduled Date & Time <span className="required">*</span>
                </label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={newDateTime}
                  onChange={(e) => setNewDateTime(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setMode('view')}
                  disabled={submitting}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Updating...' : 'Save New Schedule'}
                </button>
              </div>
            </form>
          )}
        </div>

        {mode === 'view' && (
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              {event.action_url && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem' }}
                  onClick={() => {
                    onClose();
                    navigate(event.action_url);
                  }}
                >
                  <ExternalLink size={14} />
                  <span>Open {event.lead ? 'Lead' : 'Customer'}</span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {event.status === 'PENDING' && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.82rem' }}
                    onClick={() => setMode('reschedule')}
                  >
                    <CalendarClock size={14} />
                    <span>Reschedule</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: '0.82rem' }}
                    onClick={() => setMode('complete')}
                  >
                    <CheckCircle2 size={14} />
                    <span>Mark Completed</span>
                  </button>
                </>
              )}
              <button type="button" className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.82rem' }}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
