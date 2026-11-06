import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  RotateCcw,
  Scale,
  User,
  Users,
  Shield,
  Save,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertCircle,
  HelpCircle,
  Sliders,
  Globe,
  UploadCloud,
  Bell,
  ArrowUp,
  ArrowDown,
  X,
  Sparkles,
} from 'lucide-react';
import { leadApi } from '../api/leadApi';
import { userApi } from '../api/userApi';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/validation';
import { useDialogA11y } from '../hooks/useDialogA11y';

export const LeadAssignmentManager = () => {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [users, setUsers] = useState([]);
  const [sources, setSources] = useState([]);
  const [products, setProducts] = useState([]);

  // Global Config State
  const [config, setConfig] = useState({
    is_enabled: true,
    strategy: 'ROUND_ROBIN',
    specific_user: '',
    fallback_user: '',
    salesmen_pool: [],
    notify_salesman: true,
    auto_assign_web_to_lead: true,
    auto_assign_csv_import: true,
    auto_assign_manual_create: true,
  });

  // Custom Rules State
  const [rules, setRules] = useState([]);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [savingRule, setSavingRule] = useState(false);

  const [ruleFormData, setRuleFormData] = useState({
    name: '',
    is_active: true,
    source: '',
    lead_type: '',
    country: '',
    product: '',
    strategy: 'ROUND_ROBIN',
    specific_user: '',
    salesmen_pool: [],
  });

  const ruleDialogRef = useDialogA11y(isRuleModalOpen, () => {
    if (!savingRule) setIsRuleModalOpen(false);
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [configRes, rulesRes, usersRes, sourcesRes] = await Promise.all([
        leadApi.getAssignmentConfig(),
        leadApi.getAssignmentRules(),
        userApi.getUsers(),
        leadApi.getSources(),
      ]);

      setConfig({
        is_enabled: configRes.is_enabled ?? true,
        strategy: configRes.strategy || 'ROUND_ROBIN',
        specific_user: configRes.specific_user || '',
        fallback_user: configRes.fallback_user || '',
        salesmen_pool: configRes.salesmen_pool || [],
        notify_salesman: configRes.notify_salesman ?? true,
        auto_assign_web_to_lead: configRes.auto_assign_web_to_lead ?? true,
        auto_assign_csv_import: configRes.auto_assign_csv_import ?? true,
        auto_assign_manual_create: configRes.auto_assign_manual_create ?? true,
      });

      const rawRules = Array.isArray(rulesRes) ? rulesRes : rulesRes.results || [];
      setRules(rawRules);

      const rawUsers = Array.isArray(usersRes) ? usersRes : usersRes.results || [];
      setUsers(rawUsers);

      const rawSources = Array.isArray(sourcesRes) ? sourcesRes : sourcesRes.results || [];
      setSources(rawSources);

      try {
        const prodRes = await leadApi.getProducts?.();
        if (prodRes) setProducts(Array.isArray(prodRes) ? prodRes : prodRes.results || []);
      } catch {}
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load assignment configuration'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter eligible salesmen (EXECUTIVE or salesmen role)
  const salesExecutives = users.filter(
    (u) => u.is_active && (u.role === 'EXECUTIVE' || u.role === 'SALES_EXECUTIVE')
  );

  const handleTogglePoolUser = (userId) => {
    setConfig((prev) => {
      const current = prev.salesmen_pool || [];
      if (current.includes(userId)) {
        return { ...prev, salesmen_pool: current.filter((id) => id !== userId) };
      } else {
        return { ...prev, salesmen_pool: [...current, userId] };
      }
    });
  };

  const handleSelectAllPool = () => {
    setConfig((prev) => ({
      ...prev,
      salesmen_pool: salesExecutives.map((u) => u.id),
    }));
  };

  const handleDeselectAllPool = () => {
    setConfig((prev) => ({
      ...prev,
      salesmen_pool: [],
    }));
  };

  const handleSaveConfig = async (e) => {
    if (e) e.preventDefault();
    setSavingConfig(true);
    try {
      const payload = {
        is_enabled: config.is_enabled,
        strategy: config.strategy,
        specific_user: config.specific_user ? parseInt(config.specific_user, 10) : null,
        fallback_user: config.fallback_user ? parseInt(config.fallback_user, 10) : null,
        salesmen_pool_ids: config.salesmen_pool,
        notify_salesman: config.notify_salesman,
        auto_assign_web_to_lead: config.auto_assign_web_to_lead,
        auto_assign_csv_import: config.auto_assign_csv_import,
        auto_assign_manual_create: config.auto_assign_manual_create,
      };

      await leadApi.updateAssignmentConfig(payload);
      showToast('Lead auto-assignment configuration saved successfully!', 'success');
      loadData();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save configuration'), 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  // Rule Handlers
  const handleOpenCreateRule = () => {
    setEditingRule(null);
    setRuleFormData({
      name: '',
      is_active: true,
      source: '',
      lead_type: '',
      country: '',
      product: '',
      strategy: 'ROUND_ROBIN',
      specific_user: '',
      salesmen_pool: salesExecutives.map((u) => u.id),
    });
    setIsRuleModalOpen(true);
  };

  const handleOpenEditRule = (rule) => {
    setEditingRule(rule);
    setRuleFormData({
      name: rule.name,
      is_active: rule.is_active,
      source: rule.source || '',
      lead_type: rule.lead_type || '',
      country: rule.country || '',
      product: rule.product || '',
      strategy: rule.strategy,
      specific_user: rule.specific_user || '',
      salesmen_pool: rule.salesmen_pool || [],
    });
    setIsRuleModalOpen(true);
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this assignment rule?')) return;
    try {
      await leadApi.deleteAssignmentRule(ruleId);
      showToast('Assignment rule deleted.', 'info');
      loadData();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to delete rule'), 'error');
    }
  };

  const handleSaveRule = async (e) => {
    if (e) e.preventDefault();
    if (!ruleFormData.name.trim()) {
      showToast('Rule name is required.', 'warning');
      return;
    }
    setSavingRule(true);
    try {
      const payload = {
        name: ruleFormData.name.trim(),
        is_active: ruleFormData.is_active,
        source: ruleFormData.source ? parseInt(ruleFormData.source, 10) : null,
        lead_type: ruleFormData.lead_type || '',
        country: ruleFormData.country.trim(),
        product: ruleFormData.product ? parseInt(ruleFormData.product, 10) : null,
        strategy: ruleFormData.strategy,
        specific_user: ruleFormData.specific_user ? parseInt(ruleFormData.specific_user, 10) : null,
        salesmen_pool_ids: ruleFormData.salesmen_pool,
      };

      if (editingRule) {
        await leadApi.updateAssignmentRule(editingRule.id, payload);
        showToast('Assignment rule updated.', 'success');
      } else {
        await leadApi.createAssignmentRule(payload);
        showToast('New assignment rule created.', 'success');
      }
      setIsRuleModalOpen(false);
      loadData();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save rule'), 'error');
    } finally {
      setSavingRule(false);
    }
  };

  const handleMoveRule = async (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= rules.length) return;
    const newRules = [...rules];
    const [moved] = newRules.splice(index, 1);
    newRules.splice(targetIdx, 0, moved);

    const orderPayload = newRules.map((r, i) => ({ id: r.id, order: i + 1 }));
    setRules(newRules);
    try {
      await leadApi.reorderAssignmentRules(orderPayload);
    } catch {
      loadData();
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-dim)' }}>
        Loading assignment configuration...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Banner Card: Master Enable/Disable */}
      <div className="card" style={{ borderLeft: config.is_enabled ? '4px solid var(--success, #10b981)' : '4px solid var(--text-dim)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <UserCheck size={22} color="var(--primary, #6366f1)" />
              <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Automated Lead Assignment</h3>
              <span className={`badge ${config.is_enabled ? 'badge-success' : 'badge-secondary'}`}>
                {config.is_enabled ? 'Active / Enabled' : 'Disabled'}
              </span>
            </div>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Automatically assign incoming leads (Web-to-Lead, CSV imports, and manual creations) to sales representatives according to customized strategies and routing rules.
            </p>
          </div>

          <label className="toggle-switch" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer', margin: 0 }}>
            <input
              type="checkbox"
              checked={config.is_enabled}
              onChange={(e) => setConfig({ ...config, is_enabled: e.target.checked })}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
              {config.is_enabled ? 'Auto-Assignment Enabled' : 'Auto-Assignment Disabled'}
            </span>
          </label>
        </div>
      </div>

      {/* Global Default Strategy Card */}
      <form onSubmit={handleSaveConfig} className="card">
        <div style={{ borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
          <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sliders size={18} color="var(--primary, #6366f1)" />
            <span>Default Assignment Strategy</span>
          </h3>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            Choose how leads are distributed when no specific conditional routing rule matches.
          </p>
        </div>

        {/* Strategy Selection Tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Round Robin */}
          <div
            onClick={() => setConfig({ ...config, strategy: 'ROUND_ROBIN' })}
            style={{
              padding: '1.15rem',
              borderRadius: 'var(--radius-md, 8px)',
              border: config.strategy === 'ROUND_ROBIN' ? '2px solid var(--primary, #6366f1)' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              background: config.strategy === 'ROUND_ROBIN' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface, #1e222d)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
              <RotateCcw size={18} color="var(--primary, #6366f1)" />
              <strong style={{ fontSize: '0.95rem' }}>Round Robin</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Rotates incoming leads strictly in sequence across active salesmen (Salesman A &rarr; Salesman B &rarr; Salesman C &rarr; Salesman A).
            </p>
          </div>

          {/* Least Loaded */}
          <div
            onClick={() => setConfig({ ...config, strategy: 'LEAST_LOADED' })}
            style={{
              padding: '1.15rem',
              borderRadius: 'var(--radius-md, 8px)',
              border: config.strategy === 'LEAST_LOADED' ? '2px solid var(--primary, #6366f1)' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              background: config.strategy === 'LEAST_LOADED' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface, #1e222d)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
              <Scale size={18} color="#38bdf8" />
              <strong style={{ fontSize: '0.95rem' }}>Least Loaded</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Assigns new leads to the salesman with the lowest number of active deals to balance workload.
            </p>
          </div>

          {/* Specific Salesperson */}
          <div
            onClick={() => setConfig({ ...config, strategy: 'SPECIFIC_USER' })}
            style={{
              padding: '1.15rem',
              borderRadius: 'var(--radius-md, 8px)',
              border: config.strategy === 'SPECIFIC_USER' ? '2px solid var(--primary, #6366f1)' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
              background: config.strategy === 'SPECIFIC_USER' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-surface, #1e222d)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem' }}>
              <User size={18} color="#f59e0b" />
              <strong style={{ fontSize: '0.95rem' }}>Specific Salesperson</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Directly routes all default leads to one designated lead qualifier or sales representative.
            </p>
          </div>
        </div>

        {/* Specific User Dropdown if selected */}
        {config.strategy === 'SPECIFIC_USER' && (
          <div className="form-group" style={{ marginBottom: '1.5rem', maxWidth: '400px' }}>
            <label className="form-label" htmlFor="specific-salesman-select">
              Select Primary Salesperson <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <select
              id="specific-salesman-select"
              className="form-control"
              value={config.specific_user}
              onChange={(e) => setConfig({ ...config, specific_user: e.target.value })}
              required
            >
              <option value="">-- Choose Salesperson --</option>
              {salesExecutives.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.username} ({u.email})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Salesmen Pool Checklist (for Round Robin & Least Loaded) */}
        {config.strategy !== 'SPECIFIC_USER' && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div>
                <label className="form-label" style={{ margin: 0, fontWeight: 600 }}>
                  Active Salesmen Rotation Pool ({config.salesmen_pool?.length || 0} of {salesExecutives.length} selected)
                </label>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  Only checked salesmen will receive new leads. Uncheck salesmen who are on vacation or offline.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleSelectAllPool} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                  Select All
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleDeselectAllPool} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                  Deselect All
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '0.65rem',
                maxHeight: '260px',
                overflowY: 'auto',
                padding: '0.5rem',
                background: 'rgba(0, 0, 0, 0.15)',
                borderRadius: 'var(--radius-md, 8px)',
                border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
              }}
            >
              {salesExecutives.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', padding: '1rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                  No active Sales Executives found in user accounts.
                </div>
              ) : (
                salesExecutives.map((u) => {
                  const isChecked = config.salesmen_pool?.includes(u.id);
                  const displayName = u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.username;

                  return (
                    <label
                      key={u.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        padding: '0.6rem 0.75rem',
                        borderRadius: 'var(--radius-sm, 6px)',
                        background: isChecked ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-surface, #1e222d)',
                        border: isChecked ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid var(--border-subtle, rgba(255, 255, 255, 0.05))',
                        cursor: 'pointer',
                        margin: 0,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleTogglePoolUser(u.id)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>{displayName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.email}
                        </div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Fallback Salesman & Channel Controls */}
        <div className="form-grid-2" style={{ marginBottom: '1.5rem' }}>
          <div>
            <label className="form-label" htmlFor="fallback-salesman-select">
              Fallback Salesperson
            </label>
            <select
              id="fallback-salesman-select"
              className="form-control"
              value={config.fallback_user}
              onChange={(e) => setConfig({ ...config, fallback_user: e.target.value })}
            >
              <option value="">-- No Fallback (Keep Unassigned) --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.username} ({u.role})
                </option>
              ))}
            </select>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Assigned if the rotation pool is empty or unavailable.
            </span>
          </div>

          <div>
            <label className="form-label">Channel Automation Toggles</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={config.auto_assign_web_to_lead}
                  onChange={(e) => setConfig({ ...config, auto_assign_web_to_lead: e.target.checked })}
                />
                <span>Auto-assign Website Contact Form (Web-to-Lead) inquiries</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={config.auto_assign_csv_import}
                  onChange={(e) => setConfig({ ...config, auto_assign_csv_import: e.target.checked })}
                />
                <span>Auto-assign unassigned CSV imported leads</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={config.auto_assign_manual_create}
                  onChange={(e) => setConfig({ ...config, auto_assign_manual_create: e.target.checked })}
                />
                <span>Auto-assign manual lead creations when owner is left blank</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={config.notify_salesman}
                  onChange={(e) => setConfig({ ...config, notify_salesman: e.target.checked })}
                />
                <span>Send instant in-app notification to salesman upon assignment</span>
              </label>
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={savingConfig}>
          <Save size={16} />
          <span>{savingConfig ? 'Saving Settings...' : 'Save Assignment Configuration'}</span>
        </button>
      </form>

      {/* Conditional Lead Routing Rules Section */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} color="#38bdf8" />
              <span>Custom Routing Rules (Conditional Assignment)</span>
            </h3>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
              Route leads to specific salesmen based on criteria like Lead Source, Product, Country, or Lead Type before defaulting to global strategy.
            </p>
          </div>

          <button type="button" className="btn btn-secondary btn-sm" onClick={handleOpenCreateRule}>
            <Plus size={14} />
            <span>Add Routing Rule</span>
          </button>
        </div>

        {rules.length === 0 ? (
          <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-dim)' }}>
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>No custom routing rules defined yet.</p>
            <p style={{ margin: 0, fontSize: '0.8rem' }}>
              All incoming leads currently follow your <strong>{config.strategy.replace('_', ' ')}</strong> default strategy.
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ margin: 0, fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Priority</th>
                  <th>Rule Name</th>
                  <th>Matching Criteria</th>
                  <th>Assignment Target</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule, idx) => (
                  <tr key={rule.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.15rem 0.35rem' }}
                          disabled={idx === 0}
                          onClick={() => handleMoveRule(idx, -1)}
                          title="Move Up"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.15rem 0.35rem' }}
                          disabled={idx === rules.length - 1}
                          onClick={() => handleMoveRule(idx, 1)}
                          title="Move Down"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <strong>{rule.name}</strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                        {rule.source_details && (
                          <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                            Source: {rule.source_details.name}
                          </span>
                        )}
                        {rule.lead_type && (
                          <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                            Type: {rule.lead_type}
                          </span>
                        )}
                        {rule.country && (
                          <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                            Country: {rule.country}
                          </span>
                        )}
                        {!rule.source_details && !rule.lead_type && !rule.country && (
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Any Lead</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {rule.strategy === 'SPECIFIC_USER' ? (
                        <span>
                          Salesman: <strong>{rule.specific_user_details?.full_name || rule.specific_user_details?.email || 'Designated User'}</strong>
                        </span>
                      ) : (
                        <span>
                          {rule.strategy.replace('_', ' ')} across ({rule.salesmen_pool?.length || 0} reps)
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${rule.is_active ? 'badge-success' : 'badge-secondary'}`}>
                        {rule.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleOpenEditRule(rule)}
                          title="Edit Rule"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDeleteRule(rule.id)}
                          style={{ color: 'var(--danger)' }}
                          title="Delete Rule"
                        >
                          <Trash2 size={13} />
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

      {/* Add / Edit Routing Rule Modal */}
      {isRuleModalOpen && (
        <div className="modal-backdrop" onClick={() => !savingRule && setIsRuleModalOpen(false)}>
          <div
            className="modal-container"
            ref={ruleDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Lead Routing Rule"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '580px' }}
          >
            <div className="modal-header">
              <h3>{editingRule ? 'Edit Routing Rule' : 'New Lead Assignment Rule'}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsRuleModalOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRule}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="rule-name-input">
                    Rule Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    id="rule-name-input"
                    type="text"
                    className="form-control"
                    placeholder="e.g. Website Inquiries to Regional Sales"
                    value={ruleFormData.name}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="rule-source-select">
                      Match Lead Source
                    </label>
                    <select
                      id="rule-source-select"
                      className="form-control"
                      value={ruleFormData.source}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, source: e.target.value })}
                    >
                      <option value="">-- Any Source --</option>
                      {sources.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="rule-type-select">
                      Match Lead Type
                    </label>
                    <select
                      id="rule-type-select"
                      className="form-control"
                      value={ruleFormData.lead_type}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, lead_type: e.target.value })}
                    >
                      <option value="">-- Any Type --</option>
                      <option value="INBOUND">Inbound</option>
                      <option value="OUTBOUND">Outbound</option>
                      <option value="REFERRAL">Referral</option>
                      <option value="PARTNER">Partner</option>
                      <option value="EVENT">Event</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="rule-country-input">
                    Match Country (Optional)
                  </label>
                  <input
                    id="rule-country-input"
                    type="text"
                    className="form-control"
                    placeholder="e.g. United States, Germany, India"
                    value={ruleFormData.country}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, country: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="rule-strategy-select">
                    Assignment Strategy
                  </label>
                  <select
                    id="rule-strategy-select"
                    className="form-control"
                    value={ruleFormData.strategy}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, strategy: e.target.value })}
                  >
                    <option value="ROUND_ROBIN">Round Robin (Even Distribution)</option>
                    <option value="LEAST_LOADED">Least Loaded (Workload Balanced)</option>
                    <option value="SPECIFIC_USER">Specific Salesperson</option>
                  </select>
                </div>

                {ruleFormData.strategy === 'SPECIFIC_USER' ? (
                  <div className="form-group">
                    <label className="form-label" htmlFor="rule-specific-user-select">
                      Target Salesperson <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <select
                      id="rule-specific-user-select"
                      className="form-control"
                      value={ruleFormData.specific_user}
                      onChange={(e) => setRuleFormData({ ...ruleFormData, specific_user: e.target.value })}
                      required
                    >
                      <option value="">-- Choose Salesperson --</option>
                      {salesExecutives.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.first_name ? `${u.first_name} ${u.last_name || ''}`.trim() : u.username} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">
                      Assigned Pool ({ruleFormData.salesmen_pool?.length || 0} selected)
                    </label>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '0.4rem',
                        maxHeight: '160px',
                        overflowY: 'auto',
                        padding: '0.4rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: 'var(--radius-sm, 6px)',
                      }}
                    >
                      {salesExecutives.map((u) => {
                        const isChecked = ruleFormData.salesmen_pool?.includes(u.id);
                        return (
                          <label
                            key={u.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              fontSize: '0.8rem',
                              margin: 0,
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const cur = ruleFormData.salesmen_pool || [];
                                const next = cur.includes(u.id) ? cur.filter((id) => id !== u.id) : [...cur, u.id];
                                setRuleFormData({ ...ruleFormData, salesmen_pool: next });
                              }}
                            />
                            <span>{u.first_name || u.username}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={ruleFormData.is_active}
                    onChange={(e) => setRuleFormData({ ...ruleFormData, is_active: e.target.checked })}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Enable this rule immediately</span>
                </label>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsRuleModalOpen(false)}
                  disabled={savingRule}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingRule}>
                  <Check size={16} />
                  <span>{savingRule ? 'Saving...' : editingRule ? 'Update Rule' : 'Create Rule'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadAssignmentManager;

