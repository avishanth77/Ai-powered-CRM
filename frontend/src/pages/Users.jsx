import React, { useState, useEffect } from 'react';
import { userApi } from '../api/userApi';
import { targetApi } from '../api/targetApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate, formatCurrency } from '../utils/formatters';
import { extractErrorMessage, normalizeServerErrors, isValidEmail } from '../utils/validation';
import { FieldError } from '../components/FieldError';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { USER_ROLES, ROLE_LABELS } from '../utils/constants';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { Pagination } from '../components/Pagination';
import { StaffTargetModal } from '../components/StaffTargetModal';
import { StaffTargetCard } from '../components/StaffTargetCard';
import {
  UserCog,
  UserPlus,
  Shield,
  Phone,
  Mail,
  Target,
  Users as UsersIcon,
  Calendar,
  Sparkles,
  Briefcase,
  PhoneCall,
  IndianRupee,
  Settings,
} from 'lucide-react';

export const Users = () => {
  const { isAdmin, isManagerOrAdmin } = useAuth();
  const { showToast } = useToast();

  const getCurrentMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  // Tab State: 'directory' | 'targets'
  const [activeTab, setActiveTab] = useState('directory');

  // Directory State
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 20;

  // Staff Targets State
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthStr());
  const [teamOverview, setTeamOverview] = useState(null);
  const [targetsLoading, setTargetsLoading] = useState(false);

  // Target Modal State
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [selectedStaffUser, setSelectedStaffUser] = useState(null);
  const [selectedExistingTarget, setSelectedExistingTarget] = useState(null);

  // Create User Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    first_name: '',
    last_name: '',
    phone: '',
    role: USER_ROLES.EXECUTIVE,
    password: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const inviteDialogRef = useDialogA11y(modalOpen, () => setModalOpen(false));

  const fetchUsers = async (page = 1) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await userApi.getUsers({ page, page_size: pageSize });
      const list = res.results || (Array.isArray(res) ? res : []);
      setUsers(Array.isArray(list) ? list : []);
      setTotalCount(res.count ?? (Array.isArray(res) ? res.length : 0));
      setCurrentPage(page);
    } catch (err) {
      setLoadError(extractErrorMessage(err, 'Failed to fetch users'));
      showToast(extractErrorMessage(err, 'Failed to fetch users'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamTargets = async (monthToFetch = selectedMonth) => {
    setTargetsLoading(true);
    try {
      const res = await targetApi.getTeamOverview({ month: monthToFetch });
      if (res.success && res.data) {
        setTeamOverview(res.data);
      }
    } catch (err) {
      // Non-blocking fallback
    } finally {
      setTargetsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
    fetchTeamTargets(selectedMonth);
  }, []);

  const handleMonthChange = (e) => {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    fetchTeamTargets(newMonth);
  };

  const handleOpenTargetModal = (staffUser, targetReport = null) => {
    setSelectedStaffUser(staffUser);
    setSelectedExistingTarget(targetReport);
    setTargetModalOpen(true);
  };

  const handleTargetSaved = () => {
    fetchTeamTargets(selectedMonth);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!formData.email || !isValidEmail(formData.email)) {
      setErrors({ email: 'Please provide a valid email.' });
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setErrors({ password: 'Password must be at least 6 characters.' });
      return;
    }

    setSaving(true);
    try {
      await userApi.createUser(formData);
      showToast('User account successfully created!', 'success');
      setModalOpen(false);
      setFormData({
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        role: USER_ROLES.EXECUTIVE,
        password: '',
      });
      fetchUsers(1);
      fetchTeamTargets(selectedMonth);
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to create user account');
      showToast(msg, 'error');
      if (err.response?.data?.errors) {
        const { fieldErrors, summary } = normalizeServerErrors(err.response.data.errors);
        setErrors(fieldErrors);
        if (summary.length > 0) {
          showToast(summary.join(' '), 'error');
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const teamAggregates = teamOverview?.team_aggregates || {
    daily_calls: { actual: 0, target: 0, percentage: 0 },
    daily_leads: { actual: 0, target: 0, percentage: 0 },
    monthly_deals: { actual: 0, target: 0, percentage: 0 },
    monthly_revenue: { actual: 0, target: 0, percentage: 0 },
  };

  const leaderboard = teamOverview?.leaderboard || [];

  return (
    <div className="users-page">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 className="page-title">
            <UserCog size={26} color="var(--primary)" />
            <span>Staff & Target Management</span>
          </h1>
          <p className="page-subtitle">
            Manage sales team accounts, customize daily & monthly targets, and track rep performance
          </p>
        </div>

        {isAdmin && (
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <UserPlus size={16} />
              <span>Add New User</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs Navigation */}
      <div className="targets-tab-nav">
        <button
          type="button"
          className={`targets-tab-btn ${activeTab === 'directory' ? 'active' : ''}`}
          onClick={() => setActiveTab('directory')}
        >
          <UsersIcon size={16} />
          <span>Team Directory</span>
          <span className="badge" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
            {totalCount || users.length}
          </span>
        </button>

        <button
          type="button"
          className={`targets-tab-btn ${activeTab === 'targets' ? 'active' : ''}`}
          onClick={() => setActiveTab('targets')}
        >
          <Target size={16} />
          <span>Staff Sales Targets & Quotas</span>
          <span className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem' }}>
            {selectedMonth}
          </span>
        </button>
      </div>

      {/* TAB 1: TEAM DIRECTORY */}
      {activeTab === 'directory' && (
        <>
          <div className="table-responsive">
            {loading ? (
              <LoadingSpinner text="Retrieving team members..." />
            ) : loadError ? (
              <EmptyState
                title="Could not load users"
                message={loadError}
                actionLabel="Retry"
                onAction={() => fetchUsers(currentPage)}
              />
            ) : users.length === 0 ? (
              <EmptyState title="No users found" message="No user accounts registered." />
            ) : (
              <table className="crm-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Joined</th>
                    {isManagerOrAdmin && <th style={{ textAlign: 'right' }}>Target Management</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="lead-name-cell">
                          <span className="lead-primary-name">
                            {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.email.split('@')[0]}
                          </span>
                        </div>
                      </td>
                      <td className="table-truncate-cell">
                        <span className="contact-item">
                          <Mail size={13} className="text-dim" /> {u.email}
                        </span>
                      </td>
                      <td>
                        <span className="contact-item">
                          <Phone size={13} className="text-dim" /> {u.phone || '—'}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            u.role === 'ADMIN'
                              ? 'badge-purple'
                              : u.role === 'MANAGER'
                              ? 'badge-primary'
                              : 'badge-success'
                          }`}
                        >
                          <Shield size={12} />
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td>
                        {u.is_active ? (
                          <span className="text-success font-semibold font-sm" style={{ color: 'var(--success)' }}>
                            Active
                          </span>
                        ) : (
                          <span className="text-dim font-sm">Inactive</span>
                        )}
                      </td>
                      <td>
                        <span className="text-dim font-sm">{formatDate(u.created_at)}</span>
                      </td>
                      {isManagerOrAdmin && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs"
                            onClick={() => handleOpenTargetModal(u)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                          >
                            <Target size={13} color="var(--primary)" />
                            <span>Set Target</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!loading && !loadError && users.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={(page) => fetchUsers(page)}
            />
          )}
        </>
      )}

      {/* TAB 2: STAFF SALES TARGETS & PERFORMANCE */}
      {activeTab === 'targets' && (
        <div>
          {/* Top Month Filter Bar */}
          <div className="targets-overview-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(99, 102, 241, 0.12)',
                  color: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Target size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Team Target Quotas & Real-Time Pacing
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Admin-customized daily and monthly performance metrics for sales staff
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label htmlFor="select-target-month" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Target Period:
              </label>
              <input
                id="select-target-month"
                type="month"
                className="form-control"
                style={{ width: 'auto', height: '34px', fontSize: '0.85rem' }}
                value={selectedMonth}
                onChange={handleMonthChange}
              />
            </div>
          </div>

          {/* Team Aggregates Summary Cards */}
          <div className="targets-kpi-grid">
            {/* KPI 1: Team Daily Calls */}
            <div className="kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-label">Team Calls Today</span>
                <div className="kpi-icon-circle" style={{ color: '#0284c7' }}><PhoneCall size={18} /></div>
              </div>
              <div className="kpi-value">
                {teamAggregates.daily_calls.actual}
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>
                  / {teamAggregates.daily_calls.target}
                </span>
              </div>
              <div className="kpi-meta text-muted">
                <span>{teamAggregates.daily_calls.percentage}% Daily Target Achieved</span>
              </div>
            </div>

            {/* KPI 2: Team Daily Leads */}
            <div className="kpi-card kpi-card-info">
              <div className="kpi-card-header">
                <span className="kpi-label">Team Leads Handled Today</span>
                <div className="kpi-icon-circle" style={{ color: '#10b981' }}><Sparkles size={18} /></div>
              </div>
              <div className="kpi-value">
                {teamAggregates.daily_leads.actual}
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>
                  / {teamAggregates.daily_leads.target}
                </span>
              </div>
              <div className="kpi-meta text-muted">
                <span>{teamAggregates.daily_leads.percentage}% Daily Outreach Target</span>
              </div>
            </div>

            {/* KPI 3: Team Deals Won */}
            <div className="kpi-card kpi-card-success">
              <div className="kpi-card-header">
                <span className="kpi-label">Monthly Deals Won</span>
                <div className="kpi-icon-circle" style={{ color: '#8b5cf6' }}><Briefcase size={18} /></div>
              </div>
              <div className="kpi-value">
                {teamAggregates.monthly_deals.actual}
                <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>
                  / {teamAggregates.monthly_deals.target}
                </span>
              </div>
              <div className="kpi-meta text-muted">
                <span>{teamAggregates.monthly_deals.percentage}% Monthly Closed Won Quota</span>
              </div>
            </div>

            {/* KPI 4: Team Monthly Revenue */}
            <div className="kpi-card">
              <div className="kpi-card-header">
                <span className="kpi-label">Monthly Revenue Quota</span>
                <div className="kpi-icon-circle" style={{ color: '#10b981' }}><IndianRupee size={18} /></div>
              </div>
              <div className="kpi-value">
                {formatCurrency(teamAggregates.monthly_revenue.actual)}
              </div>
              <div className="kpi-meta text-muted">
                <span>Quota: {formatCurrency(teamAggregates.monthly_revenue.target)} ({teamAggregates.monthly_revenue.percentage}%)</span>
              </div>
            </div>
          </div>

          {/* Staff Target Cards Grid */}
          {targetsLoading ? (
            <LoadingSpinner text="Calculating live target progress..." />
          ) : leaderboard.length === 0 ? (
            <EmptyState
              title="No Staff Targets Found"
              message="No sales staff accounts available to assign targets."
            />
          ) : (
            <div className="targets-team-grid">
              {leaderboard.map((rep) => (
                <StaffTargetCard
                  key={rep.user_id}
                  report={rep}
                  canManage={isManagerOrAdmin}
                  onEditTarget={() => {
                    const matchedUser = users.find((u) => u.id === rep.user_id) || {
                      id: rep.user_id,
                      first_name: rep.user_name,
                      email: rep.user_email,
                      role: rep.user_role,
                    };
                    handleOpenTargetModal(matchedUser, rep);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Target Setting Modal */}
      {targetModalOpen && selectedStaffUser && (
        <StaffTargetModal
          isOpen={targetModalOpen}
          onClose={() => {
            setTargetModalOpen(false);
            setSelectedStaffUser(null);
            setSelectedExistingTarget(null);
          }}
          staffUser={selectedStaffUser}
          initialPeriodMonth={selectedMonth}
          existingTarget={selectedExistingTarget}
          onSuccess={handleTargetSaved}
        />
      )}

      {/* Add User Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div
            className="modal-container"
            ref={inviteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Create new user account"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-row">
                <UserPlus size={20} color="var(--primary)" />
                <h3 style={{ margin: 0 }}>Create New User Account</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setModalOpen(false)}
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body form-layout">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="user-fname">First Name</label>
                    <input
                      id="user-fname"
                      name="first_name"
                      type="text"
                      className="form-control"
                      placeholder="e.g. John"
                      value={formData.first_name}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="user-lname">Last Name</label>
                    <input
                      id="user-lname"
                      name="last_name"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Doe"
                      value={formData.last_name}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="user-email">
                    Email Address
                  </label>
                  <input
                    id="user-email"
                    name="email"
                    type="email"
                    className={`form-control ${errors.email ? 'border-danger' : ''}`}
                    placeholder="john.doe@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                  <FieldError id="user-email-error" message={errors.email} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="user-phone">Phone Number</label>
                  <input
                    id="user-phone"
                    name="phone"
                    type="tel"
                    className="form-control"
                    placeholder="+91 9876543210"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="user-role">Role</label>
                  <select
                    id="user-role"
                    name="role"
                    className="form-control"
                    value={formData.role}
                    onChange={handleChange}
                  >
                    <option value={USER_ROLES.EXECUTIVE}>Sales Executive / Intern</option>
                    <option value={USER_ROLES.MANAGER}>Sales Manager</option>
                    <option value={USER_ROLES.ADMIN}>Admin / Mentor</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="user-password">
                    Temporary Password
                  </label>
                  <input
                    id="user-password"
                    name="password"
                    type="password"
                    className={`form-control ${errors.password ? 'border-danger' : ''}`}
                    placeholder="Minimum 6 characters"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                  <FieldError id="user-password-error" message={errors.password} />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
