import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { leadApi } from '../api/leadApi';
import { userApi } from '../api/userApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage, isValidEmail, isValidPhone } from '../utils/validation';
import { LEAD_STATUS, LEAD_PRIORITY } from '../utils/constants';
import { ArrowLeft, Save, UserPlus } from 'lucide-react';

export const LeadCreate = () => {
  const navigate = useNavigate();
  const { user, canAssignLeads } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    company_name: '',
    source: '',
    status: LEAD_STATUS.NEW,
    priority: LEAD_PRIORITY.MEDIUM,
    assigned_to: user?.id || '',
    expected_value: '0.00',
    address: '',
    lost_reason: '',
  });

  const [sources, setSources] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    leadApi
      .getSources()
      .then((res) => setSources(res.results || res))
      .catch(() => {});

    if (canAssignLeads) {
      userApi
        .getUsers()
        .then((res) => setUsers(res.results || res))
        .catch(() => {});
    }
  }, [canAssignLeads]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Contact / Lead name is required.';
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required.';
    } else if (!isValidPhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number (minimum 7 digits).';
    }

    if (formData.email && !isValidEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (parseFloat(formData.expected_value) < 0) {
      newErrors.expected_value = 'Expected value cannot be negative.';
    }

    if (formData.status === LEAD_STATUS.LOST && !formData.lost_reason.trim()) {
      newErrors.lost_reason = 'A reason is required when marking a lead as Lost.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      showToast('Please fix the errors in the form.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        source: formData.source ? parseInt(formData.source) : null,
        assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : null,
        expected_value: parseFloat(formData.expected_value) || 0,
      };

      const res = await leadApi.createLead(payload);
      showToast(`Lead "${res.name}" successfully created!`, 'success');
      navigate(`/leads/${res.id}`);
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to create lead.');
      showToast(msg, 'error');
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lead-form-page">
      <div className="page-header">
        <div>
          <Link to="/leads" className="contact-item mb-2" style={{ marginBottom: '0.5rem' }}>
            <ArrowLeft size={16} /> Back to Leads List
          </Link>
          <h1 className="page-title">
            <UserPlus size={26} />
            <span>Create New Lead</span>
          </h1>
          <p className="page-subtitle">Add a new prospecting client to your pipeline</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '840px' }}>
        <form onSubmit={handleSubmit} className="form-layout">
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="lead-name">
                Full Name
              </label>
              <input
                id="lead-name"
                name="name"
                type="text"
                className="form-control"
                placeholder="e.g. Sarah Jenkins"
                value={formData.name}
                onChange={handleChange}
                required
              />
              {errors.name && <span className="form-error-msg">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="lead-company">Company Name</label>
              <input
                id="lead-company"
                name="company_name"
                type="text"
                className="form-control"
                placeholder="e.g. Acorn Technologies Inc."
                value={formData.company_name}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="lead-phone">
                Phone Number
              </label>
              <input
                id="lead-phone"
                name="phone"
                type="tel"
                className="form-control"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={handleChange}
                required
              />
              {errors.phone && <span className="form-error-msg">{errors.phone}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="lead-email">Email Address</label>
              <input
                id="lead-email"
                name="email"
                type="email"
                className="form-control"
                placeholder="sarah@example.com"
                value={formData.email}
                onChange={handleChange}
              />
              {errors.email && <span className="form-error-msg">{errors.email}</span>}
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="lead-source">Lead Source</label>
              <select
                id="lead-source"
                name="source"
                className="form-control"
                value={formData.source}
                onChange={handleChange}
              >
                <option value="">Select Lead Source</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="lead-priority">Priority</label>
              <select
                id="lead-priority"
                name="priority"
                className="form-control"
                value={formData.priority}
                onChange={handleChange}
              >
                {Object.entries(LEAD_PRIORITY).map(([k, v]) => (
                  <option key={k} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="lead-status">Initial Status</label>
              <select
                id="lead-status"
                name="status"
                className="form-control"
                value={formData.status}
                onChange={handleChange}
              >
                {Object.entries(LEAD_STATUS).map(([k, v]) => (
                  <option key={k} value={v}>
                    {v.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="lead-value">Expected Deal Value (₹)</label>
              <input
                id="lead-value"
                name="expected_value"
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                value={formData.expected_value}
                onChange={handleChange}
              />
              {errors.expected_value && <span className="form-error-msg">{errors.expected_value}</span>}
            </div>
          </div>

          {canAssignLeads && (
            <div className="form-group">
              <label className="form-label" htmlFor="lead-assigned">Assigned Executive / Representative</label>
              <select
                id="lead-assigned"
                name="assigned_to"
                className="form-control"
                value={formData.assigned_to}
                onChange={handleChange}
              >
                <option value="">Select Assignee</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.status === LEAD_STATUS.LOST && (
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="lost-reason">
                Lost Reason
              </label>
              <textarea
                id="lost-reason"
                name="lost_reason"
                className="form-control"
                placeholder="Explain why this lead was lost (e.g. competitor, budget, unresponsive)..."
                value={formData.lost_reason}
                onChange={handleChange}
                required
              />
              {errors.lost_reason && <span className="form-error-msg">{errors.lost_reason}</span>}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="lead-address">Physical / Company Address</label>
            <textarea
              id="lead-address"
              name="address"
              className="form-control"
              placeholder="Suite, Street, City, State, ZIP..."
              value={formData.address}
              onChange={handleChange}
              rows={2}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <Link to="/leads" className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Save size={18} />
              <span>{loading ? 'Creating...' : 'Save Lead'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
