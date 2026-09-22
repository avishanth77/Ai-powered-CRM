import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { leadApi } from '../api/leadApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, getInitials } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';
import { LEAD_STATUS, LEAD_STATUS_CONFIG } from '../utils/constants';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { PriorityBadge } from '../components/PriorityBadge';
import { Kanban, Plus, ChevronLeft, ChevronRight, LayoutGrid } from 'lucide-react';

export const Pipeline = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [pipelineData, setPipelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [movingLeadId, setMovingLeadId] = useState(null);

  // Pagination state:
  // stagePage: 0 = Funnel 1 (New -> Negotiation), 1 = Funnel 2 (Qualified -> Lost), -1 = All Stages
  const [stagePage, setStagePage] = useState(0);
  const [columnPages, setColumnPages] = useState({});
  const [cardsPerPage, setCardsPerPage] = useState(3);

  const allStages = [
    LEAD_STATUS.NEW,
    LEAD_STATUS.CONTACTED,
    LEAD_STATUS.DEMO_SCHEDULED,
    LEAD_STATUS.NEGOTIATION,
    LEAD_STATUS.QUALIFIED,
    LEAD_STATUS.WON,
    LEAD_STATUS.LOST,
  ];

  const visibleStages =
    stagePage === 0
      ? allStages.slice(0, 4)
      : stagePage === 1
      ? allStages.slice(4)
      : allStages;

  const fetchPipeline = async () => {
    try {
      const res = await leadApi.getPipeline();
      if (res.success && res.data) {
        setPipelineData(res.data);
      }
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to fetch pipeline stages'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
  }, []);

  const handleMoveStage = async (leadId, targetStage) => {
    if (!targetStage) return;

    if (targetStage === LEAD_STATUS.LOST) {
      const reason = window.prompt('Please provide a reason why this lead is lost:');
      if (!reason || !reason.trim()) {
        showToast('Lost reason is required.', 'warning');
        return;
      }
      setMovingLeadId(leadId);
      try {
        await leadApi.updateLead(leadId, { status: targetStage, lost_reason: reason.trim() });
        showToast(`Lead moved to Lost`, 'info');
        fetchPipeline();
      } catch (err) {
        showToast(extractErrorMessage(err, 'Move failed'), 'error');
      } finally {
        setMovingLeadId(null);
      }
      return;
    }

    setMovingLeadId(leadId);
    try {
      await leadApi.updateLead(leadId, { status: targetStage });
      showToast(
        `Lead moved to ${targetStage === LEAD_STATUS.DEMO_SCHEDULED ? 'Demo' : targetStage.replace('_', ' ')}`,
        'success'
      );
      fetchPipeline();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Move failed'), 'error');
    } finally {
      setMovingLeadId(null);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading sales pipeline stages..." />;
  }

  return (
    <div className="pipeline-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            <Kanban size={26} />
            <span>Sales Pipeline</span>
          </h1>
          <p className="page-subtitle">
            Visualize and transition deal progress across all stages
          </p>
        </div>
        <div className="page-actions">
          <Link to="/leads/create" className="btn btn-primary">
            <Plus size={18} />
            <span>Add Lead</span>
          </Link>
        </div>
      </div>

      {/* Stage Controls & Pagination Bar */}
      <div className="pipeline-controls-bar">
        <div className="pipeline-stage-pager">
          <span className="pipeline-pager-label">Stage Group:</span>
          <div className="pipeline-stage-tabs">
            <button
              type="button"
              className={`pipeline-tab-pill ${stagePage === 0 ? 'active' : ''}`}
              onClick={() => setStagePage(0)}
            >
              <span>1. Active Funnel</span>
              <span className="pipeline-pill-sub">(Stages 1–4)</span>
            </button>
            <button
              type="button"
              className={`pipeline-tab-pill ${stagePage === 1 ? 'active' : ''}`}
              onClick={() => setStagePage(1)}
            >
              <span>2. Closing & Won</span>
              <span className="pipeline-pill-sub">(Stages 5–7)</span>
            </button>
            <button
              type="button"
              className={`pipeline-tab-pill ${stagePage === -1 ? 'active' : ''}`}
              onClick={() => setStagePage(-1)}
            >
              <LayoutGrid size={14} />
              <span>All Stages</span>
            </button>
          </div>
        </div>

        <div className="pipeline-pager-nav">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-dim)' }}>
            <span>Cards/Page:</span>
            <select
              className="pipeline-move-select"
              value={cardsPerPage}
              onChange={(e) => setCardsPerPage(Number(e.target.value))}
              aria-label="Cards per column page"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
            >
              <option value={3}>3 cards</option>
              <option value={5}>5 cards</option>
              <option value={10}>10 cards</option>
            </select>
          </div>

          {stagePage !== -1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={stagePage === 0}
                onClick={() => setStagePage(0)}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
              >
                <ChevronLeft size={14} />
                <span>Prev</span>
              </button>
              <span className="pipeline-page-indicator">
                {stagePage + 1} / 2
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={stagePage === 1}
                onClick={() => setStagePage(1)}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`pipeline-board ${stagePage !== -1 ? 'fit-screen' : ''}`}>
        {visibleStages.map((stageKey) => {
          const stageConfig = LEAD_STATUS_CONFIG[stageKey];
          const columnData = pipelineData ? pipelineData[stageKey] : null;
          const allLeadsInStage = columnData ? columnData.leads : [];
          const count = columnData ? columnData.count : 0;
          const totalLeads = allLeadsInStage.length;

          // Column Cards Pagination
          const page = columnPages[stageKey] || 1;
          const totalPages = Math.max(1, Math.ceil(totalLeads / cardsPerPage));
          const safePage = Math.min(page, totalPages);
          const startIndex = (safePage - 1) * cardsPerPage;
          const paginatedLeads = allLeadsInStage.slice(startIndex, startIndex + cardsPerPage);

          // Calculate total expected value for stage
          const totalValue = allLeadsInStage.reduce(
            (acc, curr) => acc + (parseFloat(curr.expected_value) || 0),
            0
          );

          return (
            <div key={stageKey} className="pipeline-column">
              <div className="pipeline-column-header">
                <div className="pipeline-stage-title-group">
                  <span
                    className="stage-color-indicator"
                    style={{ backgroundColor: stageConfig.color }}
                  />
                  <span className="pipeline-stage-name">{stageConfig.label}</span>
                </div>
                <span className="pipeline-column-badge">{count}</span>
              </div>

              <div
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-dim)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                Value: <span className="text-main font-semibold">{formatCurrency(totalValue)}</span>
              </div>

              <div className="pipeline-cards-container">
                {totalLeads === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                    No leads in this stage
                  </div>
                ) : (
                  paginatedLeads.map((lead) => (
                    <div key={lead.id} className="pipeline-lead-card">
                      <div className="pipeline-card-top">
                        <div>
                          <Link to={`/leads/${lead.id}`} className="pipeline-lead-name">
                            {lead.name}
                          </Link>
                          <div className="pipeline-lead-company">
                            {lead.company_name || 'Individual'}
                          </div>
                        </div>
                        <PriorityBadge priority={lead.priority} />
                      </div>

                      <div className="pipeline-card-bottom">
                        <span className="pipeline-lead-value">
                          {formatCurrency(lead.expected_value)}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div
                            className="pipeline-assignee-avatar"
                            title={`Assigned to ${lead.assigned_to_details?.full_name || 'Unassigned'}`}
                          >
                            {getInitials(lead.assigned_to_details?.full_name || 'U')}
                          </div>

                          <select
                            className="pipeline-move-select"
                            value={lead.status}
                            disabled={movingLeadId === lead.id}
                            onChange={(e) => handleMoveStage(lead.id, e.target.value)}
                            aria-label="Move lead stage"
                          >
                            <option value="" disabled>Move to...</option>
                            {allStages.map((s) => (
                              <option key={s} value={s}>
                                → {s === LEAD_STATUS.DEMO_SCHEDULED ? 'Demo' : LEAD_STATUS_CONFIG[s].label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {totalPages > 1 && (
                <div className="pipeline-column-pagination">
                  <span className="pipeline-page-indicator">
                    {startIndex + 1}–{Math.min(startIndex + cardsPerPage, totalLeads)} of {totalLeads}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <button
                      type="button"
                      className="pipeline-page-btn"
                      disabled={safePage === 1}
                      onClick={() => setColumnPages((prev) => ({ ...prev, [stageKey]: safePage - 1 }))}
                      title="Previous leads"
                      aria-label="Previous leads page"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="pipeline-page-indicator" style={{ minWidth: '36px', textAlign: 'center' }}>
                      {safePage}/{totalPages}
                    </span>
                    <button
                      type="button"
                      className="pipeline-page-btn"
                      disabled={safePage === totalPages}
                      onClick={() => setColumnPages((prev) => ({ ...prev, [stageKey]: safePage + 1 }))}
                      title="Next leads"
                      aria-label="Next leads page"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
