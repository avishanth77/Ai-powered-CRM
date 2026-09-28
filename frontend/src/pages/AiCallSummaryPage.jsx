import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Mic,
  Upload,
  FileText,
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  ArrowLeft,
  Save,
  CalendarPlus,
  Edit3,
  Check,
  AlertCircle,
  FileAudio,
  X,
  PhoneCall,
  Mail,
  Copy,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { leadApi } from '../api/leadApi';
import { aiApi } from '../api/aiApi';
import { followupApi } from '../api/followupApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AudioRecorder } from '../components/AudioRecorder';
import { toLocalDateKey } from '../utils/formatters';

const STAGES = {
  IDLE: 'IDLE',
  UPLOADING: 'Uploading audio...',
  TRANSCRIBING: 'Transcribing conversation...',
  ANALYZING: 'Analyzing transcript & intents...',
  SUMMARIZING: 'Generating structured CRM summary...',
  SAVING: 'Saving call...',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
};

export const AiCallSummaryPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const preselectedLeadId = searchParams.get('lead');

  // Form Inputs
  const [leads, setLeads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(preselectedLeadId || '');
  const [callType, setCallType] = useState('Outbound');
  const [callDate, setCallDate] = useState(() => toLocalDateKey(new Date()));
  const [durationMinutes, setDurationMinutes] = useState('12');
  const [durationSeconds, setDurationSeconds] = useState('35');
  const [callNotes, setCallNotes] = useState('');

  // Audio state
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);
  const [uploadedAudioFile, setUploadedAudioFile] = useState(null);
  const fileInputRef = useRef(null);

  // Processing state
  const [processingStatus, setProcessingStatus] = useState(STAGES.IDLE);
  const [processingError, setProcessingError] = useState(null);

  // Results state
  const [resultTranscript, setResultTranscript] = useState('');
  const [resultSummary, setResultSummary] = useState(null);
  const [savedCallId, setSavedCallId] = useState(null);

  // Transcript Edit state
  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [editedTranscriptText, setEditedTranscriptText] = useState('');
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // Summary Edit state
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummaryText, setEditedSummaryText] = useState('');
  const [editedNextAction, setEditedNextAction] = useState('');

  // Action status
  const [isSavingCall, setIsSavingCall] = useState(false);
  const [isSavedToLead, setIsSavedToLead] = useState(false);

  // Follow-up Confirmation Modal state
  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const [followupDate, setFollowupDate] = useState('');
  const [followupNotes, setFollowupNotes] = useState('');
  const [followupPurpose, setFollowupPurpose] = useState('Phone Call');
  const [isSchedulingFollowup, setIsSchedulingFollowup] = useState(false);

  // Email Draft Modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);

  // Load leads list
  useEffect(() => {
    leadApi
      .getLeads({ page_size: 100 })
      .then((res) => {
        const list = res.results || (Array.isArray(res) ? res : res.data || []);
        setLeads(list);
        if (!selectedLeadId && list.length > 0) {
          setSelectedLeadId(list[0].id.toString());
        }
      })
      .catch(() => {});
  }, []);

  // Update preselected lead if query param changes
  useEffect(() => {
    if (preselectedLeadId) {
      setSelectedLeadId(preselectedLeadId);
    }
  }, [preselectedLeadId]);

  const handleAudioUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate empty file
    if (file.size === 0) {
      showToast('The uploaded file is empty (0 bytes). Please upload a valid audio file.', 'error');
      return;
    }

    // Validate audio format (.mp3, .wav, .m4a, .webm)
    const validExtensions = ['.mp3', '.wav', '.m4a', '.webm', '.ogg'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext)) || file.type.startsWith('audio/');

    if (!isValid) {
      showToast('Unsupported audio format. Please upload an .mp3, .wav, .m4a, or .webm audio file.', 'error');
      return;
    }

    // Validate size (max 25MB)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('Audio file exceeds 25MB limit. Please upload a smaller recording.', 'error');
      return;
    }

    setUploadedAudioFile(file);
    setRecordedAudioBlob(null);
    setProcessingError(null);
    showToast(`Loaded ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`, 'info');
  };

  const handleRecordingComplete = (blob, seconds) => {
    setRecordedAudioBlob(blob);
    setUploadedAudioFile(null);
    setProcessingError(null);
    if (seconds > 0) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      setDurationMinutes(String(mins));
      setDurationSeconds(String(secs).padStart(2, '0'));
    }
    showToast('Voice note captured. Click "Analyze Call" to process.', 'success');
  };

  const handleRecordingReset = () => {
    setRecordedAudioBlob(null);
  };

  const handleAnalyzeCall = async () => {
    if (!selectedLeadId) {
      showToast('Please select a lead before analyzing the call.', 'warning');
      return;
    }

    if (!uploadedAudioFile && !recordedAudioBlob && !callNotes.trim()) {
      showToast('Please record audio, upload an audio file, or enter call notes.', 'warning');
      return;
    }

    setProcessingError(null);
    setResultTranscript('');
    setResultSummary(null);
    setIsSavedToLead(false);

    try {
      const totalDurationSecs = (parseInt(durationMinutes) || 0) * 60 + (parseInt(durationSeconds) || 0);

      const formData = new FormData();
      formData.append('lead_id', selectedLeadId);
      formData.append('notes', callNotes);
      formData.append('call_type', callType);
      formData.append('duration_seconds', totalDurationSecs);

      if (uploadedAudioFile) {
        setProcessingStatus(STAGES.UPLOADING);
        formData.append('audio_file', uploadedAudioFile);
      } else if (recordedAudioBlob) {
        setProcessingStatus(STAGES.UPLOADING);
        formData.append('audio_file', recordedAudioBlob, 'recording.webm');
      } else {
        setProcessingStatus(STAGES.ANALYZING);
      }

      // Transition to real transcription stage after upload request initiated
      setTimeout(() => {
        setProcessingStatus((curr) => (curr === STAGES.UPLOADING ? STAGES.TRANSCRIBING : curr));
      }, 700);

      // Transition to real analysis stage
      setTimeout(() => {
        setProcessingStatus((curr) => (curr === STAGES.TRANSCRIBING ? STAGES.ANALYZING : curr));
      }, 1800);

      const res = await aiApi.generateCallSummary(formData);

      setProcessingStatus(STAGES.SUMMARIZING);

      const summaryData = res?.data?.summary || res?.summary;
      const transcriptData = res?.data?.transcript || res?.transcript;

      setResultTranscript(transcriptData || '');
      setEditedTranscriptText(transcriptData || '');
      setResultSummary(summaryData);
      setEditedSummaryText(summaryData?.summary || '');
      setEditedNextAction(summaryData?.next_action || '');

      setProcessingStatus(STAGES.COMPLETED);
      showToast('AI speech transcription & deal analysis completed!', 'success');
    } catch (err) {
      setProcessingStatus(STAGES.FAILED);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        'Unable to analyze this recording. The AI service could not process the audio. Please try again.';
      setProcessingError(errMsg);
      showToast(errMsg, 'error');
    }
  };

  // Save Call to Lead in Backend CRM
  const handleSaveToLead = async () => {
    if (!resultSummary || !selectedLeadId) return;

    setIsSavingCall(true);
    try {
      const totalDurationSecs = (parseInt(durationMinutes) || 0) * 60 + (parseInt(durationSeconds) || 0);

      const callPayload = {
        lead: parseInt(selectedLeadId),
        call_type: callType,
        started_at: `${callDate}T10:00:00Z`,
        duration_seconds: totalDurationSecs,
        transcript: editedTranscriptText || resultTranscript,
        ai_summary: editedSummaryText || resultSummary.summary,
        key_points: resultSummary.key_points || [],
        customer_requirements: resultSummary.customer_requirements || [],
        objections: resultSummary.objections || resultSummary.customer_objections || [],
        customer_intent: resultSummary.customer_intent || 'Interested',
        next_action: editedNextAction || resultSummary.next_action || '',
        follow_up_date: resultSummary.follow_up_date || null,
        processing_status: 'COMPLETED',
      };

      const res = await aiApi.createCall(callPayload);
      const callId = res?.id || res?.data?.id;
      setSavedCallId(callId);
      setIsSavedToLead(true);
      showToast('Call, transcript, and AI summary saved to lead timeline!', 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Failed to save call to lead.';
      showToast(msg, 'error');
    } finally {
      setIsSavingCall(false);
    }
  };

  // Re-analyze Call with Edited Transcript
  const handleReanalyzeTranscript = async () => {
    if (!editedTranscriptText.trim()) {
      showToast('Transcript cannot be empty.', 'warning');
      return;
    }

    setIsReanalyzing(true);
    try {
      const totalDurationSecs = (parseInt(durationMinutes) || 0) * 60 + (parseInt(durationSeconds) || 0);
      const formData = new FormData();
      formData.append('lead_id', selectedLeadId);
      formData.append('notes', editedTranscriptText);
      formData.append('call_type', callType);
      formData.append('duration_seconds', totalDurationSecs);

      const res = await aiApi.generateCallSummary(formData);
      const summaryData = res?.data?.summary || res?.summary;

      setResultTranscript(editedTranscriptText);
      setResultSummary(summaryData);
      setEditedSummaryText(summaryData?.summary || '');
      setEditedNextAction(summaryData?.next_action || '');
      setIsEditingTranscript(false);

      // If call is already saved in database, update it on backend too
      if (savedCallId) {
        await aiApi.updateCallTranscript(savedCallId, editedTranscriptText, true);
      }

      showToast('AI analysis regenerated with updated transcript!', 'success');
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to re-analyze transcript.', 'error');
    } finally {
      setIsReanalyzing(false);
    }
  };

  // Open Follow-up Confirmation Dialog
  const handleOpenFollowupModal = () => {
    const targetDate = resultSummary?.follow_up_date || callDate;
    setFollowupDate(targetDate);
    setFollowupNotes(`AI Suggested: ${editedNextAction || resultSummary?.next_action || 'Follow up with customer'}`);
    setFollowupPurpose('Phone Call');
    setFollowupModalOpen(true);
  };

  // Confirm Follow-up Creation via Existing CRM Followup API
  const handleConfirmFollowup = async (e) => {
    e.preventDefault();
    if (!selectedLeadId || !followupDate) {
      showToast('Please specify a follow-up date.', 'warning');
      return;
    }

    setIsSchedulingFollowup(true);
    try {
      const followUpDateTime = `${followupDate}T10:00:00Z`;

      await followupApi.createFollowUp({
        lead: parseInt(selectedLeadId),
        follow_up_at: followUpDateTime,
        purpose: followupPurpose,
        notes: followupNotes,
      });

      setFollowupModalOpen(false);
      showToast(`Follow-up confirmed & scheduled for ${followupDate}!`, 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Failed to schedule follow-up.';
      showToast(msg, 'error');
    } finally {
      setIsSchedulingFollowup(false);
    }
  };

  // Open Email Draft Modal
  const handleOpenEmailModal = () => {
    const leadObj = leads.find((l) => l.id.toString() === selectedLeadId.toString());
    const leadName = leadObj?.name || 'Customer';
    const compName = leadObj?.company_name || 'your organization';

    setEmailSubject(`Follow-up: Discussion regarding CRM Lite with ${compName}`);

    const nextAct = editedNextAction || resultSummary?.next_action || 'Review our proposed solution';
    const reqList = (resultSummary?.customer_requirements || []).map((r) => `  • ${r}`).join('\n');

    const draft = `Dear ${leadName},

Thank you for taking the time to speak with us today.

Following up on our conversation, we noted your key requirements:
${reqList || '  • Tailored CRM solution with dedicated support'}

As agreed, our next step is to:
${nextAct}

Please let me know if you have any questions or require additional details.

Best regards,
${user?.first_name || 'Sales'} ${user?.last_name || 'Executive'}
CRM Lite Team`;

    setEmailBody(draft);
    setEmailModalOpen(true);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(`Subject: ${emailSubject}\n\n${emailBody}`);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
    showToast('Email draft copied to clipboard!', 'success');
  };

  const selectedLeadObj = leads.find((l) => l.id.toString() === selectedLeadId.toString());
  const isBusy = processingStatus !== STAGES.IDLE && processingStatus !== STAGES.COMPLETED && processingStatus !== STAGES.FAILED;

  return (
    <div className="ai-center-page">
      <div className="page-header">
        <div>
          <Link to="/ai" className="contact-item mb-2" style={{ marginBottom: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <ArrowLeft size={16} /> Back to AI Center
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 className="page-title">AI Call Summary</h1>
            <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <Mic size={13} />
              <span>Real Speech-to-Text & Gemini AI</span>
            </span>
          </div>
          <p className="page-subtitle">
            Transcribe real customer audio recordings, extract structured deal intelligence, and automate CRM updates.
          </p>
        </div>

        {selectedLeadId && (
          <div className="page-actions">
            <Link to={`/leads/${selectedLeadId}?tab=timeline`} className="btn btn-secondary btn-sm">
              <User size={14} />
              <span>View Lead Timeline</span>
            </Link>
          </div>
        )}
      </div>

      <div className="call-summary-workflow">
        {/* LEFT COLUMN: Input Configuration & Audio Capture */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <h3 style={{ fontSize: '1.0625rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <PhoneCall size={18} color="var(--primary)" />
              <span>Call Information</span>
            </h3>

            {/* Select Lead */}
            <div className="form-group mb-3">
              <label className="form-label" htmlFor="lead-select">
                Select Lead <span className="text-danger">*</span>
              </label>
              <select
                id="lead-select"
                className="form-control"
                value={selectedLeadId}
                onChange={(e) => setSelectedLeadId(e.target.value)}
                disabled={isBusy}
              >
                <option value="">-- Choose a CRM Lead --</option>
                {leads.map((ld) => (
                  <option key={ld.id} value={ld.id}>
                    {ld.name} {ld.company_name ? `(${ld.company_name})` : ''} — {ld.stage_details?.name || ld.status}
                  </option>
                ))}
              </select>
            </div>

            {/* Call Type, Date, Duration Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="call-type">Call Type</label>
                <select
                  id="call-type"
                  className="form-control"
                  value={callType}
                  onChange={(e) => setCallType(e.target.value)}
                  disabled={isBusy}
                >
                  <option value="Outbound">Outbound</option>
                  <option value="Inbound">Inbound</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="call-date">Call Date</label>
                <input
                  id="call-date"
                  type="date"
                  className="form-control"
                  value={callDate}
                  onChange={(e) => setCallDate(e.target.value)}
                  disabled={isBusy}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Duration (mm:ss)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    className="form-control"
                    placeholder="12"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    disabled={isBusy}
                    aria-label="Duration Minutes"
                    style={{ textAlign: 'center' }}
                  />
                  <span>:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    className="form-control"
                    placeholder="35"
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(e.target.value)}
                    disabled={isBusy}
                    aria-label="Duration Seconds"
                    style={{ textAlign: 'center' }}
                  />
                </div>
              </div>
            </div>

            {/* Input Method 1: Browser-Based Voice Recorder */}
            <div style={{ marginBottom: '1.25rem' }}>
              <span className="lead-info-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                1. Voice Recording
              </span>
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                onRecordingReset={handleRecordingReset}
                disabled={isBusy}
              />
            </div>

            {/* Divider: OR Upload Audio File */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1rem 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                OR Upload Audio File
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            </div>

            {/* Input Method 2: Audio File Upload */}
            <div style={{ marginBottom: '1.25rem' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.webm,audio/*"
                style={{ display: 'none' }}
                onChange={handleAudioUpload}
                disabled={isBusy}
              />

              {uploadedAudioFile ? (
                <div className="audio-preview-bar">
                  <FileAudio size={22} color="var(--primary)" />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {uploadedAudioFile.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {(uploadedAudioFile.size / (1024 * 1024)).toFixed(2)} MB • Audio Recording
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mobile-close-btn"
                    onClick={() => setUploadedAudioFile(null)}
                    disabled={isBusy}
                    title="Remove file"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', borderStyle: 'dashed' }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isBusy}
                >
                  <Upload size={16} />
                  <span>Upload Audio (.mp3, .wav, .m4a, .webm)</span>
                </button>
              )}
            </div>

            {/* Divider: OR Call Notes */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1rem 0' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                OR Discussion Notes
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            </div>

            {/* Input Method 3: Discussion Notes */}
            <div className="form-group mb-3">
              <label className="form-label" htmlFor="call-notes">
                Call Notes (Optional Context)
              </label>
              <textarea
                id="call-notes"
                className="form-control"
                rows={3}
                placeholder="Additional discussion context or bullet points..."
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                disabled={isBusy}
              />
            </div>

            {/* Analyze Call Button */}
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.9375rem', gap: '0.625rem' }}
              onClick={handleAnalyzeCall}
              disabled={isBusy || !selectedLeadId || (!uploadedAudioFile && !recordedAudioBlob && !callNotes.trim())}
            >
              <Sparkles size={18} />
              <span>{isBusy ? processingStatus : 'Analyze Call'}</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Output (Progress Stepper -> Transcript -> Structured Summary) */}
        <div>
          {/* STATE 1: Processing Progress Box */}
          {isBusy && (
            <div className="ai-processing-box">
              <div className="spinner" style={{ width: 44, height: 44, marginBottom: '1.25rem' }} />
              <h3 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>Processing Voice Call</h3>
              <p className="text-dim" style={{ fontSize: '0.875rem', marginBottom: '1.25rem', color: 'var(--primary)', fontWeight: 600 }}>
                {processingStatus}
              </p>

              <div className="ai-step-indicator">
                {[
                  { label: 'Uploading audio...' },
                  { label: 'Transcribing conversation...' },
                  { label: 'Analyzing transcript...' },
                  { label: 'Generating CRM summary...' },
                  { label: 'Saving call...' },
                ].map((st, idx) => {
                  const currentOrder =
                    processingStatus === STAGES.UPLOADING ? 0 :
                    processingStatus === STAGES.TRANSCRIBING ? 1 :
                    processingStatus === STAGES.ANALYZING ? 2 :
                    processingStatus === STAGES.SUMMARIZING ? 3 : 4;

                  const isActive = idx === currentOrder;
                  const isCompleted = idx < currentOrder;

                  return (
                    <div
                      key={idx}
                      className={`ai-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                    >
                      <div className="step-icon-wrapper">
                        {isCompleted ? <Check size={13} /> : idx + 1}
                      </div>
                      <span>{st.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STATE 2: Error Notice with Retry */}
          {!isBusy && processingError && (
            <div className="card" style={{ borderLeft: '4px solid var(--danger)', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontWeight: 700, fontSize: '1rem', marginBottom: '0.5rem' }}>
                <AlertCircle size={20} />
                <span>Unable to analyze this recording</span>
              </div>
              <p style={{ color: 'var(--text-main)', fontSize: '0.875rem', marginBottom: '1rem', lineHeight: 1.5 }}>
                {processingError}
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAnalyzeCall}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
              >
                <RotateCcw size={15} />
                <span>Try Again</span>
              </button>
            </div>
          )}

          {/* STATE 3: Empty Placeholder before processing */}
          {!isBusy && !resultSummary && !processingError && (
            <div
              className="card text-center"
              style={{
                padding: '3.5rem 1.5rem',
                textAlign: 'center',
                background: 'var(--bg-surface-elevated)',
                border: '1px dashed var(--border-subtle)',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--primary-subtle)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1rem',
                }}
              >
                <Sparkles size={28} />
              </div>
              <h3 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>AI Summary Ready</h3>
              <p className="text-muted" style={{ maxWidth: 360, margin: '0 auto', fontSize: '0.875rem' }}>
                Record a voice note, upload an audio clip, or type call notes on the left, then click <strong>Analyze Call</strong>.
              </p>
            </div>
          )}

          {/* STATE 4: Completed Transcript & Summary Result */}
          {!isBusy && resultSummary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Transcript Block */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={16} color="var(--primary)" />
                    <span>CALL TRANSCRIPT</span>
                  </h3>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setIsEditingTranscript(!isEditingTranscript)}
                    >
                      <Edit3 size={13} />
                      <span>{isEditingTranscript ? 'Cancel Editing' : 'Edit Transcript'}</span>
                    </button>

                    {isEditingTranscript && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={handleReanalyzeTranscript}
                        disabled={isReanalyzing}
                      >
                        <Sparkles size={13} />
                        <span>{isReanalyzing ? 'Re-analyzing…' : 'Re-analyze with AI'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {isEditingTranscript ? (
                  <div>
                    <textarea
                      className="form-control"
                      rows={8}
                      value={editedTranscriptText}
                      onChange={(e) => setEditedTranscriptText(e.target.value)}
                      style={{ fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: 1.6 }}
                    />
                    <span className="text-dim" style={{ fontSize: '0.75rem', display: 'block', marginTop: '0.35rem' }}>
                      Tip: You can edit speaker labels and dialogue, then click "Re-analyze with AI" to update the CRM summary.
                    </span>
                  </div>
                ) : (
                  <div className="transcript-card" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {resultTranscript || 'No verbatim transcript generated.'}
                  </div>
                )}
              </div>

              {/* Structured AI Summary Card */}
              <div className="summary-result-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.875rem', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <span className="ai-header-badge" style={{ marginBottom: '0.25rem' }}>
                      🤖 AI CALL SUMMARY
                    </span>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Deal Intelligence & Action Plan
                    </h2>
                    {selectedLeadObj && (
                      <span className="text-dim" style={{ fontSize: '0.8125rem' }}>
                        Lead: <strong>{selectedLeadObj.name}</strong> • {callType} Call ({durationMinutes}:{durationSeconds})
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsEditingSummary(!isEditingSummary)}
                    title="Toggle edit mode"
                  >
                    <Edit3 size={14} />
                    <span>{isEditingSummary ? 'Done Editing' : 'Edit Summary'}</span>
                  </button>
                </div>

                {/* 1. Summary */}
                <div className="summary-section">
                  <div className="summary-section-title">
                    <span>Summary</span>
                  </div>
                  {isEditingSummary ? (
                    <textarea
                      className="form-control"
                      rows={3}
                      value={editedSummaryText}
                      onChange={(e) => setEditedSummaryText(e.target.value)}
                    />
                  ) : (
                    <div className="summary-section-content" style={{ lineHeight: 1.6 }}>
                      {editedSummaryText || resultSummary.summary}
                    </div>
                  )}
                </div>

                {/* 2. Key Points */}
                <div className="summary-section">
                  <div className="summary-section-title">
                    <span>Key Points</span>
                  </div>
                  <ul className="summary-bullet-list">
                    {(resultSummary.key_points || []).map((pt, i) => (
                      <li key={i}>{pt}</li>
                    ))}
                  </ul>
                </div>

                {/* 3. Customer Requirements */}
                <div className="summary-section">
                  <div className="summary-section-title">
                    <span>Customer Requirements</span>
                  </div>
                  <ul className="summary-bullet-list">
                    {(resultSummary.customer_requirements || []).length > 0 ? (
                      resultSummary.customer_requirements.map((req, i) => (
                        <li key={i}>{req}</li>
                      ))
                    ) : (
                      <li className="text-muted">None explicitly stated.</li>
                    )}
                  </ul>
                </div>

                {/* 4. Objections */}
                <div className="summary-section">
                  <div className="summary-section-title">
                    <span>Objections</span>
                  </div>
                  <ul className="summary-bullet-list">
                    {(resultSummary.objections || resultSummary.customer_objections || []).length > 0 ? (
                      (resultSummary.objections || resultSummary.customer_objections).map((obj, i) => (
                        <li key={i}>{obj}</li>
                      ))
                    ) : (
                      <li className="text-muted">No pricing or commercial objections noted.</li>
                    )}
                  </ul>
                </div>

                {/* 5. Customer Intent */}
                <div className="summary-section">
                  <div className="summary-section-title">
                    <span>Customer Intent</span>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.8125rem' }}>
                    <CheckCircle2 size={14} />
                    <span>{resultSummary.customer_intent || 'Interested'}</span>
                  </div>
                </div>

                {/* 6. Recommended Next Action */}
                <div className="summary-section">
                  <div className="summary-section-title">
                    <span>Next Action</span>
                  </div>
                  {isEditingSummary ? (
                    <input
                      type="text"
                      className="form-control"
                      value={editedNextAction}
                      onChange={(e) => setEditedNextAction(e.target.value)}
                    />
                  ) : (
                    <div className="summary-section-content" style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      {editedNextAction || resultSummary.next_action || 'Review conversation and follow up'}
                    </div>
                  )}
                </div>

                {/* 7. Suggested Follow-up Date */}
                <div className="summary-section">
                  <div className="summary-section-title">
                    <span>Suggested Follow-up</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <Calendar size={15} color="var(--primary)" />
                    <span>{resultSummary.follow_up_date || 'No explicit timeline mentioned'}</span>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveToLead}
                    disabled={isSavingCall || isSavedToLead}
                  >
                    {isSavedToLead ? <Check size={16} /> : <Save size={16} />}
                    <span>{isSavedToLead ? 'Saved to Lead' : isSavingCall ? 'Saving...' : 'Save to Lead'}</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleOpenFollowupModal}
                  >
                    <CalendarPlus size={16} color="var(--primary)" />
                    <span>Create Follow-up</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleOpenEmailModal}
                  >
                    <Mail size={16} color="var(--primary)" />
                    <span>Draft Email</span>
                  </button>

                  {selectedLeadId && (
                    <Link to={`/leads/${selectedLeadId}?tab=timeline`} className="btn btn-secondary">
                      <ExternalLink size={15} />
                      <span>View Lead Timeline</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Follow-up Confirmation Dialog */}
      {followupModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="followup-modal-title">
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 id="followup-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.125rem' }}>
                <CalendarPlus size={18} color="var(--primary)" />
                <span>AI Suggested Follow-up</span>
              </h3>
              <button
                type="button"
                className="mobile-close-btn"
                onClick={() => setFollowupModalOpen(false)}
                disabled={isSchedulingFollowup}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmFollowup}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  The AI suggested a follow-up for <strong>{selectedLeadObj?.name}</strong>. Please review and confirm before scheduling:
                </p>

                <div className="form-group">
                  <label className="form-label" htmlFor="fu-date">Follow-up Date <span className="text-danger">*</span></label>
                  <input
                    id="fu-date"
                    type="date"
                    className="form-control"
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    required
                    disabled={isSchedulingFollowup}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="fu-purpose">Purpose</label>
                  <select
                    id="fu-purpose"
                    className="form-control"
                    value={followupPurpose}
                    onChange={(e) => setFollowupPurpose(e.target.value)}
                    disabled={isSchedulingFollowup}
                  >
                    <option value="Phone Call">Phone Call</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Demo">Demo</option>
                    <option value="Email">Email</option>
                    <option value="Proposal">Proposal</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="fu-notes">Action Notes</label>
                  <textarea
                    id="fu-notes"
                    className="form-control"
                    rows={3}
                    value={followupNotes}
                    onChange={(e) => setFollowupNotes(e.target.value)}
                    disabled={isSchedulingFollowup}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFollowupModalOpen(false)}
                  disabled={isSchedulingFollowup}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSchedulingFollowup || !followupDate}
                >
                  {isSchedulingFollowup ? 'Scheduling...' : 'Confirm & Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Email Draft Modal */}
      {emailModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="email-modal-title">
          <div className="modal-card" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3 id="email-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.125rem' }}>
                <Mail size={18} color="var(--primary)" />
                <span>AI Suggested Email Draft</span>
              </h3>
              <button
                type="button"
                className="mobile-close-btn"
                onClick={() => setEmailModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="email-subj">Subject</label>
                <input
                  id="email-subj"
                  type="text"
                  className="form-control"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="email-body">Email Body (Review before sending)</label>
                <textarea
                  id="email-body"
                  className="form-control"
                  rows={10}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  style={{ fontFamily: 'inherit', fontSize: '0.875rem', lineHeight: 1.5 }}
                />
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCopyEmail}
              >
                {copiedEmail ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedEmail ? 'Copied!' : 'Copy Draft'}</span>
              </button>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEmailModalOpen(false)}
                >
                  Close
                </button>
                {selectedLeadObj?.email && (
                  <a
                    href={`mailto:${selectedLeadObj.email}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`}
                    className="btn btn-primary"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Mail size={15} />
                    <span>Open in Email Client</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
