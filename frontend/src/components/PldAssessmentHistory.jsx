import React, { useCallback, useEffect, useRef, useState } from 'react';
import { History, Target, X } from 'lucide-react';
import { pldApi } from '../api/pldApi';
import { useToast } from '../context/ToastContext';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { extractErrorMessage } from '../utils/validation';
import { formatDateTime, getInitials } from '../utils/formatters';
import { PLD_STATUS_CONFIG, getPLDSeverity } from '../utils/constants';
import { EmptyState } from './EmptyState';
import { PldStatusBadge } from './PldStatusBadge';
import { LoadingSpinner } from './LoadingSpinner';

const PldResultModal = ({ assessment, onClose }) => {
  const dialogRef = useDialogA11y(Boolean(assessment), onClose);
  if (!assessment) return null;

  const config = PLD_STATUS_CONFIG[assessment.pld_status];
  const problems = assessment.problems || [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container modal-container-lg"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="PLD Assessment Result"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <h3>Assessment Result</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close result">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="pld-result-summary">
            <div className="pld-result-score">
              <span className="pld-result-points">
                {assessment.total_score}
                <span className="pld-result-max">/{assessment.max_score}</span>
              </span>
              <span className="pld-result-percentage">{assessment.percentage}%</span>
            </div>
            <span
              className="status-badge pld-result-status"
              style={{ color: config.color, backgroundColor: config.bg }}
            >
              {config.label}
            </span>
          </div>

          <dl className="icp-result-meta">
            <div>
              <dt>Assessed by</dt>
              <dd>
                {assessment.assessed_by_details?.full_name ||
                  assessment.assessed_by_details?.email ||
                  '—'}
              </dd>
            </div>
            <div>
              <dt>Assessed at</dt>
              <dd>{formatDateTime(assessment.assessed_at)}</dd>
            </div>
            <div>
              <dt>Lead</dt>
              <dd>{assessment.lead_name || assessment.lead_details?.name || '—'}</dd>
            </div>
            <div>
              <dt>Qualification threshold</dt>
              <dd>{assessment.config_snapshot?.qualified_min_percentage ?? '—'}%</dd>
            </div>
          </dl>

          <h4 className="icp-answers-heading">Problems selected at the time of this assessment</h4>
          {problems.length === 0 ? (
            <p className="text-muted">No problems were recorded for this attempt.</p>
          ) : (
            <div className="icp-answers-list">
              {problems.map((row) => {
                const severity = getPLDSeverity(row.severity || row.problem_snapshot?.severity);
                return (
                  <div className="icp-answer-row" key={row.id}>
                    <div className="icp-answer-question">
                      <span className="font-semibold text-main">
                        {row.problem_name || row.problem_snapshot?.name}
                      </span>
                      <span
                        className="pld-severity-tag"
                        style={{ color: severity.color, backgroundColor: severity.bg }}
                      >
                        {severity.label}
                      </span>
                    </div>
                    <div className="icp-answer-value text-dim font-sm">
                      {row.problem_snapshot?.description || ''}
                    </div>
                    <div className="icp-answer-points">+{row.points_earned}</div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-dim font-sm icp-snapshot-note">
            Scores reflect the problem names, points and severity that were configured when this
            assessment was submitted. Later changes to the problem set do not affect this record.
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

export const PldAssessmentHistory = ({ leadId, refreshToken }) => {
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
      const res = await pldApi.getAssessmentHistory(leadId);
      if (currentRequest !== requestId.current) return;
      setHistory(res.results || []);
    } catch (err) {
      if (currentRequest === requestId.current) {
        showToast(extractErrorMessage(err, 'Failed to load PLD history'), 'error');
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [leadId, showToast]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory, refreshToken]);

  const handleViewResult = async (assessmentId) => {
    setLoadingResult(true);
    try {
      const res = await pldApi.getAssessment(assessmentId);
      if (res?.data) setViewing(res.data);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load assessment result'), 'error');
    } finally {
      setLoadingResult(false);
    }
  };

  if (loading) return <LoadingSpinner text="Loading PLD history..." />;

  if (history.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No assessments yet"
        message="Run the PLD assessment to record the first score for this lead."
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
              <th>Assessed By</th>
              <th className="table-action-col">Result</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => {
              const assessedBy = row.assessed_by_details?.full_name || row.assessed_by_details?.email;
              return (
                <tr key={row.id}>
                  <td>
                    <span className="text-main font-sm">{formatDateTime(row.assessed_at)}</span>
                    {row.latest && (
                      <span className="icp-latest-tag" title="Most recent assessment">
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
                    <PldStatusBadge status={row.pld_status} size="sm" />
                  </td>
                  <td>
                    <span className="icp-qualified-by">
                      <span className="icp-qualified-avatar">{getInitials(assessedBy)}</span>
                      <span className="text-muted font-sm">{assessedBy || '—'}</span>
                    </span>
                  </td>
                  <td className="table-action-col">
                    <div className="action-buttons-group" style={{ justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleViewResult(row.id)}
                        disabled={loadingResult}
                        aria-label={`View result for assessment ${row.id}`}
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

      <PldResultModal assessment={viewing} onClose={() => setViewing(null)} />
    </>
  );
};
