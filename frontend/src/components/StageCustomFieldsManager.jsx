import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sliders,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  Layers,
  Sparkles,
  ChevronRight,
  Filter,
  CheckCircle2,
  Hash,
  Type,
  Calendar,
  DollarSign,
  Link2,
  Mail,
  Phone,
  List,
  CheckSquare,
} from 'lucide-react';
import { leadApi } from '../api/leadApi';
import { useToast } from '../context/ToastContext';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { extractErrorMessage } from '../utils/validation';
import { LoadingSpinner } from './LoadingSpinner';
import { EmptyState } from './EmptyState';
import { ConfirmModal } from './ConfirmModal';

export const FIELD_TYPES = [
  { value: 'text', label: 'Single-line Text', icon: Type },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'dropdown', label: 'Dropdown Select', icon: List },
  { value: 'multi_select', label: 'Multi-Select', icon: List },
  { value: 'checkbox', label: 'Checkbox (Boolean)', icon: CheckSquare },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'currency', label: 'Currency', icon: DollarSign },
  { value: 'textarea', label: 'Multi-line Textarea', icon: Type },
  { value: 'url', label: 'Website / URL', icon: Link2 },
  { value: 'email', label: 'Email Address', icon: Mail },
  { value: 'phone', label: 'Phone Number', icon: Phone },
];

