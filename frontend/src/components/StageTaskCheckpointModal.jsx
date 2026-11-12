import React, { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  ArrowRight,
  User,
  Calendar,
  Lock,
  Loader2,
  Check,
} from 'lucide-react';
import { leadApi } from '../api/leadApi';
import '../styles/stage_tasks.css';

export default function StageTaskCheckpointModal({
  isOpen,
  onClose,
  lead,
  targetStage,
  sourceStage,
  missingTasks = [],
  errorMessage = '',
  onAdvanceSuccess,
  onProceedToWinProbability,
  isManagerOrAdmin = false,
}) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  const [outcomeNotes, setOutcomeNotes] = useState({});
  const [showNotesInput, setShowNotesInput] = useState({});
  const [advancing, setAdvancing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [winProb, setWinProb] = useState(targetStage?.win_probability ?? 10);
  const [winReason, setWinReason] = useState(targetStage?.win_probability_reason || '');

  useEffect(() => {
    if (isOpen && targetStage) {
      setWinProb(targetStage.win_probability ?? 10);
      setWinReason(targetStage.win_probability_reason || '');
    }
  }, [isOpen, targetStage]);

  useEffect(() => {
    if (isOpen && lead) {
      setError('');
      loadStageTasks();
    }
  }, [isOpen, lead, targetStage]);

  const loadStageTasks = async () => {
    if (!lead?.id) return;
    setLoading(true);
    try {
      const res = await leadApi.getLeadStageTasks(lead.id);
      const taskList = res.data?.tasks || [];
      setTasks(taskList);
      setSummary(res.data?.summary || lead.stage_task_summary || null);
    } catch (err) {
      console.error('Error fetching stage tasks:', err);
      // Fallback to missingTasks passed from progression rejection
      if (missingTasks && missingTasks.length > 0) {
        setTasks(missingTasks);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !lead) return null;

  // Filter tasks for current stage
  const currentStageId = lead.stage?.id || lead.stage;
  const currentStageName = lead.stage?.name || 'Current Stage';
  const targetStageName = targetStage?.name || 'Next Stage';

  const currentStageTasks = tasks.filter(
    (t) =>
      !t.stage ||
      t.stage === currentStageId ||
      t.stage_id === currentStageId ||
      t.stage?.id === currentStageId
  );

  const mandatoryTasks = currentStageTasks.filter((t) => t.is_mandatory);
  const incompleteMandatory = mandatoryTasks.filter((t) => t.status !== 'COMPLETED');
  
  const isIcpStage =
    currentStageName.toLowerCase() === 'icp' ||
    lead.stage?.slug?.toLowerCase() === 'icp' ||
    (typeof lead.stage === 'string' && lead.stage.toLowerCase() === 'icp');
  const isIcpQualified = ['POTENTIAL_FIT', 'GOOD_FIT', 'STRONG_ICP_FIT'].includes(lead?.icp_status);
  const isIcpBlocked = isIcpStage && !isIcpQualified && targetStage?.slug !== 'lost';

  const allMandatoryCompleted =
    (mandatoryTasks.length === 0 || incompleteMandatory.length === 0) && !isIcpBlocked;

  const handleToggleComplete = async (taskId) => {
    setCompletingTaskId(taskId);
    setError('');
    try {
      const notes = outcomeNotes[taskId] || '';
      const res = await leadApi.toggleCompleteStageTask(taskId, notes);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: res.data?.status || 'COMPLETED',
                completed_at: new Date().toISOString(),
              }
            : t
        )
      );
      if (res.stage_task_summary) {
        setSummary(res.stage_task_summary);
      } else {
        await loadStageTasks();
      }
      setShowNotesInput((prev) => ({ ...prev, [taskId]: false }));
    } catch (err) {
      console.error('Failed to complete task:', err);
      setError(err.response?.data?.message || 'Failed to update task status.');
    } finally {
      setCompletingTaskId(null);
    }
  };

  const handleAdvanceStage = async () => {
    if (!targetStage?.id) return;
    setAdvancing(true);
    setError('');
    try {
      const updated = await leadApi.updateLead(lead.id, {
        stage: targetStage.id,
        win_probability_override: parseInt(winProb, 10) || 0,
        win_probability_reason: (winReason || '').trim(),
      });
      if (onAdvanceSuccess) {
        onAdvanceSuccess(updated);
      }
      onClose();
    } catch (err) {
      console.error('Failed to advance stage:', err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        'Failed to advance to next stage.';
      setError(msg);
    } finally {
      setAdvancing(false);
    }
  };

  const priorityClass = (p) => {
    const val = (p || '').toUpperCase();
    if (val === 'URGENT') return 'urgent';
    if (val === 'HIGH') return 'high';
    if (val === 'LOW') return 'low';
    return 'medium';
  };

  const isApprovalBlocked =
    errorMessage &&
    errorMessage.toLowerCase().includes('manager approval') &&
    !isManagerOrAdmin;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >
      <div
        className="checkpoint-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="checkpoint-modal-header">
          <div className="checkpoint-header-left">
            <div className="checkpoint-header-icon">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 className="checkpoint-header-title">
                  Stage Progression Checkpoint
                </h3>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--primary-subtle)',
                    color: 'var(--primary)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                  }}
                >
                  Step 1 of 2
                </span>
              </div>
              <p className="checkpoint-header-sub">
                Lead: <strong>{lead.name || lead.lead_name}</strong>
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="modal-close-btn">
            <X size={18} />
          </button>
        </div>

        {/* Stage Transition Visualizer */}
        <div className="checkpoint-stage-strip">
          <div className="checkpoint-stage-transition">
            <span style={{ color: 'var(--text-muted)' }}>Moving from:</span>
            <span className="checkpoint-stage-name">{currentStageName}</span>
            <ArrowRight size={14} style={{ color: 'var(--text-dim)' }} />
            <span className="checkpoint-stage-target">{targetStageName}</span>
          </div>

          <div>
            <span style={{ color: 'var(--text-muted)' }}>Mandatory Tasks: </span>
            <strong
              style={{
                color: allMandatoryCompleted ? 'var(--success)' : 'var(--warning)',
              }}
            >
              {mandatoryTasks.length - incompleteMandatory.length} /{' '}
              {mandatoryTasks.length} Completed
            </strong>
          </div>
        </div>

        {/* Content Body */}
        <div className="checkpoint-body">
          {error && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--danger-bg)',
                border: '1px solid rgba(225, 29, 72, 0.3)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.85rem',
              }}
            >
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {isApprovalBlocked ? (
            <div className="checkpoint-banner-warning">
              <Lock size={18} style={{ color: 'var(--warning)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <h4 className="checkpoint-banner-title">Manager Approval Required</h4>
                <p className="checkpoint-banner-desc">
                  Advancing beyond stage <strong>"{currentStageName}"</strong> requires approval
                  from a Sales Manager or Admin. Please request a manager to review and advance this lead.
                </p>
              </div>
            </div>
          ) : (
            <div className="checkpoint-banner-warning">
              <AlertTriangle size={18} style={{ color: 'var(--warning)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <h4 className="checkpoint-banner-title">Action Required Before Progression</h4>
                <p className="checkpoint-banner-desc">
                  Leads can only advance once all mandatory tasks for the current stage are
                  completed. Complete the checkpoint tasks below to unlock advancement.
                </p>
              </div>
            </div>
          )}

          {/* Task Progress Bar */}
          {mandatoryTasks.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.35rem',
                }}
              >
                <span>Checkpoint Completion</span>
                <strong>
                  {Math.round(
                    ((mandatoryTasks.length - incompleteMandatory.length) /
                      mandatoryTasks.length) *
                      100
                  )}
                  %
                </strong>
              </div>
              <div className="stage-progress-bar-wrap">
                <div
                  className="stage-progress-bar-fill ready"
                  style={{
                    width: `${
                      ((mandatoryTasks.length - incompleteMandatory.length) /
                        mandatoryTasks.length) *
                      100
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Tasks List */}
          <div>
            <div className="checkpoint-tasks-heading">
              Current Stage Tasks ({mandatoryTasks.length} mandatory,{' '}
              {currentStageTasks.length - mandatoryTasks.length} optional)
            </div>

            {isIcpBlocked && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: 'var(--danger)',
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  marginTop: '0.5rem',
                  marginBottom: '0.5rem',
                }}
              >
                <AlertCircle size={16} />
                <span>
                  ICP Qualification required: Lead must be qualified before moving beyond the ICP stage (Current: {lead?.icp_status || 'Not Tested'}).
                </span>
              </div>
            )}

            {allMandatoryCompleted && mandatoryTasks.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: 'var(--success)',
                  padding: '0.6rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  marginTop: '0.5rem',
                  marginBottom: '0.5rem',
                }}
              >
                <Check size={16} />
                <span>All mandatory checkpoint tasks completed! Ready to set win probability.</span>
              </div>
            )}

            {loading ? (
              <div className="stage-tasks-empty" style={{ padding: '2rem' }}>
                <Loader2 size={22} className="animate-spin text-primary" />
                <p className="stage-tasks-empty-desc">Loading stage tasks...</p>
              </div>
            ) : currentStageTasks.length === 0 ? (
              <div className="stage-tasks-empty" style={{ padding: '2rem' }}>
                <p className="stage-tasks-empty-desc" style={{ marginBottom: '0.5rem' }}>
                  No stage tasks configured for this stage.
                </p>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--success)', fontSize: '0.85rem', fontWeight: 600 }}>
                  <Check size={16} /> Ready for progression — no mandatory tasks blocking this lead.
                </div>
              </div>
            ) : (
              <div className="stage-tasks-list" style={{ marginTop: '0.5rem' }}>
                {currentStageTasks.map((task) => {
                  const isCompleted = task.status === 'COMPLETED';
                  const isCompleting = completingTaskId === task.id;
                  const isOverdue = task.is_overdue;

                  return (
                    <div
                      key={task.id}
                      className={`stage-task-card ${
                        isCompleted ? 'completed' : task.is_mandatory ? 'mandatory' : ''
                      }`}
                      style={{ padding: '0.9rem 1rem' }}
                    >
                      <div className="task-card-left">
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(task.id)}
                          disabled={isCompleting}
                          className={`task-check-circle ${isCompleted ? 'checked' : ''}`}
                          title={isCompleted ? 'Mark Pending' : 'Mark Completed'}
                        >
                          {isCompleting ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : isCompleted ? (
                            <Check size={14} />
                          ) : null}
                        </button>

                        <div className="task-card-content">
                          <div className="task-title-row">
                            <h4
                              className={`task-card-title ${
                                isCompleted ? 'strikethrough' : ''
                              }`}
                              style={{ fontSize: '0.9rem' }}
                            >
                              {task.title}
                            </h4>

                            {task.is_mandatory ? (
                              <span className="badge-checkpoint">Mandatory</span>
                            ) : (
                              <span className="badge-optional">Optional</span>
                            )}

                            <span
                              className={`badge-priority ${priorityClass(task.priority)}`}
                            >
                              {task.priority || 'Medium'}
                            </span>
                          </div>

                          {task.description && (
                            <p className="task-card-desc" style={{ margin: '0.15rem 0' }}>
                              {task.description}
                            </p>
                          )}

                          <div className="task-card-meta">
                            {task.assigned_to_name && (
                              <span className="task-meta-item">
                                <User size={12} />
                                <span>{task.assigned_to_name}</span>
                              </span>
                            )}
                            {task.due_date && (
                              <span
                                className={`task-meta-item ${
                                  isOverdue && !isCompleted ? 'overdue' : ''
                                }`}
                              >
                                <Calendar size={12} />
                                <span>
                                  Due {new Date(task.due_date).toLocaleDateString()}
                                  {isOverdue && !isCompleted && ' (Overdue)'}
                                </span>
                              </span>
                            )}
                          </div>

                          {/* Inline Notes Input */}
                          {showNotesInput[task.id] && !isCompleted && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginTop: '0.5rem',
                              }}
                            >
                              <input
                                type="text"
                                placeholder="Outcome notes or result..."
                                value={outcomeNotes[task.id] || ''}
                                onChange={(e) =>
                                  setOutcomeNotes((prev) => ({
                                    ...prev,
                                    [task.id]: e.target.value,
                                  }))
                                }
                                className="form-control"
                                style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem' }}
                              />
                              <button
                                type="button"
                                onClick={() => handleToggleComplete(task.id)}
                                disabled={isCompleting}
                                className="btn btn-primary btn-sm"
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                Save & Complete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quick Action buttons */}
                      {!isCompleted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            onClick={() =>
                              setShowNotesInput((prev) => ({
                                ...prev,
                                [task.id]: !prev[task.id],
                              }))
                            }
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                          >
                            + Note
                          </button>
                          <button
                            type="button"
                            disabled={isCompleting}
                            onClick={() => handleToggleComplete(task.id)}
                            className="btn btn-primary btn-sm"
                            style={{
                              background: 'var(--success)',
                              borderColor: 'var(--success)',
                              padding: '0.25rem 0.65rem',
                              fontSize: '0.75rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            {isCompleting ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Check size={12} />
                            )}
                            <span>Complete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="checkpoint-modal-footer">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>

          <button
            type="button"
            disabled={!allMandatoryCompleted || isApprovalBlocked || advancing}
            onClick={() => {
              if (onProceedToWinProbability) {
                onProceedToWinProbability({
                  lead,
                  targetStage,
                  sourceStage: currentStageName,
                });
              } else {
                handleAdvanceStage();
              }
            }}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {advancing ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Advancing...</span>
              </>
            ) : onProceedToWinProbability ? (
              <>
                <span>Next: Win Probability & Rationale</span>
                <ArrowRight size={15} />
              </>
            ) : (
              <>
                <span>Advance to {targetStageName}</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
