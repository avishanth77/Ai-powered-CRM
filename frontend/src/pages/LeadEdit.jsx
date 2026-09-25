import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { leadApi } from '../api/leadApi';
import { userApi } from '../api/userApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage, isValidEmail, isValidPhone } from '../utils/validation';
import { LEAD_STATUS, LEAD_PRIORITY } from '../utils/constants';
import { LoadingSpinner } from '../components/LoadingSpinner';
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchData = async () => {
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

        setFormData({
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
        });

        setSources(sourcesRes.results || (Array.isArray(sourcesRes) ? sourcesRes : []));

        if (canAssignLeads) {
          const usersRes = await userApi.getUsers();
          setUsers(usersRes.results || (Array.isArray(usersRes) ? usersRes : []));
        }
      } catch (err) {
        showToast(extractErrorMessage(err, 'Failed to load lead details'), 'error');
        navigate('/leads');
      } finally {
        setInitialLoading(false);
      }
    };

    fetchData();
  }, [id, canAssignLeads, navigate, showToast]);

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

    if (parseFloat(formData.expected_value) < 0) {
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
        setErrors(err.response.data.errors);
      }
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return <LoadingSpinner text="Loading lead information..." />;
  }

  return (
    <div className="lead-form-page">
      <div className="page-header">
        <div>
          <Link to={`/leads/${id}`} className="contact-item mb-2" style={{ marginBottom: '0.5rem' }}>
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
              />
              {errors.name && <span className="form-error-msg">{errors.name}</span>}
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
              />
              {errors.phone && <span className="form-error-msg">{errors.phone}</span>}
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
              />
              {errors.email && <span className="form-error-msg">{errors.email}</span>}
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
              >
                {stages.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              {errors.stage && <span className="form-error-msg">{errors.stage}</span>}
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
              />
              {errors.expected_value && <span className="form-error-msg">{errors.expected_value}</span>}
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
              />
              {errors.lost_reason && <span className="form-error-msg">{errors.lost_reason}</span>}
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
              rows={2}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <Link to={`/leads/${id}`} className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={18} />
              <span>{saving ? 'Updating...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
