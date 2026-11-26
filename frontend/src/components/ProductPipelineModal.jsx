import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, GitBranch, Sparkles, Copy, Layers, Loader2 } from 'lucide-react';
import { leadApi } from '../api/leadApi';
import { productApi } from '../api/productApi';
import { useToast } from '../context/ToastContext';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { extractErrorMessage } from '../utils/validation';

const STARTER_CUSTOM_STAGES = [
  { name: 'New', slug: 'new', color: '#0284c7', win_probability: 10, is_system: true },
  { name: 'Discovery', slug: 'discovery', color: '#6366f1', win_probability: 30, is_system: false },
  { name: 'Proposal', slug: 'proposal', color: '#d97706', win_probability: 65, is_system: false },
  { name: 'Won', slug: 'won', color: '#0d9488', win_probability: 100, is_system: true },
  { name: 'Lost', slug: 'lost', color: '#e11d48', win_probability: 0, is_system: true },
];

export default function ProductPipelineModal({
  isOpen,
  onClose,
  preselectedProduct = null,
  existingPipelines = [],
  onCreated,
}) {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState('custom'); // 'custom' | 'clone' | 'minimal'
  const [cloneFromId, setCloneFromId] = useState('');
  const [cloneRules, setCloneRules] = useState(true);
  const [cloneFields, setCloneFields] = useState(false);
  const [customStages, setCustomStages] = useState(STARTER_CUSTOM_STAGES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const dialogRef = useDialogA11y(isOpen, () => {
    if (!submitting) onClose();
  });

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setMode('custom');
    setCustomStages(STARTER_CUSTOM_STAGES.map((s) => ({ ...s })));
    setCloneRules(true);
    setCloneFields(false);

    const defPipe = existingPipelines.find((p) => p.is_default) || existingPipelines[0];
    setCloneFromId(defPipe ? String(defPipe.id) : '');

    productApi
      .getProducts()
      .then((res) => {
        const list = res?.results || (Array.isArray(res) ? res : []);
        setProducts(list.filter((p) => p.is_active));
      })
      .catch(() => {});

    if (preselectedProduct) {
      setSelectedProductId(String(preselectedProduct.id));
      setName(`${preselectedProduct.name} Pipeline`);
      setDescription(`Custom sales pipeline dedicated to ${preselectedProduct.name}`);
    } else {
      setSelectedProductId('');
      setName('');
      setDescription('');
    }
  }, [isOpen, preselectedProduct, existingPipelines]);

  if (!isOpen) return null;

  const usedProductIds = new Set(
    existingPipelines.filter((p) => p.product).map((p) => Number(p.product))
  );
  const eligibleProducts = products.filter(
    (p) => !usedProductIds.has(p.id) || (preselectedProduct && p.id === preselectedProduct.id)
  );

  const handleProductSelect = (pid) => {
    setSelectedProductId(pid);
    const prod = products.find((p) => String(p.id) === String(pid));
    if (prod) {
      setName(`${prod.name} Pipeline`);
      if (!description) {
        setDescription(`Custom sales pipeline dedicated to ${prod.name}`);
      }
    }
  };

  const handleAddCustomStage = () => {
    // Insert right before Won/Lost if they are at the end
    const wonIndex = customStages.findIndex((s) => s.slug === 'won' || s.name.toLowerCase() === 'won');
    const newStage = {
      name: '',
      slug: '',
      color: '#7c3aed',
      win_probability: 50,
      is_system: false,
    };
    if (wonIndex > 0) {
      const next = [...customStages];
      next.splice(wonIndex, 0, newStage);
      setCustomStages(next);
    } else {
      setCustomStages([...customStages, newStage]);
    }
  };

  const handleUpdateCustomStage = (idx, key, val) => {
    setCustomStages((prev) =>
      prev.map((st, i) => (i === idx ? { ...st, [key]: val } : st))
    );
  };

  const handleRemoveCustomStage = (idx) => {
    if (customStages[idx]?.is_system) return;
    setCustomStages((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId) {
      setError('Please select a product for this custom pipeline.');
      return;
    }
    if (!name.trim()) {
      setError('Pipeline name is required.');
      return;
    }

    if (mode === 'custom') {
      const cleaned = customStages.filter((s) => (s.name || '').trim());
      if (cleaned.length < 2) {
        setError('Please define at least 2 stages (e.g. New and Won).');
        return;
      }
      const namesLower = cleaned.map((s) => s.name.trim().toLowerCase());
      if (new Set(namesLower).size !== namesLower.length) {
        setError('Stage names within a pipeline must be unique.');
        return;
      }
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        product: parseInt(selectedProductId, 10),
        mode,
        is_active: true,
      };

      if (mode === 'clone') {
        if (cloneFromId) payload.clone_from = parseInt(cloneFromId, 10);
        payload.clone_rules = cloneRules;
        payload.clone_fields = cloneFields;
      } else if (mode === 'custom') {
        payload.initial_stages = customStages
          .filter((s) => (s.name || '').trim())
          .map((s) => ({
            name: s.name.trim(),
            slug: s.slug || undefined,
            color: s.color || '#6366F1',
            win_probability: parseInt(s.win_probability, 10) || 0,
            is_system: Boolean(s.is_system),
            is_active: true,
          }));
      }

      const res = await leadApi.createPipeline(payload);
      const created = res?.data || res;
      showToast(res?.message || `Custom pipeline "${name.trim()}" created!`, 'success');
      if (onCreated) onCreated(created);
      onClose();
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to create custom product pipeline.');
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="modal-container modal-container-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-prod-pipeline-title"
      >
        <div className="modal-header">
          <div className="modal-title-row">
            <GitBranch size={20} color="var(--primary)" />
            <h3 id="create-prod-pipeline-title">Create Custom Product Pipeline</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={submitting} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && (
              <div className="alert alert-danger" style={{ margin: 0, fontSize: '0.85rem' }}>
                {error}
              </div>
            )}

            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="pp-product">
                  Product
                </label>
                <select
                  id="pp-product"
                  className="form-control"
                  value={selectedProductId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  disabled={Boolean(preselectedProduct)}
                  required
                >
                  <option value="">-- Select Product --</option>
                  {eligibleProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.code})
                    </option>
                  ))}
                </select>
                {eligibleProducts.length === 0 && !preselectedProduct && (
                  <span className="text-dim font-xs" style={{ marginTop: '0.25rem' }}>
                    All active products already have a custom pipeline.
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label form-label-required" htmlFor="pp-name">
                  Pipeline Name
                </label>
                <input
                  id="pp-name"
                  type="text"
                  className="form-control"
                  placeholder="e.g. Enterprise SaaS Pipeline"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pp-desc">
                Description
              </label>
              <input
                id="pp-desc"
                type="text"
                className="form-control"
                placeholder="Describe when or how this product's sales workflow operates"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Stage Setup Mode</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={() => setMode('custom')}
                  style={{
                    padding: '0.75rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: mode === 'custom' ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                    background: mode === 'custom' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-surface-elevated)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'var(--text-main)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.84rem', color: mode === 'custom' ? 'var(--primary)' : 'var(--text-main)' }}>
                    <Sparkles size={14} color="var(--primary)" />
                    <span>Custom Stages</span>
                  </div>
                  <div className="text-dim font-xs" style={{ marginTop: '0.25rem' }}>
                    Build bespoke stages now
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('clone')}
                  style={{
                    padding: '0.75rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: mode === 'clone' ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                    background: mode === 'clone' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-surface-elevated)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'var(--text-main)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.84rem', color: mode === 'clone' ? 'var(--primary)' : 'var(--text-main)' }}>
                    <Copy size={14} color="var(--primary)" />
                    <span>Clone Existing</span>
                  </div>
                  <div className="text-dim font-xs" style={{ marginTop: '0.25rem' }}>
                    Copy from Default Pipeline
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('minimal')}
                  style={{
                    padding: '0.75rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: mode === 'minimal' ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                    background: mode === 'minimal' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-surface-elevated)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'var(--text-main)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.84rem', color: mode === 'minimal' ? 'var(--primary)' : 'var(--text-main)' }}>
                    <Layers size={14} color="var(--primary)" />
                    <span>Blank Minimal</span>
                  </div>
                  <div className="text-dim font-xs" style={{ marginTop: '0.25rem' }}>
                    Start with New, Won, Lost
                  </div>
                </button>
              </div>
            </div>

            {mode === 'custom' && (
              <div style={{ background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', padding: '0.85rem', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    Pipeline Stages ({customStages.length})
                  </span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddCustomStage}>
                    <Plus size={14} />
                    <span>Add Stage</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  {customStages.map((st, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '28px 1fr 44px 85px 32px',
                        gap: '0.5rem',
                        alignItems: 'center',
                      }}
                    >
                      <span className="text-dim font-xs" style={{ textAlign: 'center', fontWeight: 600 }}>
                        {idx + 1}.
                      </span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Stage name (e.g. Technical Audit)"
                        value={st.name}
                        onChange={(e) => handleUpdateCustomStage(idx, 'name', e.target.value)}
                        style={{ padding: '0.35rem 0.6rem', fontSize: '0.8125rem' }}
                        required
                      />
                      <input
                        type="color"
                        value={st.color || '#6366F1'}
                        onChange={(e) => handleUpdateCustomStage(idx, 'color', e.target.value)}
                        title="Stage Color"
                        style={{ width: '38px', height: '32px', padding: 0, border: '1px solid var(--border-subtle)', borderRadius: '4px', cursor: 'pointer', background: 'none' }}
                      />
                      <div style={{ position: 'relative' }}>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="form-control"
                          value={st.win_probability}
                          onChange={(e) => handleUpdateCustomStage(idx, 'win_probability', e.target.value)}
                          title="Win Probability %"
                          style={{ padding: '0.35rem 1.25rem 0.35rem 0.45rem', fontSize: '0.8125rem' }}
                        />
                        <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: 'var(--text-dim)' }}>%</span>
                      </div>
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={Boolean(st.is_system)}
                        onClick={() => handleRemoveCustomStage(idx)}
                        title={st.is_system ? 'System stage (protected)' : 'Remove stage'}
                        style={{ padding: '0.25rem', color: st.is_system ? 'var(--text-dim)' : 'var(--danger)', opacity: st.is_system ? 0.35 : 1 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="text-dim font-xs" style={{ marginTop: '0.5rem' }}>
                  You can add Stage Custom Fields, Automated Tasks, and Approval Gates per stage after creation.
                </div>
              </div>
            )}

            {mode === 'clone' && (
              <div style={{ background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-md)', padding: '0.85rem', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="pp-clone-from">Source Pipeline</label>
                  <select
                    id="pp-clone-from"
                    className="form-control"
                    value={cloneFromId}
                    onChange={(e) => setCloneFromId(e.target.value)}
                  >
                    {existingPipelines.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.stages_count ?? ''} stages)
                      </option>
                    ))}
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={cloneRules} onChange={(e) => setCloneRules(e.target.checked)} />
                  <span>Also copy Automated Stage Task Rules</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={cloneFields} onChange={(e) => setCloneFields(e.target.checked)} />
                  <span>Also copy Stage-Specific Custom Input Fields</span>
                </label>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || !selectedProductId}>
              {submitting ? <Loader2 size={15} className="spinner" /> : <Plus size={15} />}
              <span>{submitting ? 'Creating Pipeline...' : 'Create Product Pipeline'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
