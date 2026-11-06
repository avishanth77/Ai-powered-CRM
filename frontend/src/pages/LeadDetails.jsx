import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { leadApi } from '../api/leadApi';
import { followupApi } from '../api/followupApi';
import { userApi } from '../api/userApi';
import { aiApi } from '../api/aiApi';
import { icpApi } from '../api/icpApi';
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
import { IcpQualificationHistory } from '../components/IcpQualificationHistory';
import { IcpQualificationLauncher } from '../components/IcpQualificationTest';
import { IcpStatusBadge } from '../components/IcpStatusBadge';
import LeadStageTasksTab from '../components/LeadStageTasksTab';
import StageTaskCheckpointModal from '../components/StageTaskCheckpointModal';
import StageTransitionModal from '../components/StageTransitionModal';
import ProductSelector from '../components/ProductSelector';
import { HubSpotLeadHeader } from '../components/hubspot/HubSpotLeadHeader';
import { HubSpotOverviewTab } from '../components/hubspot/HubSpotOverviewTab';
import { HubSpotActivitiesTab } from '../components/hubspot/HubSpotActivitiesTab';
import { HubSpotNotesCollabTab } from '../components/hubspot/HubSpotNotesCollabTab';
import { HubSpotHistoryTab } from '../components/hubspot/HubSpotHistoryTab';
import { CustomPropertiesModal } from '../components/hubspot/CustomPropertiesModal';
import '../styles/comments.css';
import '../styles/hubspot_lead.css';

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
  Gauge,
  TrendingUp,
  Loader2,
  CheckSquare,
  Package,
  X,
} from 'lucide-react';

