import React, { useState, useEffect } from 'react';
import { leadApi } from '../api/leadApi';
import { authApi } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/validation';
import { ROLE_LABELS } from '../utils/constants';
import { Settings as SettingsIcon, Plus, Save, Compass, Shield, Check, KeyRound, Eye, EyeOff } from 'lucide-react';

export const Settings = () => {
  const { user, updateUserProfile, canManageSources } = useAuth();
  const { showToast } = useToast();

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

  useEffect(() => {
    if (canManageSources) {
      leadApi
        .getSources()
        .then((res) => setSources(res.results || res))
        .catch(() => {});
    }
  }, [canManageSources]);

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
      leadApi.getSources().then((r) => setSources(r.results || r));
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to add source'), 'error');
    } finally {
      setAddingSource(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <SettingsIcon size={26} />
            <span>Settings & Configuration</span>
          </h1>
          <p className="page-subtitle">
            Manage your personal profile and sales channel sources
          </p>
        </div>
      </div>

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
                    padding: '0.25rem'
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
                    padding: '0.25rem'
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

        {/* Lead Sources Management (Manager & Admin) */}
        {canManageSources && (
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

            <div className="notes-feed" style={{ maxHeight: '240px', overflowY: 'auto' }}>
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
      </div>
    </div>
  );
};
