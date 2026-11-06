import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Briefcase,
  Mail,
  Phone,
  PhoneCall,
  Calendar,
  CheckSquare,
  MessageSquare,
  Share2,
  UserCheck,
  TrendingUp,
  Target,
  Edit,
  MoreVertical,
  CheckCircle,
  AlertTriangle,
  User,
  Sparkles,
} from 'lucide-react';
import { PriorityBadge } from '../PriorityBadge';
import { StatusBadge } from '../StatusBadge';
import { formatCurrency } from '../../utils/formatters';

export const HubSpotLeadHeader = ({
  lead,
  stages = [],
  onStageSelect,
  onEditLead,
  onLogCall,
  onLogEmail,
  onLogMeeting,
  onAddNote,
  onNewTask,
  onScheduleFollowup,
  onConvert,
  onHandover,
  onAssign,
  onMarkLost,
  onDelete,
  onOpenWinProb,
  canAssignLeads = false,
  canConvertLeads = false,
  canHandoverLeads = false,
  isAdminOrManager = false,
}) => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  if (!lead) return null;

  // Name initials for avatar
  const initials = (lead.name || 'PL')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const leadStageId = lead.stage?.id || lead.stage;
  const currentStageIndex = stages.findIndex((s) => s.id === leadStageId);

  return (
    <div className="hs-header">
      {/* Top row: Breadcrumb and Quick Links */}
      <div className="hs-header-top">
        <div className="hs-breadcrumb">
          <Link to="/leads">
            <ArrowLeft size={14} />
            <span>Leads</span>
          </Link>
          <span>/</span>
          <span style={{ color: 'var(--text-main, #f8fafc)', fontWeight: 600 }}>
            {lead.name}
          </span>
          {lead.company_name && (
            <>
              <span className="hs-subtitle-divider">•</span>
              <span>{lead.company_name}</span>
            </>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="hs-actions-toolbar">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onLogCall}
            title="Log Phone Call"
          >
            <PhoneCall size={14} />
            <span>Log Call</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onAddNote}
            title="Add Communication Note"
          >
            <MessageSquare size={14} />
            <span>Note</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onNewTask}
            title="Create Task"
          >
            <CheckSquare size={14} />
            <span>Task</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onScheduleFollowup}
            title="Schedule Follow-up"
          >
            <Calendar size={14} />
            <span>Follow-up</span>
          </button>

          {canConvertLeads && (
            <button
              type="button"
              className="btn btn-success btn-sm"
              onClick={onConvert}
              title="Convert Lead to Customer"
            >
              <UserCheck size={14} />
              <span>Convert</span>
            </button>
          )}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onEditLead}
            title="Edit Lead Details"
          >
            <Edit size={14} />
            <span>Edit</span>
          </button>

          {/* More Actions Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              title="More Actions"
            >
              <MoreVertical size={14} />
            </button>

            {moreMenuOpen && (
              <>
                <div
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 99,
                  }}
                  onClick={() => setMoreMenuOpen(false)}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '0.35rem',
                    background: 'var(--bg-surface, #1e222d)',
                    border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))',
                    borderRadius: 'var(--radius-md, 8px)',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
                    padding: '0.4rem',
                    zIndex: 100,
                    minWidth: '180px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                  }}
                >
                  {canAssignLeads && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent' }}
                      onClick={() => {
                        setMoreMenuOpen(false);
                        onAssign();
                      }}
                    >
                      <UserCheck size={14} />
                      <span>Assign Lead</span>
                    </button>
                  )}

                  {canHandoverLeads && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent' }}
                      onClick={() => {
                        setMoreMenuOpen(false);
                        onHandover();
                      }}
                    >
                      <Share2 size={14} />
                      <span>Handover Lead</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent' }}
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onOpenWinProb();
                    }}
                  >
                    <TrendingUp size={14} />
                    <span>Set Win Probability</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', color: 'var(--danger, #ef4444)' }}
                    onClick={() => {
                      setMoreMenuOpen(false);
                      onMarkLost();
                    }}
                  >
                    <AlertTriangle size={14} />
                    <span>Mark as Lost</span>
                  </button>

                  {isAdminOrManager && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', color: 'var(--danger, #ef4444)' }}
                      onClick={() => {
                        setMoreMenuOpen(false);
                        onDelete();
                      }}
                    >
                      <span>Delete Lead</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Middle row: Lead Identity, Owner, Badges */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="hs-header-identity">
          <div className="hs-avatar">{initials}</div>
          <div className="hs-title-block">
            <h1>{lead.name}</h1>
            <div className="hs-subtitle">
              {lead.company_name && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Building2 size={13} className="text-dim" />
                  <strong>{lead.company_name}</strong>
                </span>
              )}
              {lead.job_title && (
                <>
                  <span className="hs-subtitle-divider">•</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Briefcase size={13} className="text-dim" />
                    <span>{lead.job_title}</span>
                  </span>
                </>
              )}
              {lead.assigned_to_details && (
                <>
                  <span className="hs-subtitle-divider">•</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <User size={13} className="text-dim" />
                    <span>Owner: <strong>{lead.assigned_to_details.full_name || lead.assigned_to_details.email}</strong></span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Badges strip */}
        <div className="hs-badges">
          {lead.priority && <PriorityBadge priority={lead.priority} />}
          {lead.status && <StatusBadge status={lead.status} />}
          {lead.win_probability !== undefined && (
            <span
              className="hs-score-badge"
              style={{ cursor: 'pointer' }}
              onClick={onOpenWinProb}
              title="Win Probability"
            >
              <TrendingUp size={13} />
              <span>{lead.win_probability}% Win Prob</span>
            </span>
          )}
          {lead.lead_score > 0 && (
            <span className="hs-score-badge" title="Lead Score">
              <Sparkles size={13} />
              <span>Score: {lead.lead_score}</span>
            </span>
          )}
          {lead.expected_value > 0 && (
            <span
              className="badge"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '0.25rem 0.6rem',
                fontSize: '0.8125rem',
                fontWeight: 700,
              }}
            >
              {formatCurrency(lead.expected_value)}
            </span>
          )}
        </div>
      </div>

      {/* Bottom row: Interactive Pipeline Stage Stepper */}
      {stages.length > 0 && (
        <div className="hs-stage-stepper" role="tablist" aria-label="Pipeline stages">
          {stages.map((stage, idx) => {
            const isActive = stage.id === leadStageId;
            const isPassed = currentStageIndex > -1 && idx < currentStageIndex;

            return (
              <button
                key={stage.id}
                type="button"
                className={`hs-stage-step ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''}`}
                onClick={() => onStageSelect(stage)}
                title={`Transition to ${stage.name}`}
              >
                {isPassed ? <CheckCircle size={12} /> : null}
                <span>{stage.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HubSpotLeadHeader;

