import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Calendar,
  Clock,
  User,
  Users,
  PhoneCall,
  MonitorPlay,
  Mail,
  CheckSquare,
  Search,
  Building,
  Check,
  Sparkles
} from 'lucide-react';
import { leadApi } from '../api/leadApi';
import { calendarApi } from '../api/calendarApi';
import { useToast } from '../context/ToastContext';

const EVENT_PURPOSES = [
  {
    id: 'meeting',
    label: 'Meeting',
    sub: 'Client sync / video',
    icon: Users,
    color: '#0284c7',
    bg: 'rgba(2, 132, 199, 0.08)'
  },
  {
    id: 'call',
    label: 'Phone Call',
    sub: 'Direct audio call',
    icon: PhoneCall,
    color: '#059669',
    bg: 'rgba(5, 150, 105, 0.08)'
  },
  {
    id: 'demo',
    label: 'Product Demo',
    sub: 'Platform walkthrough',
    icon: MonitorPlay,
    color: '#7c3aed',
    bg: 'rgba(124, 58, 237, 0.08)'
  },
  {
    id: 'email',
    label: 'Email Follow-up',
    sub: 'Proposal / check-in',
    icon: Mail,
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.08)'
  },
  {
    id: 'follow_up',
    label: 'General Task',
    sub: 'Action item reminder',
    icon: CheckSquare,
    color: '#475569',
    bg: 'rgba(71, 85, 105, 0.08)'
  },
];

