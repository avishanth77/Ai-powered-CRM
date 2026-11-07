import React, { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Tag,
  DollarSign,
  Layers,
  TrendingUp,
  X,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { productApi } from '../api/productApi';
import { useToast } from '../context/ToastContext';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { formatCurrency } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';

const BILLING_CYCLE_OPTIONS = [
  { value: 'ONE_TIME', label: 'One-time' },
  { value: 'MONTHLY', label: 'Monthly Recurring' },
  { value: 'ANNUAL', label: 'Annual Recurring' },
];

const DEFAULT_CATEGORIES = [
  'Enterprise Software',
  'SaaS Application',
  'AI & Automation',
  'Cloud Services',
  'Professional Services',
  'Mobile Apps',
  'Support & Maintenance',
];

export default function ProductsManager() {
  const { showToast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'SaaS Application',
    unit_price: '',
    currency: 'INR',
    billing_cycle: 'ANNUAL',
    description: '',
    is_active: true,
  });

  const dialogRef = useDialogA11y(isModalOpen, () => {
    if (!submitting) setIsModalOpen(false);
  });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productApi.getProducts();
      const list = res.results || (Array.isArray(res) ? res : []);
      setProducts(list);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load products'), 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      code: '',
      category: 'SaaS Application',
      unit_price: '',
      currency: 'INR',
      billing_cycle: 'ANNUAL',
      description: '',
      is_active: true,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      code: p.code,
      category: p.category || 'SaaS Application',
      unit_price: p.unit_price,
      currency: p.currency || 'INR',
      billing_cycle: p.billing_cycle || 'ANNUAL',
      description: p.description || '',
      is_active: p.is_active,
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Product Name is required.');
      return;
    }
    if (!formData.code.trim()) {
      setFormError('Product Code / SKU is required.');
      return;
    }
    const priceNum = parseFloat(formData.unit_price);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Please enter a valid non-negative unit price.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        category: formData.category.trim(),
        unit_price: priceNum.toFixed(2),
        currency: formData.currency,
        billing_cycle: formData.billing_cycle,
        description: formData.description.trim(),
        is_active: formData.is_active,
      };

      if (editingProduct) {
        await productApi.updateProduct(editingProduct.id, payload);
        showToast(`Product "${payload.name}" updated successfully!`, 'success');
      } else {
        await productApi.createProduct(payload);
        showToast(`Product "${payload.name}" created successfully!`, 'success');
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to save product.');
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (p) => {
    try {
      await productApi.updateProduct(p.id, { is_active: !p.is_active });
      showToast(`Product "${p.name}" is now ${!p.is_active ? 'Active' : 'Inactive'}.`, 'success');
      fetchProducts();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Could not update status'), 'error');
    }
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Are you sure you want to delete "${p.name}"? If leads are using it, consider deactivating it instead.`)) {
      return;
    }
    try {
      await productApi.deleteProduct(p.id);
      showToast(`Product "${p.name}" deleted.`, 'success');
      fetchProducts();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Could not delete product (it may be linked to active deals).'), 'error');
    }
  };

  // Filtered list
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = !selectedCategory || p.category === selectedCategory;

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && p.is_active) ||
      (statusFilter === 'INACTIVE' && !p.is_active);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = Array.from(new Set([...DEFAULT_CATEGORIES, ...products.map((p) => p.category).filter(Boolean)]));

  return (
    <div className="products-manager">
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={22} className="text-primary" /> Products & Offerings Catalog
          </h2>
          <p className="text-dim font-sm" style={{ margin: '0.25rem 0 0 0' }}>
            Manage the multi-product catalog. Attach one or more products to leads, track pipeline value per product, and close multi-item deals.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleOpenCreate}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* KPI Cards Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1rem' }}>
          <div className="text-dim font-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Products</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', fontFamily: 'Outfit' }}>
            {products.length}
          </div>
          <div className="text-dim font-xs" style={{ marginTop: '0.25rem' }}>In catalog</div>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <div className="text-dim font-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Products</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--success)', fontFamily: 'Outfit' }}>
            {products.filter((p) => p.is_active).length}
          </div>
          <div className="text-dim font-xs" style={{ marginTop: '0.25rem' }}>Available for sales reps</div>
        </div>

        <div className="card" style={{ padding: '1rem' }}>
          <div className="text-dim font-xs" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categories</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.25rem', color: 'var(--primary)', fontFamily: 'Outfit' }}>
            {categories.length}
          </div>
          <div className="text-dim font-xs" style={{ marginTop: '0.25rem' }}>Product lines</div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '220px' }}>
          <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by product name, code, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '2.2rem' }}
          />
        </div>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '180px' }}
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          className="form-control"
          style={{ width: 'auto', minWidth: '140px' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active Only</option>
          <option value="INACTIVE">Inactive Only</option>
        </select>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={fetchProducts}
          title="Refresh products"
          style={{ padding: '0.55rem' }}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Table / List */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', background: 'var(--bg-card-subtle)' }}>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Product / Offering</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Code / SKU</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Category</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Standard Unit Price</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Billing</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Deals</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-dim)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem' }}>
                    <Loader2 size={24} className="spinner" style={{ margin: '0 auto' }} />
                    <div className="text-dim font-sm" style={{ marginTop: '0.5rem' }}>Loading catalog...</div>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-dim)' }}>
                    <Package size={36} style={{ opacity: 0.3, margin: '0 auto 0.5rem auto', display: 'block' }} />
                    <div style={{ fontWeight: 600 }}>No products found</div>
                    <div className="font-xs">Try adjusting your filters or click "Add Product" to create one.</div>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</div>
                      {p.description && (
                        <div className="text-dim font-xs" style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <code style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'var(--bg-surface-elevated)' }}>
                        {p.code}
                      </code>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                        {p.category || 'General'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', fontFamily: 'Outfit', fontWeight: 600, color: 'var(--warning)' }}>
                      {formatCurrency(p.unit_price)}
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className="text-dim font-xs">{p.billing_cycle_display || p.billing_cycle}</span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className="tab-badge" style={{ fontWeight: 600 }}>
                        {p.leads_count || 0} deals
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem' }}>
                      <span className={`status-badge ${p.is_active ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem' }}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => handleOpenEdit(p)}
                          title="Edit Product"
                          style={{ padding: '0.25rem 0.5rem', color: 'var(--primary)' }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => handleToggleActive(p)}
                          title={p.is_active ? 'Deactivate Product' : 'Activate Product'}
                          style={{ padding: '0.25rem 0.5rem', color: p.is_active ? 'var(--warning)' : 'var(--success)' }}
                        >
                          {p.is_active ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => handleDelete(p)}
                          title="Delete Product"
                          style={{ padding: '0.25rem 0.5rem', color: 'var(--danger)' }}
                        >
                          <Trash2 size={14} />
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

      {/* Product Add / Edit Modal */}
      {isModalOpen && (
        <div
          className="modal-backdrop"
          onClick={!submitting ? () => setIsModalOpen(false) : undefined}
          role="dialog"
          aria-modal="true"
          style={{ zIndex: 1100 }}
        >
          <div
            className="modal-container"
            ref={dialogRef}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '540px', width: '100%' }}
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <div
                  className="modal-icon-badge"
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.15)',
                    color: 'var(--primary)',
                    padding: '0.4rem',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Package size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>
                    {editingProduct ? 'Edit Product Offering' : 'Add New Product Offering'}
                  </h3>
                  <p className="text-dim font-xs" style={{ margin: '2px 0 0 0' }}>
                    {editingProduct ? `Updating SKU ${editingProduct.code}` : 'Define an offering available for CRM deals'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                disabled={submitting}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {formError && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem' }}>
                  {formError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label form-label-required">Product Name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Enterprise Cloud ERP Suite"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label form-label-required">Code / SKU</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. ERP-ENTERPRISE"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    required
                  />
                  <span className="text-dim font-xs">Unique identifier</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. SaaS Application"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    list="category-suggestions"
                  />
                  <datalist id="category-suggestions">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label form-label-required">Standard Unit Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-control"
                    placeholder="e.g. 50000.00"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Billing Cycle</label>
                  <select
                    className="form-control"
                    value={formData.billing_cycle}
                    onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value })}
                  >
                    {BILLING_CYCLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Description / Feature Scope</label>
                <textarea
                  rows={2}
                  className="form-control"
                  placeholder="Key features, included user licenses, support tiers, or SLA terms..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                <input
                  type="checkbox"
                  id="prod-active-chk"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <label htmlFor="prod-active-chk" style={{ margin: 0, fontWeight: 500, cursor: 'pointer' }}>
                  Active (available for sales reps to attach to leads)
                </label>
              </div>

              <div className="modal-actions" style={{ justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {submitting ? <Loader2 size={16} className="spinner" /> : <Package size={16} />}
                  {editingProduct ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

