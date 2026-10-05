import React, { useState, useEffect } from 'react';
import { leadApi } from '../api/leadApi';
import { authApi } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/validation';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { ROLE_LABELS } from '../utils/constants';
import { IcpQuestionsManager } from '../components/IcpQuestionsManager';
import {
  Settings as SettingsIcon,
  Plus,
  Save,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Kanban,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  Power,
  AlertTriangle,
  Lock,
  Layers,
  ListChecks,
  X,
} from 'lucide-react';

export const Settings = () => {
  const { user, updateUserProfile, canManageSources, canManageStages, canManageIcp } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState(canManageStages ? 'stages' : 'profile');

  // Profile Form
  const [profileData, setProfileData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Form State
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_new_password: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Sources State
  const [sources, setSources] = useState([]);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceDesc, setNewSourceDesc] = useState('');
  const [addingSource, setAddingSource] = useState(false);

  // Lead Stages State
  const [stages, setStages] = useState([]);
  const [loadingStages, setLoadingStages] = useState(false);

  // Create Stage Modal
  const [createStageModalOpen, setCreateStageModalOpen] = useState(false);
  const [stageFormData, setStageFormData] = useState({
    name: '',
    description: '',
    color: '#6366F1',
    display_order: 1,
    is_active: true,
  });
  const [submittingStage, setSubmittingStage] = useState(false);
  const [stageFormErrors, setStageFormErrors] = useState({});

  // Edit Stage Modal
  const [editStageModalOpen, setEditStageModalOpen] = useState(false);
  const [stageToEdit, setStageToEdit] = useState(null);
  const [editingStage, setEditingStage] = useState(false);

  // Safe Delete Stage Modal
  const [deleteStageModalOpen, setDeleteStageModalOpen] = useState(false);
  const [stageToDelete, setStageToDelete] = useState(null);
  const [replacementStageId, setReplacementStageId] = useState('');
  const [deletingStage, setDeletingStage] = useState(false);

  // Dialog accessibility: Escape to close, focus trap, body scroll lock
  const createStageDialogRef = useDialogA11y(createStageModalOpen, () => setCreateStageModalOpen(false));
  const editStageDialogRef = useDialogA11y(editStageModalOpen, () => setEditStageModalOpen(false));
  const deleteStageDialogRef = useDialogA11y(deleteStageModalOpen, () => setDeleteStageModalOpen(false));

  const fetchStages = async () => {
    setLoadingStages(true);
    try {
      const res = await leadApi.getStages({ all: 'true' });
      const items = res.results || (Array.isArray(res) ? res : []);
      // Sort by display_order
      items.sort((a, b) => a.display_order - b.display_order || a.id - b.id);
      setStages(items);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load lead stages'), 'error');
    } finally {
      setLoadingStages(false);
    }
  };

  const fetchSources = async () => {
    try {
      const res = await leadApi.getSources();
      setSources(res.results || (Array.isArray(res) ? res : []));
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to load lead sources'), 'error');
    }
  };

  useEffect(() => {
    if (canManageStages || user?.role === 'ADMIN' || user?.role === 'MANAGER') {
      fetchStages();
    }
    if (canManageSources) {
      fetchSources();
    }
  }, [canManageStages, canManageSources]);

  // Profile submission
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await authApi.updateMe(profileData);
      if (res.data) {
        updateUserProfile(res.data);
      }
      showToast('Profile updated successfully!', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update profile'), 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Change password submission
  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_new_password) {
      showToast('New passwords do not match.', 'warning');
      return;
    }
    if (passwordData.new_password.length < 6) {
      showToast('New password must be at least 6 characters.', 'warning');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await authApi.changePassword(passwordData);
      showToast(res?.message || 'Password changed successfully!', 'success');
      setPasswordData({
        old_password: '',
        new_password: '',
        confirm_new_password: '',
      });
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to change password'), 'error');
    } finally {
      setChangingPassword(false);
    }
  };

  // Create Source
  const handleCreateSource = async (e) => {
    e.preventDefault();
    if (!newSourceName.trim()) return;

    setAddingSource(true);
    try {
      const res = await leadApi.createSource({
        name: newSourceName.trim(),
        description: newSourceDesc.trim(),
      });
      showToast(`Source "${res.name}" added!`, 'success');
      setNewSourceName('');
      setNewSourceDesc('');
      fetchSources();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to add source'), 'error');
    } finally {
      setAddingSource(false);
    }
  };

  // Open Create Stage
  const handleOpenCreateStage = () => {
    const nextOrder = stages.length > 0 ? Math.max(...stages.map((s) => s.display_order)) + 1 : 1;
    setStageFormData({
      name: '',
      description: '',
      color: '#6366F1',
      display_order: nextOrder,
      is_active: true,
    });
    setStageFormErrors({});
    setCreateStageModalOpen(true);
  };

  // Validate Stage Form
  const validateStageForm = (data, excludeId = null) => {
    const errs = {};
    const name = (data.name || '').trim();
    if (!name) {
      errs.name = 'Stage name is required and cannot be empty.';
    } else {
      const duplicate = stages.some(
        (s) => s.name.toLowerCase() === name.toLowerCase() && s.id !== excludeId
      );
      if (duplicate) {
        errs.name = 'A lead stage with this name already exists (case-insensitive).';
      }
    }

    if (!data.color || !data.color.trim()) {
      errs.color = 'A valid color is required.';
    }

    if (!data.display_order || parseInt(data.display_order) < 1) {
      errs.display_order = 'Display order must be a positive integer.';
    }

    setStageFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit Create Stage
  const handleCreateStageSubmit = async (e) => {
    e.preventDefault();
    if (!validateStageForm(stageFormData)) return;

    setSubmittingStage(true);
    try {
      await leadApi.createStage({
        name: stageFormData.name.trim(),
        description: stageFormData.description.trim() || undefined,
        color: stageFormData.color.trim(),
        display_order: parseInt(stageFormData.display_order) || 1,
        is_active: Boolean(stageFormData.is_active),
      });
      showToast(`Stage "${stageFormData.name.trim()}" created successfully!`, 'success');
      setCreateStageModalOpen(false);
      fetchStages();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to create stage'), 'error');
    } finally {
      setSubmittingStage(false);
    }
  };

  // Open Edit Stage
  const handleOpenEditStage = (stage) => {
    setStageToEdit({
      id: stage.id,
      name: stage.name,
      description: stage.description || '',
      color: stage.color || '#6366F1',
      display_order: stage.display_order,
      is_active: stage.is_active,
      is_system: stage.is_system,
    });
    setStageFormErrors({});
    setEditStageModalOpen(true);
  };

  // Submit Edit Stage
  const handleEditStageSubmit = async (e) => {
    e.preventDefault();
    if (!stageToEdit) return;
    if (!validateStageForm(stageToEdit, stageToEdit.id)) return;

    setEditingStage(true);
    try {
      await leadApi.updateStage(stageToEdit.id, {
        name: stageToEdit.name.trim(),
        description: stageToEdit.description.trim(),
        color: stageToEdit.color.trim(),
        display_order: parseInt(stageToEdit.display_order) || 1,
        is_active: Boolean(stageToEdit.is_active),
      });
      showToast(`Stage "${stageToEdit.name.trim()}" updated successfully!`, 'success');
      setEditStageModalOpen(false);
      setStageToEdit(null);
      fetchStages();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to update stage'), 'error');
    } finally {
      setEditingStage(false);
    }
  };

  // Toggle Stage Active
  const handleToggleStageActive = async (stage) => {
    try {
      const res = await leadApi.toggleStageActive(stage.id);
      showToast(res.message || `Stage "${stage.name}" status updated`, 'success');
      fetchStages();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to toggle stage status'), 'error');
    }
  };

  // Move Stage Up / Down
  const handleMoveStage = async (stage, direction) => {
    try {
      await leadApi.moveStage(stage.id, { direction });
      showToast(`Stage "${stage.name}" reordered`, 'info');
      fetchStages();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to reorder stage'), 'error');
    }
  };

  // Open Safe Delete Stage
  const handleOpenDeleteStage = (stage) => {
    if (stage.is_system) {
      showToast(`Stage "${stage.name}" is a protected system stage and cannot be deleted.`, 'warning');
      return;
    }
    setStageToDelete(stage);
    // Find a replacement stage (first other active stage)
    const otherStages = stages.filter((s) => s.id !== stage.id && s.is_active);
    setReplacementStageId(otherStages.length > 0 ? otherStages[0].id : '');
    setDeleteStageModalOpen(true);
  };

  // Confirm Safe Delete Stage
  const handleConfirmDeleteStage = async () => {
    if (!stageToDelete) return;
    setDeletingStage(true);
    try {
      const payload = stageToDelete.leads_count > 0 ? { move_to_stage: parseInt(replacementStageId) } : {};
      const res = await leadApi.deleteStage(stageToDelete.id, payload);
      showToast(res?.message || `Stage "${stageToDelete.name}" was successfully deleted.`, 'success');
      setDeleteStageModalOpen(false);
      setStageToDelete(null);
      fetchStages();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Stage deletion failed'), 'error');
    } finally {
      setDeletingStage(false);
    }
  };

  return (
    <div className="settings-page">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <SettingsIcon size={26} />
            <span>Settings & Configuration</span>
          </h1>
          <p className="page-subtitle">
            Configure CRM lead stages, ICP qualification questions, sales channels, and your personal profile
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="tabs-navigation" style={{ marginBottom: '1.5rem' }} role="tablist" aria-label="Settings sections">
        {canManageStages && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'stages'}
            className={`tab-btn ${activeTab === 'stages' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveTab('stages')}
          >
            <Kanban size={16} />
            <span>Lead Stage Management</span>
            <span className="tab-badge">{stages.length}</span>
          </button>
        )}

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'profile'}
          className={`tab-btn ${activeTab === 'profile' ? 'tab-btn-active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <Shield size={16} />
          <span>Profile & Security</span>
        </button>

        {canManageSources && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sources'}
            className={`tab-btn ${activeTab === 'sources' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveTab('sources')}
          >
            <Layers size={16} />
            <span>Lead Sources</span>
            <span className="tab-badge">{sources.length}</span>
          </button>
        )}

        {canManageIcp && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'icp'}
            className={`tab-btn ${activeTab === 'icp' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveTab('icp')}
          >
            <ListChecks size={16} />
            <span>ICP Questions</span>
          </button>
        )}
      </div>

      {/* TAB 1: LEAD STAGES MANAGEMENT (Admin Only) */}
      {activeTab === 'stages' && canManageStages && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Kanban size={20} color="var(--primary)" />
                <span>Dynamic Lead Stages</span>
              </h3>
              <p className="text-muted font-sm" style={{ margin: '0.25rem 0 0 0' }}>
                Manage stages, display order, colors, and active visibility in real-time across the pipeline.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleOpenCreateStage}
            >
              <Plus size={16} />
              <span>Add New Stage</span>
            </button>
          </div>

          <div className="table-responsive embedded">
            <table className="crm-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Order</th>
                  <th>Stage Name</th>
                  <th>Description</th>
                  <th>Color</th>
                  <th>Active</th>
                  <th>Leads Count</th>
                  <th>System</th>
                  <th className="table-action-col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingStages ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)' }}>
                      Loading lead stages...
                    </td>
                  </tr>
                ) : (
                  stages.map((st, idx) => (
                  <tr key={st.id} style={{ opacity: st.is_active ? 1 : 0.65 }}>
                    <td>
                      <span className="font-semibold text-main font-sm" style={{ padding: '0.25rem 0.5rem', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)' }}>
                        {st.display_order}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <span
                          style={{
                            width: '14px',
                            height: '14px',
                            borderRadius: '50%',
                            backgroundColor: st.color,
                            boxShadow: `0 0 8px ${st.color}88`,
                            display: 'inline-block',
                            flexShrink: 0
                          }}
                        />
                        <span className="font-semibold text-main">{st.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-dim font-sm">
                        {st.description || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="font-mono font-sm text-dim" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <code>{st.color}</code>
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${st.is_active ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>
                        {st.is_active ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>
                      <span className="tab-badge" style={{ fontWeight: 600 }}>
                        {st.leads_count || 0} leads
                      </span>
                    </td>
                    <td>
                      {st.is_system ? (
                        <span className="contact-item font-sm" style={{ color: 'var(--primary-light)', fontWeight: 600 }}>
                          <Lock size={13} /> System
                        </span>
                      ) : (
                        <span className="text-dim font-sm">Custom</span>
                      )}
                    </td>
                    <td className="table-action-col">
                      <div className="action-buttons-group" style={{ justifyContent: 'flex-end', gap: '0.35rem' }}>
                        {/* Move Up */}
                        <button
                          type="button"
                          className="icon-action-btn"
                          title="Move Up"
                          aria-label={`Move stage ${st.name} up`}
                          disabled={idx === 0}
                          onClick={() => handleMoveStage(st, 'up')}
                        >
                          <ArrowUp size={15} />
                        </button>

                        {/* Move Down */}
                        <button
                          type="button"
                          className="icon-action-btn"
                          title="Move Down"
                          aria-label={`Move stage ${st.name} down`}
                          disabled={idx === stages.length - 1}
                          onClick={() => handleMoveStage(st, 'down')}
                        >
                          <ArrowDown size={15} />
                        </button>

                        {/* Edit / Rename */}
                        <button
                          type="button"
                          className="icon-action-btn"
                          title="Edit Stage"
                          aria-label={`Edit stage ${st.name}`}
                          onClick={() => handleOpenEditStage(st)}
                        >
                          <Edit size={15} />
                        </button>

                        {/* Toggle Active */}
                        <button
                          type="button"
                          className="icon-action-btn"
                          title={st.is_active ? 'Deactivate Stage' : 'Activate Stage'}
                          aria-label={`${st.is_active ? 'Deactivate' : 'Activate'} stage ${st.name}`}
                          onClick={() => handleToggleStageActive(st)}
                          style={{ color: st.is_active ? 'var(--warning)' : 'var(--success)' }}
                        >
                          <Power size={15} />
                        </button>

                        {/* Delete Safely */}
                        <button
                          type="button"
                          className="icon-action-btn icon-delete"
                          title={st.is_system ? 'System stages cannot be deleted' : 'Delete Stage'}
                          aria-label={`Delete stage ${st.name}`}
                          disabled={st.is_system}
                          onClick={() => handleOpenDeleteStage(st)}
                          style={{ opacity: st.is_system ? 0.35 : 1 }}
                        >
                          <Trash2 size={15} />
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
      )}

      {/* TAB 2: PERSONAL PROFILE & SECURITY */}
      {activeTab === 'profile' && (
        <div className="settings-layout-grid">
          {/* Profile Card */}
          <div className="card">
            <h3 style={{ fontSize: '1.125rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              My Profile
            </h3>

            <form onSubmit={handleProfileSubmit} className="form-layout">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="settings-fname">First Name</label>
                  <input
                    id="settings-fname"
                    type="text"
                    className="form-control"
                    value={profileData.first_name}
                    onChange={(e) => setProfileData({ ...profileData, first_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="settings-lname">Last Name</label>
                  <input
                    id="settings-lname"
                    type="text"
                    className="form-control"
                    value={profileData.last_name}
                    onChange={(e) => setProfileData({ ...profileData, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address (Read-only)</label>
                <input
                  type="email"
                  className="form-control"
                  value={user?.email || ''}
                  disabled
                  style={{ opacity: 0.7 }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="settings-phone">Phone Number</label>
                <input
                  id="settings-phone"
                  type="tel"
                  className="form-control"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">System Role</label>
                <div className="contact-item font-semibold" style={{ color: 'var(--primary-light)' }}>
                  <Shield size={16} />
                  <span>{ROLE_LABELS[user?.role] || user?.role}</span>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" disabled={savingProfile} style={{ alignSelf: 'flex-start' }}>
                <Save size={16} />
                <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
              </button>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <KeyRound size={20} color="var(--primary)" />
              <h3 style={{ fontSize: '1.125rem', margin: 0 }}>
                Change Password
              </h3>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="form-layout">
              <div className="form-group">
                <label className="form-label" htmlFor="current-password">Current Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="current-password"
                    type={showOldPassword ? 'text' : 'password'}
                    className="form-control"
                    placeholder="Enter current password"
                    value={passwordData.old_password}
                    onChange={(e) => setPasswordData({ ...passwordData, old_password: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '0.25rem',
                    }}
                    aria-label="Toggle current password visibility"
                  >
                    {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-password">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    className="form-control"
                    placeholder="At least 6 characters"
                    value={passwordData.new_password}
                    onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '0.25rem',
                    }}
                    aria-label="Toggle new password visibility"
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="confirm-password">Confirm New Password</label>
                <input
                  id="confirm-password"
                  type="password"
                  className="form-control"
                  placeholder="Re-enter new password"
                  value={passwordData.confirm_new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_new_password: e.target.value })}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={changingPassword || !passwordData.old_password || !passwordData.new_password}
                style={{ alignSelf: 'flex-start' }}
              >
                <KeyRound size={16} />
                <span>{changingPassword ? 'Updating Password...' : 'Update Password'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: LEAD SOURCES */}
      {activeTab === 'sources' && canManageSources && (
        <div className="card">
          <h3 style={{ fontSize: '1.125rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
            Lead Sources & Channels
          </h3>

          <form onSubmit={handleCreateSource} className="form-layout mb-4" style={{ marginBottom: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="new-source-name">Add New Source</label>
              <input
                id="new-source-name"
                type="text"
                className="form-control"
                placeholder="e.g. TikTok Ads, Trade Show 2026..."
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <input
                type="text"
                className="form-control"
                placeholder="Optional brief description..."
                value={newSourceDesc}
                onChange={(e) => setNewSourceDesc(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-secondary"
              disabled={addingSource || !newSourceName.trim()}
              style={{ alignSelf: 'flex-start' }}
            >
              <Plus size={16} />
              <span>{addingSource ? 'Adding...' : 'Add Source'}</span>
            </button>
          </form>

          <h4 style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Active Lead Sources
          </h4>

          <div className="notes-feed" style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {sources.map((src) => (
              <div key={src.id} className="note-card" style={{ padding: '0.75rem 1rem' }}>
                <div className="note-card-header" style={{ marginBottom: 0 }}>
                  <strong className="text-main">{src.name}</strong>
                  <span className="tab-badge">{src.leads_count || 0} leads</span>
                </div>
                {src.description && (
                  <span className="text-dim font-sm" style={{ display: 'block', marginTop: '0.25rem' }}>
                    {src.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE STAGE MODAL */}
      {createStageModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-container" ref={createStageDialogRef} role="dialog" aria-modal="true" aria-label="Add new lead stage">
            <div className="modal-header">
              <div className="modal-title-row">
                <Kanban size={20} color="var(--primary)" />
                <h3>Add New Lead Stage</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setCreateStageModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStageSubmit}>
              <div className="modal-body form-layout">
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="stage-name">
                    Stage Name
                  </label>
                  <input
                    id="stage-name"
                    type="text"
                    className="form-control"
                    placeholder="e.g. Proposal Sent"
                    value={stageFormData.name}
                    onChange={(e) => setStageFormData({ ...stageFormData, name: e.target.value })}
                    required
                  />
                  {stageFormErrors.name && (
                    <span className="form-error-msg">{stageFormErrors.name}</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="stage-desc">
                    Description
                  </label>
                  <textarea
                    id="stage-desc"
                    className="form-control"
                    rows={2}
                    placeholder="e.g. Proposal has been sent to the lead"
                    value={stageFormData.description}
                    onChange={(e) => setStageFormData({ ...stageFormData, description: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="stage-color">
                      Color
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="color"
                        value={stageFormData.color}
                        onChange={(e) => setStageFormData({ ...stageFormData, color: e.target.value })}
                        style={{
                          width: '42px',
                          height: '38px',
                          padding: '0.1rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          background: 'none'
                        }}
                      />
                      <input
                        id="stage-color"
                        type="text"
                        className="form-control"
                        value={stageFormData.color}
                        onChange={(e) => setStageFormData({ ...stageFormData, color: e.target.value })}
                        placeholder="#6366F1"
                      />
                    </div>
                    {stageFormErrors.color && (
                      <span className="form-error-msg">{stageFormErrors.color}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="stage-order">
                      Display Order
                    </label>
                    <input
                      id="stage-order"
                      type="number"
                      min={1}
                      className="form-control"
                      value={stageFormData.display_order}
                      onChange={(e) => setStageFormData({ ...stageFormData, display_order: e.target.value })}
                      required
                    />
                    {stageFormErrors.display_order && (
                      <span className="form-error-msg">{stageFormErrors.display_order}</span>
                    )}
                  </div>
                </div>

                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <input
                    id="stage-active"
                    type="checkbox"
                    checked={stageFormData.is_active}
                    onChange={(e) => setStageFormData({ ...stageFormData, is_active: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="stage-active" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                    Active (visible in pipeline and lead forms)
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setCreateStageModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingStage}
                >
                  {submittingStage ? 'Creating Stage...' : 'Create Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT / RENAME STAGE MODAL */}
      {editStageModalOpen && stageToEdit && (
        <div className="modal-backdrop">
          <div className="modal-container" ref={editStageDialogRef} role="dialog" aria-modal="true" aria-label="Edit lead stage">
            <div className="modal-header">
              <div className="modal-title-row">
                <Edit size={20} color="var(--primary)" />
                <h3>Edit Stage: {stageToEdit.name}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditStageModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditStageSubmit}>
              <div className="modal-body form-layout">
                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="edit-stage-name">
                    Stage Name
                  </label>
                  <input
                    id="edit-stage-name"
                    type="text"
                    className="form-control"
                    value={stageToEdit.name}
                    onChange={(e) => setStageToEdit({ ...stageToEdit, name: e.target.value })}
                    required
                  />
                  {stageFormErrors.name && (
                    <span className="form-error-msg">{stageFormErrors.name}</span>
                  )}
                  <span className="text-dim font-sm" style={{ marginTop: '0.25rem' }}>
                    Renaming preserves existing leads without breaking their stage relationship.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-stage-desc">
                    Description
                  </label>
                  <textarea
                    id="edit-stage-desc"
                    className="form-control"
                    rows={2}
                    value={stageToEdit.description}
                    onChange={(e) => setStageToEdit({ ...stageToEdit, description: e.target.value })}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-stage-color">
                      Color
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="color"
                        value={stageToEdit.color}
                        onChange={(e) => setStageToEdit({ ...stageToEdit, color: e.target.value })}
                        style={{
                          width: '42px',
                          height: '38px',
                          padding: '0.1rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          background: 'none'
                        }}
                      />
                      <input
                        id="edit-stage-color"
                        type="text"
                        className="form-control"
                        value={stageToEdit.color}
                        onChange={(e) => setStageToEdit({ ...stageToEdit, color: e.target.value })}
                      />
                    </div>
                    {stageFormErrors.color && (
                      <span className="form-error-msg">{stageFormErrors.color}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="edit-stage-order">
                      Display Order
                    </label>
                    <input
                      id="edit-stage-order"
                      type="number"
                      min={1}
                      className="form-control"
                      value={stageToEdit.display_order}
                      onChange={(e) => setStageToEdit({ ...stageToEdit, display_order: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <input
                    id="edit-stage-active"
                    type="checkbox"
                    checked={stageToEdit.is_active}
                    onChange={(e) => setStageToEdit({ ...stageToEdit, is_active: e.target.checked })}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="edit-stage-active" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
                    Active (accessible in new lead dropdowns and pipeline)
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditStageModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editingStage}
                >
                  {editingStage ? 'Saving Changes...' : 'Save Stage'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SAFE DELETE / MIGRATE STAGE MODAL */}
      {deleteStageModalOpen && stageToDelete && (
        <div className="modal-backdrop">
          <div className="modal-container" ref={deleteStageDialogRef} role="dialog" aria-modal="true" aria-label="Delete lead stage">
            <div className="modal-header">
              <div className="modal-title-row">
                <AlertTriangle size={20} color="var(--danger)" />
                <h3>Delete Stage: {stageToDelete.name}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDeleteStageModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body form-layout">
              {stageToDelete.leads_count > 0 ? (
                <>
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.25)', marginBottom: '1rem' }}>
                    <p style={{ margin: 0, fontWeight: 600, color: 'var(--danger)' }}>
                      This stage is currently used by {stageToDelete.leads_count} lead{stageToDelete.leads_count > 1 ? 's' : ''}.
                    </p>
                    <p className="text-dim font-sm" style={{ margin: '0.5rem 0 0 0' }}>
                      To safely delete this stage without losing data, select another active stage to transfer these leads to.
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label form-label-required" htmlFor="replacement-stage">
                      Move leads to:
                    </label>
                    <select
                      id="replacement-stage"
                      className="form-control"
                      value={replacementStageId}
                      onChange={(e) => setReplacementStageId(e.target.value)}
                      required
                    >
                      <option value="">Select replacement stage</option>
                      {stages
                        .filter((s) => s.id !== stageToDelete.id && s.is_active)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} (Order: {s.display_order})
                          </option>
                        ))}
                    </select>
                  </div>
                </>
              ) : (
                <p style={{ margin: 0, color: 'var(--text-main)' }}>
                  Are you sure you want to permanently delete stage <strong>{stageToDelete.name}</strong>?
                  There are no leads currently assigned to this stage.
                </p>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteStageModalOpen(false)}
                disabled={deletingStage}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDeleteStage}
                disabled={deletingStage || (stageToDelete.leads_count > 0 && !replacementStageId)}
              >
                {deletingStage
                  ? 'Deleting...'
                  : stageToDelete.leads_count > 0
                  ? 'Move & Delete'
                  : 'Delete Stage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: ICP QUALIFICATION QUESTIONS (Admin / Manager) */}
      {activeTab === 'icp' && canManageIcp && <IcpQuestionsManager />}
    </div>
  );
};
