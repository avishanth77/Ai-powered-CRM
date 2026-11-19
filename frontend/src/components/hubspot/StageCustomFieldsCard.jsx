import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Check,
  Save,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';
import { leadApi } from '../../api/leadApi';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../utils/validation';
import { formatCurrency, formatDate } from '../../utils/formatters';

export const StageCustomFieldsCard = ({
  lead,
  onLeadUpdated,
}) => {
  const { showToast } = useToast();
  const stageProperties = lead?.stage_custom_properties || [];
  const currentStage = lead?.stage_details;

  const [formValues, setFormValues] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Initialize form values from lead stage custom properties
  useEffect(() => {
    if (stageProperties.length > 0) {
      const initial = {};
      stageProperties.forEach((p) => {
        initial[p.name || p.id] = p.value_json !== null && p.value_json !== undefined ? p.value_json : p.value_text || '';
      });
      setFormValues(initial);
    }
  }, [stageProperties]);

  if (!stageProperties || stageProperties.length === 0) {
    return null;
  }

  const handleValueChange = (propKey, val) => {
    setFormValues((prev) => ({
      ...prev,
      [propKey]: val,
    }));
  };

  const handleSave = async (e) => {
    e?.preventDefault?.();
    setSubmitting(true);
    try {
      await leadApi.updateLeadCustomProperties(lead.id, formValues);
      showToast('Stage fields updated successfully!', 'success');
      setIsEditing(false);
      if (onLeadUpdated) onLeadUpdated();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update stage fields'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    const initial = {};
    stageProperties.forEach((p) => {
      initial[p.name || p.id] = p.value_json !== null && p.value_json !== undefined ? p.value_json : p.value_text || '';
    });
    setFormValues(initial);
    setIsEditing(false);
  };

  // Check mandatory fields pending
  const pendingMandatory = stageProperties.filter((p) => {
    if (!p.is_mandatory) return false;
    const v = formValues[p.name || p.id];
    return v === undefined || v === null || String(v).trim() === '';
  });

  return (
    <div className="hs-card stage-custom-fields-card" style={{ borderColor: 'rgba(99, 102, 241, 0.35)', marginBottom: '1.25rem' }}>
      {/* Header */}
      <div
        className="hs-card-header"
        style={{
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.05))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={() => setIsCollapsed((prev) => !prev)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <Sliders size={16} color="var(--primary, #6366f1)" />
          <h3 className="hs-card-title" style={{ margin: 0, textTransform: 'none', fontSize: '0.9rem' }}>
            <span>Stage Fields: {currentStage?.name || 'Current Stage'}</span>
          </h3>
          <span
            className="badge"
            style={{
              backgroundColor: 'rgba(99, 102, 241, 0.15)',
              color: 'var(--primary, #6366f1)',
              fontWeight: 700,
              fontSize: '0.7rem',
            }}
          >
            {stageProperties.length} Field{stageProperties.length === 1 ? '' : 's'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {!isEditing && !isCollapsed && (
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
            >
              <span>Edit Values</span>
            </button>
          )}
          {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </div>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div className="hs-card-body" style={{ padding: '1.25rem' }}>
          {pendingMandatory.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'rgba(234, 179, 8, 0.08)',
                padding: '0.6rem 0.75rem',
                borderRadius: 'var(--radius-sm, 6px)',
                fontSize: '0.8125rem',
                color: 'var(--text-main)',
                border: '1px solid rgba(234, 179, 8, 0.25)',
                marginBottom: '0.5rem',
              }}
            >
              <AlertCircle size={15} color="var(--warning, #f59e0b)" style={{ flexShrink: 0 }} />
              <span>
                <strong>Action Needed:</strong> {pendingMandatory.length} mandatory field{pendingMandatory.length > 1 ? 's' : ''} for {currentStage?.name} pending completion before pipeline progression.
              </span>
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSave}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {stageProperties.map((prop) => {
                  const key = prop.name || prop.id;
                  const currentVal = formValues[key] ?? '';

                  return (
                    <div key={prop.id} className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>
                          {prop.label}
                          {prop.is_mandatory && <span style={{ color: 'var(--danger)', marginLeft: '3px' }}>*</span>}
                        </span>
                        <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>{prop.field_type}</span>
                      </label>

                      {prop.field_type === 'textarea' ? (
                        <textarea
                          rows={3}
                          className="form-control"
                          placeholder={prop.placeholder || 'Type here...'}
                          value={currentVal}
                          onChange={(e) => handleValueChange(key, e.target.value)}
                        />
                      ) : prop.field_type === 'dropdown' ? (
                        <select
                          className="form-control"
                          value={currentVal}
                          onChange={(e) => handleValueChange(key, e.target.value)}
                        >
                          <option value="">Select option</option>
                          {(prop.options || []).map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : prop.field_type === 'checkbox' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(currentVal === 'true' || currentVal === true || currentVal === '1')}
                            onChange={(e) => handleValueChange(key, e.target.checked ? 'true' : 'false')}
                            style={{ width: '16px', height: '16px' }}
                          />
                          <span>{currentVal === 'true' || currentVal === true ? 'Yes / Confirmed' : 'No / Unchecked'}</span>
                        </label>
                      ) : prop.field_type === 'number' || prop.field_type === 'currency' ? (
                        <input
                          type="number"
                          className="form-control"
                          placeholder={prop.placeholder || '0'}
                          value={currentVal}
                          onChange={(e) => handleValueChange(key, e.target.value)}
                        />
                      ) : prop.field_type === 'date' ? (
                        <input
                          type="date"
                          className="form-control"
                          value={currentVal}
                          onChange={(e) => handleValueChange(key, e.target.value)}
                        />
                      ) : (
                        <input
                          type="text"
                          className="form-control"
                          placeholder={prop.placeholder || `Enter ${prop.label}`}
                          value={currentVal}
                          onChange={(e) => handleValueChange(key, e.target.value)}
                        />
                      )}

                      {prop.help_text && (
                        <span className="text-dim font-xs" style={{ marginTop: '0.2rem', display: 'block' }}>
                          {prop.help_text}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleReset}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={submitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Save size={13} />
                  <span>{submitting ? 'Saving...' : 'Save Stage Fields'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div>
              {stageProperties.map((prop) => {
                const key = prop.name || prop.id;
                const val = formValues[key];
                return (
                  <div key={prop.id} className="hs-prop-row" style={{ paddingBottom: '0.65rem', marginBottom: '0.65rem', borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="hs-prop-label">
                        {prop.label}
                        {prop.is_mandatory && <span style={{ color: 'var(--danger)', marginLeft: '3px' }}>*</span>}
                      </span>
                      <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>{prop.field_type}</span>
                    </div>

                    <span className="hs-prop-value" style={{ marginTop: '0.2rem' }}>
                      {val ? (
                        prop.field_type === 'checkbox' ? (
                          val === 'true' || val === true ? (
                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Yes</span>
                          ) : (
                            <span style={{ color: 'var(--text-dim)' }}>No</span>
                          )
                        ) : prop.field_type === 'url' ? (
                          <a
                            href={String(val).startsWith('http') ? val : `https://${val}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <span>{val}</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : prop.field_type === 'currency' ? (
                          formatCurrency(val)
                        ) : (
                          val
                        )
                      ) : (
                        <span className="hs-prop-empty" style={{ fontStyle: 'italic', color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                          {prop.is_mandatory ? 'Pending required value' : 'Empty'}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={() => setIsEditing(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Sliders size={12} />
                  <span>Update Stage Values</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StageCustomFieldsCard;
