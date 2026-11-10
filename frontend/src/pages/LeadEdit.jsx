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
import ProductSelector from '../components/ProductSelector';
import { ConfirmModal } from '../components/ConfirmModal';
import { PldAssessmentTest } from '../components/PldAssessmentTest';
import { ArrowLeft, Save, Edit3, Package, User, Building2, Target, DollarSign } from 'lucide-react';

export const LeadEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canAssignLeads } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    first_name: '',
    last_name: '',
    phone: '',
    mobile_phone: '',
    email: '',
    job_title: '',
    department: '',
    linkedin_url: '',
    buying_role: '',
    company_name: '',
    website: '',
    industry: '',
    company_size: '',
    annual_revenue: '',
    country: '',
    state: '',
    city: '',
    address: '',
    lead_score: '0',
    buying_intent: 'MEDIUM',
    estimated_budget: '',
    purchasing_timeline: '',
    decision_maker: '',
    customer_requirements: '',
    competitor_info: '',
    qualification_notes: '',
    lead_type: 'INBOUND',
    expected_close_date: '',
    source: '',
    stage: '',
    priority: '',
    assigned_to: '',
    expected_value: '0.00',
    product_ids: [],
    lost_reason: '',
    win_probability_override: '',
    win_probability_reason: '',
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
  const [pldModalData, setPldModalData] = useState(null);

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
      if (leadRes.stage_details && !loadedStages.some((s) => s.id === leadRes.stage_details.id)) {
        loadedStages = [...loadedStages, { ...leadRes.stage_details, name: `${leadRes.stage_details.name} (Inactive)` }];
      }
      setStages(loadedStages);

      const loaded = {
        name: leadRes.name || '',
        first_name: leadRes.first_name || '',
        last_name: leadRes.last_name || '',
        phone: leadRes.phone || '',
        mobile_phone: leadRes.mobile_phone || '',
        email: leadRes.email || '',
        job_title: leadRes.job_title || '',
        department: leadRes.department || '',
        linkedin_url: leadRes.linkedin_url || '',
        buying_role: leadRes.buying_role || '',
        company_name: leadRes.company_name || '',
        website: leadRes.website || '',
        industry: leadRes.industry || '',
        company_size: leadRes.company_size || '',
        annual_revenue: leadRes.annual_revenue || '',
        country: leadRes.country || '',
        state: leadRes.state || '',
        city: leadRes.city || '',
        address: leadRes.address || '',
        lead_score: leadRes.lead_score !== undefined ? String(leadRes.lead_score) : '0',
        buying_intent: leadRes.buying_intent || 'MEDIUM',
        estimated_budget: leadRes.estimated_budget || '',
        purchasing_timeline: leadRes.purchasing_timeline || '',
        decision_maker: leadRes.decision_maker || '',
        customer_requirements: leadRes.customer_requirements || '',
        competitor_info: leadRes.competitor_info || '',
        qualification_notes: leadRes.qualification_notes || '',
        lead_type: leadRes.lead_type || 'INBOUND',
        expected_close_date: leadRes.expected_close_date || '',
        source: leadRes.source || '',
        stage: leadRes.stage || leadRes.stage_details?.id || '',
        priority: leadRes.priority || '',
        assigned_to: leadRes.assigned_to || '',
        expected_value: leadRes.expected_value || '0.00',
        lost_reason: leadRes.lost_reason || '',
        win_probability_override: leadRes.win_probability_override !== null && leadRes.win_probability_override !== undefined ? leadRes.win_probability_override : '',
        win_probability_reason: leadRes.win_probability_reason || '',
        product_ids: leadRes.product_ids || leadRes.products?.map((p) => p.id) || [],
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
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === 'first_name' || name === 'last_name') {
        const first = name === 'first_name' ? value : prev.first_name;
        const last = name === 'last_name' ? value : prev.last_name;
        if (first || last) {
          updated.name = `${first} ${last}`.trim();
        }
      }
      return updated;
    });

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const selectedStageObj = stages.find((s) => s.id === parseInt(formData.stage));
  const isLostStage = selectedStageObj && (selectedStageObj.slug === 'lost' || selectedStageObj.name.toLowerCase() === 'lost');

  const validateForm = () => {
    const newErrors = {};
    if (formData.phone && !isValidPhone(formData.phone)) {
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
      newErrors.lost_reason = 'Lost reason is mandatory when marking a lead as Lost.';
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
        name: formData.name.trim() || `${formData.first_name} ${formData.last_name}`.trim() || 'Prospect Lead',
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone: formData.phone.trim(),
        mobile_phone: formData.mobile_phone.trim(),
        email: formData.email.trim() || null,
        job_title: formData.job_title.trim(),
        department: formData.department.trim(),
        linkedin_url: formData.linkedin_url.trim() || null,
        buying_role: formData.buying_role || '',
        company_name: formData.company_name.trim() || null,
        website: formData.website.trim() || null,
        industry: formData.industry.trim(),
        company_size: formData.company_size || '',
        annual_revenue: formData.annual_revenue ? parseFloat(formData.annual_revenue) : null,
        country: formData.country.trim(),
        state: formData.state.trim(),
        city: formData.city.trim(),
        address: formData.address.trim() || null,
        lead_score: parseInt(formData.lead_score) || 0,
        buying_intent: formData.buying_intent || 'MEDIUM',
        estimated_budget: formData.estimated_budget ? parseFloat(formData.estimated_budget) : null,
        customer_requirements: formData.customer_requirements.trim(),
        purchasing_timeline: formData.purchasing_timeline || '',
        decision_maker: formData.decision_maker.trim(),
        competitor_info: formData.competitor_info.trim(),
        qualification_notes: formData.qualification_notes.trim(),
        lead_type: formData.lead_type || 'INBOUND',
        expected_close_date: formData.expected_close_date || null,
        stage: formData.stage ? parseInt(formData.stage) : null,
        source: formData.source ? parseInt(formData.source) : null,
        priority: formData.priority,
        assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : null,
        expected_value: parseFloat(formData.expected_value) || 0,
        product_ids: formData.product_ids || [],
        lost_reason: isLostStage ? formData.lost_reason.trim() : null,
        win_probability_override: formData.win_probability_override !== '' && formData.win_probability_override !== null && formData.win_probability_override !== undefined ? parseInt(formData.win_probability_override) : null,
        win_probability_reason: (formData.win_probability_reason || '').trim(),
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
    return <LoadingSpinner text="Loading lead details..." />;
  }

  return (
    <div className="lead-form-page">
      <div className="page-header">
        <div>
          <Link to={`/leads/${id}`} className="contact-item mb-2" style={{ marginBottom: '0.5rem' }}>
            <ArrowLeft size={16} /> Back to Lead Details
          </Link>
          <h1 className="page-title">
            <Edit3 size={26} />
            <span>Edit Lead: {formData.name}</span>
          </h1>
          <p className="page-subtitle">Update lead information and CRM properties</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '880px' }}>
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

          {/* Section 1: Contact Information */}
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <User size={16} color="var(--primary)" />
              <span>Contact Information</span>
            </h3>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="first-name">First Name</label>
              <input
                id="first-name"
                name="first_name"
                type="text"
                className="form-control"
                value={formData.first_name}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="last-name">Last Name</label>
              <input
                id="last-name"
                name="last_name"
                type="text"
                className="form-control"
                value={formData.last_name}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="lead-email">Email Address</label>
              <input
                id="lead-email"
                name="email"
                type="email"
                className="form-control"
                value={formData.email}
                onChange={handleChange}
                aria-invalid={Boolean(errors.email)}
              />
              <FieldError id="lead-email-error" message={errors.email} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="lead-phone">Work Phone</label>
              <input
                id="lead-phone"
                name="phone"
                type="tel"
                className="form-control"
                value={formData.phone}
                onChange={handleChange}
                aria-invalid={Boolean(errors.phone)}
              />
              <FieldError id="lead-phone-error" message={errors.phone} />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="mobile-phone">Mobile Phone</label>
              <input
                id="mobile-phone"
                name="mobile_phone"
                type="tel"
                className="form-control"
                value={formData.mobile_phone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="job-title">Job Title</label>
              <input
                id="job-title"
                name="job_title"
                type="text"
                className="form-control"
                value={formData.job_title}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="department">Department</label>
              <input
                id="department"
                name="department"
                type="text"
                className="form-control"
                value={formData.department}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="buying-role">Buying Role</label>
              <select
                id="buying-role"
                name="buying_role"
                className="form-control"
                value={formData.buying_role}
                onChange={handleChange}
              >
                <option value="">Select Buying Role</option>
                <option value="DECISION_MAKER">Decision Maker</option>
                <option value="INFLUENCER">Influencer</option>
                <option value="BUDGET_HOLDER">Budget Holder</option>
                <option value="CHAMPION">Champion</option>
                <option value="END_USER">End User</option>
                <option value="GATEKEEPER">Gatekeeper</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="linkedin-url">LinkedIn Profile URL</label>
            <input
              id="linkedin-url"
              name="linkedin_url"
              type="url"
              className="form-control"
              value={formData.linkedin_url}
              onChange={handleChange}
            />
          </div>

          {/* Section 2: Company Information */}
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', margin: '1.25rem 0 0.75rem 0' }}>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Building2 size={16} color="#38bdf8" />
              <span>Company Information</span>
            </h3>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="lead-company">Company Name</label>
              <input
                id="lead-company"
                name="company_name"
                type="text"
                className="form-control"
                value={formData.company_name}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="url"
                className="form-control"
                value={formData.website}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="industry">Industry</label>
              <input
                id="industry"
                name="industry"
                type="text"
                className="form-control"
                value={formData.industry}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="company-size">Company Size</label>
              <select
                id="company-size"
                name="company_size"
                className="form-control"
                value={formData.company_size}
                onChange={handleChange}
              >
                <option value="">Select Size</option>
                <option value="1-10">1-10 employees</option>
                <option value="11-50">11-50 employees</option>
                <option value="51-200">51-200 employees</option>
                <option value="201-500">201-500 employees</option>
                <option value="501-1000">501-1000 employees</option>
                <option value="1000+">1000+ employees</option>
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="annual-revenue">Annual Revenue (₹)</label>
              <input
                id="annual-revenue"
                name="annual_revenue"
                type="number"
                step="0.01"
                className="form-control"
                value={formData.annual_revenue}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="city">City</label>
              <input
                id="city"
                name="city"
                type="text"
                className="form-control"
                value={formData.city}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="state">State / Region</label>
              <input
                id="state"
                name="state"
                type="text"
                className="form-control"
                value={formData.state}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="country">Country</label>
              <input
                id="country"
                name="country"
                type="text"
                className="form-control"
                value={formData.country}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="lead-address">Physical Address</label>
            <textarea
              id="lead-address"
              name="address"
              className="form-control"
              rows={2}
              value={formData.address}
              onChange={handleChange}
            />
          </div>

          {/* Section 3: Lead Qualification */}
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', margin: '1.25rem 0 0.75rem 0' }}>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Target size={16} color="#f59e0b" />
              <span>Lead Qualification</span>
            </h3>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="lead-score">Lead Score (0-100)</label>
              <input
                id="lead-score"
                name="lead_score"
                type="number"
                min="0"
                max="100"
                className="form-control"
                value={formData.lead_score}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="buying-intent">Buying Intent</label>
              <select
                id="buying-intent"
                name="buying_intent"
                className="form-control"
                value={formData.buying_intent}
                onChange={handleChange}
              >
                <option value="HIGH">High Intent</option>
                <option value="MEDIUM">Medium Intent</option>
                <option value="LOW">Low Intent</option>
              </select>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="estimated-budget">Estimated Budget (₹)</label>
              <input
                id="estimated-budget"
                name="estimated_budget"
                type="number"
                step="0.01"
                className="form-control"
                value={formData.estimated_budget}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="purchasing-timeline">Purchasing Timeline</label>
              <select
                id="purchasing-timeline"
                name="purchasing_timeline"
                className="form-control"
                value={formData.purchasing_timeline}
                onChange={handleChange}
              >
                <option value="">Select Timeline</option>
                <option value="IMMEDIATE">Immediate (&lt; 1 month)</option>
                <option value="1_3_MONTHS">1 - 3 months</option>
                <option value="3_6_MONTHS">3 - 6 months</option>
                <option value="6_12_MONTHS">6 - 12 months</option>
                <option value="NO_TIMELINE">No immediate plan</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="decision-maker">Key Decision Maker Name / Title</label>
            <input
              id="decision-maker"
              name="decision_maker"
              type="text"
              className="form-control"
              value={formData.decision_maker}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="customer-requirements">Customer Requirements / Scope</label>
            <textarea
              id="customer-requirements"
              name="customer_requirements"
              className="form-control"
              rows={3}
              value={formData.customer_requirements}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="competitor-info">Competitor Information</label>
            <textarea
              id="competitor-info"
              name="competitor_info"
              className="form-control"
              rows={2}
              value={formData.competitor_info}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="qualification-notes">Qualification Notes</label>
            <textarea
              id="qualification-notes"
              name="qualification_notes"
              className="form-control"
              rows={2}
              value={formData.qualification_notes}
              onChange={handleChange}
            />
          </div>

          {/* Section 4: Pipeline & Sales Information */}
          <div style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem', margin: '1.25rem 0 0.75rem 0' }}>
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <DollarSign size={16} color="#10b981" />
              <span>Pipeline & Sales Information</span>
            </h3>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label" htmlFor="lead-type">Lead Type</label>
              <select
                id="lead-type"
                name="lead_type"
                className="form-control"
                value={formData.lead_type}
                onChange={handleChange}
              >
                <option value="INBOUND">Inbound</option>
                <option value="OUTBOUND">Outbound</option>
                <option value="REFERRAL">Referral</option>
                <option value="PARTNER">Partner</option>
                <option value="EVENT">Event / Trade Show</option>
                <option value="EXISTING_CUSTOMER">Existing Customer</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

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
          </div>

          <div className="form-grid-2">
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

            <div className="form-group">
              <label className="form-label" htmlFor="expected-close-date">Expected Closing Date</label>
              <input
                id="expected-close-date"
                name="expected_close_date"
                type="date"
                className="form-control"
                value={formData.expected_close_date}
                onChange={handleChange}
              />
            </div>
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
            />
            <FieldError id="lead-value-error" message={errors.expected_value} />
          </div>

          {/* Multi-Product Selection */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
              <Package size={15} color="var(--primary)" /> Interested Products & Line Items
            </label>
            <ProductSelector
              selectedProductIds={formData.product_ids || []}
              onChange={(ids) => setFormData((prev) => ({ ...prev, product_ids: ids }))}
              onTotalValueChange={(val) => {
                if (val > 0) {
                  setFormData((prev) => ({ ...prev, expected_value: val.toFixed(2) }));
                }
              }}
            />
          </div>

          {canAssignLeads && (
            <div className="form-group">
              <label className="form-label" htmlFor="lead-assigned">Assigned Representative</label>
              <select
                id="lead-assigned"
                name="assigned_to"
                className="form-control"
                value={formData.assigned_to}
                onChange={handleChange}
              >
                <option value="">Unassigned (Auto-Assign if unassigned)</option>
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
                placeholder="Reason why this deal was lost..."
                value={formData.lost_reason}
                onChange={handleChange}
                required
                aria-invalid={Boolean(errors.lost_reason)}
              />
              <FieldError id="lead-lost-reason-error" message={errors.lost_reason} />
            </div>
          )}

          <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Link to={`/leads/${id}`} className="btn btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={16} />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {pldModalData && (
        <ConfirmModal
          isOpen={Boolean(pldModalData)}
          title="PLD Qualification Required"
          message={`Stage "${pldModalData.stageName}" requires a qualified PLD assessment before advancing.`}
          confirmText="Start Assessment"
          onConfirm={() => {
            navigate(`/leads/${id}?tab=pld`);
            setPldModalData(null);
          }}
          onCancel={() => setPldModalData(null)}
        />
      )}
    </div>
  );
};

export default LeadEdit;
