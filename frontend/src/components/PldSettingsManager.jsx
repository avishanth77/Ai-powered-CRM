import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit,
  ListChecks,
  Percent,
  Plus,
  Power,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { leadApi } from '../api/leadApi';
import { pldApi } from '../api/pldApi';
import { useToast } from '../context/ToastContext';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { extractErrorMessage, normalizeServerErrors } from '../utils/validation';
import { PLD_ICP_MIN_OPTIONS, PLD_SEVERITIES, getPLDSeverity } from '../utils/constants';
import { ConfirmModal } from './ConfirmModal';
import { EmptyState } from './EmptyState';
import { FieldError } from './FieldError';
import { LoadingSpinner } from './LoadingSpinner';

const emptyProblemForm = () => ({
  name: '',
  description: '',
  points: 0,
  severity: 'MEDIUM',
  is_active: true,
});

const emptyGateForm = () => ({
  stage: '',
  require_icp_min_status: '',
  require_pld_qualified: false,
  require_problems_assessed: false,
  notes: '',
});

const toNumber = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const gateSummary = (gate) => {
  const parts = [];
  if (gate.require_icp_min_status) {
    const label = PLD_ICP_MIN_OPTIONS.find((o) => o.value === gate.require_icp_min_status);
    parts.push(label ? label.label : gate.require_icp_min_status);
  }
  if (gate.require_pld_qualified) parts.push('Qualified PLD');
  if (gate.require_problems_assessed) parts.push('Assessment recorded');
  return parts;
};

