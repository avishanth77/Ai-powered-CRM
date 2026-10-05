import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, Send, Target, X } from 'lucide-react';
import { pldApi } from '../api/pldApi';
import { useToast } from '../context/ToastContext';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { extractErrorMessage } from '../utils/validation';
import { PLD_STATUS_CONFIG, getPLDSeverity } from '../utils/constants';
import { LoadingSpinner } from './LoadingSpinner';

export const PldAssessmentTest = ({ isOpen, leadId, leadName, companyName, onClose, onCompleted }) => {
  const { showToast } = useToast();

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

  const loadProblems = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setNoProblems(false);
    const currentRequest = ++requestId.current;
    try {
      const res = await pldApi.getLeadPld(leadId);
      if (currentRequest !== requestId.current) return;
      const loaded = res?.data?.problems || [];
      setProblems(loaded);
      setNoProblems(loaded.length === 0);
    } catch (err) {
      if (currentRequest === requestId.current) {
        showToast(extractErrorMessage(err, 'Failed to load PLD problems'), 'error');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [leadId, showToast]);

  useEffect(() => {
    if (!isOpen) return;
    setSelected([]);
    setResult(null);
    setNoProblems(false);
    loadProblems();
  }, [isOpen, loadProblems]);

  const totalPoints = problems.reduce((sum, problem) => sum + problem.points, 0);
  const selectedPoints = problems
    .filter((problem) => selected.includes(problem.id))
    .reduce((sum, problem) => sum + problem.points, 0);

  const toggleProblem = (problemId) => {
    setSelected((prev) =>
      prev.includes(problemId) ? prev.filter((id) => id !== problemId) : [...prev, problemId],
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selected.length === 0) {
      showToast('Select at least one problem before submitting.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await pldApi.submitAssessment(leadId, selected);
      if (res?.data) {
        setResult(res.data);
        showToast('PLD assessment submitted and scored.', 'success');
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
              <h3>PLD Assessment</h3>
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

        {loading ? (
          <LoadingSpinner text="Loading active problems..." />
        ) : noProblems ? (
          <div className="modal-body">
            <p className="text-muted">
              There are no active PLD problems configured yet. Ask an admin to add them in Settings.
            </p>
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
            <p className="text-muted pld-result-note">
              This result has been saved. Running the assessment again adds a new entry to the history —
              earlier results are never rewritten.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="pld-assess-meta" aria-live="polite">
              <span className="font-semibold text-main">
                {selected.length} of {problems.length} problems selected
              </span>
              <span className="text-dim font-sm">
                {selectedPoints} of {totalPoints} points
              </span>
            </div>

            <div className="modal-body pld-problems-body">
              <p className="text-muted font-sm" style={{ margin: '0 0 0.75rem' }}>
                Select every problem this lead is experiencing. The score is calculated automatically from
                the points configured by an admin.
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
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <ArrowLeft size={15} />
              <span>Back to Lead</span>
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setResult(null);
                setSelected([]);
                loadProblems();
              }}
            >
              <CheckCircle2 size={15} />
              <span>Run Again</span>
            </button>
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
  onCompleted,
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
        onClose={() => setOpen(false)}
        onCompleted={onCompleted}
      />
    </>
  );
};
