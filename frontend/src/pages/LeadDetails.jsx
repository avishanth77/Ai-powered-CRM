import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { leadApi } from '../api/leadApi';
import { followupApi } from '../api/followupApi';
import { userApi } from '../api/userApi';
import { aiApi } from '../api/aiApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDateTime, formatDate, formatRelativeTime, toLocalDateTimeInput } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';
import { useDialogA11y } from '../hooks/useDialogA11y';
import {
  LEAD_STATUS,
  NOTE_TYPES,
  FOLLOWUP_PURPOSES,
} from '../utils/constants';

import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ConfirmModal } from '../components/ConfirmModal';
import { LostReasonModal } from '../components/LostReasonModal';
import { InternalCommentsSection } from '../components/InternalCommentsSection';
import '../styles/comments.css';

import {
  ArrowLeft,
  Edit,
  UserCheck,
  CalendarPlus,
  MessageSquarePlus,
  MessageSquare,
  Clock,
  Activity,
  Phone,
  PhoneCall,
  Mic,
  FileText,
  Mail,
  Building2,
  MapPin,
  CheckCircle2,
  Share2,
  Send,
  Sparkles,
  Bot,
  Copy,
  Check,
  Target,
  ShieldAlert,
} from 'lucide-react';

export const LeadDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, canAssignLeads, canConvertLeads, canHandoverLeads } = useAuth();
  const { showToast } = useToast();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'notes'); // notes | followups | handovers | timeline | comments

  // Data for tabs & dropdowns
  const [stages, setStages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Modals state
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [converting, setConverting] = useState(false);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Handover state
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [handoverTarget, setHandoverTarget] = useState('');
  const [handoverReason, setHandoverReason] = useState('');
  const [handoverSubmitting, setHandoverSubmitting] = useState(false);

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

  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [pendingLostStageId, setPendingLostStageId] = useState(null);
  const [lostSubmitting, setLostSubmitting] = useState(false);

  // AI Summary State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiSummaryData, setAiSummaryData] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [copiedAction, setCopiedAction] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Dialog accessibility: Escape to close, focus trap, body scroll lock
  const assignDialogRef = useDialogA11y(assignModalOpen, () => setAssignModalOpen(false));
  const handoverDialogRef = useDialogA11y(handoverModalOpen, () => setHandoverModalOpen(false));
  const noteDialogRef = useDialogA11y(newNoteModalOpen, () => setNewNoteModalOpen(false));
  const scheduleDialogRef = useDialogA11y(scheduleModalOpen, () => setScheduleModalOpen(false));
  const completeDialogRef = useDialogA11y(completeModalOpen, () => setCompleteModalOpen(false));
  const aiDialogRef = useDialogA11y(aiModalOpen, () => setAiModalOpen(false));

  // Logged Call Summary Details Modal
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [activeCallSummary, setActiveCallSummary] = useState(null);
  const [loadingCallDetails, setLoadingCallDetails] = useState(false);
  const callDialogRef = useDialogA11y(callModalOpen, () => setCallModalOpen(false));

  const handleViewCallSummary = async (callId, actItem) => {
    setCallModalOpen(true);
    if (callId) {
      setLoadingCallDetails(true);
      try {
        const res = await aiApi.getCallById(callId);
        setActiveCallSummary(res);
      } catch {
        setActiveCallSummary({
          call_type: actItem.new_value?.call_type || 'Outbound',
          duration_seconds: actItem.new_value?.duration_seconds || 0,
          ai_summary: actItem.new_value?.ai_summary || actItem.notes,
          next_action: actItem.new_value?.next_action,
          customer_intent: actItem.new_value?.customer_intent,
          follow_up_date: actItem.new_value?.follow_up_date,
        });
      } finally {
        setLoadingCallDetails(false);
      }
    } else {
      setActiveCallSummary({
        call_type: actItem.new_value?.call_type || 'Outbound',
        duration_seconds: actItem.new_value?.duration_seconds || 0,
        ai_summary: actItem.new_value?.ai_summary || actItem.notes,
        next_action: actItem.new_value?.next_action,
        customer_intent: actItem.new_value?.customer_intent,
        follow_up_date: actItem.new_value?.follow_up_date,
      });
    }
  };

  const handleCopy = async (text, type) => {
    if (!text) return;
    if (!navigator.clipboard?.writeText) {
      showToast('Copy is not supported in this browser.', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      showToast('Copy failed — clipboard access was blocked.', 'error');
      return;
    }
    if (type === 'action') {
      setCopiedAction(true);
      setTimeout(() => setCopiedAction(false), 2000);
      showToast('Recommended action copied to clipboard', 'info');
    } else if (type === 'summary') {
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
      showToast('Executive summary copied to clipboard', 'info');
    }
  };

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
      showToast(extractErrorMessage(err, 'Failed to load lead profile'), 'error');
      navigate('/leads');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, showToast]);

  const fetchStages = useCallback(async () => {
    try {
      const res = await leadApi.getStages();
      setStages(res.results || (Array.isArray(res) ? res : []));
    } catch {}
  }, []);

  // Normalize list-shaped responses; a non-array payload must not blank the page.
  const asList = (value) => (Array.isArray(value) ? value : []);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await leadApi.getNotes(id);
      setNotes(asList(res.data ?? res));
    } catch {}
  }, [id]);

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await leadApi.getTimeline(id);
      setTimeline(asList(res.data ?? res));
    } catch {}
  }, [id]);

  const fetchFollowups = useCallback(async () => {
    try {
      const res = await followupApi.getFollowUps({ lead: id });
      setFollowups(asList(res.results ?? res));
    } catch {}
  }, [id]);

  const fetchHandovers = useCallback(async () => {
    try {
      const res = await leadApi.getLeadHandovers(id);
      setHandovers(asList(res.data ?? res));
    } catch {}
  }, [id]);

  useEffect(() => {
    fetchLeadDetails();
    fetchStages();
    fetchNotes();
    fetchTimeline();
    fetchFollowups();
    fetchHandovers();

    if (canAssignLeads || canHandoverLeads) {
      userApi.getUsers().then((res) => setUsersList(asList(res.results ?? res))).catch(() => {});
    }
  }, [fetchLeadDetails, fetchStages, fetchNotes, fetchTimeline, fetchFollowups, fetchHandovers, canAssignLeads, canHandoverLeads]);

  // Handle Quick Stage Change
  const handleStageChange = async (newStageId) => {
    const targetStageObj = stages.find((s) => s.id === parseInt(newStageId));
    if (!targetStageObj) {
      showToast('Could not update stage — the stage list is unavailable.', 'error');
      return;
    }
    const isLost = targetStageObj.slug === 'lost' || targetStageObj.name.toLowerCase() === 'lost';

    if (isLost) {
      setPendingLostStageId(parseInt(newStageId));
      setLostModalOpen(true);
      return;
    }

    try {
      await leadApi.updateLead(id, { stage: parseInt(newStageId) });
      showToast(`Stage changed to ${targetStageObj.name}`, 'success');
      fetchLeadDetails();
      fetchTimeline();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Stage update failed'), 'error');
    }
  };

  const handleConfirmLost = async (reason) => {
    if (!pendingLostStageId) return;
    setLostSubmitting(true);
    try {
      await leadApi.updateLead(id, { stage: pendingLostStageId, lost_reason: reason });
      showToast('Lead marked as Lost.', 'info');
      setLostModalOpen(false);
      setPendingLostStageId(null);
      fetchLeadDetails();
      fetchTimeline();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Stage update failed'), 'error');
    } finally {
      setLostSubmitting(false);
    }
  };

  // Handle Lead Handover (Admin & Sales Manager only)
  const handleConfirmHandover = async (e) => {
    e.preventDefault();
    if (!handoverTarget) {
      showToast('Please select a target Sales Executive.', 'warning');
      return;
    }
    if (!handoverReason.trim()) {
      showToast('Please provide a reason for the handover.', 'warning');
      return;
    }

    setHandoverSubmitting(true);
    try {
      await leadApi.handoverLead(id, {
        new_assigned_to: parseInt(handoverTarget),
        reason: handoverReason.trim(),
      });
      showToast('Lead handed over successfully.', 'success');
      setHandoverModalOpen(false);
      setHandoverTarget('');
      setHandoverReason('');
      fetchLeadDetails();
      fetchTimeline();
      fetchHandovers();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Lead handover failed'), 'error');
    } finally {
      setHandoverSubmitting(false);
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
      await leadApi.addNote(id, {
        ...noteData,
        lead: parseInt(id),
      });
      showToast('Communication note recorded successfully.', 'success');
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
    if (!completionOutcome.trim() || completionOutcome.trim().length < 3) {
      showToast('Please provide an outcome note (minimum 3 characters).', 'warning');
      return;
    }

    setCompleting(true);
    try {
      await followupApi.completeFollowUp(selectedFollowup.id, {
        outcome: completionOutcome.trim(),
      });
      showToast(
        selectedFollowup?.status === 'COMPLETED'
          ? 'Follow-up outcome updated!'
          : 'Follow-up marked as completed.',
        'success'
      );
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

  const handleReopenFollowup = async () => {
    if (!selectedFollowup) return;
    setCompleting(true);
    try {
      await followupApi.updateFollowUp(selectedFollowup.id, { status: 'PENDING' });
      showToast('Follow-up reopened as Pending!', 'success');
      setCompleteModalOpen(false);
      setSelectedFollowup(null);
      setCompletionOutcome('');
      fetchFollowups();
      fetchTimeline();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to reopen follow-up'), 'error');
    } finally {
      setCompleting(false);
    }
  };

  if (loading || !lead) {
    return <LoadingSpinner text="Loading lead profile..." />;
  }

  const isQualified =
    lead.stage_details?.slug === 'qualified' ||
    lead.stage?.slug === 'qualified' ||
    lead.status === LEAD_STATUS.QUALIFIED ||
    lead.stage_details?.name?.toLowerCase() === 'qualified';

  const isWon =
    lead.stage_details?.slug === 'won' ||
    lead.stage?.slug === 'won' ||
    lead.status === LEAD_STATUS.WON ||
    lead.stage_details?.name?.toLowerCase() === 'won';

  const eligibleExecutives = usersList.filter(
    (u) => u.is_active && u.role === 'EXECUTIVE' && u.id !== lead.assigned_to
  );

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
            <StatusBadge status={lead.stage_details || lead.status} />
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
            disabled={loadingAi}
          >
            <Sparkles size={16} color="#c084fc" />
            <span>{loadingAi ? 'Analyzing…' : 'AI Synthesis'}</span>
          </button>

          <Link
            to={`/ai/call-summary?lead=${id}`}
            className="btn btn-secondary"
            title="Record or Upload AI Voice Call Summary"
          >
            <Mic size={16} color="var(--primary)" />
            <span>AI Call Summary</span>
          </Link>

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
              {/* Quick Stage Selector */}
              <select
                className="pipeline-move-select"
                value={lead.stage || lead.stage_details?.id || ''}
                onChange={(e) => handleStageChange(e.target.value)}
                aria-label="Change Lead Stage"
                disabled={stages.length === 0}
              >
                {lead.stage_details && !stages.some((s) => s.id === lead.stage_details.id) && (
                  <option value={lead.stage_details.id}>{lead.stage_details.name}</option>
                )}
                {stages.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="lead-info-list">
              {/* Current Assignment Block */}
              <div
                className="lead-info-item"
                style={{
                  background: 'rgba(99, 102, 241, 0.08)',
                  padding: '0.875rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  marginBottom: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <div>
                    <span className="lead-info-label" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      Current Assignment
                    </span>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-main)', marginTop: '0.25rem' }}>
                      {lead.assigned_to_details?.full_name || lead.assigned_to_details?.email || 'Unassigned'}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.125rem' }}>
                      Role: {lead.assigned_to_details?.role === 'EXECUTIVE' ? 'Sales Executive' : (lead.assigned_to_details?.role || 'Sales Executive')}
                    </div>
                  </div>
                  {canHandoverLeads && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ padding: '0.35rem 0.625rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}
                      onClick={() => setHandoverModalOpen(true)}
                    >
                      <Share2 size={13} />
                      <span>Handover Lead</span>
                    </button>
                  )}
                </div>
              </div>
                <div className="lead-info-item">
                <span className="lead-info-label">Phone</span>
                <span className="lead-info-value contact-item">
                  <Phone size={14} className="text-dim" />
                  {lead.phone ? <a href={`tel:${lead.phone}`}>{lead.phone}</a> : '—'}
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
                <span className="lead-info-value" style={{ fontFamily: 'Outfit', fontSize: '1.25rem', color: 'var(--warning)' }}>
                  {formatCurrency(lead.expected_value)}
                </span>
              </div>

              <div className="lead-info-item">
                <span className="lead-info-label">Lead Source</span>
                <span className="lead-info-value">{lead.source_details?.name || 'N/A'}</span>
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
                  <span className="lost-reason-text">{lead.lost_reason}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Tabbed Communication Notes, Follow-ups, and Activity Timeline */}
        <div className="lead-detail-main">
          <div className="tabs-navigation" role="tablist" aria-label="Lead detail views">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'notes'}
              className={`tab-btn ${activeTab === 'notes' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('notes')}
            >
              <MessageSquarePlus size={16} />
              <span>Communication Notes</span>
              <span className="tab-badge">{notes.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'followups'}
              className={`tab-btn ${activeTab === 'followups' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('followups')}
            >
              <Clock size={16} />
              <span>Follow-ups</span>
              <span className="tab-badge">{followups.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'handovers'}
              className={`tab-btn ${activeTab === 'handovers' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('handovers')}
            >
              <Share2 size={16} />
              <span>Handover History</span>
              <span className="tab-badge">{handovers.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'timeline'}
              className={`tab-btn ${activeTab === 'timeline' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              <Activity size={16} />
              <span>Activity Audit Trail</span>
              <span className="tab-badge">{timeline.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'comments'}
              className={`tab-btn ${activeTab === 'comments' ? 'tab-btn-active' : ''}`}
              onClick={() => setActiveTab('comments')}
            >
              <MessageSquare size={16} />
              <span>Internal Discussion</span>
              <span className="tab-badge" style={{ background: 'rgba(124, 58, 237, 0.15)', color: 'var(--accent-purple)' }}>
                Team
              </span>
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

                        {fu.status !== 'COMPLETED' ? (
                          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                              type="button"
                              className="btn btn-success btn-sm"
                              onClick={() => {
                                setSelectedFollowup(fu);
                                setCompletionOutcome(fu.outcome || '');
                                setCompleteModalOpen(true);
                              }}
                              title="Complete task & log outcome"
                            >
                              <CheckCircle2 size={14} />
                              <span>Complete & Log Outcome</span>
                            </button>
                          </div>
                        ) : (
                          <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setSelectedFollowup(fu);
                                setCompletionOutcome(fu.outcome || '');
                                setCompleteModalOpen(true);
                              }}
                              title="View or update logged outcome"
                            >
                              <FileText size={14} />
                              <span>View / Edit Outcome</span>
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
                  {timeline.map((act) => {
                    const isCall = act.action === 'CALL_LOGGED';
                    return (
                      <div key={act.id} className="timeline-item">
                        <div
                          className="timeline-dot"
                          style={isCall ? { background: 'var(--primary)', borderColor: 'var(--primary)' } : undefined}
                        />
                        <div
                          className="timeline-card"
                          style={isCall ? { borderLeft: '3px solid var(--primary)' } : undefined}
                        >
                          <div className="timeline-header">
                            <span
                              className="timeline-action"
                              style={isCall ? { display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary)' } : undefined}
                            >
                              {isCall ? (
                                <>
                                  <Mic size={14} />
                                  <span>🎙 Call • {act.new_value?.call_type || 'Outbound'} Call</span>
                                </>
                              ) : (
                                act.action_display || act.action
                              )}
                            </span>
                            <span className="timeline-time">{formatRelativeTime(act.created_at)}</span>
                          </div>

                          <div className="timeline-actor">
                            By: {act.performer_name || 'System / Automated'}
                            {isCall && act.new_value?.duration_seconds !== undefined
                              ? ` • Duration: ${Math.floor(act.new_value.duration_seconds / 60)}:${String(act.new_value.duration_seconds % 60).padStart(2, '0')}`
                              : ''}{' '}
                            ({formatDateTime(act.created_at)})
                          </div>

                          {isCall && act.new_value?.ai_summary ? (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                AI Summary:
                              </div>
                              <div style={{ color: 'var(--text-main)', lineHeight: 1.5 }}>
                                {act.new_value.ai_summary}
                              </div>
                            </div>
                          ) : act.notes ? (
                            <div className="timeline-notes">{act.notes}</div>
                          ) : null}

                          {isCall && act.new_value?.next_action && (
                            <div style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-dim)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                                Next Action:
                              </div>
                              <div style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                {act.new_value.next_action}
                              </div>
                            </div>
                          )}

                          {isCall && (
                            <div style={{ marginTop: '0.75rem' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleViewCallSummary(act.new_value?.call_id, act)}
                              >
                                <FileText size={13} />
                                <span>View Summary</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Handover History */}
          {activeTab === 'handovers' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.125rem' }}>Ownership Handover History</h3>
                {canHandoverLeads && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setHandoverModalOpen(true)}
                  >
                    <Share2 size={14} />
                    <span>+ Handover Lead</span>
                  </button>
                )}
              </div>

              {handovers.length === 0 ? (
                <div className="card text-center" style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                  <p className="text-muted">No ownership handovers recorded for this lead.</p>
                  {canHandoverLeads && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm mt-3"
                      style={{ margin: '1rem auto 0' }}
                      onClick={() => setHandoverModalOpen(true)}
                    >
                      Initiate Handover
                    </button>
                  )}
                </div>
              ) : (
                <div className="timeline-container">
                  {handovers.map((item) => (
                    <div key={item.id} className="timeline-item">
                      <div className="timeline-dot" style={{ background: 'var(--primary)', borderColor: 'var(--primary)' }} />
                      <div className="timeline-card">
                        <div className="timeline-header">
                          <span className="timeline-action" style={{ color: 'var(--primary)' }}>
                            {item.previous_assignee_name || 'Unassigned'} → {item.new_assignee_name}
                          </span>
                          <span className="timeline-time">{formatRelativeTime(item.created_at)}</span>
                        </div>
                        <div className="timeline-actor">
                          Handed over by: <strong>{item.handed_over_by_name || 'Admin / Manager'}</strong> ({formatDateTime(item.created_at)})
                        </div>
                        <div className="timeline-notes" style={{ marginTop: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                          <strong>Reason:</strong> {item.reason}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Internal Team Discussion & Mentions */}
          {activeTab === 'comments' && (
            <div>
              <InternalCommentsSection leadId={lead.id} />
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

      {/* Lost Reason Modal */}
      <LostReasonModal
        isOpen={lostModalOpen}
        leadName={lead?.name}
        loading={lostSubmitting}
        onConfirm={handleConfirmLost}
        onCancel={() => {
          setLostModalOpen(false);
          setPendingLostStageId(null);
        }}
      />

      {/* Assign Lead Modal */}
      {assignModalOpen && (
        <div className="modal-backdrop" onClick={() => setAssignModalOpen(false)}>
          <div className="modal-container" ref={assignDialogRef} role="dialog" aria-modal="true" aria-label="Assign lead" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reassign Lead</h3>
              <button className="modal-close-btn" onClick={() => setAssignModalOpen(false)} aria-label="Close dialog">✕</button>
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
                {usersList
                  .filter((u) => u.is_active && u.role === 'EXECUTIVE')
                  .map((u) => (
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

      {/* Handover Lead Modal */}
      {handoverModalOpen && (
        <div className="modal-backdrop" onClick={() => setHandoverModalOpen(false)}>
          <div className="modal-container" ref={handoverDialogRef} role="dialog" aria-modal="true" aria-label="Handover lead" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3>Handover Lead</h3>
              <button className="modal-close-btn" onClick={() => setHandoverModalOpen(false)} aria-label="Close dialog">✕</button>
            </div>
            <form onSubmit={handleConfirmHandover}>
              <div className="modal-body form-layout">
                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lead</div>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '0.125rem' }}>
                    {lead.company_name ? `${lead.company_name} (${lead.name})` : lead.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.375rem' }}>
                    Current Executive: <strong style={{ color: 'var(--text-main)' }}>{lead.assigned_to_details?.full_name || lead.assigned_to_details?.email || 'Unassigned'}</strong>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="handover-target">Transfer To</label>
                  <select
                    id="handover-target"
                    className="form-control"
                    value={handoverTarget}
                    onChange={(e) => setHandoverTarget(e.target.value)}
                    required
                  >
                    <option value="">Select Sales Executive</option>
                    {eligibleExecutives.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </option>
                    ))}
                  </select>
                  {eligibleExecutives.length === 0 && (
                    <span className="form-error-msg" style={{ marginTop: '0.25rem' }}>
                      No eligible active Sales Executives found.
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="handover-reason">Reason</label>
                  <textarea
                    id="handover-reason"
                    className="form-control"
                    rows={3}
                    placeholder="e.g. Customer requested another executive, territory reassignment..."
                    value={handoverReason}
                    onChange={(e) => setHandoverReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setHandoverModalOpen(false)}>Cancel</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={handoverSubmitting || !handoverTarget || !handoverReason.trim()}
                >
                  <Share2 size={15} />
                  <span>{handoverSubmitting ? 'Transferring...' : 'Confirm Handover'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {newNoteModalOpen && (
        <div className="modal-backdrop" onClick={() => setNewNoteModalOpen(false)}>
          <div className="modal-container" ref={noteDialogRef} role="dialog" aria-modal="true" aria-label="Add communication note" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Communication Note</h3>
              <button className="modal-close-btn" onClick={() => setNewNoteModalOpen(false)} aria-label="Close dialog">✕</button>
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
          <div className="modal-container" ref={scheduleDialogRef} role="dialog" aria-modal="true" aria-label="Schedule follow-up" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Schedule Follow-up</h3>
              <button className="modal-close-btn" onClick={() => setScheduleModalOpen(false)} aria-label="Close dialog">✕</button>
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
                    min={toLocalDateTimeInput(new Date())}
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

      {/* Complete Follow-up / Outcome Modal */}
      {completeModalOpen && (
        <div className="modal-backdrop" onClick={() => setCompleteModalOpen(false)}>
          <div className="modal-container" ref={completeDialogRef} role="dialog" aria-modal="true" aria-label="Log follow-up outcome" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {selectedFollowup?.status === 'COMPLETED' ? (
                  <CheckCircle2 size={18} color="var(--success)" />
                ) : (
                  <Clock size={18} color="var(--primary)" />
                )}
                <h3 style={{ margin: 0 }}>
                  {selectedFollowup?.status === 'COMPLETED'
                    ? 'Follow-up Outcome & Details'
                    : 'Complete Follow-up'}
                </h3>
              </div>
              <button className="modal-close-btn" onClick={() => setCompleteModalOpen(false)} aria-label="Close dialog">✕</button>
            </div>
            <form onSubmit={handleCompleteFollowup}>
              <div className="modal-body form-layout">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <p className="text-muted font-sm" style={{ margin: 0 }}>
                    Target: <strong>{lead?.name}</strong> ({selectedFollowup?.purpose})
                  </p>
                  <span
                    className="status-badge"
                    style={{
                      color: selectedFollowup?.status === 'COMPLETED' ? 'var(--success)' : '#38bdf8',
                      backgroundColor: selectedFollowup?.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.12)',
                    }}
                  >
                    {selectedFollowup?.status}
                  </span>
                </div>
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="complete-outcome">Outcome Description</label>
                  <textarea
                    id="complete-outcome"
                    className="form-control"
                    placeholder="e.g. Call connected with VP of Operations. Agreed to proceed with demonstration next Tuesday (min 3 chars)..."
                    value={completionOutcome}
                    onChange={(e) => setCompletionOutcome(e.target.value)}
                    rows={4}
                    minLength={3}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  {selectedFollowup?.status === 'COMPLETED' && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleReopenFollowup}
                      disabled={completing}
                      title="Change status back to Pending"
                    >
                      <Clock size={14} />
                      <span>Reopen as Pending</span>
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setCompleteModalOpen(false)}>Cancel</button>
                  <button
                    type="submit"
                    className={selectedFollowup?.status === 'COMPLETED' ? 'btn btn-primary' : 'btn btn-success'}
                    disabled={completing || completionOutcome.trim().length < 3}
                  >
                    {completing
                      ? 'Saving...'
                      : selectedFollowup?.status === 'COMPLETED'
                      ? 'Update Outcome'
                      : 'Mark Completed'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* AI Synthesis Modal */}
      {aiModalOpen && (
        <div className="modal-backdrop" onClick={() => setAiModalOpen(false)}>
          <div className="modal-container modal-container-lg" ref={aiDialogRef} role="dialog" aria-modal="true" aria-label="AI lead synthesis" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-row">
                <Sparkles size={20} color="var(--accent-purple, #7c3aed)" />
                <h3 style={{ margin: 0 }}>AI Lead Synthesis & Recommendations</h3>
              </div>
              <button className="modal-close-btn" onClick={() => setAiModalOpen(false)} aria-label="Close dialog">✕</button>
            </div>
            <div className="modal-body">
              {loadingAi ? (
                <div style={{ padding: '2rem 0' }}>
                  <LoadingSpinner text="Synthesizing historical notes, stage progression, and client intent..." />
                </div>
              ) : aiSummaryData ? (
                <div className="ai-modal-content">
                  {/* AI Disclaimer */}
                  <div className="ai-disclaimer-banner">
                    <Bot size={20} color="var(--accent-purple, #7c3aed)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <p className="ai-disclaimer-text">
                      <strong>AI Advisory:</strong> {aiSummaryData.disclaimer || 'Generated based on notes, touchpoints, and timeline history for this lead.'}
                    </p>
                  </div>

                  {/* Executive Summary Card */}
                  <div className="ai-card">
                    <div className="ai-card-header">
                      <h4 className="ai-card-title">
                        <Sparkles size={14} color="var(--accent-purple, #7c3aed)" />
                        <span>Executive Summary</span>
                      </h4>
                      {aiSummaryData.data?.executive_summary && (
                        <button
                          type="button"
                          className="ai-copy-btn"
                          onClick={() => handleCopy(aiSummaryData.data.executive_summary, 'summary')}
                          title="Copy executive summary"
                        >
                          {copiedSummary ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                          <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>
                    <p className="ai-card-body">
                      {aiSummaryData.data?.executive_summary || 'No summary generated yet.'}
                    </p>
                  </div>

                  {/* Requirements & Objections Grid */}
                  <div className="form-grid-2">
                    <div className="ai-card">
                      <div className="ai-card-header">
                        <h4 className="ai-card-title" style={{ color: 'var(--info, #0284c7)' }}>
                          <Target size={15} color="var(--info, #0284c7)" />
                          <span>Identified Requirements</span>
                        </h4>
                      </div>
                      {aiSummaryData.data?.customer_requirements?.length > 0 ? (
                        <ul className="ai-list">
                          {aiSummaryData.data.customer_requirements.map((req, i) => (
                            <li key={i}>{req}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted font-sm" style={{ margin: 0, fontStyle: 'italic' }}>
                          No specific technical or commercial requirements logged yet.
                        </p>
                      )}
                    </div>

                    <div className="ai-card">
                      <div className="ai-card-header">
                        <h4 className="ai-card-title" style={{ color: 'var(--danger, #e11d48)' }}>
                          <ShieldAlert size={15} color="var(--danger, #e11d48)" />
                          <span>Key Objections & Risks</span>
                        </h4>
                      </div>
                      {aiSummaryData.data?.main_objections?.length > 0 ? (
                        <ul className="ai-list">
                          {aiSummaryData.data.main_objections.map((obj, i) => (
                            <li key={i}>{obj}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted font-sm" style={{ margin: 0, fontStyle: 'italic' }}>
                          No significant client objections or blockers recorded.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Recommended Next Action Card */}
                  <div className="ai-recommendation-card">
                    <div className="ai-rec-title">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <CheckCircle2 size={16} color="var(--primary)" />
                        <span>Recommended Next Action</span>
                      </div>
                      {aiSummaryData.data?.recommended_next_action && (
                        <button
                          type="button"
                          className="ai-copy-btn"
                          onClick={() => handleCopy(aiSummaryData.data.recommended_next_action, 'action')}
                          title="Copy recommended action"
                        >
                          {copiedAction ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                          <span>{copiedAction ? 'Copied' : 'Copy Action'}</span>
                        </button>
                      )}
                    </div>
                    <p className="ai-rec-text">
                      {aiSummaryData.data?.recommended_next_action || 'Continue standard follow-up cycle.'}
                    </p>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={Sparkles}
                  title="Summary unavailable"
                  message="The AI summary could not be generated. Please try again."
                  actionLabel="Retry"
                  onAction={handleOpenAiSummary}
                />
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setAiModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Call Summary Inspection Modal */}
      {callModalOpen && (
        <div className="modal-backdrop" onClick={() => setCallModalOpen(false)}>
          <div
            ref={callDialogRef}
            className="modal-container modal-container-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="call-summary-modal-title"
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <Mic size={20} color="var(--primary)" />
                <h3 id="call-summary-modal-title">
                  {activeCallSummary?.call_type || 'Outbound'} Call Intelligence
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setCallModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {loadingCallDetails ? (
                <div style={{ padding: '3rem', textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                  <p className="text-muted">Loading call intelligence details...</p>
                </div>
              ) : activeCallSummary ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Call meta */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      flexWrap: 'wrap',
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-surface-elevated)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <span><strong>Call Type:</strong> {activeCallSummary.call_type || 'Outbound'}</span>
                    <span>•</span>
                    <span>
                      <strong>Duration:</strong>{' '}
                      {Math.floor((activeCallSummary.duration_seconds || 0) / 60)}:
                      {String((activeCallSummary.duration_seconds || 0) % 60).padStart(2, '0')}
                    </span>
                    {activeCallSummary.customer_intent && (
                      <>
                        <span>•</span>
                        <span className="badge badge-success">
                          {activeCallSummary.customer_intent}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Summary */}
                  <div>
                    <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
                      AI Executive Summary
                    </h4>
                    <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text-main)', margin: 0 }}>
                      {activeCallSummary.ai_summary || 'No summary text available.'}
                    </p>
                  </div>

                  {/* Next Action */}
                  {activeCallSummary.next_action && (
                    <div
                      style={{
                        padding: '0.875rem 1rem',
                        background: 'var(--primary-subtle)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--primary-glow)',
                      }}
                    >
                      <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.25rem', fontWeight: 700 }}>
                        Recommended Next Action
                      </h4>
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-main)' }}>
                        {activeCallSummary.next_action}
                      </p>
                    </div>
                  )}

                  {/* Key Points */}
                  {activeCallSummary.key_points?.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
                        Key Discussion Points
                      </h4>
                      <ul className="summary-bullet-list">
                        {activeCallSummary.key_points.map((pt, i) => (
                          <li key={i}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Requirements & Objections Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    {activeCallSummary.customer_requirements?.length > 0 && (
                      <div className="card" style={{ padding: '1rem', background: 'var(--bg-surface-elevated)' }}>
                        <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                          Customer Requirements
                        </h4>
                        <ul className="summary-bullet-list">
                          {activeCallSummary.customer_requirements.map((req, i) => (
                            <li key={i}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {activeCallSummary.objections?.length > 0 && (
                      <div className="card" style={{ padding: '1rem', background: 'var(--bg-surface-elevated)' }}>
                        <h4 style={{ fontSize: '0.8125rem', textTransform: 'uppercase', color: 'var(--danger)', marginBottom: '0.5rem' }}>
                          Customer Objections
                        </h4>
                        <ul className="summary-bullet-list">
                          {activeCallSummary.objections.map((obj, i) => (
                            <li key={i}>{obj}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Transcript */}
                  {activeCallSummary.transcript && (
                    <div>
                      <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: '0.35rem' }}>
                        Call Transcript
                      </h4>
                      <div className="transcript-card" style={{ maxHeight: 200 }}>
                        {activeCallSummary.transcript}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted">No call details found.</p>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCallModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
