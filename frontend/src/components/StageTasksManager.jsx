import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Power,
  Clock,
  User,
  Users,
  Phone,
  Mail,
  FileText,
  Presentation,
  MessageSquare,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Layers,
  Sparkles,
  X,
  HelpCircle,
  Filter,
  Check,
} from 'lucide-react';
import { leadApi } from '../api/leadApi';
import { userApi } from '../api/userApi';
import { useToast } from '../context/ToastContext';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { extractErrorMessage, normalizeServerErrors } from '../utils/validation';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';
import { ConfirmModal } from './ConfirmModal';
import { FieldError } from './FieldError';
import {
  FOLLOWUP_PURPOSES,
  ASSIGNEE_STRATEGIES,
  DUE_OFFSET_UNITS,
  LEAD_PRIORITY,
} from '../utils/constants';

const PURPOSE_ICONS = {
  'Phone Call': Phone,
  'WhatsApp': MessageSquare,
  'Meeting': Users,
  'Demo': Presentation,
  'Email': Mail,
  'Proposal': FileText,
  'Payment Follow-up': Calendar,
  'Other': CheckCircle2,
};

const TEMPLATE_VARIABLES = [
  { tag: '{lead_name}', label: 'Lead Name', example: 'Sarah Connor' },
  { tag: '{company_name}', label: 'Company', example: 'Cyberdyne Systems' },
  { tag: '{phone}', label: 'Phone', example: '+1-555-0199' },
  { tag: '{email}', label: 'Email', example: 'sarah@cyberdyne.io' },
  { tag: '{stage_name}', label: 'Target Stage', example: 'Demo Scheduled' },
  { tag: '{priority}', label: 'Priority', example: 'HIGH' },
  { tag: '{expected_value}', label: 'Value', example: '$25,000.00' },
  { tag: '{assigned_to}', label: 'Assignee', example: 'John Matrix' },
];

const PRESET_OFFSETS = [
  { label: '15 Mins', value: 15, unit: 'MINUTES' },
  { label: '1 Hour', value: 1, unit: 'HOURS' },
  { label: '4 Hours', value: 4, unit: 'HOURS' },
  { label: '1 Day', value: 1, unit: 'DAYS' },
  { label: '2 Days', value: 2, unit: 'DAYS' },
  { label: '1 Week', value: 1, unit: 'WEEKS' },
];

const emptyRuleForm = (defaultStageId = '') => ({
  name: '',
  stage: defaultStageId,
  purpose: 'Phone Call',
  title: '',
  description_template: 'Reach out to {lead_name} ({company_name}) at {phone} to initiate next steps in the {stage_name} stage.',
  assignee_strategy: 'LEAD_OWNER',
  specific_user: '',
  fallback_user: '',
  round_robin_user_ids: [],
  due_offset_value: 1,
  due_offset_unit: 'DAYS',
  priority_filter: 'ALL',
  is_mandatory: true,
  order: 1,
  dependency: '',
  task_priority: 'MEDIUM',
  requires_approval: false,
  prevent_duplicate: true,
  is_active: true,
});