export const StageCustomFieldsManager = ({ initialStageId, onStageUpdated }) => {
  const { showToast } = useToast();

  const [stages, setStages] = useState([]);
  const [selectedStageId, setSelectedStageId] = useState(initialStageId || null);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingProps, setLoadingProps] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProp, setEditingProp] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [propToDelete, setPropToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    stage: '',
    label: '',
    name: '',
    field_type: 'text',
    optionsText: '',
    is_mandatory: false,
    placeholder: '',
    help_text: '',
  });

  const modalDialogRef = useDialogA11y(modalOpen, () => {
    if (!submitting) setModalOpen(false);
  });

  // Fetch all stages
  const fetchStages = useCallback(async () => {
    try {
      setLoading(true);
      const res = await leadApi.getStages({ all: 'true' });
      const items = res?.results || (Array.isArray(res) ? res : []);
      items.sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.id - b.id);
      setStages(items);

      if (!selectedStageId && items.length > 0) {
        setSelectedStageId(items[0].id);
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load pipeline stages'), 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedStageId, showToast]);

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  useEffect(() => {
    if (initialStageId) {
      setSelectedStageId(initialStageId);
    }
  }, [initialStageId]);

  // Fetch properties for selected stage
  const fetchPropertiesForStage = useCallback(async (stageId) => {
    if (!stageId) return;
    try {
      setLoadingProps(true);
      const data = await leadApi.getCustomProperties({ stage: stageId, all: 'true' });
      const items = Array.isArray(data) ? data : data?.results || [];
      items.sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.id - b.id);
      setProperties(items);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load stage custom fields'), 'error');
    } finally {
      setLoadingProps(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (selectedStageId) {
      fetchPropertiesForStage(selectedStageId);
    }
  }, [selectedStageId, fetchPropertiesForStage]);

  // Handle Create Open
  const handleOpenCreate = () => {
    setFormData({
      stage: selectedStageId || '',
      label: '',
      name: '',
      field_type: 'text',
      optionsText: '',
      is_mandatory: false,
      placeholder: '',
      help_text: '',
    });
    setEditingProp(null);
    setModalOpen(true);
  };

  // Handle Edit Open
  const handleOpenEdit = (prop) => {
    setFormData({
      stage: prop.stage || selectedStageId || '',
      label: prop.label || '',
      name: prop.name || '',
      field_type: prop.field_type || 'text',
      optionsText: Array.isArray(prop.options) ? prop.options.join('\n') : '',
      is_mandatory: Boolean(prop.is_mandatory),
      placeholder: prop.placeholder || '',
      help_text: prop.help_text || '',
    });
    setEditingProp(prop);
    setModalOpen(true);
  };

  // Submit Add / Edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.label.trim()) {
      showToast('Field label is required.', 'warning');
      return;
    }

    const optionsArray = ['dropdown', 'multi_select'].includes(formData.field_type)
      ? formData.optionsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    if (['dropdown', 'multi_select'].includes(formData.field_type) && optionsArray.length === 0) {
      showToast('Please provide at least one option for dropdown/multi-select fields.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        stage: formData.stage ? parseInt(formData.stage, 10) : null,
        label: formData.label.trim(),
        name: formData.name.trim() || undefined,
        field_type: formData.field_type,
        options: optionsArray,
        is_mandatory: Boolean(formData.is_mandatory),
        placeholder: formData.placeholder.trim(),
        help_text: formData.help_text.trim(),
        section: 'stage',
      };

      if (editingProp) {
        await leadApi.updateCustomProperty(editingProp.id, payload);
        showToast(`Field "${formData.label.trim()}" updated successfully!`, 'success');
      } else {
        await leadApi.createCustomProperty(payload);
        showToast(`Custom field "${formData.label.trim()}" added to stage!`, 'success');
      }

      setModalOpen(false);
      setEditingProp(null);
      fetchPropertiesForStage(selectedStageId);
      if (onStageUpdated) onStageUpdated();
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to save stage custom field');
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Delete Confirm
  const handleOpenDelete = (prop) => {
    setPropToDelete(prop);
    setDeleteConfirmOpen(true);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!propToDelete) return;
    setDeleting(true);
    try {
      await leadApi.deleteCustomProperty(propToDelete.id);
      showToast(`Custom field "${propToDelete.label}" was removed.`, 'success');
      setDeleteConfirmOpen(false);
      setPropToDelete(null);
      fetchPropertiesForStage(selectedStageId);
      if (onStageUpdated) onStageUpdated();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to remove custom field'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const selectedStage = stages.find((s) => s.id === parseInt(selectedStageId, 10));

  if (loading) {
    return <LoadingSpinner text="Loading pipeline stages and custom fields..." />;
  }

  return (
    <div className="stage-custom-fields-manager">
      {/* Header Description */}
      <div className="card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.35rem 0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Sliders size={20} color="var(--primary)" />
              <span>Pipeline Stage Custom Input Fields</span>
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-dim)' }}>
              Configure custom data fields for each stage in your sales pipeline. When a lead enters that stage, sales reps can view, fill in, and track these stage-specific attributes.
            </p>
          </div>

          {selectedStage && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenCreate}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={16} />
              <span>Add Field to {selectedStage.name}</span>
            </button>
          )}
        </div>
      </div>

      {/* Stage Selector Pills */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label className="form-label" style={{ marginBottom: '0.5rem', display: 'block', fontWeight: 600 }}>
          Select Pipeline Stage to Customize:
        </label>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {stages.map((stage) => {
            const isSelected = stage.id === parseInt(selectedStageId, 10);
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setSelectedStageId(stage.id)}
                className={`btn stage-selector-btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.825rem',
                  borderRadius: 'var(--radius-full, 9999px)',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                }}
              >
                <span
                  style={{
                    width: '9px',
                    height: '9px',
                    borderRadius: '50%',
                    backgroundColor: stage.color || '#6366f1',
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontWeight: isSelected ? 700 : 500 }}>{stage.name}</span>
                {stage.custom_fields_count > 0 && (
                  <span
                    style={{
                      background: isSelected ? 'rgba(255, 255, 255, 0.25)' : 'rgba(99, 102, 241, 0.15)',
                      color: isSelected ? '#ffffff' : 'var(--primary)',
                      padding: '0.1rem 0.45rem',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    {stage.custom_fields_count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fields List Card */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: selectedStage?.color || '#6366f1',
              }}
            />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
              {selectedStage ? `Fields for "${selectedStage.name}" Stage` : 'Stage Fields'}
            </h3>
            <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
              {properties.length} field{properties.length === 1 ? '' : 's'}
            </span>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleOpenCreate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={14} />
            <span>+ Add Field</span>
          </button>
        </div>

        {loadingProps ? (
          <LoadingSpinner text="Loading stage fields..." />
        ) : properties.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-dim)' }}>
            <Sliders size={36} style={{ opacity: 0.35, marginBottom: '0.75rem' }} />
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.25rem' }}>
              No custom fields configured for {selectedStage?.name || 'this stage'}
            </div>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.825rem' }}>
              Add custom fields like URLs, checklists, pricing requirements, or notes required during this pipeline stage.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleOpenCreate}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', margin: '0 auto' }}
            >
              <Plus size={14} />
              <span>+ Add First Custom Field</span>
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ margin: 0, fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>Field Label</th>
                  <th>Machine Key</th>
                  <th>Field Type</th>
                  <th>Requirement</th>
                  <th>Options / Help</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((prop, idx) => {
                  const typeDef = FIELD_TYPES.find((t) => t.value === prop.field_type) || FIELD_TYPES[0];
                  const TypeIcon = typeDef.icon;
                  return (
                    <tr key={prop.id}>
                      <td style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{idx + 1}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {prop.label}
                        </div>
                        {prop.placeholder && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                            Placeholder: "{prop.placeholder}"
                          </div>
                        )}
                      </td>
                      <td>
                        <code style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--bg-surface-elevated, rgba(255, 255, 255, 0.05))' }}>
                          {prop.name}
                        </code>
                      </td>
                      <td>
                        <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
                          <TypeIcon size={12} />
                          <span>{typeDef.label}</span>
                        </span>
                      </td>
                      <td>
                        {prop.is_mandatory ? (
                          <span className="badge" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', fontWeight: 700, fontSize: '0.75rem' }}>
                            * Required
                          </span>
                        ) : (
                          <span className="text-dim font-xs">Optional</span>
                        )}
                      </td>
                      <td>
                        {Array.isArray(prop.options) && prop.options.length > 0 ? (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            {prop.options.length} options: {prop.options.slice(0, 3).join(', ')}{prop.options.length > 3 ? '...' : ''}
                          </span>
                        ) : prop.help_text ? (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                            {prop.help_text}
                          </span>
                        ) : (
                          <span className="text-dim font-xs">—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleOpenEdit(prop)}
                            title="Edit Field"
                            aria-label={`Edit ${prop.label}`}
                          >
                            <Edit2 size={13} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleOpenDelete(prop)}
                            style={{ color: 'var(--danger)' }}
                            title="Remove Field"
                            aria-label={`Remove ${prop.label}`}
                          >
                            <Trash2 size={13} />
                            <span>Remove</span>
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

      {/* Add / Edit Field Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => !submitting && setModalOpen(false)}>
          <div
            className="modal-container"
            ref={modalDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={editingProp ? 'Edit Custom Field' : 'Add Custom Field'}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '540px' }}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Sliders size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                  {editingProp ? `Edit Field: ${editingProp.label}` : `Add Custom Field to "${selectedStage?.name}"`}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="form-layout" style={{ padding: '1.25rem' }}>
              {/* Stage Selection */}
              <div className="form-group">
                <label htmlFor="prop-stage" className="form-label form-label-required">Target Pipeline Stage</label>
                <select
                  id="prop-stage"
                  className="form-control"
                  value={formData.stage}
                  onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                  required
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Display Order: {s.display_order})
                    </option>
                  ))}
                </select>
                <span className="text-dim font-xs">The stage where this field will be prompted and saved.</span>
              </div>

              {/* Field Label & Key */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="prop-label" className="form-label form-label-required">Field Label</label>
                  <input
                    id="prop-label"
                    type="text"
                    className="form-control"
                    placeholder="e.g. Demo Meeting Link, Discount Rationale"
                    value={formData.label}
                    onChange={(e) => {
                      const lbl = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        label: lbl,
                        name: !editingProp ? lbl.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 50) : prev.name,
                      }));
                    }}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="prop-name" className="form-label">
                    <span>Machine Key (Slug)</span>
                    <span className="text-dim font-xs" style={{ marginLeft: '4px' }}>(Optional)</span>
                  </label>
                  <input
                    id="prop-name"
                    type="text"
                    className="form-control"
                    placeholder="auto-generated if blank"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!!editingProp}
                  />
                </div>
              </div>

              {/* Field Type */}
              <div className="form-group">
                <label htmlFor="prop-type" className="form-label form-label-required">Field Input Type</label>
                <select
                  id="prop-type"
                  className="form-control"
                  value={formData.field_type}
                  onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Options for Dropdown / Multi-Select */}
              {['dropdown', 'multi_select'].includes(formData.field_type) && (
                <div className="form-group">
                  <label htmlFor="prop-options" className="form-label form-label-required">
                    Options List (one option per line)
                  </label>
                  <textarea
                    id="prop-options"
                    rows={4}
                    className="form-control"
                    placeholder="Standard Plan&#10;Enterprise Plan&#10;Custom Architecture"
                    value={formData.optionsText}
                    onChange={(e) => setFormData({ ...formData, optionsText: e.target.value })}
                    required
                  />
                  <span className="text-dim font-xs">Enter each available selectable choice on a new line.</span>
                </div>
              )}

              {/* Mandatory Checkbox */}
              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.65rem', marginTop: '0.25rem' }}>
                <input
                  id="prop-mandatory"
                  type="checkbox"
                  checked={formData.is_mandatory}
                  onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="prop-mandatory" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                  <strong>Mandatory stage field</strong> (Reps must complete this field to advance past this stage)
                </label>
              </div>

              {/* Placeholder & Help Text */}
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="prop-placeholder" className="form-label">Placeholder Text</label>
                  <input
                    id="prop-placeholder"
                    type="text"
                    className="form-control"
                    placeholder="e.g. https://meet.google.com/..."
                    value={formData.placeholder}
                    onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="prop-help" className="form-label">Help / Tooltip Guidance</label>
                  <input
                    id="prop-help"
                    type="text"
                    className="form-control"
                    placeholder="Brief instruction for reps"
                    value={formData.help_text}
                    onChange={(e) => setFormData({ ...formData, help_text: e.target.value })}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="modal-footer" style={{ padding: '1rem 0 0 0', marginTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : editingProp ? 'Save Changes' : 'Add Custom Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title={`Remove Field "${propToDelete?.label}"?`}
        message={`Are you sure you want to remove the field "${propToDelete?.label}" from the "${selectedStage?.name}" stage? Any existing values saved for leads will also be permanently deleted.`}
        confirmText={deleting ? 'Removing...' : 'Remove Field'}
        isDestructive={true}
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </div>
  );
};

export default StageCustomFieldsManager;
