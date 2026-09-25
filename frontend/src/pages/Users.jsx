import React, { useState, useEffect } from 'react';
import { userApi } from '../api/userApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/formatters';
import { extractErrorMessage, isValidEmail } from '../utils/validation';
import { USER_ROLES, ROLE_LABELS } from '../utils/constants';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { UserCog, UserPlus, Shield, Phone, Mail, Check, X } from 'lucide-react';

export const Users = () => {
  const { user: currentUser, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create user modal
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

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await userApi.getUsers();
      setUsers(res.results || res);
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to fetch users'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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
      showToast('User created successfully!', 'success');
      setModalOpen(false);
      setFormData({
        email: '',
        first_name: '',
        last_name: '',
        phone: '',
        role: USER_ROLES.EXECUTIVE,
        password: '',
      });
      fetchUsers();
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to create user');
      showToast(msg, 'error');
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <UserCog size={26} />
            <span>User Management</span>
          </h1>
          <p className="page-subtitle">
            Manage sales team accounts, roles, and system access permissions
          </p>
        </div>

        {isAdmin && (
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setModalOpen(true)}
            >
              <UserPlus size={16} />
              <span>Add New User</span>
            </button>
          </div>
        )}
      </div>

      <div className="table-responsive">
        {loading ? (
          <LoadingSpinner text="Retrieving team members..." />
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
                      className="status-badge"
                      style={{
                        color:
                          u.role === 'ADMIN'
                            ? '#a855f7'
                            : u.role === 'MANAGER'
                            ? '#38bdf8'
                            : '#34d399',
                        backgroundColor:
                          u.role === 'ADMIN'
                            ? 'rgba(168, 85, 247, 0.12)'
                            : u.role === 'MANAGER'
                            ? 'rgba(56, 189, 248, 0.12)'
                            : 'rgba(52, 211, 153, 0.12)',
                      }}
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add User Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New User Account</h3>
              <button className="modal-close-btn" onClick={() => setModalOpen(false)}>✕</button>
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
                      value={formData.last_name}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="user-email">Email Address</label>
                  <input
                    id="user-email"
                    name="email"
                    type="email"
                    className="form-control"
                    placeholder="rep@company.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                  {errors.email && <span className="form-error-msg">{errors.email}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="user-phone">Phone Number</label>
                  <input
                    id="user-phone"
                    name="phone"
                    type="tel"
                    className="form-control"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label form-label-required" htmlFor="user-role">System Role</label>
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
                  <label className="form-label form-label-required" htmlFor="user-password">Initial Password</label>
                  <input
                    id="user-password"
                    name="password"
                    type="password"
                    className="form-control"
                    placeholder="At least 6 characters"
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                  {errors.password && <span className="form-error-msg">{errors.password}</span>}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
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
