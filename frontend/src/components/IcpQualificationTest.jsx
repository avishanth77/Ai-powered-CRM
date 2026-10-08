import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, Send, Target, X } from 'lucide-react';
import { icpApi } from '../api/icpApi';
import { useToast } from '../context/ToastContext';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { extractErrorMessage, normalizeServerErrors } from '../utils/validation';
import { ICP_STATUS_CONFIG, getIcpQuestionType } from '../utils/constants';
import { LoadingSpinner } from './LoadingSpinner';

const isBlank = (value) =>
  value === undefined ||
  value === null ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'string' && value.trim() === '');

const QuestionControl = ({ question, value, onChange, error }) => {
  const options = question.options || [];

  if (question.question_type === 'TEXT') {
    return (
      <textarea
        className="form-control"
        rows={3}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer"
        aria-label={question.question_text}
        aria-invalid={Boolean(error)}
      />
    );
  }

  if (question.question_type === 'NUMBER') {
    return (
      <input
        type="number"
        className="form-control"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter a number"
        aria-label={question.question_text}
        aria-invalid={Boolean(error)}
      />
    );
  }

  if (question.question_type === 'MULTI_CHOICE') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className="icp-choice-list" role="group" aria-label={question.question_text}>
        {options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <label className={`icp-choice-item ${checked ? 'icp-choice-item-selected' : ''}`} key={option.id}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, option.id]
                      : selected.filter((id) => id !== option.id),
                  )
                }
              />
              <span className="icp-choice-label">{option.option_text}</span>
              <span className="icp-choice-points">{option.points} pts</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (question.question_type === 'DROPDOWN') {
    return (
      <select
        className="form-control"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        aria-label={question.question_text}
        aria-invalid={Boolean(error)}
      >
        <option value="">Select an option</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.option_text}
          </option>
        ))}
      </select>
    );
  }

  if (question.question_type === 'SINGLE_CHOICE' || question.question_type === 'YES_NO') {
    return (
      <div className="icp-choice-list" role="radiogroup" aria-label={question.question_text}>
        {options.map((option) => {
          const checked = String(value) === String(option.id);
          return (
            <label className={`icp-choice-item ${checked ? 'icp-choice-item-selected' : ''}`} key={option.id}>
              <input
                type="radio"
                name={`question-${question.id}`}
                checked={checked}
                onChange={() => onChange(option.id)}
              />
              <span className="icp-choice-label">{option.option_text}</span>
              <span className="icp-choice-points">{option.points} pts</span>
            </label>
          );
        })}
      </div>
    );
  }

  return <input type="text" className="form-control" onChange={(e) => onChange(e.target.value)} aria-label={question.question_text} />;
};

