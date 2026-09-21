import React, { useState, useEffect } from 'react';
import { leadApi } from '../api/leadApi';
import { authApi } from '../api/authApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage } from '../utils/validation';
import { ROLE_LABELS } from '../utils/constants';
import { Settings as SettingsIcon, Plus, Save, Compass, Shield, Check } from 'lucide-react';

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

      <div className="dashboard-charts-grid">
        {/* Profile Card */}
        <div className="card col-span-6">
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

        {/* Lead Sources Management (Manager & Admin) */}
        {canManageSources && (
          <div className="card col-span-6">
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
