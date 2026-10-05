import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Edit,
  ListChecks,
  Plus,
  Power,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { icpApi } from '../api/icpApi';
import { useToast } from '../context/ToastContext';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { extractErrorMessage, normalizeServerErrors } from '../utils/validation';
import { ICP_QUESTION_TYPES, getIcpQuestionType } from '../utils/constants';
import { ConfirmModal } from './ConfirmModal';
import { EmptyState } from './EmptyState';
import { FieldError } from './FieldError';
import { LoadingSpinner } from './LoadingSpinner';

const emptyOption = () => ({ option_text: '', points: 0 });
const emptyRule = () => ({ min: '', max: '', points: 0 });

const emptyForm = () => ({
  question_text: '',
  description: '',
  question_type: 'DROPDOWN',
  is_required: true,
  is_active: true,
  max_points: 0,
  options: [emptyOption(), emptyOption()],
  scoring_rules: [],
});

const toNumber = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const IcpQuestionsManager = () => {
  const { showToast } = useToast();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState({ poor_fit_max: 39, potential_fit_max: 59, good_fit_max: 79 });
  const [savingConfig, setSavingConfig] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const requestId = useRef(0);

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setFormErrors({});
  };

  const formDialogRef = useDialogA11y(formOpen, closeForm);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    const currentRequest = ++requestId.current;
    try {
      const res = await icpApi.getQuestions({ include_inactive: 'true' });
      if (currentRequest !== requestId.current) return;
      const rows = res?.results ?? (Array.isArray(res) ? res : []);
      setQuestions(rows.sort((a, b) => a.display_order - b.display_order || a.id - b.id));
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load ICP questions'), 'error');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [showToast]);

  const loadConfig = useCallback(async () => {
    try {
      const res = await icpApi.getScoringConfig();
      if (res?.data) setConfig(res.data);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load scoring thresholds'), 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadQuestions();
    loadConfig();
  }, [loadQuestions, loadConfig]);

  const typeMeta = getIcpQuestionType(formData.question_type);

  const handleChange = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleTypeChange = (e) => {
    const questionType = e.target.value;
    setFormData((prev) => {
      const next = { ...prev, question_type: questionType };
      if (questionType === 'YES_NO') {
        next.options = prev.options.length === 2 && prev.options.every((o) => o.option_text)
          ? prev.options
          : [{ option_text: 'Yes', points: 0 }, { option_text: 'No', points: 0 }];
      }
      if (questionType === 'NUMBER') {
        next.scoring_rules = prev.scoring_rules.length ? prev.scoring_rules : [emptyRule()];
      }
      return next;
    });
  };

  const updateOption = (index, field) => (e) => {
    const value = e.target.value;
    setFormData((prev) => {
      const options = [...prev.options];
      options[index] = {
        ...options[index],
        [field]: field === 'points' ? toNumber(value) : value,
      };
      return { ...prev, options };
    });
  };

  const addOption = () =>
    setFormData((prev) => ({ ...prev, options: [...prev.options, emptyOption()] }));

  const removeOption = (index) =>
    setFormData((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }));

  const updateRule = (index, field) => (e) => {
    const value = e.target.value;
    setFormData((prev) => {
      const rules = [...prev.scoring_rules];
      rules[index] = { ...rules[index], [field]: field === 'points' ? toNumber(value) : value };
      return { ...prev, scoring_rules: rules };
    });
  };

  const addRule = () =>
    setFormData((prev) => ({ ...prev, scoring_rules: [...prev.scoring_rules, emptyRule()] }));

  const removeRule = (index) =>
    setFormData((prev) => ({
      ...prev,
      scoring_rules: prev.scoring_rules.filter((_, i) => i !== index),
    }));

  const openCreate = () => {
    setEditing(null);
    setFormData(emptyForm());
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (question) => {
    setEditing(question);
    setFormData({
      question_text: question.question_text || '',
      description: question.description || '',
      question_type: question.question_type,
      is_required: Boolean(question.is_required),
      is_active: Boolean(question.is_active),
      max_points: question.max_points || 0,
      options: (question.options || []).map((option) => ({
        option_text: option.option_text,
        points: option.points,
      })),
      scoring_rules: (question.scoring_rules || []).map((rule) => ({
        min: rule.min ?? '',
        max: rule.max ?? '',
        points: rule.points ?? 0,
      })),
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const validate = () => {
    const errors = {};
    if (!formData.question_text.trim()) {
      errors.question_text = 'Question text is required.';
    }

    if (typeMeta.isChoice) {
      const cleaned = formData.options.filter((option) => option.option_text.trim());
      if (cleaned.length === 0) {
        errors.options = 'Add at least one answer option.';
      } else if (formData.question_type === 'YES_NO' && cleaned.length !== 2) {
        errors.options = 'Yes / No questions need exactly two options.';
      } else if (cleaned.some((option) => option.option_text.trim() === '')) {
        errors.options = 'Every option needs a label.';
      }
    }

    if (formData.question_type === 'NUMBER') {
      if (formData.scoring_rules.length === 0) {
        errors.scoring_rules = 'Add at least one scoring range.';
      } else {
        const hasInvalid = formData.scoring_rules.some((rule) => {
          const hasBound = rule.min !== '' || rule.max !== '';
          const minInvalid = rule.min !== '' && rule.max !== '' && Number(rule.min) > Number(rule.max);
          return !hasBound || minInvalid;
        });
        if (hasInvalid) {
          errors.scoring_rules = 'Each range needs points, and min cannot be greater than max.';
        }
      }
    }

    if (formData.question_type === 'TEXT' && toNumber(formData.max_points) < 0) {
      errors.max_points = 'Points cannot be negative.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildPayload = () => {
    const payload = {
      question_text: formData.question_text.trim(),
      description: formData.description.trim(),
      question_type: formData.question_type,
      is_required: Boolean(formData.is_required),
      is_active: Boolean(formData.is_active),
    };

    if (typeMeta.isChoice) {
      payload.options = formData.options
        .filter((option) => option.option_text.trim())
        .map((option) => ({
          option_text: option.option_text.trim(),
          points: toNumber(option.points),
        }));
    } else {
      payload.options = [];
    }

    if (formData.question_type === 'NUMBER') {
      payload.scoring_rules = formData.scoring_rules.map((rule) => ({
        min: rule.min === '' ? null : Number(rule.min),
        max: rule.max === '' ? null : Number(rule.max),
        points: toNumber(rule.points),
      }));
    } else {
      payload.scoring_rules = [];
    }

    if (formData.question_type === 'TEXT') {
      payload.max_points = toNumber(formData.max_points);
    }

    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (editing) {
        await icpApi.updateQuestion(editing.id, payload);
        showToast('ICP question updated successfully.', 'success');
      } else {
        await icpApi.createQuestion(payload);
        showToast('ICP question created successfully.', 'success');
      }
      closeForm();
      loadQuestions();
    } catch (err) {
      const { fieldErrors } = normalizeServerErrors(err);
      setFormErrors(fieldErrors);
      showToast(extractErrorMessage(err, 'Failed to save ICP question'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (question) => {
    try {
      const res = await icpApi.toggleQuestionActive(question.id, !question.is_active);
      showToast(res?.message || 'Question status updated.', 'success');
      loadQuestions();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update question status'), 'error');
    }
  };

  const handleMove = async (question, direction) => {
    try {
      await icpApi.moveQuestion(question.id, direction);
      loadQuestions();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to reorder question'), 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await icpApi.deleteQuestion(deleteTarget.id);
      showToast(res?.message || 'Question deleted.', 'success');
      setDeleteTarget(null);
      loadQuestions();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete question'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleConfigSave = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await icpApi.updateScoringConfig({
        poor_fit_max: toNumber(config.poor_fit_max),
        potential_fit_max: toNumber(config.potential_fit_max),
        good_fit_max: toNumber(config.good_fit_max),
      });
      if (res?.data) setConfig(res.data);
      showToast('Scoring thresholds updated.', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update scoring thresholds'), 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const optionSummary = (question) => {
    const options = question.options || [];
    if (options.length === 0) return '—';
    return `${options.length} option${options.length === 1 ? '' : 's'} · max ${question.max_points} pts`;
  };

  return (
    <div className="icp-manager">
      {/* Question list */}
      <div className="card">
        <div className="icp-section-header">
          <div>
            <h3 className="icp-section-title">
              <ListChecks size={20} color="var(--primary)" />
              <span>ICP Qualification Questions</span>
            </h3>
            <p className="text-muted font-sm icp-section-subtitle">
              These questions are shown to sales users in this order when they run an ICP test.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />
            <span>Add Question</span>
          </button>
        </div>

        {loading ? (
          <LoadingSpinner text="Loading ICP questions..." />
        ) : questions.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No ICP questions configured"
            message="Create the first question to build your ICP qualification test."
            actionLabel="Add Question"
            onAction={openCreate}
          />
        ) : (
          <div className="table-responsive embedded">
            <table className="crm-table">
              <thead>
                <tr>
                  <th style={{ width: '70px' }}>Order</th>
                  <th>Question</th>
                  <th>Type</th>
                  <th>Scoring</th>
                  <th>Required</th>
                  <th>Status</th>
                  <th className="table-action-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((question, index) => (
                  <tr key={question.id} style={{ opacity: question.is_active ? 1 : 0.65 }}>
                    <td>
                      <span className="icp-order-chip">{question.display_order}</span>
                    </td>
                    <td>
                      <div className="font-semibold text-main">{question.question_text}</div>
                      {question.description && (
                        <div className="text-dim font-sm">{question.description}</div>
                      )}
                    </td>
                    <td>
                      <span className="icp-type-tag">
                        {getIcpQuestionType(question.question_type).label}
                      </span>
                    </td>
                    <td>
                      <span className="text-dim font-sm">
                        {question.question_type === 'NUMBER'
                          ? `${(question.scoring_rules || []).length} range(s) · max ${question.max_points} pts`
                          : question.question_type === 'TEXT'
                            ? `Flat ${question.max_points} pts`
                            : optionSummary(question)}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${question.is_required ? 'badge-purple' : 'badge-neutral'}`}
                        style={{ fontSize: '0.72rem', padding: '0.18rem 0.55rem' }}
                      >
                        {question.is_required ? 'Required' : 'Optional'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${question.is_active ? 'badge-success' : 'badge-danger'}`}
                        style={{ fontSize: '0.72rem', padding: '0.18rem 0.55rem' }}
                      >
                        {question.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="table-action-col">
                      <div className="action-buttons-group" style={{ justifyContent: 'flex-end', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="icon-action-btn"
                          title="Move Up"
                          aria-label={`Move question ${question.question_text} up`}
                          disabled={index === 0}
                          onClick={() => handleMove(question, 'up')}
                        >
                          <ArrowUp size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-action-btn"
                          title="Move Down"
                          aria-label={`Move question ${question.question_text} down`}
                          disabled={index === questions.length - 1}
                          onClick={() => handleMove(question, 'down')}
                        >
                          <ArrowDown size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-action-btn"
                          title="Edit Question"
                          aria-label={`Edit question ${question.question_text}`}
                          onClick={() => openEdit(question)}
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-action-btn"
                          title={question.is_active ? 'Deactivate' : 'Activate'}
                          aria-label={`${question.is_active ? 'Deactivate' : 'Activate'} question ${question.question_text}`}
                          onClick={() => handleToggleActive(question)}
                          style={{ color: question.is_active ? 'var(--warning)' : 'var(--success)' }}
                        >
                          <Power size={15} />
                        </button>
                        <button
                          type="button"
                          className="icon-action-btn icon-delete"
                          title="Delete Question"
                          aria-label={`Delete question ${question.question_text}`}
                          onClick={() => setDeleteTarget(question)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Scoring thresholds */}
      <div className="card icp-config-card">
        <div className="icp-section-header">
          <div>
            <h3 className="icp-section-title">
              <SlidersHorizontal size={20} color="var(--primary)" />
              <span>Score Classification</span>
            </h3>
            <p className="text-muted font-sm icp-section-subtitle">
              Percentage = (earned points / maximum points) × 100. Changes apply to future qualifications only.
            </p>
          </div>
        </div>

        <form onSubmit={handleConfigSave} className="icp-threshold-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="icp-poor-max">
              Poor Fit up to
            </label>
            <input
              id="icp-poor-max"
              type="number"
              className="form-control"
              min="0"
              max="100"
              value={config.poor_fit_max}
              onChange={(e) => setConfig({ ...config, poor_fit_max: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="icp-potential-max">
              Potential Fit up to
            </label>
            <input
              id="icp-potential-max"
              type="number"
              className="form-control"
              min="0"
              max="100"
              value={config.potential_fit_max}
              onChange={(e) => setConfig({ ...config, potential_fit_max: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="icp-good-max">
              Good Fit up to
            </label>
            <input
              id="icp-good-max"
              type="number"
              className="form-control"
              min="0"
              max="100"
              value={config.good_fit_max}
              onChange={(e) => setConfig({ ...config, good_fit_max: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Above that</label>
            <input type="text" className="form-control" value="Strong ICP Fit" readOnly disabled />
          </div>
          <div className="icp-threshold-actions">
            <button type="submit" className="btn btn-primary" disabled={savingConfig}>
              {savingConfig ? 'Saving...' : 'Save Thresholds'}
            </button>
          </div>
        </form>
      </div>

      {/* Create / Edit modal */}
      {formOpen && (
        <div className="modal-backdrop" onClick={closeForm}>
          <div
            className="modal-container modal-container-lg"
            ref={formDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={editing ? 'Edit ICP question' : 'Add ICP question'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <h3>{editing ? 'Edit ICP Question' : 'Add ICP Question'}</h3>
              </div>
              <button className="modal-close-btn" onClick={closeForm} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid-2">
                  <div className="form-group icp-span-2">
                    <label className="form-label form-label-required" htmlFor="icp-question-text">
                      Question
                    </label>
                    <input
                      id="icp-question-text"
                      type="text"
                      className="form-control"
                      value={formData.question_text}
                      onChange={handleChange('question_text')}
                      placeholder="e.g. How many employees does the company have?"
                    />
                    <FieldError message={formErrors.question_text} />
                  </div>

                  <div className="form-group icp-span-2">
                    <label className="form-label" htmlFor="icp-question-desc">
                      Description / Help text
                    </label>
                    <input
                      id="icp-question-desc"
                      type="text"
                      className="form-control"
                      value={formData.description}
                      onChange={handleChange('description')}
                      placeholder="Optional guidance shown under the question"
                    />
                    <FieldError message={formErrors.description} />
                  </div>

                  <div className="form-group">
                    <label className="form-label form-label-required" htmlFor="icp-question-type">
                      Question type
                    </label>
                    <select
                      id="icp-question-type"
                      className="form-control"
                      value={formData.question_type}
                      onChange={handleTypeChange}
                    >
                      {ICP_QUESTION_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    <FieldError message={formErrors.question_type} />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="icp-display-order">
                      Display order
                    </label>
                    <input
                      id="icp-display-order"
                      type="number"
                      className="form-control"
                      min="1"
                      value={editing ? editing.display_order : questions.length + 1}
                      disabled
                    />
                    <span className="text-dim font-sm">Use the up / down buttons to reorder.</span>
                  </div>

                  <div className="form-group icp-toggle-row">
                    <label className="icp-checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.is_required}
                        onChange={handleChange('is_required')}
                      />
                      <span>Required</span>
                    </label>
                    <label className="icp-checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={handleChange('is_active')}
                      />
                      <span>Active</span>
                    </label>
                  </div>
                </div>

                {/* Options editor for choice based questions */}
                {typeMeta.isChoice && (
                  <div className="icp-editor-section">
                    <div className="icp-editor-header">
                      <span className="form-label form-label-required">Answer options &amp; points</span>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={addOption}>
                        <Plus size={14} />
                        <span>Add option</span>
                      </button>
                    </div>
                    <div className="icp-option-head">
                      <span>Option</span>
                      <span>Points</span>
                      <span />
                    </div>
                    {formData.options.map((option, index) => (
                      <div className="icp-option-row" key={`option-${index}`}>
                        <input
                          type="text"
                          className="form-control"
                          value={option.option_text}
                          onChange={updateOption(index, 'option_text')}
                          placeholder="Option label"
                          aria-label={`Option ${index + 1} label`}
                        />
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          value={option.points}
                          onChange={updateOption(index, 'points')}
                          aria-label={`Option ${index + 1} points`}
                        />
                        <button
                          type="button"
                          className="icon-action-btn icon-delete"
                          onClick={() => removeOption(index)}
                          title="Remove option"
                          aria-label={`Remove option ${index + 1}`}
                          disabled={formData.options.length <= 1}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                    <FieldError message={formErrors.options} />
                  </div>
                )}

                {/* Scoring rules editor for number questions */}
                {typeMeta.usesRules && (
                  <div className="icp-editor-section">
                    <div className="icp-editor-header">
                      <span className="form-label form-label-required">Scoring ranges</span>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={addRule}>
                        <Plus size={14} />
                        <span>Add range</span>
                      </button>
                    </div>
                    <div className="icp-option-head">
                      <span>Min</span>
                      <span>Max</span>
                      <span>Points</span>
                      <span />
                    </div>
                    {formData.scoring_rules.map((rule, index) => (
                      <div className="icp-option-row icp-rule-row" key={`rule-${index}`}>
                        <input
                          type="number"
                          className="form-control"
                          value={rule.min}
                          onChange={updateRule(index, 'min')}
                          placeholder="any"
                          aria-label={`Range ${index + 1} minimum`}
                        />
                        <input
                          type="number"
                          className="form-control"
                          value={rule.max}
                          onChange={updateRule(index, 'max')}
                          placeholder="any"
                          aria-label={`Range ${index + 1} maximum`}
                        />
                        <input
                          type="number"
                          className="form-control"
                          min="0"
                          value={rule.points}
                          onChange={updateRule(index, 'points')}
                          aria-label={`Range ${index + 1} points`}
                        />
                        <button
                          type="button"
                          className="icon-action-btn icon-delete"
                          onClick={() => removeRule(index)}
                          title="Remove range"
                          aria-label={`Remove range ${index + 1}`}
                          disabled={formData.scoring_rules.length <= 1}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                    <FieldError message={formErrors.scoring_rules} />
                    <p className="text-dim font-sm icp-editor-hint">
                      Leave Min or Max blank for an open range. The first matching range is used.
                    </p>
                  </div>
                )}

                {/* Flat points for text questions */}
                {typeMeta.usesPoints && (
                  <div className="icp-editor-section">
                    <div className="form-group" style={{ maxWidth: '220px' }}>
                      <label className="form-label" htmlFor="icp-text-points">
                        Points when answered
                      </label>
                      <input
                        id="icp-text-points"
                        type="number"
                        className="form-control"
                        min="0"
                        value={formData.max_points}
                        onChange={handleChange('max_points')}
                      />
                      <FieldError message={formErrors.max_points} />
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeForm}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Create Question'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete ICP Question"
        message={`Delete "${deleteTarget?.question_text}"? Past qualifications keep their own snapshot, so historical scores are unaffected. Use Deactivate instead if you only want to hide it from future tests.`}
        confirmText="Delete Question"
        isDestructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};