import React, { useState, useEffect } from 'react';
import { X, Calendar, Plus } from 'lucide-react';
import { leadApi } from '../api/leadApi';
import { calendarApi } from '../api/calendarApi';
import { useToast } from '../context/ToastContext';

export const CalendarScheduleModal = ({ initialDate, onClose, onSuccess }) => {
  const { addToast } = useToast();

  const [leads, setLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);

  const defaultDateTime = initialDate
    ? `${initialDate}T10:00`
    : new Date(Date.now() + 86400000).toISOString().slice(0, 16);

  const [formData, setFormData] = useState({
    lead: '',
    purpose: 'meeting',
    follow_up_at: defaultDateTime,
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await leadApi.getLeads({ page_size: 100 });
        const list = res.results || res;
        setLeads(Array.isArray(list) ? list : []);
      } catch (err) {
        console.error('Failed to load leads list for calendar scheduling:', err);
      } finally {
        setLoadingLeads(false);
      }
    };
    fetchLeads();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.lead) {
      addToast('Please select a lead to schedule this event for.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await calendarApi.scheduleEvent({
        lead: formData.lead,
        purpose: formData.purpose,
        follow_up_at: new Date(formData.follow_up_at).toISOString(),
        notes: formData.notes.trim() || undefined,
      });

      addToast('Calendar event scheduled successfully!', 'success');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to schedule event:', err);
      addToast(
        err.response?.data?.message || err.response?.data?.non_field_errors?.[0] || 'Failed to schedule event.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Schedule Calendar Event</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '20px 24px' }}>
            {/* Select Lead */}
            <div className="form-group">
              <label className="form-label">
                Target Lead <span className="required">*</span>
              </label>
              {loadingLeads ? (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>Loading available leads...</div>
              ) : (
                <select
                  className="form-select"
                  value={formData.lead}
                  onChange={(e) => setFormData({ ...formData, lead: e.target.value })}
                  required
                >
                  <option value="">-- Choose Lead --</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} {l.company_name ? `(${l.company_name})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Purpose / Event Type */}
            <div className="form-group">
              <label className="form-label">
                Event Type / Purpose <span className="required">*</span>
              </label>
              <select
                className="form-select"
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                required
              >
                <option value="meeting">Meeting</option>
                <option value="call">Phone Call</option>
                <option value="demo">Product Demo</option>
                <option value="email">Email Follow-up</option>
                <option value="follow_up">General Follow-up</option>
              </select>
            </div>

            {/* Date & Time */}
            <div className="form-group">
              <label className="form-label">
                Date & Scheduled Time <span className="required">*</span>
              </label>
              <input
                type="datetime-local"
                className="form-input"
                value={formData.follow_up_at}
                onChange={(e) => setFormData({ ...formData, follow_up_at: e.target.value })}
                required
              />
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Agenda / Notes</label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Key meeting objectives, call notes, or discussion points..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || loadingLeads}
            >
              {submitting ? 'Scheduling...' : 'Schedule Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