export const PldSettingsManager = () => {
  const { showToast } = useToast();

  // Problems
  const [problems, setProblems] = useState([]);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [problemFormOpen, setProblemFormOpen] = useState(false);
  const [editingProblem, setEditingProblem] = useState(null);
  const [problemForm, setProblemForm] = useState(emptyProblemForm());
  const [problemFormErrors, setProblemFormErrors] = useState({});
  const [submittingProblem, setSubmittingProblem] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Threshold
  const [config, setConfig] = useState({ qualified_min_percentage: 60 });
  const [savingConfig, setSavingConfig] = useState(false);

  // Gates
  const [stages, setStages] = useState([]);
  const [gates, setGates] = useState([]);
  const [loadingGates, setLoadingGates] = useState(true);
  const [gateFormOpen, setGateFormOpen] = useState(false);
  const [editingGate, setEditingGate] = useState(null);
  const [gateForm, setGateForm] = useState(emptyGateForm());
  const [gateFormErrors, setGateFormErrors] = useState({});
  const [submittingGate, setSubmittingGate] = useState(false);
  const [deleteGateTarget, setDeleteGateTarget] = useState(null);
  const [deletingGate, setDeletingGate] = useState(false);

  const requestId = useRef(0);

  const closeProblemForm = () => {
    setProblemFormOpen(false);
    setEditingProblem(null);
    setProblemFormErrors({});
  };
  const closeGateForm = () => {
    setGateFormOpen(false);
    setEditingGate(null);
    setGateFormErrors({});
  };

  const problemDialogRef = useDialogA11y(problemFormOpen, closeProblemForm);
  const gateDialogRef = useDialogA11y(gateFormOpen, closeGateForm);

  const loadProblems = useCallback(async () => {
    setLoadingProblems(true);
    const currentRequest = ++requestId.current;
    try {
      const res = await pldApi.getProblems({ include_inactive: 'true' });
      if (currentRequest !== requestId.current) return;
      const rows = res?.results ?? (Array.isArray(res) ? res : []);
      setProblems(rows.sort((a, b) => a.display_order - b.display_order || a.id - b.id));
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load PLD problems'), 'error');
    } finally {
      if (currentRequest === requestId.current) setLoadingProblems(false);
    }
  }, [showToast]);

  const loadConfig = useCallback(async () => {
    try {
      const res = await pldApi.getScoringConfig();
      if (res?.data) setConfig(res.data);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load scoring threshold'), 'error');
    }
  }, [showToast]);

  const loadStages = useCallback(async () => {
    try {
      const res = await leadApi.getStages({ all: 'true' });
      const items = res.results || (Array.isArray(res) ? res : []);
      setStages(items.sort((a, b) => a.display_order - b.display_order || a.id - b.id));
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load lead stages'), 'error');
    }
  }, [showToast]);

  const loadGates = useCallback(async () => {
    setLoadingGates(true);
    try {
      const res = await pldApi.getGates();
      const rows = res?.results ?? (Array.isArray(res) ? res : []);
      setGates(rows);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load stage gates'), 'error');
    } finally {
      setLoadingGates(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadProblems();
    loadConfig();
    loadStages();
    loadGates();
  }, [loadProblems, loadConfig, loadStages, loadGates]);

  /* ---------------- Problems ---------------- */

  const openProblemCreate = () => {
    setProblemForm(emptyProblemForm());
    setProblemFormErrors({});
    setEditingProblem(null);
    setProblemFormOpen(true);
  };

  const openProblemEdit = (problem) => {
    setProblemForm({
      name: problem.name,
      description: problem.description || '',
      points: problem.points,
      severity: problem.severity,
      is_active: problem.is_active,
    });
    setProblemFormErrors({});
    setEditingProblem(problem);
    setProblemFormOpen(true);
  };

  const validateProblem = () => {
    const errs = {};
    if (!problemForm.name.trim()) errs.name = 'Problem name is required.';
    if (toNumber(problemForm.points) < 0) errs.points = 'Points cannot be negative.';
    setProblemFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleProblemSubmit = async (e) => {
    e.preventDefault();
    if (!validateProblem()) return;

    setSubmittingProblem(true);
    const payload = {
      name: problemForm.name.trim(),
      description: problemForm.description.trim(),
      points: toNumber(problemForm.points),
      severity: problemForm.severity,
      is_active: Boolean(problemForm.is_active),
    };
    try {
      if (editingProblem) {
        await pldApi.updateProblem(editingProblem.id, payload);
        showToast('PLD problem updated.', 'success');
      } else {
        await pldApi.createProblem(payload);
        showToast('PLD problem created.', 'success');
      }
      closeProblemForm();
      loadProblems();
    } catch (err) {
      const { fieldErrors } = normalizeServerErrors(err);
      setProblemFormErrors(fieldErrors);
      showToast(extractErrorMessage(err, 'Failed to save PLD problem'), 'error');
    } finally {
      setSubmittingProblem(false);
    }
  };

  const handleMove = async (problem, direction) => {
    try {
      await pldApi.moveProblem(problem.id, direction);
      loadProblems();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to reorder problem'), 'error');
    }
  };

  const handleToggleActive = async (problem) => {
    try {
      const res = await pldApi.toggleProblemActive(problem.id, !problem.is_active);
      showToast(res?.message || 'Problem status updated.', 'success');
      loadProblems();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to toggle problem status'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await pldApi.deleteProblem(deleteTarget.id);
      showToast(res?.message || 'Problem deleted.', 'success');
      setDeleteTarget(null);
      loadProblems();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete problem'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  /* ---------------- Threshold ---------------- */

  const handleConfigSave = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await pldApi.updateScoringConfig({
        qualified_min_percentage: toNumber(config.qualified_min_percentage),
      });
      if (res?.data) setConfig(res.data);
      showToast('Qualification threshold updated.', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update threshold'), 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  /* ---------------- Gates ---------------- */

  const gateForStage = (stageId) => gates.find((gate) => gate.stage.id === stageId);

  const stagesWithoutGates = stages.filter((stage) => !gateForStage(stage.id));

  const openGateCreate = () => {
    setGateForm({ ...emptyGateForm(), stage: stagesWithoutGates[0]?.id || '' });
    setGateFormErrors({});
    setEditingGate(null);
    setGateFormOpen(true);
  };

  const openGateCreateForStage = (stage) => {
    setGateForm({ ...emptyGateForm(), stage: stage.id });
    setGateFormErrors({});
    setEditingGate(null);
    setGateFormOpen(true);
  };

  const openGateEdit = (gate) => {
    setGateForm({
      stage: gate.stage.id,
      require_icp_min_status: gate.require_icp_min_status || '',
      require_pld_qualified: Boolean(gate.require_pld_qualified),
      require_problems_assessed: Boolean(gate.require_problems_assessed),
      notes: gate.notes || '',
    });
    setGateFormErrors({});
    setEditingGate(gate);
    setGateFormOpen(true);
  };

  const validateGate = () => {
    const errs = {};
    if (!gateForm.stage) errs.stage = 'Select a stage.';
    const hasAny =
      gateForm.require_icp_min_status ||
      gateForm.require_pld_qualified ||
      gateForm.require_problems_assessed;
    if (!hasAny) {
      errs.requirements = 'A gate must require at least one thing, otherwise remove it instead.';
    }
    setGateFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGateSubmit = async (e) => {
    e.preventDefault();
    if (!validateGate()) return;

    setSubmittingGate(true);
    const payload = {
      stage: Number(gateForm.stage),
      require_icp_min_status: gateForm.require_icp_min_status || '',
      require_pld_qualified: Boolean(gateForm.require_pld_qualified),
      require_problems_assessed: Boolean(gateForm.require_problems_assessed),
      notes: gateForm.notes.trim(),
    };
    try {
      if (editingGate) {
        await pldApi.updateGate(editingGate.id, payload);
        showToast('Stage gate updated.', 'success');
      } else {
        await pldApi.createGate(payload);
        showToast('Stage gate created.', 'success');
      }
      closeGateForm();
      loadGates();
    } catch (err) {
      const { fieldErrors } = normalizeServerErrors(err);
      setGateFormErrors(fieldErrors);
      showToast(extractErrorMessage(err, 'Failed to save stage gate'), 'error');
    } finally {
      setSubmittingGate(false);
    }
  };

  const handleDeleteGate = async () => {
    if (!deleteGateTarget) return;
    setDeletingGate(true);
    try {
      const res = await pldApi.deleteGate(deleteGateTarget.id);
      showToast(res?.message || 'Stage gate removed.', 'success');
      setDeleteGateTarget(null);
      loadGates();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to remove stage gate'), 'error');
    } finally {
      setDeletingGate(false);
    }
  };

  const totalPoints = problems
    .filter((problem) => problem.is_active)
    .reduce((sum, problem) => sum + problem.points, 0);

  return (
    <div className="icp-manager">
      {/* Problems */}
      <div className="card">
        <div className="icp-section-header">
          <div>
            <h3 className="icp-section-title">
              <ListChecks size={20} color="var(--primary)" />
              <span>PLD Problems</span>
            </h3>
            <p className="text-muted font-sm icp-section-subtitle">
              Sales users pick from this list during an assessment. The score is the sum of the
              selected problems' points; max score is the sum of every active problem
              {totalPoints > 0 ? ` (${totalPoints} pts)` : ''}.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openProblemCreate}>
            <Plus size={16} />
            <span>Add Problem</span>
          </button>
        </div>

        {loadingProblems ? (
          <LoadingSpinner text="Loading PLD problems..." />
        ) : problems.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No PLD problems configured"
            message="Create the first problem to build your PLD assessment."
            actionLabel="Add Problem"
            onAction={openProblemCreate}
          />
        ) : (
          <div className="table-responsive embedded">
            <table className="crm-table">
              <thead>
                <tr>
                  <th style={{ width: '70px' }}>Order</th>
                  <th>Problem</th>
                  <th>Severity</th>
                  <th style={{ width: '90px' }}>Points</th>
                  <th>Status</th>
                  <th className="table-action-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((problem, index) => {
                  const severity = getPLDSeverity(problem.severity);
                  return (
                    <tr key={problem.id} style={{ opacity: problem.is_active ? 1 : 0.65 }}>
                      <td>
                        <span className="icp-order-chip">{problem.display_order}</span>
                      </td>
                      <td>
                        <div className="font-semibold text-main">{problem.name}</div>
                        {problem.description && (
                          <div className="text-dim font-sm">{problem.description}</div>
                        )}
                      </td>
                      <td>
                        <span
                          className="pld-severity-tag"
                          style={{ color: severity.color, backgroundColor: severity.bg }}
                        >
                          {severity.label}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold text-main">+{problem.points}</span>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${problem.is_active ? 'badge-success' : 'badge-danger'}`}
                          style={{ fontSize: '0.72rem', padding: '0.18rem 0.55rem' }}
                        >
                          {problem.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="table-action-col">
                        <div
                          className="action-buttons-group"
                          style={{ justifyContent: 'flex-end', gap: '0.35rem' }}
                        >
                          <button
                            type="button"
                            className="icon-action-btn"
                            title="Move Up"
                            aria-label={`Move problem ${problem.name} up`}
                            disabled={index === 0}
                            onClick={() => handleMove(problem, 'up')}
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-action-btn"
                            title="Move Down"
                            aria-label={`Move problem ${problem.name} down`}
                            disabled={index === problems.length - 1}
                            onClick={() => handleMove(problem, 'down')}
                          >
                            <ArrowDown size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-action-btn"
                            title="Edit Problem"
                            aria-label={`Edit problem ${problem.name}`}
                            onClick={() => openProblemEdit(problem)}
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-action-btn"
                            title={problem.is_active ? 'Deactivate' : 'Activate'}
                            aria-label={`${problem.is_active ? 'Deactivate' : 'Activate'} problem ${problem.name}`}
                            onClick={() => handleToggleActive(problem)}
                            style={{ color: problem.is_active ? 'var(--warning)' : 'var(--success)' }}
                          >
                            <Power size={15} />
                          </button>
                          <button
                            type="button"
                            className="icon-action-btn icon-delete"
                            title="Delete Problem"
                            aria-label={`Delete problem ${problem.name}`}
                            onClick={() => setDeleteTarget(problem)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Threshold */}
      <div className="card icp-config-card">
        <div className="icp-section-header">
          <div>
            <h3 className="icp-section-title">
              <SlidersHorizontal size={20} color="var(--primary)" />
              <span>Qualification Threshold</span>
            </h3>
            <p className="text-muted font-sm icp-section-subtitle">
              A lead becomes Qualified PLD at or above this percentage. Changes apply to future
              assessments only — history keeps the threshold it was scored with.
            </p>
          </div>
        </div>

        <form onSubmit={handleConfigSave} className="icp-threshold-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="pld-threshold">
              Qualified PLD from
            </label>
            <input
              id="pld-threshold"
              type="number"
              className="form-control"
              min="0"
              max="100"
              value={config.qualified_min_percentage}
              onChange={(e) => setConfig({ ...config, qualified_min_percentage: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Percent of maximum score</label>
            <input
              type="text"
              className="form-control"
              value={`${config.qualified_min_percentage}%`}
              readOnly
              disabled
            />
          </div>
          <div className="icp-threshold-actions">
            <button type="submit" className="btn btn-primary" disabled={savingConfig}>
              <Percent size={15} />
              <span>{savingConfig ? 'Saving...' : 'Save Threshold'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Stage gates */}
      <div className="card">
        <div className="icp-section-header">
          <div>
            <h3 className="icp-section-title">
              <ShieldCheck size={20} color="var(--primary)" />
              <span>Stage Requirements</span>
            </h3>
            <p className="text-muted font-sm icp-section-subtitle">
              A stage with no requirements accepts any lead. Stages with requirements reject the
              move with a message explaining exactly what is missing.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openGateCreate}
            disabled={stagesWithoutGates.length === 0}
            title={
              stagesWithoutGates.length === 0
                ? 'Every stage already has requirements configured.'
                : undefined
            }
          >
            <Plus size={16} />
            <span>Add Requirement</span>
          </button>
        </div>

        {loadingGates ? (
          <LoadingSpinner text="Loading stage requirements..." />
        ) : stages.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No lead stages found"
            message="Create lead stages first, then come back to attach requirements to them."
          />
        ) : (
          <div className="table-responsive embedded">
            <table className="crm-table">
              <thead>
                <tr>
                  <th style={{ width: '70px' }}>Order</th>
                  <th>Stage</th>
                  <th>Requirements</th>
                  <th>Status</th>
                  <th className="table-action-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {stages.map((stage) => {
                  const gate = gateForStage(stage.id);
                  const parts = gate ? gateSummary(gate) : [];
                  return (
                    <tr key={stage.id} style={{ opacity: stage.is_active ? 1 : 0.65 }}>
                      <td>
                        <span className="icp-order-chip">{stage.display_order}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              backgroundColor: stage.color,
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                          <span className="font-semibold text-main">{stage.name}</span>
                        </div>
                      </td>
                      <td>
                        {gate ? (
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {parts.length === 0 ? (
                              <span className="text-dim font-sm">No requirements</span>
                            ) : (
                              parts.map((part) => (
                                <span className="pld-gate-chip" key={part}>
                                  {part}
                                </span>
                              ))
                            )}
                            {gate.notes && (
                              <span className="text-dim font-sm">{gate.notes}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-dim font-sm">No requirements</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${gate ? 'badge-purple' : 'badge-neutral'}`}
                          style={{ fontSize: '0.72rem', padding: '0.18rem 0.55rem' }}
                        >
                          {gate ? 'Gated' : 'Open'}
                        </span>
                      </td>
                      <td className="table-action-col">
                        <div
                          className="action-buttons-group"
                          style={{ justifyContent: 'flex-end', gap: '0.35rem' }}
                        >
                          <button
                            type="button"
                            className="icon-action-btn"
                            title={gate ? 'Edit Requirement' : 'Add Requirement'}
                            aria-label={`${gate ? 'Edit' : 'Add'} requirements for stage ${stage.name}`}
                            onClick={() => (gate ? openGateEdit(gate) : openGateCreateForStage(stage))}
                          >
                            <Edit size={15} />
                          </button>
                          {gate && (
                            <button
                              type="button"
                              className="icon-action-btn icon-delete"
                              title="Remove Requirement"
                              aria-label={`Remove requirements for stage ${stage.name}`}
                              onClick={() => setDeleteGateTarget(gate)}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Problem create / edit modal */}
      {problemFormOpen && (
        <div className="modal-backdrop" onClick={closeProblemForm}>
          <div
            className="modal-container modal-container-lg"
            ref={problemDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={editingProblem ? 'Edit PLD problem' : 'Add PLD problem'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <h3>{editingProblem ? 'Edit PLD Problem' : 'Add PLD Problem'}</h3>
              </div>
              <button className="modal-close-btn" onClick={closeProblemForm} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleProblemSubmit}>
              <div className="modal-body">
                <div className="form-grid-2">
                  <div className="form-group icp-span-2">
                    <label className="form-label form-label-required" htmlFor="pld-problem-name">
                      Problem
                    </label>
                    <input
                      id="pld-problem-name"
                      type="text"
                      className="form-control"
                      value={problemForm.name}
                      onChange={(e) =>
                        setProblemForm({ ...problemForm, name: e.target.value })
                      }
                      placeholder="e.g. Manual reporting eats a full day each week"
                    />
                    <FieldError message={problemFormErrors.name} />
                  </div>

                  <div className="form-group icp-span-2">
                    <label className="form-label" htmlFor="pld-problem-desc">
                      Description
                    </label>
                    <input
                      id="pld-problem-desc"
                      type="text"
                      className="form-control"
                      value={problemForm.description}
                      onChange={(e) =>
                        setProblemForm({ ...problemForm, description: e.target.value })
                      }
                      placeholder="Optional context shown while assessing"
                    />
                    <FieldError message={problemFormErrors.description} />
                  </div>

                  <div className="form-group">
                    <label className="form-label form-label-required" htmlFor="pld-problem-points">
                      Points
                    </label>
                    <input
                      id="pld-problem-points"
                      type="number"
                      className="form-control"
                      min="0"
                      value={problemForm.points}
                      onChange={(e) =>
                        setProblemForm({ ...problemForm, points: e.target.value })
                      }
                    />
                    <FieldError message={problemFormErrors.points} />
                  </div>

                  <div className="form-group">
                    <label className="form-label form-label-required" htmlFor="pld-problem-severity">
                      Severity
                    </label>
                    <select
                      id="pld-problem-severity"
                      className="form-control"
                      value={problemForm.severity}
                      onChange={(e) =>
                        setProblemForm({ ...problemForm, severity: e.target.value })
                      }
                    >
                      {PLD_SEVERITIES.map((severity) => (
                        <option key={severity.value} value={severity.value}>
                          {severity.label}
                        </option>
                      ))}
                    </select>
                    <FieldError message={problemFormErrors.severity} />
                  </div>

                  <div className="form-group icp-toggle-row icp-span-2">
                    <label className="icp-checkbox-label">
                      <input
                        type="checkbox"
                        checked={problemForm.is_active}
                        onChange={(e) =>
                          setProblemForm({ ...problemForm, is_active: e.target.checked })
                        }
                      />
                      <span>Active (offered during assessments)</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeProblemForm}
                  disabled={submittingProblem}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingProblem}>
                  {submittingProblem
                    ? 'Saving...'
                    : editingProblem
                      ? 'Save Changes'
                      : 'Create Problem'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gate create / edit modal */}
      {gateFormOpen && (
        <div className="modal-backdrop" onClick={closeGateForm}>
          <div
            className="modal-container"
            ref={gateDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={editingGate ? 'Edit stage requirement' : 'Add stage requirement'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <ShieldCheck size={20} color="var(--primary)" />
                <h3>{editingGate ? 'Edit Stage Requirement' : 'Add Stage Requirement'}</h3>
              </div>
              <button className="modal-close-btn" onClick={closeGateForm} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGateSubmit}>
              <div className="modal-body form-layout">
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="pld-gate-stage">
                    Stage
                  </label>
                  <select
                    id="pld-gate-stage"
                    className="form-control"
                    value={gateForm.stage}
                    onChange={(e) => setGateForm({ ...gateForm, stage: e.target.value })}
                    disabled={Boolean(editingGate)}
                  >
                    <option value="">Select a stage</option>
                    {(editingGate ? stages : stagesWithoutGates).map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                  <FieldError message={gateFormErrors.stage} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pld-gate-icp">
                    Minimum ICP fit
                  </label>
                  <select
                    id="pld-gate-icp"
                    className="form-control"
                    value={gateForm.require_icp_min_status}
                    onChange={(e) =>
                      setGateForm({ ...gateForm, require_icp_min_status: e.target.value })
                    }
                  >
                    {PLD_ICP_MIN_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  className="form-group"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}
                >
                  <input
                    id="pld-gate-qualified"
                    type="checkbox"
                    checked={gateForm.require_pld_qualified}
                    onChange={(e) =>
                      setGateForm({ ...gateForm, require_pld_qualified: e.target.checked })
                    }
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label
                    htmlFor="pld-gate-qualified"
                    className="form-label"
                    style={{ margin: 0, cursor: 'pointer' }}
                  >
                    Requires Qualified PLD
                  </label>
                </div>

                <div
                  className="form-group"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem' }}
                >
                  <input
                    id="pld-gate-assessed"
                    type="checkbox"
                    checked={gateForm.require_problems_assessed}
                    onChange={(e) =>
                      setGateForm({ ...gateForm, require_problems_assessed: e.target.checked })
                    }
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label
                    htmlFor="pld-gate-assessed"
                    className="form-label"
                    style={{ margin: 0, cursor: 'pointer' }}
                  >
                    Requires a completed assessment
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="pld-gate-notes">
                    Note shown when blocked
                  </label>
                  <input
                    id="pld-gate-notes"
                    type="text"
                    className="form-control"
                    value={gateForm.notes}
                    onChange={(e) => setGateForm({ ...gateForm, notes: e.target.value })}
                    placeholder="e.g. Must be signed off by a manager"
                  />
                </div>

                <FieldError message={gateFormErrors.requirements} />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeGateForm}
                  disabled={submittingGate}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submittingGate}>
                  {submittingGate ? 'Saving...' : editingGate ? 'Save Changes' : 'Create Requirement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete PLD Problem"
        message={`Delete "${deleteTarget?.name}"? Past assessments keep their own snapshot, so historical scores are unaffected. Use Deactivate instead if you only want to hide it from future assessments.`}
        confirmText="Delete Problem"
        isDestructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        isOpen={Boolean(deleteGateTarget)}
        title="Remove Stage Requirement"
        message={`Remove the requirements on "${deleteGateTarget?.stage?.name}"? Leads will be able to move into this stage freely again.`}
        confirmText="Remove Requirement"
        isDestructive
        loading={deletingGate}
        onConfirm={handleDeleteGate}
        onCancel={() => setDeleteGateTarget(null)}
      />
    </div>
  );
};
