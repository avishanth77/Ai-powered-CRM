import React, { useState } from 'react';
import {
  User,
  Building2,
  Briefcase,
  Mail,
  Phone,
  PhoneCall,
  Globe,
  MapPin,
  ExternalLink,
  Shield,
  Target,
  DollarSign,
  Calendar,
  Clock,
  CheckSquare,
  AlertCircle,
  FileText,
  Sparkles,
  Edit2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';

export const HubSpotOverviewTab = ({
  lead,
  onUpdateField,
  onUpdateCustomProperty,
  onViewTasksTab,
  onViewActivitiesTab,
  onCompleteTask,
  onScheduleFollowup,
  onOpenAiSummary,
}) => {
  const [collapsedSections, setCollapsedSections] = useState({});

  const toggleSection = (sectionKey) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  if (!lead) return null;

  const stageTaskSummary = lead.stage_task_summary || {
    total: 0,
    completed: 0,
    mandatory_total: 0,
    mandatory_completed: 0,
    mandatory_pending: 0,
    percent: 100,
    can_progress: true,
  };

  const customProps = lead.custom_properties || [];

  return (
    <div className="hs-overview-grid">
      {/* Left Column: HubSpot Detailed Property Cards */}
      <div className="hs-left-column">
        {/* Contact Information Card */}
        <div className="hs-card">
          <div className="hs-card-header" onClick={() => toggleSection('contact')} style={{ cursor: 'pointer' }}>
            <h3 className="hs-card-title">
              <User size={16} color="var(--primary, #6366f1)" />
              <span>Contact Information</span>
            </h3>
            {collapsedSections.contact ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </div>

          {!collapsedSections.contact && (
            <div className="hs-card-body">
              <div className="form-grid-2">
                <div className="hs-prop-row">
                  <span className="hs-prop-label">First Name</span>
                  <span className="hs-prop-value">{lead.first_name || <span className="hs-prop-empty">Not set</span>}</span>
                </div>
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Last Name</span>
                  <span className="hs-prop-value">{lead.last_name || <span className="hs-prop-empty">Not set</span>}</span>
                </div>
              </div>

              <div className="hs-prop-row">
                <span className="hs-prop-label">Email Address</span>
                <span className="hs-prop-value">
                  {lead.email ? (
                    <a href={`mailto:${lead.email}`} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Mail size={13} />
                      <span>{lead.email}</span>
                    </a>
                  ) : (
                    <span className="hs-prop-empty">No email address</span>
                  )}
                </span>
              </div>

              <div className="form-grid-2">
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Phone</span>
                  <span className="hs-prop-value">
                    {lead.phone ? (
                      <a href={`tel:${lead.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Phone size={13} />
                        <span>{lead.phone}</span>
                      </a>
                    ) : (
                      <span className="hs-prop-empty">Not set</span>
                    )}
                  </span>
                </div>
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Mobile Phone</span>
                  <span className="hs-prop-value">
                    {lead.mobile_phone ? (
                      <a href={`tel:${lead.mobile_phone}`} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <PhoneCall size={13} />
                        <span>{lead.mobile_phone}</span>
                      </a>
                    ) : (
                      <span className="hs-prop-empty">Not set</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Job Title</span>
                  <span className="hs-prop-value">{lead.job_title || <span className="hs-prop-empty">Not set</span>}</span>
                </div>
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Department</span>
                  <span className="hs-prop-value">{lead.department || <span className="hs-prop-empty">Not set</span>}</span>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Buying Role</span>
                  <span className="hs-prop-value">
                    {lead.buying_role ? (
                      <span className="badge badge-secondary">{lead.buying_role.replace('_', ' ')}</span>
                    ) : (
                      <span className="hs-prop-empty">Not specified</span>
                    )}
                  </span>
                </div>
                <div className="hs-prop-row">
                  <span className="hs-prop-label">LinkedIn</span>
                  <span className="hs-prop-value">
                    {lead.linkedin_url ? (
                      <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <ExternalLink size={13} color="#0a66c2" />
                        <span>View Profile</span>
                      </a>
                    ) : (
                      <span className="hs-prop-empty">Not provided</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Company Information Card */}
        <div className="hs-card">
          <div className="hs-card-header" onClick={() => toggleSection('company')} style={{ cursor: 'pointer' }}>
            <h3 className="hs-card-title">
              <Building2 size={16} color="#38bdf8" />
              <span>Company Information</span>
            </h3>
            {collapsedSections.company ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </div>

          {!collapsedSections.company && (
            <div className="hs-card-body">
              <div className="hs-prop-row">
                <span className="hs-prop-label">Company Name</span>
                <span className="hs-prop-value" style={{ fontWeight: 600 }}>
                  {lead.company_name || <span className="hs-prop-empty">Not set</span>}
                </span>
              </div>

              <div className="form-grid-2">
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Website</span>
                  <span className="hs-prop-value">
                    {lead.website ? (
                      <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Globe size={13} />
                        <span>{lead.website.replace(/^https?:\/\//, '')}</span>
                      </a>
                    ) : (
                      <span className="hs-prop-empty">Not set</span>
                    )}
                  </span>
                </div>
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Industry</span>
                  <span className="hs-prop-value">{lead.industry || <span className="hs-prop-empty">Not set</span>}</span>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Company Size</span>
                  <span className="hs-prop-value">{lead.company_size ? `${lead.company_size} employees` : <span className="hs-prop-empty">Not set</span>}</span>
                </div>
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Annual Revenue</span>
                  <span className="hs-prop-value">{lead.annual_revenue ? formatCurrency(lead.annual_revenue) : <span className="hs-prop-empty">Not set</span>}</span>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="hs-prop-row">
                  <span className="hs-prop-label">City & State</span>
                  <span className="hs-prop-value">
                    {[lead.city, lead.state].filter(Boolean).join(', ') || <span className="hs-prop-empty">Not set</span>}
                  </span>
                </div>
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Country</span>
                  <span className="hs-prop-value">{lead.country || <span className="hs-prop-empty">Not set</span>}</span>
                </div>
              </div>

              {lead.address && (
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Address</span>
                  <span className="hs-prop-value" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem' }}>
                    <MapPin size={13} className="text-dim" style={{ marginTop: '3px' }} />
                    <span>{lead.address}</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lead Qualification Card */}
        <div className="hs-card">
          <div className="hs-card-header" onClick={() => toggleSection('qualification')} style={{ cursor: 'pointer' }}>
            <h3 className="hs-card-title">
              <Target size={16} color="#f59e0b" />
              <span>Lead Qualification</span>
            </h3>
            {collapsedSections.qualification ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </div>

          {!collapsedSections.qualification && (
            <div className="hs-card-body">
              <div className="form-grid-2">
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Lead Score</span>
                  <span className="hs-prop-value" style={{ fontWeight: 700, color: lead.lead_score >= 70 ? 'var(--success)' : undefined }}>
                    {lead.lead_score} / 100
                  </span>
                </div>
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Buying Intent</span>
                  <span className="hs-prop-value">
                    <span className={`badge ${lead.buying_intent === 'HIGH' ? 'badge-success' : lead.buying_intent === 'MEDIUM' ? 'badge-primary' : 'badge-secondary'}`}>
                      {lead.buying_intent}
                    </span>
                  </span>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Estimated Budget</span>
                  <span className="hs-prop-value" style={{ fontWeight: 600 }}>
                    {lead.estimated_budget ? formatCurrency(lead.estimated_budget) : <span className="hs-prop-empty">Not set</span>}
                  </span>
                </div>
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Purchasing Timeline</span>
                  <span className="hs-prop-value">{lead.purchasing_timeline || <span className="hs-prop-empty">Not set</span>}</span>
                </div>
              </div>

              <div className="hs-prop-row">
                <span className="hs-prop-label">Decision Maker</span>
                <span className="hs-prop-value">{lead.decision_maker || <span className="hs-prop-empty">Not identified</span>}</span>
              </div>

              {lead.customer_requirements && (
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Customer Requirements</span>
                  <p className="hs-prop-value" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.8125rem' }}>
                    {lead.customer_requirements}
                  </p>
                </div>
              )}

              {lead.competitor_info && (
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Competitor Landscape</span>
                  <p className="hs-prop-value" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.8125rem' }}>
                    {lead.competitor_info}
                  </p>
                </div>
              )}

              {lead.qualification_notes && (
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Qualification Notes</span>
                  <p className="hs-prop-value" style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.8125rem' }}>
                    {lead.qualification_notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sales Information Card */}
        <div className="hs-card">
          <div className="hs-card-header" onClick={() => toggleSection('sales')} style={{ cursor: 'pointer' }}>
            <h3 className="hs-card-title">
              <DollarSign size={16} color="#10b981" />
              <span>Sales Information</span>
            </h3>
            {collapsedSections.sales ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </div>

          {!collapsedSections.sales && (
            <div className="hs-card-body">
              <div className="form-grid-2">
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Lead Type</span>
                  <span className="hs-prop-value">{lead.lead_type || 'INBOUND'}</span>
                </div>
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Lead Source</span>
                  <span className="hs-prop-value">{lead.source_details?.name || 'Direct'}</span>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Current Stage</span>
                  <span className="hs-prop-value" style={{ fontWeight: 600 }}>{lead.stage_details?.name}</span>
                </div>
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Previous Stage</span>
                  <span className="hs-prop-value">{lead.previous_stage_details?.name || <span className="hs-prop-empty">None (Initial Stage)</span>}</span>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Stage Entry Date</span>
                  <span className="hs-prop-value">{lead.stage_entered_at ? formatDate(lead.stage_entered_at) : formatDate(lead.created_at)}</span>
                </div>
                <div className="hs-prop-row">
                  <span className="hs-prop-label">Expected Close Date</span>
                  <span className="hs-prop-value">{lead.expected_close_date ? formatDate(lead.expected_close_date) : <span className="hs-prop-empty">Not set</span>}</span>
                </div>
              </div>

              {lead.lost_reason && (
                <div className="hs-prop-row" style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '0.75rem', borderRadius: 'var(--radius-sm, 6px)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <span className="hs-prop-label" style={{ color: 'var(--danger)' }}>Lost Reason</span>
                  <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.85rem' }}>{lead.lost_reason}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Attached Products */}
        {lead.products?.length > 0 && (
          <div className="hs-card">
            <div className="hs-card-header" onClick={() => toggleSection('products')} style={{ cursor: 'pointer' }}>
              <h3 className="hs-card-title">
                <Package size={16} color="#a855f7" />
                <span>Selected Products ({lead.products.length})</span>
              </h3>
              {collapsedSections.products ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </div>

            {!collapsedSections.products && (
              <div className="hs-card-body" style={{ padding: '0.75rem' }}>
                <table className="table" style={{ margin: 0, fontSize: '0.8125rem' }}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lead.products.map((p) => (
                      <tr key={p.id || p.lead_product_id}>
                        <td><strong>{p.name}</strong></td>
                        <td>{p.quantity}</td>
                        <td>{formatCurrency(p.unit_price)}</td>
                        <td><strong>{formatCurrency(p.total_price)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Custom Properties Card */}
        {customProps.length > 0 && (
          <div className="hs-card">
            <div className="hs-card-header" onClick={() => toggleSection('custom_props')} style={{ cursor: 'pointer' }}>
              <h3 className="hs-card-title">
                <Shield size={16} color="#06b6d4" />
                <span>Custom Properties ({customProps.length})</span>
              </h3>
              {collapsedSections.custom_props ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </div>

            {!collapsedSections.custom_props && (
              <div className="hs-card-body">
                {customProps.map((prop) => (
                  <div key={prop.id} className="hs-prop-row">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span className="hs-prop-label">
                        {prop.label}
                        {prop.is_mandatory && <span style={{ color: 'var(--danger)', marginLeft: '3px' }}>*</span>}
                      </span>
                      <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>{prop.field_type}</span>
                    </div>
                    <span className="hs-prop-value">
                      {prop.display_value ? (
                        prop.field_type === 'checkbox' ? (
                          prop.value_text === 'true' || prop.value_text === '1' ? 'Yes' : 'No'
                        ) : prop.field_type === 'url' ? (
                          <a href={prop.value_text.startsWith('http') ? prop.value_text : `https://${prop.value_text}`} target="_blank" rel="noopener noreferrer">
                            {prop.value_text}
                          </a>
                        ) : (
                          prop.display_value
                        )
                      ) : (
                        <span className="hs-prop-empty">{prop.placeholder || 'Empty'}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Column: Actionable Pulse & Highlights */}
      <div className="hs-right-column">
        {/* Stage Progression Gate Card */}
        <div className="hs-card" style={{ borderColor: stageTaskSummary.can_progress ? 'rgba(16, 185, 129, 0.3)' : 'rgba(234, 179, 8, 0.4)' }}>
          <div className="hs-card-header" style={{ background: stageTaskSummary.can_progress ? 'rgba(16, 185, 129, 0.05)' : 'rgba(234, 179, 8, 0.05)' }}>
            <h3 className="hs-card-title">
              <CheckSquare size={16} color={stageTaskSummary.can_progress ? 'var(--success)' : 'var(--warning)'} />
              <span>Pipeline Stage Progression</span>
            </h3>
            <span
              className="badge"
              style={{
                backgroundColor: stageTaskSummary.can_progress ? 'rgba(16, 185, 129, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                color: stageTaskSummary.can_progress ? 'var(--success)' : 'var(--warning)',
                fontWeight: 700,
              }}
            >
              {stageTaskSummary.status_label || (stageTaskSummary.can_progress ? 'Ready to Advance' : 'Tasks Pending')}
            </span>
          </div>

          <div className="hs-card-body">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                Mandatory Stage Tasks
              </span>
              <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>
                {stageTaskSummary.mandatory_completed} of {stageTaskSummary.mandatory_total} completed
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${stageTaskSummary.percent}%`,
                  height: '100%',
                  background: stageTaskSummary.can_progress ? 'var(--success, #10b981)' : 'var(--warning, #f59e0b)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            {!stageTaskSummary.can_progress && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(234, 179, 8, 0.08)', padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.8125rem', color: 'var(--text-sub)' }}>
                <AlertCircle size={15} color="var(--warning, #f59e0b)" style={{ flexShrink: 0 }} />
                <span>
                  <strong>Stage Gate:</strong> {stageTaskSummary.mandatory_pending} mandatory task{stageTaskSummary.mandatory_pending > 1 ? 's' : ''} must be completed before advancing to the next pipeline stage.
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={onViewTasksTab}
              >
                <span>View All Tasks & Rules</span>
              </button>
            </div>
          </div>
        </div>

        {/* AI Deal Intelligence */}
        <div className="hs-card" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(168, 85, 247, 0.25)' }}>
          <div className="hs-card-header">
            <h3 className="hs-card-title" style={{ color: '#c084fc' }}>
              <Sparkles size={16} color="#c084fc" />
              <span>AI Deal Assistant</span>
            </h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onOpenAiSummary}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
            >
              <span>Analyze Deal</span>
            </button>
          </div>
          <div className="hs-card-body">
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-dim)', margin: 0 }}>
              Synthesize client notes, stage history, and objections into actionable deal strategies and next steps using Gemini AI.
            </p>
          </div>
        </div>

        {/* Quick Follow-up Scheduler Card */}
        <div className="hs-card">
          <div className="hs-card-header">
            <h3 className="hs-card-title">
              <Calendar size={16} color="var(--primary, #6366f1)" />
              <span>Next Follow-up</span>
            </h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onScheduleFollowup}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
            >
              <span>+ Schedule</span>
            </button>
          </div>
          <div className="hs-card-body">
            {lead.next_followup_date ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Clock size={18} color="var(--primary)" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                    {formatDateTime(lead.next_followup_date)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Upcoming planned engagement
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
                No future follow-up scheduled. Click Schedule to ensure timely engagement.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HubSpotOverviewTab;