export const IcpQualificationTest = ({ isOpen, leadId, leadName, companyName, onClose, onCompleted }) => {
  const { showToast } = useToast();

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [noQuestions, setNoQuestions] = useState(false);
  const [result, setResult] = useState(null);
  const requestId = useRef(0);

  const dialogRef = useDialogA11y(isOpen, () => {
    if (!submitting) onClose();
  });

  const loadQuestions = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setNoQuestions(false);
    const currentRequest = ++requestId.current;
    try {
      const res = await icpApi.getLeadIcp(leadId);
      if (currentRequest !== requestId.current) return;
      const loaded = res?.data?.questions || [];
      setQuestions(loaded);
      setNoQuestions(loaded.length === 0);
    } catch (err) {
      if (currentRequest === requestId.current) {
        showToast(extractErrorMessage(err, 'Failed to load ICP questions'), 'error');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [leadId, showToast]);

  useEffect(() => {
    if (!isOpen) return;
    setAnswers({});
    setErrors({});
    setResult(null);
    setNoQuestions(false);
    loadQuestions();
  }, [isOpen, loadQuestions]);

  const total = questions.length;
  const answeredCount = useMemo(
    () => questions.filter((question) => !isBlank(answers[question.id])).length,
    [questions, answers],
  );
  const progressPercent = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  const handleChange = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setErrors((prev) => {
      if (!prev[questionId]) return prev;
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  };

  const validate = () => {
    const nextErrors = {};
    questions.forEach((question) => {
      if (question.is_required && isBlank(answers[question.id])) {
        nextErrors[question.id] = 'This question is required.';
      }
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showToast('Please complete all required questions before submitting.', 'warning');
    }
    return Object.keys(nextErrors).length === 0;
  };

  const buildAnswersPayload = () =>
    questions
      .filter((question) => !isBlank(answers[question.id]))
      .map((question) => {
        const value = answers[question.id];
        const meta = getIcpQuestionType(question.question_type);
        if (question.question_type === 'MULTI_CHOICE') {
          return { question_id: question.id, value: Array.isArray(value) ? value : [value] };
        }
        if (meta.isChoice) {
          return { question_id: question.id, value: String(value) };
        }
        return { question_id: question.id, value };
      });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await icpApi.submitQualification(leadId, buildAnswersPayload());
      if (res?.data) {
        setResult(res.data);
        showToast('ICP qualification submitted and scored.', 'success');
      }
      onCompleted?.(res?.data);
    } catch (err) {
      const { fieldErrors } = normalizeServerErrors(err);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      showToast(extractErrorMessage(err, 'Failed to submit qualification'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const statusConfig = result ? ICP_STATUS_CONFIG[result.icp_status] : null;

  return (
    <div className="modal-backdrop" onClick={() => !submitting && onClose()}>
      <div
        className="modal-container modal-container-lg icp-test-container"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="ICP Qualification Test"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-warning-icon" style={{ background: 'var(--primary-subtle)', color: 'var(--primary)' }}>
              <Target size={20} />
            </div>
            <div>
              <h3>ICP Qualification</h3>
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
            aria-label="Close qualification test"
            disabled={submitting}
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <LoadingSpinner text="Loading active questions..." />
        ) : noQuestions ? (
          <div className="modal-body">
            <p className="text-muted">There are no active ICP questions configured yet. Ask an admin to add them in Settings.</p>
          </div>
        ) : result ? (
          /* Result summary */
          <div className="modal-body icp-result-body">
            <div className="icp-result-summary">
              <div className="icp-result-score">
                <span className="icp-result-points">
                  {result.total_score}
                  <span className="icp-result-max">/{result.max_score}</span>
                </span>
                <span className="icp-result-percentage">{result.percentage}%</span>
              </div>
              <span
                className="status-badge icp-result-status"
                style={{ color: statusConfig.color, backgroundColor: statusConfig.bg }}
              >
                {statusConfig.label}
              </span>
            </div>
            <p className="text-muted icp-result-note">
              This result has been saved. You can run the test again at any time — each attempt is kept in the history.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="icp-test-form">
            {/* Progress indicator */}
            <div className="icp-progress" aria-live="polite">
              <div className="icp-progress-labels">
                <span className="font-semibold text-main">
                  {answeredCount} of {total} answered
                </span>
                <span className="text-dim font-sm">{progressPercent}% complete</span>
              </div>
              <div
                className="icp-progress-track"
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="icp-progress-bar" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            <div className="modal-body icp-questions-body">
              {questions.map((question, index) => {
                const meta = getIcpQuestionType(question.question_type);
                return (
                  <fieldset className="icp-question" key={question.id}>
                    <legend className="icp-question-legend">
                      <span className="icp-question-number">{index + 1}</span>
                      <span>
                        {question.question_text}
                        {question.is_required && (
                          <span className="icp-required-mark" aria-hidden="true">*</span>
                        )}
                      </span>
                    </legend>
                    {question.description && (
                      <p className="icp-question-help">{question.description}</p>
                    )}
                    <div className="icp-question-meta">
                      <span className="icp-type-tag">{meta.label}</span>
                      {!question.is_required && <span className="text-dim font-sm">Optional</span>}
                    </div>
                    <QuestionControl
                      question={question}
                      value={answers[question.id]}
                      onChange={(value) => handleChange(question.id, value)}
                      error={errors[question.id]}
                    />
                    {errors[question.id] && (
                      <span className="form-error-msg" role="alert">
                        {errors[question.id]}
                      </span>
                    )}
                  </fieldset>
                );
              })}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
                <ArrowLeft size={15} />
                <span>Back</span>
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Scoring...' : (
                  <>
                    <Send size={15} />
                    <span>Submit Qualification</span>
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
                setAnswers({});
                setErrors({});
                loadQuestions();
              }}
            >
              <CheckCircle2 size={15} />
              <span>Retake Test</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const IcpQualificationLauncher = ({ leadId, leadName, companyName, onCompleted, buttonLabel = 'Start ICP Qualification' }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <ClipboardList size={15} />
        <span>{buttonLabel}</span>
      </button>
      <IcpQualificationTest
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