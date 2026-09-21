import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { leadApi } from '../api/leadApi';
import { followupApi } from '../api/followupApi';
import { userApi } from '../api/userApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDateTime, formatDate, formatRelativeTime } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';
import {
  LEAD_STATUS,
  NOTE_TYPES,
  FOLLOWUP_PURPOSES,
} from '../utils/constants';

import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ConfirmModal } from '../components/ConfirmModal';

import {
  ArrowLeft,
  Edit,
  UserCheck,
  CalendarPlus,
  MessageSquarePlus,
  Clock,
  Activity,
  Phone,
  Mail,
  Building2,
  MapPin,
  CheckCircle2,
  XCircle,
  Share2,
  User,
  ShieldCheck,
  Send,
  Sparkles,
  Bot,
} from 'lucide-react';

export const LeadDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, canAssignLeads, canConvertLeads } = useAuth();
  const { showToast } = useToast();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('notes'); // notes | followups | timeline

  // Data for tabs
  const [notes, setNotes] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Modals state
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [converting, setConverting] = useState(false);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [assigning, setAssigning] = useState(false);

  const [newNoteModalOpen, setNewNoteModalOpen] = useState(false);
  const [noteData, setNoteData] = useState({ note_type: 'CALL', note_text: '' });
  const [addingNote, setAddingNote] = useState(false);

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [followupData, setFollowupData] = useState({
    follow_up_at: '',
    purpose: 'Phone Call',
  });
  const [scheduling, setScheduling] = useState(false);

  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedFollowup, setSelectedFollowup] = useState(null);
  const [completionOutcome, setCompletionOutcome] = useState('');
  const [completing, setCompleting] = useState(false);

  // AI Summary State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiSummaryData, setAiSummaryData] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const handleOpenAiSummary = async () => {
    setAiModalOpen(true);
    setLoadingAi(true);
    try {
      const res = await leadApi.getAiSummary(id);
      if (res.data) {
        setAiSummaryData(res);
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to generate AI summary'), 'error');
    } finally {
      setLoadingAi(false);
    }
  };

  const fetchLeadDetails = useCallback(async () => {
    try {
      const res = await leadApi.getLeadById(id);
      setLead(res);
      setSelectedAssignee(res.assigned_to || '');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to fetch lead profile'), 'error');
      navigate('/leads');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, showToast]);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await leadApi.getNotes(id);
      setNotes(res.data || res);
    } catch {}
  }, [id]);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await leadApi.getTimeline(id);
      setTimeline(res.data || res);
    } catch {}
  }, [id]);

  const fetchFollowups = useCallback(async () => {
    try {
      const res = await followupApi.getFollowUps({ lead: id });
      setFollowups(res.results || res);
    } catch {}
  }, [id]);

  useEffect(() => {
    fetchLeadDetails();
    fetchNotes();
    fetchTimeline();
    fetchFollowups();

    if (canAssignLeads) {
      userApi.getUsers().then((res) => setUsersList(res.results || res)).catch(() => {});
    }
  }, [fetchLeadDetails, fetchNotes, fetchTimeline, fetchFollowups, canAssignLeads]);

  // Handle Quick Status Change
  const handleStatusChange = async (newStatus) => {
    if (newStatus === lead.status) return;

    if (newStatus === LEAD_STATUS.LOST) {
      const reason = window.prompt('Please provide a reason why this lead is lost:');
      if (!reason || !reason.trim()) {
        showToast('Lost reason is required.', 'warning');
        return;
      }
      try {
        await leadApi.updateLead(id, { status: newStatus, lost_reason: reason.trim() });
        showToast('Lead marked as Lost.', 'info');
        fetchLeadDetails();
        fetchTimeline();
      } catch (err) {
        showToast(extractErrorMessage(err, 'Status update failed'), 'error');
      }
      return;
    }

    try {
      await leadApi.updateLead(id, { status: newStatus });
      showToast(`Status changed to ${newStatus.replace('_', ' ')}`, 'success');
      fetchLeadDetails();
      fetchTimeline();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Status update failed'), 'error');
    }
  };

  // Handle Lead Reassignment
  const handleConfirmAssign = async () => {
    if (!selectedAssignee) return;
    setAssigning(true);
    try {
      await leadApi.assignLead(id, parseInt(selectedAssignee));
      showToast('Lead successfully assigned.', 'success');
      setAssignModalOpen(false);
      fetchLeadDetails();
      fetchTimeline();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Lead assignment failed'), 'error');
    } finally {
      setAssigning(false);
    }
  };

  // Handle Customer Conversion
  const handleConfirmConvert = async () => {
    setConverting(true);
    try {
      const res = await leadApi.convertLead(id);
      showToast('Lead successfully converted to Customer!', 'success');
      setConvertModalOpen(false);
      fetchLeadDetails();
      fetchTimeline();
      if (res.data?.customer?.id) {
        navigate(`/customers/${res.data.customer.id}`);
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Customer conversion failed'), 'error');
    } finally {
      setConverting(false);
    }
  };

  // Handle Note Submission
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteData.note_text.trim()) return;

    setAddingNote(true);
    try {
      await leadApi.addNote(id, noteData);
      showToast('Note recorded.', 'success');
      setNoteData({ note_type: 'CALL', note_text: '' });
      setNewNoteModalOpen(false);
      fetchNotes();
      fetchTimeline();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to add note'), 'error');
    } finally {
      setAddingNote(false);
    }
  };

  // Handle Follow-up Scheduling
  const handleScheduleFollowup = async (e) => {
    e.preventDefault();
    if (!followupData.follow_up_at) {
      showToast('Please specify a date and time.', 'warning');
      return;
    }

    setScheduling(true);
    try {
      await followupApi.createFollowUp({
        lead: parseInt(id),
        follow_up_at: new Date(followupData.follow_up_at).toISOString(),
        purpose: followupData.purpose,
        assigned_to: lead.assigned_to || user.id,
      });
      showToast('Follow-up scheduled.', 'success');
      setScheduleModalOpen(false);
      setFollowupData({ follow_up_at: '', purpose: 'Phone Call' });
      fetchFollowups();
      fetchTimeline();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to schedule follow-up'), 'error');
    } finally {
      setScheduling(false);
    }
  };

  // Handle Follow-up Completion
  const handleCompleteFollowup = async (e) => {
    e.preventDefault();
    if (!completionOutcome.trim()) {
      showToast('Please provide an outcome note.', 'warning');
      return;
    }

    setCompleting(true);
    try {
      await followupApi.completeFollowUp(selectedFollowup.id, {
        outcome: completionOutcome.trim(),
      });
      showToast('Follow-up marked as completed.', 'success');
      setCompleteModalOpen(false);
      setSelectedFollowup(null);
      setCompletionOutcome('');
      fetchFollowups();
      fetchTimeline();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to complete follow-up'), 'error');
    } finally {
      setCompleting(false);
    }
  };

  if (loading || !lead) {
    return <LoadingSpinner text="Loading lead profile..." />;
  }

  const isQualified = lead.status === LEAD_STATUS.QUALIFIED;
  const isWon = lead.status === LEAD_STATUS.WON;

  return (
    <div className="lead-detail-page">
      {/* Back and Page Header */}
      <div className="page-header">
        <div>
          <Link to="/leads" className="contact-item mb-2" style={{ marginBottom: '0.5rem' }}>
            <ArrowLeft size={16} /> Back to Leads
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 className="page-title">{lead.name}</h1>
            <StatusBadge status={lead.status} />
            <PriorityBadge priority={lead.priority} />
          </div>
          <p className="page-subtitle">
            {lead.company_name ? `${lead.company_name} • ` : ''}Created on {formatDate(lead.created_at)}
          </p>
        </div>

        <div className="page-actions">
          {/* Convert to Customer Button (Qualified Leads Only) */}
          {canConvertLeads && isQualified && (
            <button
              type="button"
              className="btn btn-success"
              onClick={() => setConvertModalOpen(true)}
            >
              <UserCheck size={18} />
              <span>Convert to Customer</span>
            </button>
          )}

          {isWon && lead.customer_id && (
            <Link to={`/customers/${lead.customer_id}`} className="btn btn-secondary">
              <CheckCircle2 size={16} color="var(--success)" />
              <span>View Customer Record</span>
            </Link>
          )}

          {canAssignLeads && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAssignModalOpen(true)}
            >
              <Share2 size={16} />
              <span>Assign Lead</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleOpenAiSummary}
            title="Generate AI Lead Analysis"
          >
            <Sparkles size={16} color="#c084fc" />
            <span>AI Synthesis</span>
          </button>

          <Link to={`/leads/${id}/edit`} className="btn btn-secondary">
            <Edit size={16} />
            <span>Edit Profile</span>
          </Link>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setScheduleModalOpen(true)}
          >
            <CalendarPlus size={16} />
            <span>Schedule Follow-up</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Sidebar Profile + Tabbed Content */}
      <div className="lead-detail-layout">
        {/* Left Column: Lead Information Card */}
        <div className="lead-profile-sidebar">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem' }}>Contact Information</h3>
              {/* Quick Status Selector */}
              <select
                className="pipeline-move-select"
                value={lead.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                aria-label="Change Lead Status"
              >
                {Object.entries(LEAD_STATUS).map(([k, v]) => (
                  <option key={k} value={v}>
                    {v.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div className="lead-info-list">
              <div className="lead-info-item">
                <span className="lead-info-label">Phone</span>
                <span className="lead-info-value contact-item">
                  <Phone size={14} className="text-dim" />
                  <a href={`tel:${lead.phone}`}>{lead.phone}</a>
                </span>
              </div>

              <div className="lead-info-item">
                <span className="lead-info-label">Email</span>
                <span className="lead-info-value contact-item">
                  <Mail size={14} className="text-dim" />
                  {lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : '—'}
                </span>
              </div>

              <div className="lead-info-item">
                <span className="lead-info-label">Company</span>
                <span className="lead-info-value contact-item">
                  <Building2 size={14} className="text-dim" />
                  {lead.company_name || 'Individual'}
                </span>
              </div>

              <div className="lead-info-item">
                <span className="lead-info-label">Expected Deal Value</span>
                <span className="lead-info-value" style={{ fontFamily: 'Outfit', fontSize: '1.25rem', color: '#fbbf24' }}>
                  {formatCurrency(lead.expected_value)}
                </span>
              </div>

              <div className="lead-info-item">
                <span className="lead-info-label">Lead Source</span>
                <span className="lead-info-value">{lead.source_details?.name || 'N/A'}</span>
              </div>

              <div className="lead-info-item">
                <span className="lead-info-label">Assigned Representative</span>
                <span className="lead-info-value contact-item">
                  <User size={14} className="text-dim" />
                  {lead.assigned_to_details?.full_name || lead.assigned_to_details?.email || 'Unassigned'}
                </span>
              </div>

              {lead.address && (
                <div className="lead-info-item">
                  <span className="lead-info-label">Address</span>
                  <span className="lead-info-value contact-item">
                    <MapPin size={14} className="text-dim" />
                    {lead.address}
                  </span>
                </div>
              )}

              {lead.lost_reason && (
                <div className="lead-info-item" style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <span className="lead-info-label" style={{ color: 'var(--danger)' }}>Lost Reason</span>
                  <span style={{ fontSize: '0.875rem', color: '#fca5a5' }}>{lead.lost_reason}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Tabbed Communication Notes, Follow-ups, and Activity Timeline */}
        <div className="lead-detail-main">
          <div className="tabs-navigation">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'notes' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              <MessageSquarePlus size={16} />
              <span>Communication Notes</span>
              <span className="tab-badge">{notes.length}</span>
            </button>

            <button
              type="button"
              className={`tab-btn ${activeTab === 'followups' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('followups')}
            >
              <Clock size={16} />
              <span>Follow-ups</span>
              <span className="tab-badge">{followups.length}</span>
            </button>

            <button
              type="button"
              className={`tab-btn ${activeTab === 'timeline' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              <Activity size={16} />
              <span>Activity Audit Trail</span>
              <span className="tab-badge">{timeline.length}</span>
            </button>
          </div>

          {/* TAB 1: Communication Notes */}
          {activeTab === 'notes' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.125rem' }}>Notes & Interactions</h3>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setNewNoteModalOpen(true)}
                >
                  <MessageSquarePlus size={15} />
                  <span>+ Add Communication Note</span>
                </button>
              </div>

              {notes.length === 0 ? (
                <div className="card text-center" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                  <p className="text-muted">No communication notes recorded yet.</p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm mt-3"
                    style={{ margin: '1rem auto 0' }}
                    onClick={() => setNewNoteModalOpen(true)}
                  >
                    Add First Note
                  </button>
                </div>
              ) : (
                <div className="notes-feed">
                  {notes.map((note) => (
                    <div key={note.id} className="note-card">
                      <div className="note-card-header">
                        <div className="note-author-info">
                          <span className="note-type-pill">{note.note_type}</span>
                          <strong className="text-main font-sm">{note.user_name || note.user_email}</strong>
                        </div>
                        <span className="text-dim font-sm">{formatDateTime(note.created_at)}</span>
                      </div>
                      <div className="note-body-text">{note.note_text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Follow-ups */}
          {activeTab === 'followups' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.125rem' }}>Scheduled Follow-ups</h3>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setScheduleModalOpen(true)}
                >
                  <CalendarPlus size={15} />
                  <span>+ Schedule Follow-up</span>
                </button>
              </div>

              {followups.length === 0 ? (
                <div className="card text-center" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                  <p className="text-muted">No follow-ups scheduled for this lead.</p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm mt-3"
                    style={{ margin: '1rem auto 0' }}
                    onClick={() => setScheduleModalOpen(true)}
                  >
                    Schedule Now
                  </button>
                </div>
              ) : (
                <div className="notes-feed">
                  {followups.map((fu) => {
                    const isOverdue = fu.is_overdue || (fu.status === 'PENDING' && new Date(fu.follow_up_at) < new Date());
                    return (
                      <div key={fu.id} className="note-card">
                        <div className="note-card-header">
                          <div className="note-author-info">
                            <span className="text-main font-semibold">{fu.purpose}</span>
                            <span
                              className="status-badge"
                              style={{
                                color: isOverdue ? 'var(--danger)' : fu.status === 'COMPLETED' ? 'var(--success)' : '#38bdf8',
                                backgroundColor: isOverdue ? 'rgba(239, 68, 68, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                              }}
                            >
                              {isOverdue ? 'OVERDUE' : fu.status}
                            </span>
                          </div>
                          <span className="text-dim font-sm">
                            {formatDateTime(fu.follow_up_at)}
                          </span>
                        </div>

                        {fu.outcome && (
                          <div className="timeline-notes" style={{ marginTop: '0.5rem' }}>
                            <strong>Outcome:</strong> {fu.outcome}
                          </div>
                        )}

                        {fu.status === 'PENDING' && (
                          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              onClick={() => {
                                setSelectedFollowup(fu);
                                setCompleteModalOpen(true);
                              }}
                            >
                              <CheckCircle2 size={14} />
                              <span>Complete & Log Outcome</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Activity Timeline */}
          {activeTab === 'timeline' && (
            <div>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Activity History</h3>
              {timeline.length === 0 ? (
                <p className="text-muted">No logged activity for this lead.</p>
              ) : (
                <div className="timeline-container">
                  {timeline.map((act) => (
                    <div key={act.id} className="timeline-item">
                      <div className="timeline-dot" />
                      <div className="timeline-card">
                        <div className="timeline-header">
                          <span className="timeline-action">{act.action_display || act.action}</span>
                          <span className="timeline-time">{formatRelativeTime(act.created_at)}</span>
                        </div>
                        <div className="timeline-actor">
                          By: {act.performer_name || 'System / Automated'} ({formatDateTime(act.created_at)})
                        </div>
                        {act.notes && <div className="timeline-notes">{act.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Convert to Customer Modal */}
      <ConfirmModal
        isOpen={convertModalOpen}
        title="Convert Lead to Customer"
        message={`Are you sure you want to convert "${lead.name}" to an official customer? This will mark the lead status as WON, create a permanent Customer profile, and preserve the complete history.`}
        confirmText="Convert to Customer"
        loading={converting}
        onConfirm={handleConfirmConvert}
        onCancel={() => setConvertModalOpen(false)}
      />

      {/* Assign Lead Modal */}
      {assignModalOpen && (
        <div className="modal-backdrop" onClick={() => setAssignModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reassign Lead</h3>
              <button className="modal-close-btn" onClick={() => setAssignModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label className="form-label" htmlFor="reassign-select">Select Sales Representative</label>
              <select
                id="reassign-select"
                className="form-control mt-2"
                style={{ marginTop: '0.5rem' }}
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
              >
                <option value="">Select User</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email} ({u.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAssignModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmAssign} disabled={assigning || !selectedAssignee}>
                {assigning ? 'Assigning...' : 'Confirm Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {newNoteModalOpen && (
        <div className="modal-backdrop" onClick={() => setNewNoteModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Communication Note</h3>
              <button className="modal-close-btn" onClick={() => setNewNoteModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleAddNote}>
              <div className="modal-body form-layout">
                <div className="form-group">
                  <label className="form-label" htmlFor="note-type-select">Interaction Type</label>
                  <select
                    id="note-type-select"
                    className="form-control"
                    value={noteData.note_type}
                    onChange={(e) => setNoteData({ ...noteData, note_type: e.target.value })}
                  >
                    {NOTE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="note-text-area">Note Content</label>
                  <textarea
                    id="note-text-area"
                    className="form-control"
                    placeholder="Enter discussion summary, key objections, client requirements, or decisions..."
                    value={noteData.note_text}
                    onChange={(e) => setNoteData({ ...noteData, note_text: e.target.value })}
                    rows={4}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setNewNoteModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addingNote || !noteData.note_text.trim()}>
                  <Send size={15} />
                  <span>{addingNote ? 'Saving...' : 'Add Note'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Follow-up Modal */}
      {scheduleModalOpen && (
        <div className="modal-backdrop" onClick={() => setScheduleModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Schedule Follow-up</h3>
              <button className="modal-close-btn" onClick={() => setScheduleModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleScheduleFollowup}>
              <div className="modal-body form-layout">
                <div className="form-group">
                  <label className="form-label" htmlFor="schedule-purpose">Purpose</label>
                  <select
                    id="schedule-purpose"
                    className="form-control"
                    value={followupData.purpose}
                    onChange={(e) => setFollowupData({ ...followupData, purpose: e.target.value })}
                  >
                    {FOLLOWUP_PURPOSES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="schedule-time">Date & Time</label>
                  <input
                    id="schedule-time"
                    type="datetime-local"
                    className="form-control"
                    value={followupData.follow_up_at}
                    onChange={(e) => setFollowupData({ ...followupData, follow_up_at: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setScheduleModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={scheduling}>
                  {scheduling ? 'Scheduling...' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Follow-up Modal */}
      {completeModalOpen && (
        <div className="modal-backdrop" onClick={() => setCompleteModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Complete Follow-up</h3>
              <button className="modal-close-btn" onClick={() => setCompleteModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleCompleteFollowup}>
              <div className="modal-body form-layout">
                <p className="text-muted font-sm">
                  Marking <strong>{selectedFollowup?.purpose}</strong> as completed. Please log the outcome of the interaction:
                </p>
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="complete-outcome">Outcome Description</label>
                  <textarea
                    id="complete-outcome"
                    className="form-control"
                    placeholder="e.g. Call connected with VP of Operations. Agreed to proceed with demonstration next Tuesday..."
                    value={completionOutcome}
                    onChange={(e) => setCompletionOutcome(e.target.value)}
                    rows={3}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCompleteModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={completing || !completionOutcome.trim()}>
                  {completing ? 'Saving...' : 'Mark Completed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* AI Synthesis Modal */}
      {aiModalOpen && (
        <div className="modal-backdrop" onClick={() => setAiModalOpen(false)}>
          <div className="modal-container modal-container-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <Sparkles size={20} color="#a855f7" />
                <h3>AI Lead Synthesis & Recommendations</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setAiModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body form-layout">
              {loadingAi ? (
                <LoadingSpinner text="Analyzing historical notes and stage progression..." />
              ) : aiSummaryData ? (
                <>
                  <div style={{ background: 'rgba(168, 85, 247, 0.12)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '0.875rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <Bot size={20} color="#c084fc" />
                    <span className="font-sm" style={{ color: '#e9d5ff' }}>
                      {aiSummaryData.disclaimer}
                    </span>
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dim)', marginBottom: '0.375rem' }}>
                      Executive Summary
                    </h4>
                    <p style={{ color: '#ffffff', fontSize: '0.9375rem', lineHeight: 1.6 }}>
                      {aiSummaryData.data?.executive_summary}
                    </p>
                  </div>

                  <div className="form-grid-2">
                    <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <h4 style={{ fontSize: '0.8125rem', color: '#38bdf8', marginBottom: '0.5rem', fontWeight: 600 }}>
                        Identified Requirements
                      </h4>
                      <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {aiSummaryData.data?.customer_requirements?.map((req, i) => (
                          <li key={i} style={{ marginBottom: '0.25rem' }}>{req}</li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <h4 style={{ fontSize: '0.8125rem', color: '#fca5a5', marginBottom: '0.5rem', fontWeight: 600 }}>
                        Key Objections & Risk Factors
                      </h4>
                      <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        {aiSummaryData.data?.main_objections?.map((obj, i) => (
                          <li key={i} style={{ marginBottom: '0.25rem' }}>{obj}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                    <h4 style={{ fontSize: '0.8125rem', color: 'var(--success)', marginBottom: '0.375rem', fontWeight: 600 }}>
                      Recommended Next Action
                    </h4>
                    <p style={{ color: '#ffffff', fontSize: '0.9375rem', fontWeight: 500 }}>
                      {aiSummaryData.data?.recommended_next_action}
                    </p>
                  </div>
                </>
              ) : null}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setAiModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
