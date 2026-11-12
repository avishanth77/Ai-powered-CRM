import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  Save,
  Check,
  Shield,
  Layers,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import { leadApi } from '../../api/leadApi';
import { useToast } from '../../context/ToastContext';

const FIELD_TYPES = [
  { value: 'text', label: 'Single-line Text' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'url', label: 'Website / URL' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown Select' },
  { value: 'multi_select', label: 'Multi-Select' },
  { value: 'checkbox', label: 'Checkbox (Boolean)' },
  { value: 'currency', label: 'Currency' },
  { value: 'textarea', label: 'Multi-line Textarea' },
];

const SECTIONS = [
  { value: 'contact', label: 'Contact Information' },
  { value: 'company', label: 'Company Information' },
  { value: 'qualification', label: 'Lead Qualification' },
  { value: 'sales', label: 'Sales Information' },
  { value: 'custom', label: 'Custom Properties' },
];

export const CustomPropertiesModal = ({ isOpen, onClose, onPropertiesChanged }) => {
  const { showToast } = useToast();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProp, setEditingProp] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    label: '',
    field_type: 'text',
    section: 'custom',
    optionsText: '',
    is_mandatory: false,
    placeholder: '',
    help_text: '',
  });

  const fetchDefinitions = async () => {
    try {
      setLoading(true);
      const data = await leadApi.getCustomProperties({ all: 'true' });
      setProperties(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      showToast('Failed to load custom property definitions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDefinitions();
    }
  }, [isOpen]);

  const handleStartCreate = () => {
    setFormData({
      name: '',
      label: '',
      field_type: 'text',
      section: 'custom',
      optionsText: '',
      is_mandatory: false,
      placeholder: '',
      help_text: '',
    });
    setEditingProp(null);
    setIsCreating(true);
  };

  const handleStartEdit = (prop) => {
    setFormData({
      name: prop.name,
      label: prop.label,
      field_type: prop.field_type,
      section: prop.section,
      optionsText: Array.isArray(prop.options) ? prop.options.join('\n') : '',
      is_mandatory: prop.is_mandatory,
      placeholder: prop.placeholder || '',
      help_text: prop.help_text || '',
    });
    setEditingProp(prop);
    setIsCreating(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const optionsArray = ['dropdown', 'multi_select'].includes(formData.field_type)
        ? formData.optionsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const payload = {
        name: formData.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        label: formData.label.trim(),
        field_type: formData.field_type,
        section: formData.section,
        options: optionsArray,
        is_mandatory: formData.is_mandatory,
        placeholder: formData.placeholder.trim(),
        help_text: formData.help_text.trim(),
      };

      if (editingProp) {
        await leadApi.updateCustomProperty(editingProp.id, payload);
        showToast('Property updated successfully', 'success');
      } else {
        await leadApi.createCustomProperty(payload);
        showToast('Custom property created successfully', 'success');
      }

      setIsCreating(false);
      setEditingProp(null);
      fetchDefinitions();
      if (onPropertiesChanged) onPropertiesChanged();
    } catch (err) {
      const msg = err.response?.data?.name?.[0] || err.response?.data?.label?.[0] || 'Failed to save property';
      showToast(msg, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete property "${name}"? Existing lead values will also be deleted.`)) {
      return;
    }
    try {
      await leadApi.deleteCustomProperty(id);
      showToast('Property deleted', 'success');
      fetchDefinitions();
      if (onPropertiesChanged) onPropertiesChanged();
    } catch (err) {
      showToast('Failed to delete property', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-container modal-container-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={20} color="var(--primary)" />
            <h3 style={{ margin: 0 }}>Custom Properties Manager</h3>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Header Action */}
          {!isCreating && !editingProp && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-dim)' }}>
                Define custom fields across Contact, Company, Qualification, or Sales sections.
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleStartCreate}>
                <Plus size={14} />
                <span>New Property</span>
              </button>
            </div>
          )}

          {/* Create or Edit Form */}
          {(isCreating || editingProp) && (
            <form onSubmit={handleSave} className="hs-card" style={{ padding: '1.25rem', margin: 0 }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--text-main)' }}>
                {editingProp ? `Edit Property: ${editingProp.label}` : 'Create New Custom Property'}
              </h4>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label form-label-required">Field Label</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Budget Authority, Preferred Cloud"
                    value={formData.label}
                    onChange={(e) => {
                      const lbl = e.target.value;
                      setFormData((prev) => ({
                        ...prev,
                        label: lbl,
                        name: isCreating ? lbl.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : prev.name,
                      }));
                    }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label form-label-required">Machine Key (Slug)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. budget_authority"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    disabled={!!editingProp}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Field Type</label>
                  <select
                    className="form-control"
                    value={formData.field_type}
                    onChange={(e) => setFormData({ ...formData, field_type: e.target.value })}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Section</label>
                  <select
                    className="form-control"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  >
                    {SECTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {['dropdown', 'multi_select'].includes(formData.field_type) && (
                <div className="form-group">
                  <label className="form-label form-label-required">Dropdown Choices (One per line)</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                    value={formData.optionsText}
                    onChange={(e) => setFormData({ ...formData, optionsText: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Placeholder / Hint</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Enter cloud preference..."
                    value={formData.placeholder}
                    onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.75rem' }}>
                  <input
                    type="checkbox"
                    id="mandatory-chk"
                    checked={formData.is_mandatory}
                    onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <label htmlFor="mandatory-chk" style={{ cursor: 'pointer', fontSize: '0.875rem' }}>
                    Make this field mandatory
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingProp(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  <Save size={14} />
                  <span>Save Property</span>
                </button>
              </div>
            </form>
          )}

          {/* Properties List Table */}
          <div className="hs-card" style={{ margin: 0 }}>
            <table className="table" style={{ margin: 0, fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  <th>Field Label & Key</th>
                  <th>Type</th>
                  <th>Section</th>
                  <th>Required</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                      No custom properties defined yet. Click "New Property" to create one.
                    </td>
                  </tr>
                ) : (
                  properties.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.label}</strong>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                          {p.name}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-secondary">{p.field_type}</span>
                      </td>
                      <td>{p.section}</td>
                      <td>{p.is_mandatory ? <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Yes</span> : 'No'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.2rem 0.4rem' }}
                            onClick={() => handleStartEdit(p)}
                            title="Edit Property"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.2rem 0.4rem', color: 'var(--danger)' }}
                            onClick={() => handleDelete(p.id, p.label)}
                            title="Delete Property"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default CustomPropertiesModal;

