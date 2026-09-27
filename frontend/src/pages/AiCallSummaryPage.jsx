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
} from 'lucide-react';
import { leadApi } from '../api/leadApi';
import { aiApi } from '../api/aiApi';
import { followupApi } from '../api/followupApi';
import { useToast } from '../context/ToastContext';
import { AudioRecorder } from '../components/AudioRecorder';
import { toLocalDateKey } from '../utils/formatters';

const PROCESSING_STEPS = [
  { id: 1, label: 'Uploading voice note...' },
  { id: 2, label: 'Processing audio stream...' },
  { id: 3, label: 'Transcribing speech to text...' },
  { id: 4, label: 'Analyzing conversation intents & objections...' },
  { id: 5, label: 'Generating structured deal summary...' },
];

export const AiCallSummaryPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Results state
  const [resultTranscript, setResultTranscript] = useState('');
  const [resultSummary, setResultSummary] = useState(null);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummaryText, setEditedSummaryText] = useState('');
  const [editedNextAction, setEditedNextAction] = useState('');

  // Action status
  const [isSavingCall, setIsSavingCall] = useState(false);
  const [isSavedToLead, setIsSavedToLead] = useState(false);
  const [isSchedulingFollowup, setIsSchedulingFollowup] = useState(false);
  const [savedCallId, setSavedCallId] = useState(null);

  // Load leads list
  useEffect(() => {
    leadApi
      .getLeads({ page_size: 100 })
      .then((res) => {
        const list = res.results || (Array.isArray(res) ? res : res.data || []);
        setLeads(list);
        if (!selectedLeadId && list.length > 0) {
          // Default to first lead if none in URL
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

    // Validate audio format (.mp3, .wav, .m4a, .webm)
    const validExtensions = ['.mp3', '.wav', '.m4a', '.webm'];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => fileName.endsWith(ext)) || file.type.startsWith('audio/');

    if (!isValid) {
      showToast('Invalid file format. Please upload an .mp3, .wav, .m4a, or .webm audio file.', 'error');
      return;
    }

    // Validate size (max 25MB)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      showToast('Audio file exceeds 25MB limit. Please upload a smaller file.', 'error');
      return;
    }

    setUploadedAudioFile(file);
    setRecordedAudioBlob(null); // Clear recorder if file uploaded
    showToast(`Loaded ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`, 'info');
  };

  const handleRecordingComplete = (blob, seconds) => {
    setRecordedAudioBlob(blob);
    setUploadedAudioFile(null);
    if (seconds > 0) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      setDurationMinutes(String(mins));
      setDurationSeconds(String(secs).padStart(2, '0'));
    }
    showToast('Voice note ready for AI summary.', 'success');
  };

  const handleRecordingReset = () => {
    setRecordedAudioBlob(null);
  };

  const handleGenerateSummary = async () => {
    if (!selectedLeadId) {
      showToast('Please select a lead before generating AI summary.', 'warning');
      return;
    }

    setIsProcessing(true);
    setCurrentStepIndex(0);
    setResultTranscript('');
    setResultSummary(null);
    setIsSavedToLead(false);

    // Staged progression of simulated realistic AI steps
    for (let i = 0; i < PROCESSING_STEPS.length; i++) {
      setCurrentStepIndex(i);
      // Wait between 400ms and 700ms for each step
      await new Promise((resolve) => setTimeout(resolve, 550));
    }

    try {
      const totalDurationSecs = (parseInt(durationMinutes) || 0) * 60 + (parseInt(durationSeconds) || 0);

      const formData = new FormData();
      formData.append('lead_id', selectedLeadId);
      formData.append('notes', callNotes);
      formData.append('call_type', callType);
      formData.append('duration_seconds', totalDurationSecs);

      if (uploadedAudioFile) {
        formData.append('audio_file', uploadedAudioFile);
      } else if (recordedAudioBlob) {
        formData.append('audio_file', recordedAudioBlob, 'voicenote.webm');
      }

      const res = await aiApi.generateCallSummary(formData);
      const summaryData = res?.data?.summary || res?.summary;
      const transcriptData = res?.data?.transcript || res?.transcript;

      setResultTranscript(transcriptData || '');
      setResultSummary(summaryData);
      setEditedSummaryText(summaryData?.summary || '');
      setEditedNextAction(summaryData?.next_action || '');

      showToast('AI call summary generated successfully!', 'success');
    } catch {
      showToast('Failed to generate call summary. Please check your network.', 'error');
    } finally {
      setIsProcessing(false);
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
        transcript: resultTranscript,
        ai_summary: editedSummaryText || resultSummary.summary,
        key_points: resultSummary.key_points || [],
        customer_requirements: resultSummary.customer_requirements || [],
        objections: resultSummary.customer_objections || [],
        customer_intent: resultSummary.customer_intent || 'High purchase interest',
        next_action: editedNextAction || resultSummary.next_action || '',
        follow_up_date: resultSummary.follow_up_date || resultSummary.suggested_follow_up_date || null,
      };

      const res = await aiApi.createCall(callPayload);
      setSavedCallId(res?.id || res?.data?.id);
      setIsSavedToLead(true);
      showToast('Call and AI summary saved to lead timeline!', 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Failed to save call to lead.';
      showToast(msg, 'error');
    } finally {
      setIsSavingCall(false);
    }
  };

  // Create Follow-up from AI Recommendation
  const handleCreateFollowup = async () => {
    if (!selectedLeadId) return;

    setIsSchedulingFollowup(true);
    try {
      const targetDate = resultSummary?.follow_up_date || resultSummary?.suggested_follow_up_date || callDate;
      const followUpDateTime = `${targetDate}T11:00:00Z`;

      await followupApi.createFollowUp({
        lead: parseInt(selectedLeadId),
        follow_up_at: followUpDateTime,
        purpose: 'Phone Call',
        notes: `AI Follow-up: ${editedNextAction || resultSummary?.next_action || 'Review revised quotation.'}`,
      });

      showToast(`Follow-up scheduled for ${targetDate}!`, 'success');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Failed to schedule follow-up.';
      showToast(msg, 'error');
    } finally {
      setIsSchedulingFollowup(false);
    }
  };

  const selectedLeadObj = leads.find((l) => l.id.toString() === selectedLeadId.toString());

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
              <span>Voice Note Intelligence</span>
            </span>
          </div>
          <p className="page-subtitle">
            Transcribe client conversations, extract requirements & objections, and automate CRM updates.
          </p>
        </div>

        {selectedLeadId && (
          <div className="page-actions">
            <Link to={`/leads/${selectedLeadId}`} className="btn btn-secondary btn-sm">
              <User size={14} />
              <span>View Lead Profile</span>
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
                disabled={isProcessing}
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
                  disabled={isProcessing}
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
                  disabled={isProcessing}
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
                    disabled={isProcessing}
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
                    disabled={isProcessing}
                    aria-label="Duration Seconds"
                    style={{ textAlign: 'center' }}
                  />
                </div>
              </div>
            </div>

            {/* Input Method 1: In-Browser Audio Recorder */}
            <div style={{ marginBottom: '1.25rem' }}>
              <span className="lead-info-label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                1. Voice Note Recording
              </span>
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                onRecordingReset={handleRecordingReset}
                disabled={isProcessing}
              />
            </div>

            {/* Divider: OR Upload Audio */}
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
                disabled={isProcessing}
              />

              {uploadedAudioFile ? (
                <div className="audio-preview-bar">
                  <FileAudio size={22} color="var(--primary)" />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {uploadedAudioFile.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {(uploadedAudioFile.size / (1024 * 1024)).toFixed(2)} MB • Audio File
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mobile-close-btn"
                    onClick={() => setUploadedAudioFile(null)}
                    disabled={isProcessing}
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
                  disabled={isProcessing}
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
                OR Call Notes
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            </div>

            {/* Input Method 3: Call Notes Text */}
            <div className="form-group mb-3">
              <label className="form-label" htmlFor="call-notes">
                Call Notes & Discussion Points
              </label>
              <textarea
                id="call-notes"
                className="form-control"
                rows={3}
                placeholder="Type your call notes here... (e.g. Customer inquired about enterprise licenses, pricing discounts, 30-day onboarding, and requested a revised quote by tomorrow)"
                value={callNotes}
                onChange={(e) => setCallNotes(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            {/* Submit Button */}
            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.75rem', fontSize: '0.9375rem', gap: '0.625rem' }}
              onClick={handleGenerateSummary}
              disabled={isProcessing || !selectedLeadId}
            >
              <Sparkles size={18} />
              <span>{isProcessing ? 'Processing Audio & Notes...' : 'Generate AI Summary'}</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Output (Progress Stepper -> Transcript -> Structured Summary) */}
        <div>
          {/* STATE 1: Processing Progress Stepper */}
          {isProcessing && (
            <div className="ai-processing-box">
              <div className="spinner" style={{ width: 44, height: 44, marginBottom: '1.25rem' }} />
              <h3 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>AI Processing Pipeline</h3>
              <p className="text-dim" style={{ fontSize: '0.8125rem', marginBottom: '1rem' }}>
                Simulating voice recognition and deal extraction (Phase 1 Mock AI)
              </p>

              <div className="ai-step-indicator">
                {PROCESSING_STEPS.map((st, idx) => {
                  const isActive = idx === currentStepIndex;
                  const isCompleted = idx < currentStepIndex;
                  return (
                    <div
                      key={st.id}
                      className={`ai-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                    >
                      <div className="step-icon-wrapper">
                        {isCompleted ? <Check size={13} /> : st.id}
                      </div>
                      <span>{st.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STATE 2: Empty Placeholder before processing */}
          {!isProcessing && !resultSummary && (
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
                Record a voice note, upload an audio clip, or type call notes on the left, then click <strong>Generate AI Summary</strong>.
              </p>
            </div>
          )}

          {/* STATE 3: Completed Transcript & Summary Result */}
          {!isProcessing && resultSummary && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Transcript Block */}
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <FileText size={16} color="var(--primary)" />
                    <span>Transcript</span>
                  </h3>
                  <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                    Mock STT Transcription
                  </span>
                </div>

                <div className="transcript-card">
                  {resultTranscript}
                </div>
              </div>

              {/* Structured AI Summary Card */}
              <div className="summary-result-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.875rem', marginBottom: '1.25rem' }}>
                  <div>
                    <span className="ai-header-badge" style={{ marginBottom: '0.25rem' }}>
                      Structured AI Intelligence
                    </span>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Call Summary & Action Plan
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
                    <div className="summary-section-content">
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
                    {(resultSummary.customer_requirements || []).map((req, i) => (
                      <li key={i}>{req}</li>
                    ))}
                  </ul>
                </div>

                {/* 4. Customer Objections */}
                <div className="summary-section">
                  <div className="summary-section-title">
                    <span>Customer Objections</span>
                  </div>
                  <ul className="summary-bullet-list">
                    {(resultSummary.customer_objections || []).map((obj, i) => (
                      <li key={i}>{obj}</li>
                    ))}
                  </ul>
                </div>

                {/* 5. Customer Intent */}
                <div className="summary-section">
                  <div className="summary-section-title">
                    <span>Customer Intent</span>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0.625rem', background: 'var(--success-bg)', color: 'var(--success)', borderRadius: 'var(--radius-sm)', fontWeight: 600, fontSize: '0.8125rem' }}>
                    <CheckCircle2 size={14} />
                    <span>{resultSummary.customer_intent || 'High purchase interest'}</span>
                  </div>
                </div>

                {/* 6. Recommended Next Action */}
                <div className="summary-section">
                  <div className="summary-section-title">
                    <span>Recommended Next Action</span>
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
                      {editedNextAction || resultSummary.next_action || 'Send revised quotation'}
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
                    <span>{resultSummary.follow_up_date || resultSummary.suggested_follow_up_date || '2026-09-30'}</span>
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
                    onClick={handleCreateFollowup}
                    disabled={isSchedulingFollowup}
                  >
                    <CalendarPlus size={16} color="var(--primary)" />
                    <span>Create Follow-up</span>
                  </button>

                  {selectedLeadId && (
                    <Link to={`/leads/${selectedLeadId}`} className="btn btn-secondary">
                      <User size={16} />
                      <span>View Lead Timeline</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
