import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { leadApi } from '../api/leadApi';
import { userApi } from '../api/userApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage, normalizeServerErrors, isValidEmail, isValidPhone } from '../utils/validation';
import { FieldError } from '../components/FieldError';
import { LEAD_PRIORITY } from '../utils/constants';
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
    stage: '',
    priority: LEAD_PRIORITY.MEDIUM,
    assigned_to: user?.id || '',
    expected_value: '0.00',
    address: '',
    lost_reason: '',
  });

  const [stages, setStages] = useState([]);
  const [sources, setSources] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    // Load dynamic lead stages
    leadApi
      .getStages()
      .then((res) => {
        const stageList = res.results || (Array.isArray(res) ? res : []);
        setStages(stageList);
        if (stageList.length > 0) {
          const defaultStage = stageList.find((s) => s.slug === 'new') || stageList[0];
          setFormData((prev) => ({ ...prev, stage: prev.stage || defaultStage.id }));
        }
      })
      .catch(() => {});

    // Load sources
    leadApi
      .getSources()
      .then((res) => setSources(res.results || (Array.isArray(res) ? res : [])))
      .catch(() => {});

    // Load users if manager/admin
    if (canAssignLeads) {
      userApi
        .getUsers()
        .then((res) => setUsers(res.results || (Array.isArray(res) ? res : [])))
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

  const selectedStageObj = stages.find((s) => s.id === parseInt(formData.stage));
  const isLostStage = selectedStageObj && (selectedStageObj.slug === 'lost' || selectedStageObj.name.toLowerCase() === 'lost');

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

    const expectedNum = parseFloat(formData.expected_value);
    if (Number.isNaN(expectedNum)) {
      newErrors.expected_value = 'Please enter a valid deal value.';
    } else if (expectedNum < 0) {
      newErrors.expected_value = 'Expected value cannot be negative.';
    }

    if (isLostStage && !formData.lost_reason.trim()) {
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
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim() || null,
        company_name: formData.company_name.trim() || null,
        source: formData.source ? parseInt(formData.source) : null,
        stage: formData.stage ? parseInt(formData.stage) : null,
        priority: formData.priority,
        assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : null,
        expected_value: parseFloat(formData.expected_value) || 0,
        address: formData.address.trim() || null,
        lost_reason: isLostStage ? formData.lost_reason.trim() : null,
      };

      const res = await leadApi.createLead(payload);
      showToast(`Lead "${res.name}" successfully created!`, 'success');
      navigate(`/leads/${res.id}`);
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to create lead.');
      showToast(msg, 'error');
      if (err.response?.data?.errors) {
        const { fieldErrors, summary } = normalizeServerErrors(err.response.data.errors);
        setErrors(fieldErrors);
        setFormError(summary.length > 0 ? summary : null);
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
          {formError && (
            <div className="toast-item toast-error" role="alert" style={{ marginBottom: '0.5rem' }}>
              <div className="toast-message">
                {formError.map((msg, i) => (
                  <div key={i}>{msg}</div>
                ))}
              </div>
            </div>
          )}
          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="lead-name">
                Full Name / Contact Person
              </label>
              <input
                id="lead-name"
                name="name"
                type="text"
                className="form-control"
                placeholder="e.g. John Doe"
                value={formData.name}
                onChange={handleChange}
                required
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'lead-name-error' : undefined}
              />
              <FieldError id="lead-name-error" message={errors.name} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="lead-company">
                Company Name
              </label>
              <input
                id="lead-company"
                name="company_name"
                type="text"
                className="form-control"
                placeholder="e.g. Acme Corp (optional)"
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
                placeholder="e.g. +91 9876543210"
                value={formData.phone}
                onChange={handleChange}
                required
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? 'lead-phone-error' : undefined}
              />
              <FieldError id="lead-phone-error" message={errors.phone} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="lead-email">
                Email Address
              </label>
              <input
                id="lead-email"
                name="email"
                type="email"
                className="form-control"
                placeholder="e.g. john@acme.com"
                value={formData.email}
                onChange={handleChange}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'lead-email-error' : undefined}
              />
              <FieldError id="lead-email-error" message={errors.email} />
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
            {/* Dynamic Stage Dropdown */}
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="lead-stage">Lead Stage</label>
              <select
                id="lead-stage"
                name="stage"
                className="form-control"
                value={formData.stage}
                onChange={handleChange}
                required
                aria-invalid={Boolean(errors.stage)}
                aria-describedby={errors.stage ? 'lead-stage-error' : undefined}
              >
                {stages.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              <FieldError id="lead-stage-error" message={errors.stage} />
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
                aria-invalid={Boolean(errors.expected_value)}
                aria-describedby={errors.expected_value ? 'lead-value-error' : undefined}
              />
              <FieldError id="lead-value-error" message={errors.expected_value} />
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
                <option value="">Unassigned</option>
                {users
                  .filter((u) => u.is_active && u.role === 'EXECUTIVE')
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}` : u.email}
                    </option>
                  ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="lead-address">Physical Address / Location</label>
            <textarea
              id="lead-address"
              name="address"
              className="form-control"
              rows={2}
              placeholder="Building, Street, City, State..."
              value={formData.address}
              onChange={handleChange}
            />
          </div>

          {isLostStage && (
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="lead-lost-reason">
                Lost Reason (Mandatory when stage is Lost)
              </label>
              <textarea
                id="lead-lost-reason"
                name="lost_reason"
                className="form-control"
                rows={2}
                placeholder="Reason why this lead was lost..."
                value={formData.lost_reason}
                onChange={handleChange}
                required
                aria-invalid={Boolean(errors.lost_reason)}
                aria-describedby={errors.lost_reason ? 'lead-lost-reason-error' : undefined}
              />
              <FieldError id="lead-lost-reason-error" message={errors.lost_reason} />
            </div>
          )}

          <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Link to="/leads" className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <Save size={16} />
              <span>{loading ? 'Creating...' : 'Create Lead'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
