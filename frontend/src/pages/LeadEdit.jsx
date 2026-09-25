import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { leadApi } from '../api/leadApi';
import { userApi } from '../api/userApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage, normalizeServerErrors, isValidEmail, isValidPhone } from '../utils/validation';
import { FieldError } from '../components/FieldError';
import { LEAD_PRIORITY } from '../utils/constants';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ConfirmModal } from '../components/ConfirmModal';
import { ArrowLeft, Save, Edit3 } from 'lucide-react';

export const LeadEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canAssignLeads } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    company_name: '',
    source: '',
    stage: '',
    priority: '',
    assigned_to: '',
    expected_value: '0.00',
    address: '',
    lost_reason: '',
  });

  const [stages, setStages] = useState([]);
  const [sources, setSources] = useState([]);
  const [users, setUsers] = useState([]);
  const [initialData, setInitialData] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);

  const loadData = async () => {
    setInitialLoading(true);
    setLoadError(null);
    try {
      const [leadRes, sourcesRes, stagesRes] = await Promise.all([
        leadApi.getLeadById(id),
        leadApi.getSources(),
        leadApi.getStages(),
      ]);

      let loadedStages = stagesRes.results || (Array.isArray(stagesRes) ? stagesRes : []);
      // If current lead's stage is inactive and not in loadedStages, add it so it displays
      if (leadRes.stage_details && !loadedStages.some((s) => s.id === leadRes.stage_details.id)) {
        loadedStages = [...loadedStages, { ...leadRes.stage_details, name: `${leadRes.stage_details.name} (Inactive)` }];
      }
      setStages(loadedStages);

      const loaded = {
        name: leadRes.name || '',
        phone: leadRes.phone || '',
        email: leadRes.email || '',
        company_name: leadRes.company_name || '',
        source: leadRes.source || '',
        stage: leadRes.stage || leadRes.stage_details?.id || '',
        priority: leadRes.priority || '',
        assigned_to: leadRes.assigned_to || '',
        expected_value: leadRes.expected_value || '0.00',
        address: leadRes.address || '',
        lost_reason: leadRes.lost_reason || '',
      };
      setFormData(loaded);
      setInitialData(loaded);

      setSources(sourcesRes.results || (Array.isArray(sourcesRes) ? sourcesRes : []));

      if (canAssignLeads) {
        const usersRes = await userApi.getUsers();
        const list = usersRes.results || (Array.isArray(usersRes) ? usersRes : []);
        setUsers(list.filter((u) => u.is_active && u.role === 'EXECUTIVE'));
      }
    } catch (err) {
      setLoadError(extractErrorMessage(err, 'Failed to load lead details'));
      showToast(extractErrorMessage(err, 'Failed to load lead details'), 'error');
    } finally {
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

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

    if (isLostStage && !formData.lost_reason?.trim()) {
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

    setSaving(true);
    try {
      const payload = {
        ...formData,
        stage: formData.stage ? parseInt(formData.stage) : null,
        source: formData.source ? parseInt(formData.source) : null,
        assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : null,
        expected_value: parseFloat(formData.expected_value) || 0,
      };

      await leadApi.updateLead(id, payload);
      showToast('Lead updated successfully!', 'success');
      navigate(`/leads/${id}`);
    } catch (err) {
      const msg = extractErrorMessage(err, 'Failed to update lead.');
      showToast(msg, 'error');
      if (err.response?.data?.errors) {
        const { fieldErrors, summary } = normalizeServerErrors(err.response.data.errors);
        setErrors(fieldErrors);
        setFormError(summary.length > 0 ? summary : null);
      }
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return <LoadingSpinner text="Loading lead information..." />;
  }

  if (loadError) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem', maxWidth: '840px' }}>
        <h3>Unable to load lead</h3>
        <p className="text-muted" style={{ margin: '0.5rem 0 1.5rem' }}>{loadError}</p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-primary" onClick={loadData}>
            Retry
          </button>
          <Link to="/leads" className="btn btn-secondary">
            Back to Leads
          </Link>
        </div>
      </div>
    );
  }

  const isDirty = initialData && JSON.stringify(formData) !== JSON.stringify(initialData);

  const handleCancel = (e) => {
    e.preventDefault();
    if (isDirty) {
      setConfirmCancelOpen(true);
    } else {
      navigate(`/leads/${id}`);
    }
  };

  return (
    <div className="lead-form-page">
      <div className="page-header">
        <div>
          <Link to={`/leads/${id}`} onClick={handleCancel} className="contact-item mb-2" style={{ marginBottom: '0.5rem' }}>
            <ArrowLeft size={16} /> Back to Lead Profile
          </Link>
          <h1 className="page-title">
            <Edit3 size={26} />
            <span>Edit Lead: {formData.name}</span>
          </h1>
          <p className="page-subtitle">Update contact details, assignment, or pipeline status</p>
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
              <label className="form-label form-label-required" htmlFor="edit-name">
                Full Name
              </label>
              <input
                id="edit-name"
                name="name"
                type="text"
                className="form-control"
                value={formData.name}
                onChange={handleChange}
                required
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'edit-name-error' : undefined}
              />
              <FieldError id="edit-name-error" message={errors.name} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-company">Company Name</label>
              <input
                id="edit-company"
                name="company_name"
                type="text"
                className="form-control"
                value={formData.company_name}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="edit-phone">
                Phone Number
              </label>
              <input
                id="edit-phone"
                name="phone"
                type="tel"
                className="form-control"
                value={formData.phone}
                onChange={handleChange}
                required
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? 'edit-phone-error' : undefined}
              />
              <FieldError id="edit-phone-error" message={errors.phone} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-email">Email Address</label>
              <input
                id="edit-email"
                name="email"
                type="email"
                className="form-control"
                value={formData.email}
                onChange={handleChange}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'edit-email-error' : undefined}
              />
              <FieldError id="edit-email-error" message={errors.email} />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="edit-source">Lead Source</label>
              <select
                id="edit-source"
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
              <label className="form-label" htmlFor="edit-priority">Priority</label>
              <select
                id="edit-priority"
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
              <label className="form-label form-label-required" htmlFor="edit-stage">Lead Stage</label>
              <select
                id="edit-stage"
                name="stage"
                className="form-control"
                value={formData.stage}
                onChange={handleChange}
                required
                aria-invalid={Boolean(errors.stage)}
                aria-describedby={errors.stage ? 'edit-stage-error' : undefined}
              >
                {stages.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              <FieldError id="edit-stage-error" message={errors.stage} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-value">Expected Deal Value (₹)</label>
              <input
                id="edit-value"
                name="expected_value"
                type="number"
                step="0.01"
                min="0"
                className="form-control"
                value={formData.expected_value}
                onChange={handleChange}
                aria-invalid={Boolean(errors.expected_value)}
                aria-describedby={errors.expected_value ? 'edit-value-error' : undefined}
              />
              <FieldError id="edit-value-error" message={errors.expected_value} />
            </div>
          </div>

          {canAssignLeads && (
            <div className="form-group">
              <label className="form-label" htmlFor="edit-assigned">Assigned Executive</label>
              <select
                id="edit-assigned"
                name="assigned_to"
                className="form-control"
                value={formData.assigned_to || ''}
                onChange={handleChange}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name || u.email} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {isLostStage && (
            <div className="form-group">
              <label className="form-label form-label-required" htmlFor="edit-lost-reason">
                Lost Reason
              </label>
              <textarea
                id="edit-lost-reason"
                name="lost_reason"
                className="form-control"
                value={formData.lost_reason || ''}
                onChange={handleChange}
                placeholder="Specify why the deal was lost..."
                required
                aria-invalid={Boolean(errors.lost_reason)}
                aria-describedby={errors.lost_reason ? 'edit-lost-reason-error' : undefined}
              />
              <FieldError id="edit-lost-reason-error" message={errors.lost_reason} />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="edit-address">Address</label>
            <textarea
              id="edit-address"
              name="address"
              className="form-control"
              value={formData.address || ''}
              onChange={handleChange}
              placeholder="Street, city, state..."
              rows={2}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={18} />
              <span>{saving ? 'Updating...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={confirmCancelOpen}
        title="Discard unsaved changes?"
        message="You have unsaved edits that will be lost if you leave this page."
        confirmText="Discard Changes"
        cancelText="Keep Editing"
        isDestructive={true}
        onConfirm={() => navigate(`/leads/${id}`)}
        onCancel={() => setConfirmCancelOpen(false)}
      />
    </div>
  );
};