export const LeadDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, canAssignLeads, canConvertLeads, canHandoverLeads } = useAuth();
  const { showToast } = useToast();

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [customPropsModalOpen, setCustomPropsModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Data for tabs & dropdowns
  const [stages, setStages] = useState([]);
  const [notes, setNotes] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [handovers, setHandovers] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // ICP Qualification state
  const [icpCount, setIcpCount] = useState(0);
  const [icpRefreshToken, setIcpRefreshToken] = useState(0);

  // PLD state


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
  const [checkpointModalData, setCheckpointModalData] = useState(null);
  const [transitionModalData, setTransitionModalData] = useState(null);
  const [transitionSubmitting, setTransitionSubmitting] = useState(false);
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
  const [isEditWinProbOpen, setIsEditWinProbOpen] = useState(false);
  const [isEditProductsOpen, setIsEditProductsOpen] = useState(false);
  const [editProductIds, setEditProductIds] = useState([]);
  const [isSubmittingProducts, setIsSubmittingProducts] = useState(false);
  const [editWinProbVal, setEditWinProbVal] = useState(10);
  const [editWinProbReason, setEditWinProbReason] = useState('');
  const [isSubmittingWinProb, setIsSubmittingWinProb] = useState(false);
  const winProbDialogRef = useDialogA11y(isEditWinProbOpen, () => {
    if (!isSubmittingWinProb) setIsEditWinProbOpen(false);
  });
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

  const fetchIcpHistory = useCallback(async () => {
    try {
      const res = await icpApi.getQualificationHistory(id);
      setIcpCount(asList(res.results).length);
    } catch {}
  }, [id]);


  useEffect(() => {
    fetchLeadDetails();
    fetchStages();
    fetchNotes();
    fetchTimeline();
    fetchFollowups();
    fetchHandovers();
    fetchIcpHistory();

    if (canAssignLeads || canHandoverLeads) {
      userApi.getUsers().then((res) => setUsersList(asList(res.results ?? res))).catch(() => {});
    }
  }, [fetchLeadDetails, fetchStages, fetchNotes, fetchTimeline, fetchFollowups, fetchHandovers, fetchIcpHistory, canAssignLeads, canHandoverLeads]);

  const handleIcpCompleted = useCallback((qualificationData) => {
    setIcpRefreshToken((prev) => prev + 1);
    fetchIcpHistory();
    fetchLeadDetails();
    if (qualificationData?.stage_advanced) {
      showToast(
        `ICP Qualified! Lead auto-advanced to ${qualificationData.new_stage || 'next stage'}.`,
        'success'
      );
    }
  }, [fetchIcpHistory, fetchLeadDetails, showToast]);


    // Step 1: Open Stage Progression Checkpoint FIRST on stage change
  const handleStageChange = (newStageId) => {
    const targetStageObj = stages.find((s) => s.id === parseInt(newStageId));
    if (!targetStageObj) {
      showToast('Could not update stage — the stage list is unavailable.', 'error');
      return;
    }
    const currentStageObj = stages.find((s) => s.id === (lead?.stage?.id || lead?.stage));
    const isLost = targetStageObj.slug === 'lost' || targetStageObj.name.toLowerCase() === 'lost';

    if (isLost) {
      // Direct lost reason modal
      setTransitionModalData({
        lead,
        sourceStage: currentStageObj?.name || lead?.stage_details?.name || lead?.status || 'Current Stage',
        targetStage: targetStageObj,
      });
      return;
    }

    // Step 1: Stage Progression Checkpoint Modal FIRST!
    setCheckpointModalData({
      lead,
      sourceStage: currentStageObj?.name || lead?.stage_details?.name || lead?.status || 'Current Stage',
      targetStage: targetStageObj,
    });
  };

  const handleProceedFromCheckpoint = ({ lead: l, targetStage, sourceStage }) => {
    setCheckpointModalData(null);
    setTransitionModalData({
      lead: l || lead,
      sourceStage: sourceStage || checkpointModalData?.sourceStage,
      targetStage,
    });
  };

  const handleConfirmTransition = async ({ targetStage, winProbability, winProbabilityReason, lostReason }) => {
    setTransitionSubmitting(true);
    try {
      const payload = {
        stage: targetStage.id,
        win_probability_override: winProbability,
        win_probability_reason: winProbabilityReason,
      };
      if (lostReason) {
        payload.lost_reason = lostReason;
      }

      const updateRes = await leadApi.updateLead(id, payload);
      const autoCount = updateRes?.automated_tasks?.length || 0;
      showToast(
        `Stage changed to ${targetStage.name}${autoCount > 0 ? ` (${autoCount} automated task${autoCount > 1 ? 's' : ''} assigned)` : ''}`,
        'success'
      );
      setTransitionModalData(null);
      fetchLeadDetails();
      fetchTimeline();
      fetchFollowups();
    } catch (err) {
      const errData = err.response?.data;
      const missingList =
        errData?.missing ||
        errData?.errors?.missing ||
        errData?.missing_codes ||
        errData?.errors?.missing_codes ||
        [];
      const errorMsg = String(errData?.message || errData?.errors?.stage || '');
      const hasStageTasksMissing =
        missingList.includes('mandatory_tasks') ||
        Boolean(errData?.missing_tasks?.length) ||
        errorMsg.toLowerCase().includes('mandatory task') ||
        errorMsg.toLowerCase().includes('manager approval') ||
        Boolean(errData?.manager_approval_required);

      if (hasStageTasksMissing) {
        setTransitionModalData(null);
        setCheckpointModalData({
          lead,
          targetStage: {
            ...targetStage,
            win_probability: winProbability,
            win_probability_reason: winProbabilityReason,
          },
          missingTasks: errData?.missing_tasks || [],
          errorMessage: errorMsg,
        });
      } else {
        showToast(extractErrorMessage(err, 'Stage update failed'), 'error');
      }
    } finally {
      setTransitionSubmitting(false);
    }
  };

  const handleOpenEditWinProb = () => {
    setEditWinProbVal(lead?.win_probability_override ?? lead?.win_probability ?? 10);
    setEditWinProbReason(lead?.win_probability_reason || '');
    setIsEditWinProbOpen(true);
  };

  const handleSaveWinProb = async (e) => {
    if (e) e.preventDefault();
    setIsSubmittingWinProb(true);
    try {
      const prob = parseInt(editWinProbVal, 10) || 0;
      await leadApi.updateLead(id, {
        win_probability_override: prob,
        win_probability_reason: (editWinProbReason || '').trim(),
      });
      showToast(`Win probability set to ${prob}% (constant across all stages)`, 'success');
      setIsEditWinProbOpen(false);
      fetchLeadDetails();
      fetchTimeline();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update win probability'), 'error');
    } finally {
      setIsSubmittingWinProb(false);
    }
  };

  const handleOpenEditProducts = () => {
    setEditProductIds(lead?.product_ids || lead?.products?.map((p) => p.id) || []);
    setIsEditProductsOpen(true);
  };

  const handleSaveProducts = async (e) => {
    if (e) e.preventDefault();
    setIsSubmittingProducts(true);
    try {
      await leadApi.updateLead(id, {
        product_ids: editProductIds,
      });
      showToast('Lead products updated successfully!', 'success');
      setIsEditProductsOpen(false);
      fetchLeadDetails();
      fetchTimeline();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update products'), 'error');
    } finally {
      setIsSubmittingProducts(false);
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

  const handleDeleteLead = async () => {
    setDeleting(true);
    try {
      await leadApi.deleteLead(id);
      showToast('Lead deleted successfully', 'success');
      navigate('/leads');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete lead'), 'error');
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
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
      {/* HubSpot Top Lead Profile Header */}
      <HubSpotLeadHeader
        lead={lead}
        stages={stages}
        onStageSelect={(stg) => handleStageChange(stg.id)}
        onEditLead={() => navigate(`/leads/${id}/edit`)}
        onLogCall={() => {
          setNoteData({ note_type: 'CALL', note_text: '' });
          setNewNoteModalOpen(true);
        }}
        onLogEmail={() => {
          setNoteData({ note_type: 'EMAIL', note_text: '' });
          setNewNoteModalOpen(true);
        }}
        onLogMeeting={() => {
          setNoteData({ note_type: 'MEETING', note_text: '' });
          setNewNoteModalOpen(true);
        }}
        onAddNote={() => {
          setNoteData({ note_type: 'GENERAL', note_text: '' });
          setNewNoteModalOpen(true);
        }}
        onNewTask={() => setActiveTab('stage-tasks')}
        onScheduleFollowup={() => setScheduleModalOpen(true)}
        onConvert={() => setConvertModalOpen(true)}
        onHandover={() => setHandoverModalOpen(true)}
        onAssign={() => setAssignModalOpen(true)}
        onMarkLost={() => {
          const lostStg = stages.find((s) => s.slug === 'lost' || s.name.toLowerCase() === 'lost');
          if (lostStg) {
            handleStageChange(lostStg.id);
          } else {
            setLostModalOpen(true);
          }
        }}
        onDelete={() => setDeleteConfirmOpen(true)}
        onOpenWinProb={handleOpenEditWinProb}
        canAssignLeads={canAssignLeads}
        canConvertLeads={canConvertLeads}
        canHandoverLeads={canHandoverLeads}
        isAdminOrManager={user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.is_superuser}
      />

      {/* HubSpot Navigation Tabs */}
      <div className="hs-tabs" role="tablist" style={{ marginTop: '1.25rem' }}>
        <button
          type="button"
          className={`hs-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <span>Overview</span>
        </button>

        <button
          type="button"
          className={`hs-tab-btn ${activeTab === 'activities' ? 'active' : ''}`}
          onClick={() => setActiveTab('activities')}
        >
          <span>Activities</span>
          <span className="hs-tab-pill">{notes.length + followups.length + timeline.length}</span>
        </button>

        <button
          type="button"
          className={`hs-tab-btn ${activeTab === 'stage-tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('stage-tasks')}
        >
          <span>Tasks & Pipeline Gates</span>
          {lead?.stage_task_summary && (
            <span
              className="hs-tab-pill"
              style={{
                backgroundColor: lead.stage_task_summary.mandatory_pending > 0 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                color: lead.stage_task_summary.mandatory_pending > 0 ? 'var(--warning)' : 'var(--success)',
              }}
            >
              {lead.stage_task_summary.completed}/{lead.stage_task_summary.total}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`hs-tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >
          <span>Notes & Team Collab</span>
          <span className="hs-tab-pill">{notes.length}</span>
        </button>

        <button
          type="button"
          className={`hs-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span>Audit History</span>
          <span className="hs-tab-pill">{timeline.length}</span>
        </button>

        <button
          type="button"
          className={`hs-tab-btn ${activeTab === 'icp' ? 'active' : ''}`}
          onClick={() => setActiveTab('icp')}
        >
          <span>ICP Fit</span>
          {icpCount > 0 && <span className="hs-tab-pill">{icpCount}</span>}
        </button>

        {(user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.is_superuser) && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
            onClick={() => setCustomPropsModalOpen(true)}
            title="Configure dynamic custom properties"
          >
            <Shield size={13} color="var(--primary)" />
            <span>Customize Fields</span>
          </button>
        )}
      </div>

      {/* Main Tab Panels */}
      <div style={{ marginTop: '1rem', marginBottom: '2rem' }}>
        {activeTab === 'overview' && (
          <HubSpotOverviewTab
            lead={lead}
            onViewTasksTab={() => setActiveTab('stage-tasks')}
            onViewActivitiesTab={() => setActiveTab('activities')}
            onScheduleFollowup={() => setScheduleModalOpen(true)}
            onOpenAiSummary={handleOpenAiSummary}
          />
        )}

        {activeTab === 'activities' && (
          <HubSpotActivitiesTab
            lead={lead}
            notes={notes}
            followups={followups}
            timeline={timeline}
            onLogCall={() => {
              setNoteData({ note_type: 'CALL', note_text: '' });
              setNewNoteModalOpen(true);
            }}
            onLogEmail={() => {
              setNoteData({ note_type: 'EMAIL', note_text: '' });
              setNewNoteModalOpen(true);
            }}
            onLogMeeting={() => {
              setNoteData({ note_type: 'MEETING', note_text: '' });
              setNewNoteModalOpen(true);
            }}
            onAddNote={() => {
              setNoteData({ note_type: 'GENERAL', note_text: '' });
              setNewNoteModalOpen(true);
            }}
            onCompleteFollowup={(f) => {
              setSelectedFollowup(f);
              setCompletionOutcome(f.outcome || '');
              setCompleteModalOpen(true);
            }}
          />
        )}

        {activeTab === 'stage-tasks' && (
          <LeadStageTasksTab
            lead={lead}
            stages={stages}
            users={usersList}
            onLeadUpdated={() => {
              fetchLeadDetails();
              fetchTimeline();
            }}
            onAdvanceStageClick={(targetStage) => {
              if (targetStage) {
                handleStageChange(targetStage.id);
              }
            }}
          />
        )}

        {activeTab === 'notes' && (
          <HubSpotNotesCollabTab
            lead={lead}
            notes={notes}
            onAddNote={() => {
              setNoteData({ note_type: 'GENERAL', note_text: '' });
              setNewNoteModalOpen(true);
            }}
          />
        )}

        {activeTab === 'history' && (
          <HubSpotHistoryTab
            timeline={timeline}
            handovers={handovers}
          />
        )}

        {activeTab === 'icp' && (
          <div className="hs-card" style={{ padding: '1.25rem' }}>
            <div className="icp-lead-panel-header" style={{ marginBottom: '1.5rem' }}>
              <div className="icp-lead-status">
                <span className="icp-lead-status-label">ICP Status</span>
                <IcpStatusBadge status={lead.icp_status} />
              </div>
              <IcpQualificationLauncher
                leadId={lead.id}
                leadName={lead.name}
                companyName={lead.company_name}
                onCompleted={(data) => handleIcpCompleted(data)}
                buttonLabel={icpCount > 0 ? 'Retake ICP Qualification' : 'Start ICP Qualification'}
              />
            </div>

            <h3 style={{ fontSize: '1.125rem', margin: '0 0 0.75rem 0' }}>
              ICP Qualification History
            </h3>
            <IcpQualificationHistory leadId={lead.id} refreshToken={icpRefreshToken} />
          </div>
        )}
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


      {/* Quick Edit Win Probability Modal */}
      {isEditWinProbOpen && (
        <div
          className="modal-backdrop"
          onClick={!isSubmittingWinProb ? () => setIsEditWinProbOpen(false) : undefined}
          role="dialog"
          aria-modal="true"
          style={{ zIndex: 1100 }}
        >
          <div
            className="modal-container"
            ref={winProbDialogRef}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', width: '100%' }}
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <div
                  className="modal-icon-badge"
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--primary)',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>
                    Set Win Probability (%)
                  </h3>
                  <p className="text-dim font-xs" style={{ margin: '2px 0 0 0' }}>
                    {lead?.name} • Stage: {lead?.stage_details?.name || 'Current'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsEditWinProbOpen(false)}
                disabled={isSubmittingWinProb}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveWinProb} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Win Probability Percentage
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.35rem' }}>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={editWinProbVal}
                    onChange={(e) => {
                      let num = parseInt(e.target.value, 10);
                      if (isNaN(num)) num = 0;
                      if (num < 0) num = 0;
                      if (num > 100) num = 100;
                      setEditWinProbVal(num);
                    }}
                    style={{
                      flex: 1,
                      accentColor: editWinProbVal === 100 ? 'var(--success)' : 'var(--primary)',
                      cursor: 'pointer',
                    }}
                  />
                  <div style={{ position: 'relative', width: '80px', flexShrink: 0 }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="form-control"
                      value={editWinProbVal}
                      onChange={(e) => {
                        let num = parseInt(e.target.value, 10);
                        if (isNaN(num)) num = 0;
                        if (num < 0) num = 0;
                        if (num > 100) num = 100;
                        setEditWinProbVal(num);
                      }}
                      style={{
                        paddingRight: '1.4rem',
                        fontWeight: 700,
                        textAlign: 'center',
                        fontSize: '0.9rem',
                        color: editWinProbVal === 100 ? 'var(--success)' : undefined,
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: '0.5rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-dim)',
                        fontSize: '0.8rem',
                        pointerEvents: 'none',
                      }}
                    >
                      %
                    </span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      border: editWinProbVal === 100 ? '1px solid var(--success)' : '1px solid var(--border-subtle)',
                      background: editWinProbVal === 100 ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                      color: editWinProbVal === 100 ? 'var(--success)' : 'var(--text-main)',
                      fontWeight: editWinProbVal === 100 ? 700 : 500,
                      cursor: 'pointer',
                    }}
                    onClick={() => setEditWinProbVal(100)}
                  >
                    🎯 100% (Guaranteed)
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      border: editWinProbVal === 75 ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                      background: editWinProbVal === 75 ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      color: editWinProbVal === 75 ? 'var(--primary)' : 'var(--text-main)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setEditWinProbVal(75)}
                  >
                    75%
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      border: editWinProbVal === 50 ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                      background: editWinProbVal === 50 ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      color: editWinProbVal === 50 ? 'var(--primary)' : 'var(--text-main)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setEditWinProbVal(50)}
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    style={{
                      fontSize: '0.72rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: 'var(--radius-sm)',
                      border: editWinProbVal === 25 ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                      background: editWinProbVal === 25 ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      color: editWinProbVal === 25 ? 'var(--primary)' : 'var(--text-main)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setEditWinProbVal(25)}
                  >
                    25%
                  </button>
                  {lead?.stage_details?.win_probability !== undefined && (
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-dim)',
                        cursor: 'pointer',
                      }}
                      onClick={() => setEditWinProbVal(lead.stage_details.win_probability)}
                    >
                      Stage Default ({lead.stage_details.win_probability}%)
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  Reason / Rationale
                </label>
                <textarea
                  rows={2}
                  className="form-control"
                  placeholder="e.g. Budget fully approved, decision makers committed 100%..."
                  value={editWinProbReason}
                  onChange={(e) => setEditWinProbReason(e.target.value)}
                  style={{ marginTop: '0.35rem' }}
                />
              </div>

              <div
                style={{
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.65rem 0.85rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-main)',
                }}
              >
                🔒 <strong>Constant across all stages:</strong> Once saved, this deal will retain {editWinProbVal}% Win Probability across all pipeline transitions until updated.
              </div>

              <div className="modal-actions" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsEditWinProbOpen(false)}
                  disabled={isSubmittingWinProb}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingWinProb}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {isSubmittingWinProb ? <Loader2 size={16} className="spinner" /> : <Check size={16} />}
                  Save Win Probability
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Products Modal */}
      {isEditProductsOpen && (
        <div
          className="modal-backdrop"
          onClick={!isSubmittingProducts ? () => setIsEditProductsOpen(false) : undefined}
          role="dialog"
          aria-modal="true"
          style={{ zIndex: 1100 }}
        >
          <div
            className="modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '580px', width: '100%' }}
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <div
                  className="modal-icon-badge"
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--primary)',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Package size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>
                    Manage Products for Deal
                  </h3>
                  <p className="text-dim font-xs" style={{ margin: '2px 0 0 0' }}>
                    {lead?.name} {lead?.company_name ? `• ${lead.company_name}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsEditProductsOpen(false)}
                disabled={isSubmittingProducts}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProducts} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <ProductSelector
                selectedProductIds={editProductIds}
                onChange={setEditProductIds}
              />

              <div className="modal-actions" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsEditProductsOpen(false)}
                  disabled={isSubmittingProducts}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmittingProducts}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {isSubmittingProducts ? <Loader2 size={16} className="spinner" /> : <Package size={16} />}
                  Save Products
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Step 1: Stage Progression Checkpoint Modal (FIRST) */}
      {checkpointModalData && (
        <StageTaskCheckpointModal
          isOpen={Boolean(checkpointModalData)}
          onClose={() => setCheckpointModalData(null)}
          lead={checkpointModalData.lead}
          targetStage={checkpointModalData.targetStage}
          sourceStage={checkpointModalData.sourceStage}
          missingTasks={checkpointModalData.missingTasks}
          errorMessage={checkpointModalData.errorMessage}
          isManagerOrAdmin={user?.role === 'ADMIN' || user?.role === 'MANAGER'}
          onProceedToWinProbability={handleProceedFromCheckpoint}
          onAdvanceSuccess={() => {
            showToast(`Lead advanced to ${checkpointModalData.targetStage?.name || 'next stage'} successfully!`, 'success');
            setCheckpointModalData(null);
            fetchLeadDetails();
            fetchTimeline();
          }}
        />
      )}

      {/* Step 2: Stage Transition & Win Probability Modal (SECOND) */}
      {transitionModalData && (
        <StageTransitionModal
          isOpen={Boolean(transitionModalData)}
          lead={transitionModalData.lead}
          sourceStage={transitionModalData.sourceStage}
          targetStage={transitionModalData.targetStage}
          loading={transitionSubmitting}
          onConfirm={handleConfirmTransition}
          onCancel={() => setTransitionModalData(null)}
          onBack={() => {
            const isLost =
              transitionModalData.targetStage?.slug === 'lost' ||
              transitionModalData.targetStage?.name?.toLowerCase() === 'lost';
            if (isLost) {
              setTransitionModalData(null);
              return;
            }
            const prev = transitionModalData;
            setTransitionModalData(null);
            setCheckpointModalData({
              lead: prev.lead,
              targetStage: prev.targetStage,
              sourceStage: prev.sourceStage,
            });
          }}
        />
      )}

      {/* Delete Lead Confirm Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Lead"
        message={`Are you sure you want to permanently delete lead "${lead?.name}"? All associated notes, activities, and tasks will be removed.`}
        confirmText="Delete Lead"
        loading={deleting}
        onConfirm={handleDeleteLead}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      {/* Dynamic Custom Properties Modal */}
      <CustomPropertiesModal
        isOpen={customPropsModalOpen}
        onClose={() => setCustomPropsModalOpen(false)}
        onPropertiesChanged={() => fetchLeadDetails()}
      />
    </div>
  );
};
