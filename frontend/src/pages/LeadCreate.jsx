import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { leadApi } from '../api/leadApi';
import { userApi } from '../api/userApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { extractErrorMessage, normalizeServerErrors, isValidEmail, isValidPhone } from '../utils/validation';
import { FieldError } from '../components/FieldError';
import { LEAD_PRIORITY } from '../utils/constants';
import ProductSelector from '../components/ProductSelector';
import {
  ArrowLeft,
  Save,
  UserPlus,
  Package,
  User,
  Building2,
  Target,
  DollarSign,
  Loader2,
  CheckCircle2,
  UserCheck,
  Sparkles,
} from 'lucide-react';

export const LeadCreate = () => {
  const navigate = useNavigate();
  const { user, canAssignLeads } = useAuth();
  const { showToast } = useToast();
  const [processingStep, setProcessingStep] = useState(0);

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
    priority: LEAD_PRIORITY.MEDIUM,
    assigned_to: user?.id || '',
    expected_value: '0.00',
    product_ids: [],
    lost_reason: '',
    win_probability_override: '',
    win_probability_reason: '',
  });

  const [stages, setStages] = useState([]);
  const [sources, setSources] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  useEffect(() => {
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

    leadApi
      .getSources()
      .then((res) => setSources(res.results || (Array.isArray(res) ? res : [])))
      .catch(() => {});

    if (canAssignLeads) {
      userApi
        .getUsers()
        .then((res) => setUsers(res.results || (Array.isArray(res) ? res : [])))
        .catch(() => {});
    }
  }, [canAssignLeads]);

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
    if (!formData.stage) {
      newErrors.stage = 'Please select a pipeline stage.';
    }
    if (isLostStage && !formData.lost_reason.trim()) {
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

    setLoading(true);
    setProcessingStep(0);
    const stepTimer1 = setTimeout(() => setProcessingStep(1), 160);
    const stepTimer2 = setTimeout(() => setProcessingStep(2), 340);

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
        source: formData.source ? parseInt(formData.source) : null,
        stage: formData.stage ? parseInt(formData.stage) : null,
        priority: formData.priority,
        assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : null,
        expected_value: parseFloat(formData.expected_value) || 0,
        product_ids: formData.product_ids || [],
        lost_reason: isLostStage ? formData.lost_reason.trim() : null,
        win_probability_override: formData.win_probability_override !== '' && formData.win_probability_override !== null && formData.win_probability_override !== undefined ? parseInt(formData.win_probability_override) : null,
        win_probability_reason: (formData.win_probability_reason || '').trim(),
      };

      const res = await leadApi.createLead(payload);
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setProcessingStep(3);
      showToast(`Lead "${res.name}" successfully created!`, 'success');
      setTimeout(() => {
        navigate(`/leads/${res.id}`);
      }, 450);
    } catch (err) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      setLoading(false);
      const msg = extractErrorMessage(err, 'Failed to create lead.');
      showToast(msg, 'error');
      if (err.response?.data?.errors) {
        const { fieldErrors, summary } = normalizeServerErrors(err.response.data.errors);
        setErrors(fieldErrors);
        setFormError(summary.length > 0 ? summary : null);
      }
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
          <p className="page-subtitle">Add a comprehensive prospect profile to your CRM pipeline</p>
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
                placeholder="e.g. John"
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
                placeholder="e.g. Doe"
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
                placeholder="e.g. john.doe@company.com"
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
                placeholder="e.g. +91 9876543210"
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
                placeholder="e.g. +91 9123456789"
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
                placeholder="e.g. VP of Procurement"
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
                placeholder="e.g. Operations, IT, Executive"
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
              placeholder="https://linkedin.com/in/username"
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
                placeholder="e.g. Acme Corporation"
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
                placeholder="https://company.example.com"
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
                placeholder="e.g. SaaS, Manufacturing, Financial"
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
                placeholder="e.g. 5000000"
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
                placeholder="e.g. Bengaluru"
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
                placeholder="e.g. Karnataka"
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
                placeholder="e.g. India"
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
              placeholder="Building, Street, Suite..."
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
                placeholder="e.g. 250000"
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
              placeholder="e.g. Jane Smith, VP of Finance"
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
              placeholder="Key specifications, workflows, and problems they need solved..."
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
              placeholder="Competitors currently evaluated or incumbency..."
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
              placeholder="Key takeaways from initial screening..."
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
              <label className="form-label form-label-required" htmlFor="lead-stage">Pipeline Stage</label>
              <select
                id="lead-stage"
                name="stage"
                className="form-control"
                value={formData.stage}
                onChange={handleChange}
                required
                aria-invalid={Boolean(errors.stage)}
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
          </div>

          {/* Multi-Product Selection */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
              <Package size={15} color="var(--primary)" /> Products & Line Items
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
                <option value="">✨ Auto-Assign via Salesman Rules</option>
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

      {/* Processing Animation Modal Overlay */}
      {loading && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(11, 15, 23, 0.78)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
          }}
        >
          <div
            className="card"
            style={{
              maxWidth: '440px',
              width: '100%',
              padding: '2.25rem 2rem',
              textAlign: 'center',
              background: 'var(--surface-color, #131a26)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.2)',
              borderRadius: '18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.25rem',
            }}
          >
            {/* Animated Rotating Gradient Ring / Checkmark */}
            <div
              style={{
                position: 'relative',
                width: '74px',
                height: '74px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {processingStep === 3 ? (
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '2px solid var(--success, #22c55e)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--success, #22c55e)',
                  }}
                >
                  <CheckCircle2 size={36} />
                </div>
              ) : (
                <>
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '50%',
                      border: '3px solid transparent',
                      borderTopColor: '#6366f1',
                      borderRightColor: '#3b82f6',
                      animation: 'spin 0.9s linear infinite',
                    }}
                  />
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: '50%',
                      background: 'rgba(99, 102, 241, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#818cf8',
                    }}
                  >
                    <UserCheck size={28} className="animate-pulse" />
                  </div>
                </>
              )}
            </div>

            {/* Title & Status */}
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.4rem 0', color: 'var(--text-main, #fff)' }}>
                {processingStep === 3 ? 'Lead Created Successfully!' : 'Creating & Routing Lead...'}
              </h3>
              <p className="text-dim" style={{ fontSize: '0.875rem', margin: 0 }}>
                {processingStep === 3
                  ? 'Redirecting to prospect profile...'
                  : 'Applying intelligent routing & auto-assigning to staff'}
              </p>
            </div>

            {/* Step Indicators */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                textAlign: 'left',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem' }}>
                {processingStep >= 1 ? (
                  <CheckCircle2 size={16} className="text-success" />
                ) : (
                  <Loader2 size={16} className="animate-spin text-primary" />
                )}
                <span style={{ color: processingStep >= 1 ? 'var(--text-main)' : 'var(--text-dim)', fontWeight: processingStep === 0 ? 600 : 400 }}>
                  1. Validating Prospect Information
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem' }}>
                {processingStep >= 2 ? (
                  <CheckCircle2 size={16} className="text-success" />
                ) : processingStep === 1 ? (
                  <Loader2 size={16} className="animate-spin text-primary" />
                ) : (
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }} />
                )}
                <span style={{ color: processingStep >= 1 ? 'var(--text-main)' : 'var(--text-dim)', fontWeight: processingStep === 1 ? 600 : 400 }}>
                  2. Auto-Assigning to Sales Staff
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.85rem' }}>
                {processingStep >= 3 ? (
                  <CheckCircle2 size={16} className="text-success" />
                ) : processingStep === 2 ? (
                  <Loader2 size={16} className="animate-spin text-primary" />
                ) : (
                  <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }} />
                )}
                <span style={{ color: processingStep >= 2 ? 'var(--text-main)' : 'var(--text-dim)', fontWeight: processingStep === 2 ? 600 : 400 }}>
                  3. Generating Stage Tasks & Notifications
                </span>
              </div>
            </div>

            {/* Dynamic Progress Bar */}
            <div
              style={{
                width: '100%',
                height: '6px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background:
                    processingStep === 3
                      ? 'var(--success, #22c55e)'
                      : 'linear-gradient(90deg, #3b82f6, #6366f1)',
                  width:
                    processingStep === 0
                      ? '30%'
                      : processingStep === 1
                      ? '65%'
                      : processingStep === 2
                      ? '90%'
                      : '100%',
                  transition: 'width 0.35s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s ease',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadCreate;