export const CalendarScheduleModal = ({ initialDate, onClose, onSuccess }) => {
  const { addToast } = useToast();

  const [leads, setLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [leadSearch, setLeadSearch] = useState('');

  // Initial date computation
  const baseDate = initialDate || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(baseDate);
  const [selectedTime, setSelectedTime] = useState('10:00');

  const [selectedPurpose, setSelectedPurpose] = useState('meeting');
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [notes, setNotes] = useState('');
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

  // Filtered leads based on search query
  const filteredLeads = useMemo(() => {
    if (!leadSearch.trim()) return leads;
    const q = leadSearch.toLowerCase();
    return leads.filter(
      (l) =>
        l.name?.toLowerCase().includes(q) ||
        l.company_name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q)
    );
  }, [leads, leadSearch]);

  const selectedLead = useMemo(() => {
    return leads.find((l) => String(l.id) === String(selectedLeadId));
  }, [leads, selectedLeadId]);

  // Quick Date presets
  const handleDatePreset = (daysOffset) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleNextMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() + ((7 - day + 1) % 7 || 7);
    d.setDate(diff);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLeadId) {
      addToast('Please select a target lead for this event.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const combinedDateTime = new Date(`${selectedDate}T${selectedTime}`).toISOString();

      await calendarApi.scheduleEvent({
        lead: selectedLeadId,
        purpose: selectedPurpose,
        follow_up_at: combinedDateTime,
        notes: notes.trim() || undefined,
      });

      addToast('Calendar event scheduled successfully!', 'success');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to schedule event:', err);
      addToast(
        err.response?.data?.message ||
          err.response?.data?.non_field_errors?.[0] ||
          'Failed to schedule event.',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '580px', borderRadius: '16px' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '18px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'rgba(5, 150, 105, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary, #059669)',
              }}
            >
              <Calendar size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Schedule Calendar Event
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Plan an upcoming meeting, demo, or follow-up call
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Event Type / Purpose Selector */}
            <div>
              <label className="form-label" style={{ marginBottom: '8px', display: 'block', fontWeight: 700 }}>
                Event Type & Purpose <span className="required">*</span>
              </label>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                  gap: '8px',
                }}
              >
                {EVENT_PURPOSES.map((item) => {
                  const Icon = item.icon;
                  const isSelected = selectedPurpose === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedPurpose(item.id)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '10px',
                        border: isSelected
                          ? `2px solid ${item.color}`
                          : '1px solid var(--border-subtle, #e2e8f0)',
                        background: isSelected ? item.bg : 'var(--bg-surface, #ffffff)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'center',
                        outline: 'none',
                        boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: isSelected ? item.color : 'var(--bg-surface-elevated, #f1f5f9)',
                          color: isSelected ? '#ffffff' : item.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Icon size={16} />
                      </div>
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: isSelected ? 700 : 600,
                          color: isSelected ? item.color : 'var(--text-main, #0f172a)',
                          lineHeight: 1.2,
                        }}
                      >
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target Lead Selector */}
            <div>
              <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: 700 }}>
                Target Lead <span className="required">*</span>
              </label>

              {loadingLeads ? (
                <div style={{ fontSize: '0.84rem', color: 'var(--text-dim)', padding: '8px 0' }}>
                  Loading available leads...
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Lead Search & Select combo */}
                  <div style={{ position: 'relative' }}>
                    <Search
                      size={15}
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-dim)',
                      }}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search lead by name or company..."
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      style={{ paddingLeft: '34px', fontSize: '0.84rem', height: '38px' }}
                    />
                  </div>

                  <select
                    className="form-select"
                    value={selectedLeadId}
                    onChange={(e) => setSelectedLeadId(e.target.value)}
                    required
                    style={{ fontSize: '0.88rem', height: '40px' }}
                  >
                    <option value="">-- Select Lead ({filteredLeads.length} available) --</option>
                    {filteredLeads.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} {l.company_name ? `— ${l.company_name}` : ''} {l.stage ? `[${l.stage.name}]` : ''}
                      </option>
                    ))}
                  </select>

                  {/* Selected Lead Card Preview */}
                  {selectedLead && (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'var(--bg-surface-elevated, #f8fafc)',
                        border: '1px solid var(--border-subtle, #e2e8f0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'var(--primary, #059669)',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                          }}
                        >
                          {selectedLead.name?.charAt(0) || 'L'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                            {selectedLead.name}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {selectedLead.company_name && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Building size={12} /> {selectedLead.company_name}
                              </span>
                            )}
                            {selectedLead.email && <span>• {selectedLead.email}</span>}
                          </div>
                        </div>
                      </div>
                      {selectedLead.stage && (
                        <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                          {selectedLead.stage.name}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date & Time with Quick Presets */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>
                  Date & Time <span className="required">*</span>
                </label>
                {/* Date Shortcut Pills */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => handleDatePreset(0)}
                    className="btn btn-xs"
                    style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px' }}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDatePreset(1)}
                    className="btn btn-xs"
                    style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px' }}
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDatePreset(2)}
                    className="btn btn-xs"
                    style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px' }}
                  >
                    +2 Days
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonday}
                    className="btn btn-xs"
                    style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px' }}
                  >
                    Next Mon
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px' }}>
                <div>
                  <input
                    type="date"
                    className="form-input"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    required
                    style={{ height: '40px', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <input
                    type="time"
                    className="form-input"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    required
                    style={{ height: '40px', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              {/* Quick Time Chips */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)' }}>Slots:</span>
                {['09:30', '11:00', '14:00', '16:30'].map((slot) => {
                  const label = slot === '09:30' ? '9:30 AM' : slot === '11:00' ? '11:00 AM' : slot === '14:00' ? '2:00 PM' : '4:30 PM';
                  const isCur = selectedTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSelectedTime(slot)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        border: isCur ? '1px solid var(--primary, #059669)' : '1px solid var(--border-subtle, #e2e8f0)',
                        background: isCur ? 'rgba(5, 150, 105, 0.1)' : 'var(--bg-surface, #ffffff)',
                        color: isCur ? 'var(--primary, #059669)' : 'var(--text-muted, #475569)',
                        fontSize: '0.74rem',
                        fontWeight: isCur ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Agenda & Notes */}
            <div>
              <label className="form-label" style={{ marginBottom: '6px', display: 'block', fontWeight: 700 }}>
                Agenda & Discussion Notes
              </label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Briefly state meeting goals, agenda points, or discussion topics..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ resize: 'vertical', fontSize: '0.86rem' }}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div
            className="modal-footer"
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-subtle, #e2e8f0)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '8px 18px', fontSize: '0.88rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || loadingLeads}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 22px',
                fontSize: '0.88rem',
                fontWeight: 700,
              }}
            >
              <Calendar size={16} />
              <span>{submitting ? 'Scheduling...' : 'Schedule Event'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
