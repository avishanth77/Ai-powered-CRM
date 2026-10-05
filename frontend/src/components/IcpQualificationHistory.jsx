import React, { useCallback, useEffect, useRef, useState } from 'react';
import { History, Target, X } from 'lucide-react';
import { icpApi } from '../api/icpApi';
import { useToast } from '../context/ToastContext';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { extractErrorMessage } from '../utils/validation';
import { formatDateTime, getInitials } from '../utils/formatters';
import { ICP_STATUS_CONFIG } from '../utils/constants';
import { EmptyState } from './EmptyState';
import { IcpStatusBadge } from './IcpStatusBadge';
import { LoadingSpinner } from './LoadingSpinner';

const IcpResultModal = ({ qualification, onClose }) => {
  const dialogRef = useDialogA11y(Boolean(qualification), onClose);
  if (!qualification) return null;

  const config = ICP_STATUS_CONFIG[qualification.icp_status];
  const answers = qualification.answers || [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container modal-container-lg"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="ICP Qualification Result"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <h3>Qualification Result</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close result">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="icp-result-summary">
            <div className="icp-result-score">
              <span className="icp-result-points">
                {qualification.total_score}
                <span className="icp-result-max">/{qualification.max_score}</span>
              </span>
              <span className="icp-result-percentage">{qualification.percentage}%</span>
            </div>
            <span
              className="status-badge icp-result-status"
              style={{ color: config.color, backgroundColor: config.bg }}
            >
              {config.label}
            </span>
          </div>

          <dl className="icp-result-meta">
            <div>
              <dt>Qualified by</dt>
              <dd>
                {qualification.qualified_by_details?.full_name || qualification.qualified_by_details?.email || '—'}
              </dd>
            </div>
            <div>
              <dt>Qualified at</dt>
              <dd>{formatDateTime(qualification.qualified_at)}</dd>
            </div>
            <div>
              <dt>Lead</dt>
              <dd>{qualification.lead_name || qualification.lead_details?.name || '—'}</dd>
            </div>
          </dl>

          <h4 className="icp-answers-heading">Answers at the time of this test</h4>
          {answers.length === 0 ? (
            <p className="text-muted">No answers were recorded for this attempt.</p>
          ) : (
            <div className="icp-answers-list">
              {answers.map((answer) => (
                <div className="icp-answer-row" key={answer.id}>
                  <div className="icp-answer-question">
                    <span className="font-semibold text-main">
                      {answer.question_text || answer.question_snapshot?.question_text}
                    </span>
                    {answer.question_snapshot?.description && (
                      <span className="text-dim font-sm">{answer.question_snapshot.description}</span>
                    )}
                  </div>
                  <div className="icp-answer-value">
                    {answer.answer_value || <span className="text-dim">Not answered</span>}
                  </div>
                  <div className="icp-answer-points">
                    +{answer.points_earned}
                    {answer.question_snapshot?.max_points != null && (
                      <span className="text-dim"> / {answer.question_snapshot.max_points}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-dim font-sm icp-snapshot-note">
            Scores reflect the question wording and point values that were configured when this test was
            submitted. Later changes to the question set do not affect this record.
          </p>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export const IcpQualificationHistory = ({ leadId, refreshToken }) => {
  const { showToast } = useToast();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const requestId = useRef(0);

  const loadHistory = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    const currentRequest = ++requestId.current;
    try {
      const res = await icpApi.getQualificationHistory(leadId);
      if (currentRequest !== requestId.current) return;
      setHistory(res.results || []);
    } catch (err) {
      if (currentRequest === requestId.current) {
        showToast(extractErrorMessage(err, 'Failed to load qualification history'), 'error');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [leadId, showToast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, refreshToken]);

  const handleViewResult = async (qualificationId) => {
    setLoadingResult(true);
    try {
      const res = await icpApi.getQualification(qualificationId);
      if (res?.data) setViewing(res.data);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load qualification result'), 'error');
    } finally {
      setLoadingResult(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading qualification history..." />;

  if (history.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No qualifications yet"
        message="Run the ICP qualification test to record the first score for this lead."
      />
    );
  }

  return (
    <>
      <div className="table-responsive">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Score</th>
              <th>Percentage</th>
              <th>Status</th>
              <th>Qualified By</th>
              <th className="table-action-col">Result</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => {
              const qualifiedBy = row.qualified_by_details?.full_name || row.qualified_by_details?.email;
              return (
                <tr key={row.id}>
                  <td>
                    <span className="text-main font-sm">{formatDateTime(row.qualified_at)}</span>
                    {row.latest && (
                      <span className="icp-latest-tag" title="Most recent test">
                        Latest
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="font-semibold text-main">
                      {row.total_score}/{row.max_score}
                    </span>
                  </td>
                  <td>
                    <span className="text-main">{row.percentage}%</span>
                  </td>
                  <td>
                    <IcpStatusBadge status={row.icp_status} size="sm" />
                  </td>
                  <td>
                    <span className="icp-qualified-by">
                      <span className="icp-qualified-avatar">{getInitials(qualifiedBy)}</span>
                      <span className="text-muted font-sm">{qualifiedBy || '—'}</span>
                    </span>
                  </td>
                  <td className="table-action-col">
                    <div className="action-buttons-group" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleViewResult(row.id)}
                        disabled={loadingResult}
                        aria-label={`View result for qualification ${row.id}`}
                      >
                        <Target size={14} />
                        <span>View Result</span>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <IcpResultModal qualification={viewing} onClose={() => setViewing(null)} />
    </>
  );
};