export const StageTasksManager = ({ initialStageId = null, onStageUpdated = null }) => {
  const { showToast } = useToast();

  const [rules, setRules] = useState([]);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [selectedStageFilter, setSelectedStageFilter] = useState(initialStageId ? String(initialStageId) : '');
  const [searchQuery, setSearchQuery] = useState('');

  // Form modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState(emptyRuleForm(initialStageId || ''));
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const templateTextareaRef = useRef(null);
  const modalBodyRef = useRef(null);

  // Reset scroll to top when modal opens
  useEffect(() => {
    if (modalOpen && modalBodyRef.current) {
      modalBodyRef.current.scrollTop = 0;
    }
  }, [modalOpen]);

  const closeModal = () => {
    setModalOpen(false);
    setEditingRule(null);
    setFormData(emptyRuleForm(stages[0]?.id || ''));
    setFormErrors({});
  };

  const modalDialogRef = useDialogA11y(modalOpen, closeModal);

  // Fetch all required data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, stagesRes, usersRes] = await Promise.all([
        leadApi.getStageTaskRules(),
        leadApi.getStages({ all: 'true' }),
        userApi.getUsers(),
      ]);

      const rulesList = rulesRes?.results ?? (Array.isArray(rulesRes) ? rulesRes : []);
      const stagesList = stagesRes?.results ?? (Array.isArray(stagesRes) ? stagesRes : []);
      const usersList = usersRes?.results ?? (Array.isArray(usersRes) ? usersRes : []);

      stagesList.sort((a, b) => a.display_order - b.display_order || a.id - b.id);

      setRules(rulesList);
      setStages(stagesList);
      setUsers(usersList.filter((u) => u.is_active));
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load task automation data'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open modal for Create
  const handleOpenCreate = (stageId = null) => {
    setEditingRule(null);
    setFormErrors({});
    const targetStage = stageId || selectedStageFilter || (stages[0]?.id ? String(stages[0].id) : '');
    setFormData(emptyRuleForm(targetStage));
    setModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (rule) => {
    setEditingRule(rule);
    setFormErrors({});
    setFormData({
      name: rule.name || '',
      stage: rule.stage ? String(rule.stage) : '',
      purpose: rule.purpose || 'Phone Call',
      title: rule.title || '',
      description_template: rule.description_template || '',
      assignee_strategy: rule.assignee_strategy || 'LEAD_OWNER',
      specific_user: rule.specific_user ? String(rule.specific_user) : '',
      fallback_user: rule.fallback_user ? String(rule.fallback_user) : '',
      round_robin_user_ids: (rule.round_robin_users || []).map((u) => (typeof u === 'object' ? u.id : u)),
      due_offset_value: rule.due_offset_value ?? 1,
      due_offset_unit: rule.due_offset_unit || 'DAYS',
      priority_filter: rule.priority_filter || 'ALL',
      prevent_duplicate: rule.prevent_duplicate ?? true,
      is_active: rule.is_active ?? true,
      is_mandatory: rule.is_mandatory ?? true,
      order: rule.order ?? 1,
      dependency: rule.dependency ? String(rule.dependency) : '',
      task_priority: rule.task_priority || 'MEDIUM',
      requires_approval: rule.requires_approval ?? false,
    });
    setModalOpen(true);
  };

  // Quick toggle active state
  const handleToggleActive = async (rule, e) => {
    e.stopPropagation();
    const newStatus = !rule.is_active;

    // Optimistic update
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, is_active: newStatus } : r))
    );

    try {
      await leadApi.toggleStageTaskRuleActive(rule.id);
      showToast(
        `Rule '${rule.name}' is now ${newStatus ? 'active' : 'paused'}`,
        'success'
      );
      if (onStageUpdated) onStageUpdated();
    } catch (err) {
      // Revert optimistic update
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_active: rule.is_active } : r))
      );
      showToast(extractErrorMessage(err, 'Failed to update rule status'), 'error');
    }
  };

  // Delete rule confirmation
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await leadApi.deleteStageTaskRule(deleteTarget.id);
      showToast(`Rule '${deleteTarget.name}' deleted successfully`, 'success');
      setDeleteTarget(null);
      loadData();
      if (onStageUpdated) onStageUpdated();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete task rule'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Insert variable into template
  const handleInsertVariable = (tag) => {
    const textarea = templateTextareaRef.current;
    if (!textarea) {
      setFormData((prev) => ({
        ...prev,
        description_template: prev.description_template + ' ' + tag,
      }));
      return;
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const text = formData.description_template || '';
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + tag + after;

    setFormData((prev) => ({ ...prev, description_template: newText }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  // Toggle user in round-robin pool
  const handleToggleRoundRobinUser = (userId) => {
    setFormData((prev) => {
      const current = prev.round_robin_user_ids || [];
      const next = current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId];
      return { ...prev, round_robin_user_ids: next };
    });
  };

  // Form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErrors({});

    // Client-side validations
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Please provide a rule name.';
    if (!formData.stage) errors.stage = 'Please choose a target stage.';
    if (formData.assignee_strategy === 'SPECIFIC_USER' && !formData.specific_user) {
      errors.specific_user = 'Please select a designated user for this task.';
    }
    if (formData.assignee_strategy === 'ROUND_ROBIN' && (!formData.round_robin_user_ids || formData.round_robin_user_ids.length === 0)) {
      errors.round_robin_user_ids = 'Please select at least one user for the rotation pool.';
    }
    if (!formData.due_offset_value || Number(formData.due_offset_value) < 1) {
      errors.due_offset_value = 'Offset value must be at least 1.';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      showToast('Please fix the errors indicated in the form.', 'warning');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        stage: parseInt(formData.stage, 10),
        purpose: formData.purpose,
        title: formData.title.trim(),
        description_template: formData.description_template.trim(),
        assignee_strategy: formData.assignee_strategy,
        specific_user: formData.assignee_strategy === 'SPECIFIC_USER' ? parseInt(formData.specific_user, 10) : null,
        fallback_user: formData.fallback_user ? parseInt(formData.fallback_user, 10) : null,
        round_robin_user_ids: formData.assignee_strategy === 'ROUND_ROBIN' ? formData.round_robin_user_ids : [],
        due_offset_value: parseInt(formData.due_offset_value, 10),
        due_offset_unit: formData.due_offset_unit,
        priority_filter: formData.priority_filter,
        prevent_duplicate: Boolean(formData.prevent_duplicate),
        is_active: Boolean(formData.is_active),
        is_mandatory: Boolean(formData.is_mandatory),
        order: parseInt(formData.order || 1, 10),
        dependency: formData.dependency ? parseInt(formData.dependency, 10) : null,
        task_priority: formData.task_priority || 'MEDIUM',
        requires_approval: Boolean(formData.requires_approval),
      };

      if (editingRule) {
        await leadApi.updateStageTaskRule(editingRule.id, payload);
        showToast(`Rule '${payload.name}' updated successfully!`, 'success');
      } else {
        await leadApi.createStageTaskRule(payload);
        showToast(`Automated task rule '${payload.name}' created!`, 'success');
      }

      closeModal();
      loadData();
      if (onStageUpdated) onStageUpdated();
    } catch (err) {
      const serverErr = normalizeServerErrors(err);
      if (serverErr && typeof serverErr === 'object') {
        setFormErrors(serverErr);
      }
      showToast(extractErrorMessage(err, 'Failed to save automation rule'), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Preview generated note
  const renderPreviewNotes = () => {
    let text = formData.description_template || '';
    TEMPLATE_VARIABLES.forEach((v) => {
      text = text.replaceAll(v.tag, v.example);
    });
    if (formData.title.trim()) {
      return `[${formData.title.trim()}]\n${text}`;
    }
    return text;
  };

  // Filtered rules
  const filteredRules = rules.filter((rule) => {
    if (selectedStageFilter && String(rule.stage) !== String(selectedStageFilter)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = rule.name?.toLowerCase().includes(q);
      const matchPurpose = rule.purpose?.toLowerCase().includes(q);
      const matchStage = rule.stage_details?.name?.toLowerCase().includes(q);
      if (!matchName && !matchPurpose && !matchStage) return false;
    }
    return true;
  });

  return (
    <div className="stage-tasks-manager" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} color="var(--primary)" />
            Automated Stage Task Rules
          </h2>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Automatically assign customizable follow-up tasks to sales reps as soon as leads move into each pipeline stage.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => handleOpenCreate()}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={16} />
          New Stage Task Rule
        </button>
      </div>

      {/* Filter and stage selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '220px' }}>
          <Layers size={16} color="var(--text-muted)" />
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Filter by Stage:</span>
          <select
            className="form-control"
            value={selectedStageFilter}
            onChange={(e) => setSelectedStageFilter(e.target.value)}
            style={{ width: 'auto', flex: 1 }}
          >
            <option value="">All Pipeline Stages ({rules.length} rules)</option>
            {stages.map((stg) => {
              const count = rules.filter((r) => r.stage === stg.id).length;
              return (
                <option key={stg.id} value={stg.id}>
                  {stg.name} ({count})
                </option>
              );
            })}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
          <Filter size={16} color="var(--text-muted)" />
          <input
            type="text"
            className="form-control"
            placeholder="Search rules by name, purpose, or stage..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {selectedStageFilter && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleOpenCreate(selectedStageFilter)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={14} /> Add task for this stage
          </button>
        )}
      </div>

      {/* Rules listing */}
      {loading ? (
        <LoadingSpinner message="Loading automated stage tasks..." />
      ) : filteredRules.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={selectedStageFilter ? 'No task rules for this stage' : 'No automated task rules configured'}
          description={
            selectedStageFilter
              ? 'Add an automated task rule to automatically assign follow-ups when leads enter this pipeline stage.'
              : 'Create customizable rules that automatically generate and schedule tasks for sales reps upon stage transitions.'
          }
          action={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleOpenCreate()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={16} /> Create First Stage Task Rule
            </button>
          }
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
          {filteredRules.map((rule) => {
            const PurposeIcon = PURPOSE_ICONS[rule.purpose] || CheckCircle2;
            const stageColor = rule.stage_details?.color || '#6366F1';
            const strategyMeta = ASSIGNEE_STRATEGIES.find((s) => s.value === rule.assignee_strategy);

            return (
              <div
                key={rule.id}
                className="card"
                style={{
                  border: `1px solid ${rule.is_active ? 'var(--border-color)' : 'rgba(255,255,255,0.06)'}`,
                  opacity: rule.is_active ? 1 : 0.65,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.875rem',
                  padding: '1.25rem',
                  borderRadius: '10px',
                  background: 'var(--bg-card)',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                  position: 'relative',
                }}
              >
                {/* Top: Stage badge + Active switch */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.2rem 0.625rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: `${stageColor}20`,
                      color: stageColor,
                      border: `1px solid ${stageColor}40`,
                    }}
                  >
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        backgroundColor: stageColor,
                      }}
                    />
                    {rule.stage_details?.name || `Stage #${rule.stage}`}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        backgroundColor: rule.is_mandatory !== false ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                        color: rule.is_mandatory !== false ? '#ef4444' : 'var(--text-dim)',
                        border: `1px solid ${rule.is_mandatory !== false ? 'rgba(239, 68, 68, 0.3)' : 'rgba(100, 116, 139, 0.3)'}`
                      }}
                    >
                      {rule.is_mandatory !== false ? 'Mandatory Checkpoint' : 'Optional'}
                    </span>
                    <span
                      style={{
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        color: '#818cf8',
                        border: '1px solid rgba(99, 102, 241, 0.3)'
                      }}
                    >
                      Step #{rule.order || 1}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleToggleActive(rule, e)}
                    className="btn btn-sm"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.2rem 0.5rem',
                      fontSize: '0.75rem',
                      borderRadius: '6px',
                      backgroundColor: rule.is_active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                      color: rule.is_active ? 'var(--success)' : 'var(--text-muted)',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                    title={rule.is_active ? 'Click to Pause Rule' : 'Click to Activate Rule'}
                  >
                    <Power size={12} />
                    {rule.is_active ? 'Active' : 'Paused'}
                  </button>
                </div>

                {/* Rule title & purpose */}
                <div>
                  <h3
                    style={{
                      margin: '0 0 0.35rem 0',
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <PurposeIcon size={16} color="var(--primary)" />
                    {rule.name}
                  </h3>
                  {rule.title && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                      Headline: <span style={{ color: 'var(--text-main)' }}>{rule.title}</span>
                    </div>
                  )}
                </div>

                {/* Metadata Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem' }}>
                  {/* Strategy */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                      background: 'rgba(56, 189, 248, 0.1)',
                      color: '#38bdf8',
                    }}
                  >
                    {rule.assignee_strategy === 'ROUND_ROBIN' ? <Users size={12} /> : <User size={12} />}
                    {rule.assignee_strategy === 'SPECIFIC_USER'
                      ? `Assigned: ${rule.specific_user_details?.first_name || rule.specific_user_details?.email || 'User'}`
                      : rule.assignee_strategy === 'ROUND_ROBIN'
                      ? `Round Robin (${rule.round_robin_users?.length || 0} reps)`
                      : strategyMeta?.label || rule.assignee_strategy}
                  </span>

                  {/* Due Offset */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '6px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      color: '#f59e0b',
                    }}
                  >
                    <Clock size={12} />
                    Due in {rule.due_offset_value} {rule.due_offset_unit?.toLowerCase()}
                  </span>

                  {/* Priority Filter */}
                  {rule.priority_filter && rule.priority_filter !== 'ALL' && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        color: '#ef4444',
                      }}
                    >
                      <AlertCircle size={12} />
                      {rule.priority_filter} Leads Only
                    </span>
                  )}
                </div>

                {/* Template preview */}
                {rule.description_template && (
                  <div
                    style={{
                      background: 'var(--bg-secondary, rgba(0,0,0,0.2))',
                      padding: '0.625rem',
                      borderRadius: '6px',
                      fontSize: '0.8125rem',
                      color: 'var(--text-muted)',
                      borderLeft: `3px solid ${stageColor}`,
                      whiteSpace: 'pre-wrap',
                      maxHeight: '80px',
                      overflowY: 'auto',
                    }}
                  >
                    {rule.description_template}
                  </div>
                )}

                {/* Card footer: actions */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid var(--border-color)',
                    marginTop: 'auto',
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenEdit(rule)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Edit size={14} /> Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() => setDeleteTarget(rule)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Dialog for Create & Edit */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal} style={{ zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div
            ref={modalDialogRef}
            className="modal-container modal-container-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stage-task-modal-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '16px',
              overflow: 'hidden',
              backgroundColor: 'var(--bg-surface)'
            }}
          >
            <div className="modal-header" style={{ flexShrink: 0, padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="modal-title-row" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Sparkles size={20} color="var(--primary)" />
                <h3 id="stage-task-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>
                  {editingRule ? 'Edit Stage Task Automation Rule' : 'New Stage Task Automation Rule'}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div ref={modalBodyRef} className="modal-body form-layout" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                {/* 1. Rule Name & Stage */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label form-label-required" htmlFor="task-rule-name">
                      Rule Name
                    </label>
                    <input
                      id="task-rule-name"
                      type="text"
                      className={`form-control ${formErrors.name ? 'is-invalid' : ''}`}
                      placeholder="e.g. Schedule Product Demo"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                    <FieldError error={formErrors.name} />
                  </div>

                  <div className="form-group">
                    <label className="form-label form-label-required" htmlFor="task-rule-stage">
                      Trigger Stage
                    </label>
                    <select
                      id="task-rule-stage"
                      className={`form-control ${formErrors.stage ? 'is-invalid' : ''}`}
                      value={formData.stage}
                      onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                      required
                    >
                      <option value="" disabled>Select target stage...</option>
                      {stages.map((stg) => (
                        <option key={stg.id} value={stg.id}>
                          {stg.name}
                        </option>
                      ))}
                    </select>
                    <FieldError error={formErrors.stage} />
                  </div>
                </div>

                {/* 2. Task Purpose & Headline */}
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label form-label-required" htmlFor="task-rule-purpose">
                      Task Type / Purpose
                    </label>
                    <select
                      id="task-rule-purpose"
                      className="form-control"
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                      required
                    >
                      {FOLLOWUP_PURPOSES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="task-rule-title">
                      Task Headline / Subject <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <input
                      id="task-rule-title"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Initial Discovery Call"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>
                </div>

                {/* 2B. Progression Checkpoint, Priority & Dependencies */}
                <div className="form-grid-2" style={{ background: 'var(--bg-surface-elevated)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-subtle)', margin: '0.75rem 0' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="task-priority">
                      Task Priority
                    </label>
                    <select
                      id="task-priority"
                      className="form-control"
                      value={formData.task_priority}
                      onChange={(e) => setFormData({ ...formData, task_priority: e.target.value })}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="task-order">
                      Execution Step / Order
                    </label>
                    <input
                      id="task-order"
                      type="number"
                      min={1}
                      className="form-control"
                      value={formData.order}
                      onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" htmlFor="task-dependency">
                      Prerequisite Dependency in this Stage <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <select
                      id="task-dependency"
                      className="form-control"
                      value={formData.dependency}
                      onChange={(e) => setFormData({ ...formData, dependency: e.target.value })}
                    >
                      <option value="">None (Can be performed immediately)</option>
                      {rules
                        .filter((r) => String(r.stage) === String(formData.stage) && (!editingRule || r.id !== editingRule.id))
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            Prerequisite: {r.name} ({r.title || r.purpose})
                          </option>
                        ))}
                    </select>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
                      If set, this task cannot be completed until the prerequisite task is finished.
                    </span>
                  </div>

                  {/* Mandatory Progression Checkpoint Toggle */}
                  <div className="form-group" style={{ gridColumn: 'span 2', flexDirection: 'row', alignItems: 'flex-start', gap: '0.75rem', margin: '0.5rem 0 0 0' }}>
                    <input
                      id="task-mandatory"
                      type="checkbox"
                      checked={formData.is_mandatory}
                      onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                      style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                    />
                    <div>
                      <label htmlFor="task-mandatory" className="form-label" style={{ margin: 0, fontWeight: 700, cursor: 'pointer' }}>
                        Mandatory Checkpoint for Stage Progression
                      </label>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', display: 'block', marginTop: '2px' }}>
                        When checked, a lead CANNOT move to the next stage until this task is completed by staff.
                      </span>
                    </div>
                  </div>

                  {/* Requires Manager Approval Toggle */}
                  <div className="form-group" style={{ gridColumn: 'span 2', flexDirection: 'row', alignItems: 'flex-start', gap: '0.75rem', margin: '0.25rem 0 0 0' }}>
                    <input
                      id="task-requires-approval"
                      type="checkbox"
                      checked={formData.requires_approval}
                      onChange={(e) => setFormData({ ...formData, requires_approval: e.target.checked })}
                      style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                    />
                    <div>
                      <label htmlFor="task-requires-approval" className="form-label" style={{ margin: 0, fontWeight: 600, cursor: 'pointer' }}>
                        Require Manager Approval to Sign Off
                      </label>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-dim)', display: 'block', marginTop: '2px' }}>
                        Requires a Manager or Admin to approve/complete this specific task.
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Assignment Strategy */}
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="task-rule-strategy">
                    Task Assignee Strategy
                  </label>
                  <select
                    id="task-rule-strategy"
                    className="form-control"
                    value={formData.assignee_strategy}
                    onChange={(e) => setFormData({ ...formData, assignee_strategy: e.target.value })}
                  >
                    {ASSIGNEE_STRATEGIES.map((st) => (
                      <option key={st.value} value={st.value}>
                        {st.label} — {st.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Strategy specific inputs: SPECIFIC_USER */}
                {formData.assignee_strategy === 'SPECIFIC_USER' && (
                  <div className="form-group">
                    <label className="form-label form-label-required" htmlFor="task-specific-user">
                      Designated Assignee
                    </label>
                    <select
                      id="task-specific-user"
                      className={`form-control ${formErrors.specific_user ? 'is-invalid' : ''}`}
                      value={formData.specific_user}
                      onChange={(e) => setFormData({ ...formData, specific_user: e.target.value })}
                      required
                    >
                      <option value="">Select team member...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : u.email} ({u.role})
                        </option>
                      ))}
                    </select>
                    <FieldError error={formErrors.specific_user} />
                  </div>
                )}

                {/* Strategy specific inputs: ROUND_ROBIN */}
                {formData.assignee_strategy === 'ROUND_ROBIN' && (
                  <div className="form-group">
                    <label className="form-label form-label-required">
                      Round Robin Pool Members
                    </label>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Tasks will be distributed fairly in sequence among the selected team members.
                    </p>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '0.5rem',
                        maxHeight: '150px',
                        overflowY: 'auto',
                        padding: '0.625rem',
                        background: 'var(--bg-surface-elevated)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {users.map((u) => {
                        const checked = formData.round_robin_user_ids.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.8125rem',
                              cursor: 'pointer',
                              padding: '0.35rem 0.5rem',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: checked ? 'var(--primary-subtle)' : 'transparent',
                              color: checked ? 'var(--primary)' : 'var(--text-main)',
                              fontWeight: checked ? 600 : 400,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleRoundRobinUser(u.id)}
                            />
                            <span>{u.first_name ? `${u.first_name} ${u.last_name}` : u.email}</span>
                          </label>
                        );
                      })}
                    </div>
                    <FieldError error={formErrors.round_robin_user_ids} />
                  </div>
                )}

                {/* Fallback Assignee */}
                <div className="form-group">
                  <label className="form-label" htmlFor="task-fallback-user">
                    Fallback Assignee <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: 400 }}>(Optional)</span>
                  </label>
                  <select
                    id="task-fallback-user"
                    className="form-control"
                    value={formData.fallback_user}
                    onChange={(e) => setFormData({ ...formData, fallback_user: e.target.value })}
                  >
                    <option value="">Default (Actor or Rule Creator)</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : u.email} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Due Date Offset */}
                <div className="form-group">
                  <label className="form-label form-label-required">
                    Due Date Timing
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-main)' }}>Due in</span>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      style={{ width: '85px' }}
                      value={formData.due_offset_value}
                      onChange={(e) => setFormData({ ...formData, due_offset_value: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      required
                    />
                    <select
                      className="form-control"
                      style={{ width: '130px' }}
                      value={formData.due_offset_unit}
                      onChange={(e) => setFormData({ ...formData, due_offset_unit: e.target.value })}
                    >
                      {DUE_OFFSET_UNITS.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>after stage transition</span>
                  </div>

                  {/* Preset timing chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {PRESET_OFFSETS.map((preset) => {
                      const isSelected = formData.due_offset_value === preset.value && formData.due_offset_unit === preset.unit;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          className="btn btn-sm"
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.6rem',
                            borderRadius: 'var(--radius-sm)',
                            background: isSelected ? 'var(--primary)' : 'var(--bg-surface-elevated)',
                            color: isSelected ? '#ffffff' : 'var(--text-main)',
                            border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-subtle)'}`,
                            fontWeight: isSelected ? 600 : 500,
                          }}
                          onClick={() =>
                            setFormData({
                              ...formData,
                              due_offset_value: preset.value,
                              due_offset_unit: preset.unit,
                            })
                          }
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                  <FieldError error={formErrors.due_offset_value} />
                </div>

                {/* 5. Priority Filter & Duplicate Prevention */}
                <div className="form-grid-2" style={{ alignItems: 'flex-start' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="task-priority-filter">
                      Apply to Lead Priority
                    </label>
                    <select
                      id="task-priority-filter"
                      className="form-control"
                      value={formData.priority_filter}
                      onChange={(e) => setFormData({ ...formData, priority_filter: e.target.value })}
                    >
                      <option value="ALL">All Lead Priorities</option>
                      <option value="LOW">Low Priority Only</option>
                      <option value="MEDIUM">Medium Priority Only</option>
                      <option value="HIGH">High Priority Only</option>
                      <option value="URGENT">Urgent Priority Only</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Task Deduplication</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', marginTop: '0.35rem', color: 'var(--text-main)' }}>
                      <input
                        type="checkbox"
                        checked={formData.prevent_duplicate}
                        onChange={(e) => setFormData({ ...formData, prevent_duplicate: e.target.checked })}
                      />
                      <span>Prevent duplicate pending tasks</span>
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.2rem', display: 'block' }}>
                      Skip creation if a pending task of this type already exists.
                    </span>
                  </div>
                </div>

                {/* 6. Template & Clickable Placeholders */}
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <label className="form-label" htmlFor="task-rule-template" style={{ margin: 0 }}>
                      Task Notes / Instructions Template
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      Click tags to insert lead data:
                    </span>
                  </div>

                  {/* Variable insertion chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.5rem' }}>
                    {TEMPLATE_VARIABLES.map((v) => (
                      <button
                        key={v.tag}
                        type="button"
                        className="btn btn-sm"
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.25rem 0.5rem',
                          background: 'var(--primary-subtle)',
                          color: 'var(--primary)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          fontWeight: 500,
                        }}
                        onClick={() => handleInsertVariable(v.tag)}
                        title={`Click to insert ${v.tag} (e.g. ${v.example})`}
                      >
                        + {v.tag}
                      </button>
                    ))}
                  </div>

                  <textarea
                    id="task-rule-template"
                    ref={templateTextareaRef}
                    rows="3"
                    className="form-control"
                    placeholder="Instructions for the assignee..."
                    value={formData.description_template}
                    onChange={(e) => setFormData({ ...formData, description_template: e.target.value })}
                  />

                  {/* Live Render Preview */}
                  <div style={{ marginTop: '0.625rem', fontSize: '0.75rem' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Live Template Preview:</div>
                    <div
                      style={{
                        padding: '0.625rem 0.875rem',
                        background: 'var(--bg-surface-elevated)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px dashed var(--border-strong)',
                        color: 'var(--text-main)',
                        whiteSpace: 'pre-wrap',
                        fontSize: '0.8125rem',
                        lineHeight: 1.5,
                      }}
                    >
                      {renderPreviewNotes()}
                    </div>
                  </div>
                </div>

                {/* 7. Active status */}
                <div className="form-group" style={{ paddingTop: '0.25rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.875rem', cursor: 'pointer', margin: 0, color: 'var(--text-main)' }}>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    />
                    <span style={{ fontWeight: 600 }}>Enable this rule immediately</span>
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {saving && <LoadingSpinner inline size="sm" />}
                  {editingRule ? 'Save Changes' : 'Create Task Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={Boolean(deleteTarget)}
          title="Delete Task Automation Rule"
          message={`Are you sure you want to delete '${deleteTarget.name}'? Newly transitioned leads will no longer have this task automatically assigned.`}
          confirmText="Delete Rule"
          confirmVariant="danger"
          loading={deleting}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

