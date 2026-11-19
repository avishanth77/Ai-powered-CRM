import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Target,
  CheckCircle2,
  AlertCircle,
  Send,
  RotateCcw,
  Package,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { icpApi } from '../../api/icpApi';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage, normalizeServerErrors } from '../../utils/validation';
import { ICP_STATUS_CONFIG, getIcpQuestionType } from '../../utils/constants';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { IcpStatusBadge } from '../IcpStatusBadge';
import { LoadingSpinner } from '../LoadingSpinner';
import { IcpQualificationTest, QuestionControl, isBlank } from '../IcpQualificationTest';

export const IcpOverviewCard = ({
  lead,
  onIcpCompleted,
  onLeadUpdated,
}) => {
  const { showToast } = useToast();

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [latestQualification, setLatestQualification] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [leadProducts, setLeadProducts] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRetaking, setIsRetaking] = useState(false);
  const requestId = useRef(0);

  const leadId = lead?.id;
  const isIcpStage = Boolean(
    lead?.stage_details?.slug?.toLowerCase() === 'icp' ||
    lead?.stage_details?.name?.toLowerCase() === 'icp' ||
    lead?.status?.toLowerCase() === 'icp'
  );

  const loadQuestions = useCallback(async (prodId) => {
    if (!leadId) return;
    setLoading(true);
    const currentRequest = ++requestId.current;
    try {
      const params = {};
      if (prodId && prodId !== 'all' && prodId !== 'global') {
        params.product_id = prodId;
      } else if (prodId === 'global') {
        params.product = 'global';
      }
      const res = await icpApi.getLeadIcp(leadId, params);
      if (currentRequest !== requestId.current) return;

      const loaded = res?.data?.questions || [];
      setQuestions(loaded);

      if (res?.data?.lead_products) {
        setLeadProducts(res.data.lead_products);
      }
      if (res?.data?.selected_product && prodId === undefined) {
        setSelectedProductId(res.data.selected_product.id);
      }
      if (res?.data?.latest_qualification) {
        setLatestQualification(res.data.latest_qualification);
      } else {
        setLatestQualification(null);
      }
    } catch (err) {
      if (currentRequest === requestId.current) {
        showToast(extractErrorMessage(err, 'Failed to load ICP questions'), 'error');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [leadId, showToast]);

  useEffect(() => {
    if (!isIcpStage || !leadId) return;
    setAnswers({});
    setErrors({});
    setResult(null);
    setIsRetaking(false);
    loadQuestions();
  }, [isIcpStage, leadId, loadQuestions]);

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
    e?.preventDefault?.();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        answers: buildAnswersPayload(),
        product_id: selectedProductId || null,
      };
      const res = await icpApi.submitQualification(leadId, payload);
      if (res?.data) {
        setResult(res.data);
        setLatestQualification(res.data);
        setIsRetaking(false);
        if (res.data.stage_advanced) {
          showToast(`ICP Qualified! Lead automatically advanced to '${res.data.new_stage}'.`, 'success');
        } else {
          showToast('ICP qualification submitted and scored.', 'success');
        }
      }
      onIcpCompleted?.(res?.data);
      onLeadUpdated?.();
    } catch (err) {
      const { fieldErrors } = normalizeServerErrors(err);
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
      showToast(extractErrorMessage(err, 'Failed to submit ICP qualification'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setAnswers({});
    setErrors({});
  };

  const handleRetake = () => {
    setResult(null);
    setIsRetaking(true);
    setAnswers({});
    setErrors({});
  };

  if (!isIcpStage) return null;

  const currentStatusConfig = result
    ? ICP_STATUS_CONFIG[result.icp_status]
    : latestQualification
    ? ICP_STATUS_CONFIG[latestQualification.icp_status]
    : null;

  return (
    <>
      <div className="icp-overview-card hs-card">
        {/* Header */}
        <div className="icp-overview-header">
          <div className="icp-overview-title-group">
            <div className="icp-overview-icon">
              <Target size={18} />
            </div>
            <div>
              <h3 className="icp-overview-title">
                <span>ICP Qualification Questions</span>
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--primary, #6366f1)',
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Stage Action Required
                </span>
              </h3>
            </div>
          </div>

          <div className="icp-overview-actions">
            {/* Status Badge */}
            <IcpStatusBadge status={lead.icp_status} />

            {/* Product Filter if lead has products */}
            {leadProducts.length > 0 && (
              <select
                className="form-control"
                style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                value={selectedProductId || ''}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value, 10) : null;
                  setSelectedProductId(val);
                  setAnswers({});
                  setErrors({});
                  loadQuestions(val || 'global');
                }}
                aria-label="Filter ICP questions by product"
              >
                <option value="">Global / General ICP</option>
                {leadProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            )}

            {/* Open Full Modal Button */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsModalOpen(true)}
              title="Open qualification in modal view"
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            >
              <Maximize2 size={13} />
              <span>Expand</span>
            </button>

            {/* Collapse/Expand Toggle */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setIsCollapsed((prev) => !prev)}
              aria-label={isCollapsed ? 'Expand ICP questions' : 'Collapse ICP questions'}
              style={{ padding: '0.25rem 0.4rem' }}
            >
              {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
          </div>
        </div>

        {/* Guidance Prompt */}
        <div className="icp-overview-banner">
          <Sparkles size={15} color="var(--primary, #6366f1)" style={{ flexShrink: 0 }} />
          <span>
            <strong>Lead is in ICP Stage:</strong> Complete the qualification questions below to assess fit against your ideal customer profile and auto-advance this deal.
          </span>
        </div>

        {/* Body Content */}
        {!isCollapsed && (
          <div className="icp-overview-body">
            {loading ? (
              <LoadingSpinner text="Loading ICP questions..." />
            ) : questions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-dim)' }}>
                <Target size={32} style={{ opacity: 0.35, marginBottom: '0.5rem' }} />
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  No active ICP questions configured in the system. An administrator can add questions in Settings &gt; ICP Management.
                </p>
              </div>
            ) : (
              <>
                {/* Result or Previous Qualification Banner */}
                {(result || (latestQualification && !isRetaking)) && (
                  <div className="icp-overview-result-banner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <CheckCircle2 size={24} color={currentStatusConfig?.color || '#10b981'} style={{ flexShrink: 0 }} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                            {result ? 'Qualification Completed' : 'Latest Qualification Score'}
                          </span>
                          {currentStatusConfig && (
                            <span
                              className="status-badge"
                              style={{
                                color: currentStatusConfig.color,
                                backgroundColor: currentStatusConfig.bg,
                                fontSize: '0.75rem',
                              }}
                            >
                              {currentStatusConfig.label}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', marginTop: '0.15rem' }}>
                          Score: <strong>{(result || latestQualification).total_score} / {(result || latestQualification).max_score}</strong> ({(result || latestQualification).percentage}%)
                          {(result || latestQualification).qualified_at && (
                            <span> · {formatDate((result || latestQualification).qualified_at)}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleRetake}
                      style={{ fontSize: '0.75rem' }}
                    >
                      <RotateCcw size={13} />
                      <span>Retake Questions</span>
                    </button>
                  </div>
                )}

                {/* Auto Advanced Success Notice */}
                {result?.stage_advanced && (
                  <div
                    style={{
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid #10B981',
                      color: '#065F46',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      marginBottom: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                    }}
                  >
                    <CheckCircle2 size={18} color="#10B981" style={{ flexShrink: 0 }} />
                    <div>
                      <div>Pipeline Stage Auto-Advanced!</div>
                      <div style={{ fontWeight: 400, fontSize: '0.8rem', color: '#047857' }}>
                        Lead automatically advanced to <strong>{result.new_stage}</strong> based on positive ICP fit.
                      </div>
                    </div>
                  </div>
                )}

                {/* Interactive Questions Form (Active when not completed or when retaking) */}
                {(!result && (!latestQualification || isRetaking)) && (
                  <form onSubmit={handleSubmit}>
                    {/* Progress Track */}
                    <div className="icp-progress" style={{ margin: '0 0 1.25rem 0' }}>
                      <div className="icp-progress-labels">
                        <span className="font-semibold text-main" style={{ fontSize: '0.8125rem' }}>
                          {answeredCount} of {total} questions answered
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

                    {/* Questions List */}
                    <div className="icp-questions-body" style={{ maxHeight: 'none' }}>
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
                              namePrefix={`overview-icp-${lead.id}`}
                            />

                            {errors[question.id] && (
                              <span className="form-error-msg" role="alert" style={{ display: 'block', marginTop: '0.25rem' }}>
                                {errors[question.id]}
                              </span>
                            )}
                          </fieldset>
                        );
                      })}
                    </div>

                    {/* Submit and Action Buttons */}
                    <div className="icp-overview-footer">
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                        {progressPercent === 100 ? (
                          <span style={{ color: 'var(--success, #10b981)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <CheckCircle2 size={14} /> All questions answered
                          </span>
                        ) : (
                          <span>{total - answeredCount} remaining</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {answeredCount > 0 && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleReset}
                            disabled={submitting}
                          >
                            <RotateCcw size={13} />
                            <span>Reset</span>
                          </button>
                        )}
                        <button
                          type="submit"
                          className="btn btn-primary btn-sm"
                          disabled={submitting}
                        >
                          {submitting ? (
                            'Scoring...'
                          ) : (
                            <>
                              <Send size={14} />
                              <span>Submit ICP Qualification</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal Dialog for expanded view */}
      {isModalOpen && (
        <IcpQualificationTest
          isOpen={isModalOpen}
          leadId={lead.id}
          leadName={lead.name}
          companyName={lead.company_name}
          onClose={() => setIsModalOpen(false)}
          onCompleted={(data) => {
            setIsModalOpen(false);
            setResult(data);
            setLatestQualification(data);
            onIcpCompleted?.(data);
            onLeadUpdated?.();
          }}
        />
      )}
    </>
  );
};

export default IcpOverviewCard;
