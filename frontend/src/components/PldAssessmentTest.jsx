import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, Send, Target, X } from 'lucide-react';
import { pldApi } from '../api/pldApi';
import { useToast } from '../context/ToastContext';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { extractErrorMessage } from '../utils/validation';
import { PLD_STATUS_CONFIG, getPLDSeverity } from '../utils/constants';
import { LoadingSpinner } from './LoadingSpinner';

export const PldAssessmentTest = ({
  isOpen,
  leadId,
  leadName,
  companyName,
  initialStageId = null,
  stages = [],
  onClose,
  onCompleted,
  onMoveStage,
}) => {
  const { showToast } = useToast();

  const [availableStages, setAvailableStages] = useState(stages || []);
  const [selectedStageId, setSelectedStageId] = useState(initialStageId || null);
  const [problems, setProblems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [noProblems, setNoProblems] = useState(false);
  const [result, setResult] = useState(null);
  const requestId = useRef(0);

  const dialogRef = useDialogA11y(isOpen, () => {
    if (!submitting) onClose();
  });

  // Sync initialStageId when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialStageId) {
        setSelectedStageId(Number(initialStageId));
      }
      setSelected([]);
      setResult(null);
      setNoProblems(false);
    }
  }, [isOpen, initialStageId]);

  const loadProblems = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setNoProblems(false);
    const currentRequest = ++requestId.current;
    try {
      const res = await pldApi.getLeadPld(leadId, selectedStageId);
      if (currentRequest !== requestId.current) return;
      const loaded = res?.data?.problems || [];
      if (res?.data?.stages && res.data.stages.length > 0) {
        setAvailableStages(res.data.stages);
      }
      setProblems(loaded);
      setNoProblems(loaded.length === 0);
    } catch (err) {
      if (currentRequest === requestId.current) {
        showToast(extractErrorMessage(err, 'Failed to load PLD problems'), 'error');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [leadId, selectedStageId, showToast]);

  useEffect(() => {
    if (!isOpen) return;
    loadProblems();
  }, [isOpen, selectedStageId, loadProblems]);

  const totalPoints = problems.reduce((sum, problem) => sum + problem.points, 0);
  const selectedPoints = problems
    .filter((problem) => selected.includes(problem.id))
    .reduce((sum, problem) => sum + problem.points, 0);

  const toggleProblem = (problemId) => {
    setSelected((prev) =>
      prev.includes(problemId) ? prev.filter((id) => id !== problemId) : [...prev, problemId],
    );
  };

  const handleStageChange = (newStageId) => {
    const nextId = newStageId ? Number(newStageId) : null;
    setSelectedStageId(nextId);
    setSelected([]);
    setResult(null);
  };

  const currentStageObj = availableStages.find((s) => s.id === selectedStageId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selected.length === 0) {
      showToast('Select at least one problem before submitting.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await pldApi.submitAssessment(leadId, selected, selectedStageId);
      if (res?.data) {
        setResult(res.data);
        const stageName = res.data.stage_name || currentStageObj?.name;
        const msg = res.data.pld_status === 'QUALIFIED_PLD'
          ? `Qualified PLD for ${stageName || 'this stage'}!`
          : `Assessment completed (${res.data.percentage}%). Did not meet qualification threshold.`;
        showToast(msg, res.data.pld_status === 'QUALIFIED_PLD' ? 'success' : 'warning');
      }
      onCompleted?.(res?.data);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to submit assessment'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const statusConfig = result ? PLD_STATUS_CONFIG[result.pld_status] : null;
  const isQualified = result?.pld_status === 'QUALIFIED_PLD';

  return (
    <div className="modal-backdrop" onClick={() => !submitting && onClose()}>
      <div
        className="modal-container modal-container-lg pld-test-container"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="PLD Assessment"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-warning-icon" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)' }}>
              <Target size={20} />
            </div>
            <div>
              <h3>
                {currentStageObj ? `${currentStageObj.name} PLD Assessment` : 'PLD Assessment'}
              </h3>
              {leadName && (
                <p className="text-dim font-sm" style={{ margin: '0.15rem 0 0 0' }}>
                  {leadName}
                  {companyName ? ` · ${companyName}` : ''}
                </p>
              )}
            </div>
          </div>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close PLD assessment"
            disabled={submitting}
          >
            <X size={18} />
          </button>
        </div>

        {/* Stage selection selector */}
        {!result && availableStages.length > 0 && (
          <div style={{ padding: '0.75rem 1.5rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="font-sm" style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                Target Stage:
              </span>
              <select
                className="form-control"
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', width: 'auto' }}
                value={selectedStageId || ''}
                onChange={(e) => handleStageChange(e.target.value)}
                disabled={loading || submitting}
              >
                <option value="">General / Shared Pool</option>
                {availableStages.map((stg) => (
                  <option key={stg.id} value={stg.id}>
                    {stg.name} Assessment
                  </option>
                ))}
              </select>
            </div>
            <span className="text-dim font-sm">
              {currentStageObj
                ? `Assessing requirements to advance to ${currentStageObj.name}`
                : 'General discovery problem assessment'}
            </span>
          </div>
        )}

        {loading ? (
          <LoadingSpinner text={`Loading problems for ${currentStageObj?.name || 'PLD'}...`} />
        ) : noProblems ? (
          <div className="modal-body">
            <div className="card text-center" style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
              <p className="text-muted" style={{ marginBottom: '0.75rem' }}>
                There are no active PLD problems configured for {currentStageObj?.name || 'this stage'} yet.
              </p>
              <p className="text-dim font-sm">
                Ask an Admin to configure {currentStageObj?.name || 'PLD'} problems in Settings → PLD Engine.
              </p>
            </div>
          </div>
        ) : result ? (
          <div className="modal-body pld-result-body">
            <div className="pld-result-summary">
              <div className="pld-result-score">
                <span className="pld-result-points">
                  {result.total_score}
                  <span className="pld-result-max">/{result.max_score}</span>
                </span>
                <span className="pld-result-percentage">{result.percentage}%</span>
              </div>
              <span
                className="status-badge pld-result-status"
                style={{ color: statusConfig.color, backgroundColor: statusConfig.bg }}
              >
                {statusConfig.label}
              </span>
            </div>
            <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
              {isQualified ? (
                <p style={{ color: 'var(--success, #059669)', fontWeight: 600, margin: '0.25rem 0' }}>
                  Lead successfully qualified for {result.stage_name || currentStageObj?.name || 'this stage'}!
                </p>
              ) : (
                <p style={{ color: 'var(--danger, #dc2626)', fontWeight: 600, margin: '0.25rem 0' }}>
                  Lead did not meet the qualification threshold for {result.stage_name || currentStageObj?.name || 'this stage'}.
                </p>
              )}
            </div>
            <p className="text-muted pld-result-note">
              This assessment has been recorded in the lead's history.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="pld-test-form">
            <div className="pld-assess-meta" aria-live="polite">
              <span className="font-semibold text-main">
                {selected.length} of {problems.length} problems identified
              </span>
              <span className="text-dim font-sm">
                {selectedPoints} of {totalPoints} points
              </span>
            </div>

            <div className="modal-body pld-problems-body">
              <p className="text-muted font-sm" style={{ margin: '0 0 0.75rem' }}>
                Select every verified pain point or problem statement for this lead. Scoring and qualification
                are derived automatically from the stage pool.
              </p>
              <div className="pld-problem-list" role="group" aria-label="Problems for this lead">
                {problems.map((problem) => {
                  const severity = getPLDSeverity(problem.severity);
                  const checked = selected.includes(problem.id);
                  return (
                    <label
                      className={`pld-problem-item ${checked ? 'pld-problem-item-selected' : ''}`}
                      key={problem.id}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProblem(problem.id)}
                      />
                      <span className="pld-problem-main">
                        <span className="pld-problem-name">{problem.name}</span>
                        {problem.description && (
                          <span className="text-dim font-sm">{problem.description}</span>
                        )}
                      </span>
                      <span
                        className="pld-severity-tag"
                        style={{ color: severity.color, backgroundColor: severity.bg }}
                      >
                        {severity.label}
                      </span>
                      <span className="pld-problem-points">+{problem.points}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                <ArrowLeft size={15} />
                <span>Back</span>
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? (
                  'Scoring...'
                ) : (
                  <>
                    <Send size={15} />
                    <span>Submit Assessment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {result && (
          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <ArrowLeft size={15} />
              <span>Back to Lead</span>
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setResult(null);
                  setSelected([]);
                  loadProblems();
                }}
              >
                <span>Retake Assessment</span>
              </button>
              {isQualified && onMoveStage && (result.stage || selectedStageId) && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const targetId = result.stage || selectedStageId;
                    onMoveStage(targetId);
                    onClose();
                  }}
                >
                  <CheckCircle2 size={15} />
                  <span>Move Lead to {result.stage_name || currentStageObj?.name || 'Stage'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const PldAssessmentLauncher = ({
  leadId,
  leadName,
  companyName,
  initialStageId = null,
  stages = [],
  onCompleted,
  onMoveStage,
  buttonLabel = 'Run PLD Assessment',
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <ClipboardList size={15} />
        <span>{buttonLabel}</span>
      </button>
      <PldAssessmentTest
        isOpen={open}
        leadId={leadId}
        leadName={leadName}
        companyName={companyName}
        initialStageId={initialStageId}
        stages={stages}
        onClose={() => setOpen(false)}
        onCompleted={onCompleted}
        onMoveStage={onMoveStage}
      />
    </>
  );
};
