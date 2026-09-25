import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { leadApi } from '../api/leadApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, getInitials } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';
import { LEAD_STATUS, LEAD_STATUS_CONFIG } from '../utils/constants';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { PriorityBadge } from '../components/PriorityBadge';
import { LostReasonModal } from '../components/LostReasonModal';
import { Kanban, Plus, ChevronLeft, ChevronRight, LayoutGrid, GripVertical } from 'lucide-react';

export const Pipeline = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [pipelineData, setPipelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [movingLeadId, setMovingLeadId] = useState(null);
  const [lostModalData, setLostModalData] = useState(null);
  const [lostSubmitting, setLostSubmitting] = useState(false);

  // Drag and Drop state & refs
  const [draggedLead, setDraggedLead] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const boardRef = useRef(null);
  const autoScrollRef = useRef(null);
  const pageFlipTimeoutRef = useRef(null);
  const lastPageFlipTimeRef = useRef(0);

  // Pagination state:
  // stagePage: 0 = Funnel 1 (New -> Negotiation), 1 = Funnel 2 (Qualified -> Lost), -1 = All Stages
  const [stagePage, setStagePage] = useState(0);
  const [columnPages, setColumnPages] = useState({});
  const [cardsPerPage, setCardsPerPage] = useState(3);

  // Dynamic stages loaded from pipeline endpoint
  const allStages = pipelineData ? Object.keys(pipelineData) : [];
  const midpoint = Math.ceil(allStages.length / 2) || 4;

  const visibleStages =
    stagePage === 0
      ? allStages.slice(0, midpoint)
      : stagePage === 1
      ? allStages.slice(midpoint)
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
    return () => {
      if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);
      if (pageFlipTimeoutRef.current) clearTimeout(pageFlipTimeoutRef.current);
    };
  }, []);

  const handleMoveStage = async (leadId, targetStage, sourceStage = null) => {
    if (!targetStage) return;

    // Find current stage if not provided
    if (!sourceStage && pipelineData) {
      for (const [stg, col] of Object.entries(pipelineData)) {
        if (col.leads && col.leads.some((l) => l.id === leadId)) {
          sourceStage = stg;
          break;
        }
      }
    }

    if (sourceStage === targetStage) return;

    const targetStageObj = pipelineData ? pipelineData[targetStage] : null;
    const targetStageId = targetStageObj?.id;
    const isLost =
      targetStage === LEAD_STATUS.LOST ||
      targetStage === 'lost' ||
      targetStageObj?.label?.toLowerCase() === 'lost';

    if (isLost) {
      let leadName = '';
      if (pipelineData) {
        for (const col of Object.values(pipelineData)) {
          const found = col.leads?.find((l) => l.id === leadId);
          if (found) {
            leadName = found.name;
            break;
          }
        }
      }
      setLostModalData({
        leadId,
        leadName,
        targetStage,
        targetStageId,
        sourceStage,
      });
      return;
    }

    // Optimistic UI update for instant, responsive feel
    const previousData = pipelineData ? JSON.parse(JSON.stringify(pipelineData)) : null;
    if (pipelineData && sourceStage) {
      const nextData = { ...pipelineData };
      let movedLeadObj = null;

      if (nextData[sourceStage]) {
        const sourceLeads = [...nextData[sourceStage].leads];
        const idx = sourceLeads.findIndex((l) => l.id === leadId);
        if (idx !== -1) {
          movedLeadObj = { ...sourceLeads[idx], status: targetStage };
          sourceLeads.splice(idx, 1);
          nextData[sourceStage] = {
            ...nextData[sourceStage],
            leads: sourceLeads,
            count: Math.max(0, nextData[sourceStage].count - 1),
          };
        }
      }

      if (movedLeadObj && nextData[targetStage]) {
        const targetLeads = [movedLeadObj, ...nextData[targetStage].leads];
        nextData[targetStage] = {
          ...nextData[targetStage],
          leads: targetLeads,
          count: nextData[targetStage].count + 1,
        };
        setPipelineData(nextData);
      }
    }

    setMovingLeadId(leadId);
    try {
      await leadApi.updateLead(leadId, {
        stage: targetStageId || undefined,
        status: targetStage,
      });
      showToast(
        `Lead moved to ${targetStageObj?.label || targetStage}`,
        'success'
      );
      // Fetch latest data to synchronize counts and values
      fetchPipeline();
    } catch (err) {
      // Revert optimistic update on failure
      if (previousData) {
        setPipelineData(previousData);
      }
      showToast(extractErrorMessage(err, 'Move failed'), 'error');
    } finally {
      setMovingLeadId(null);
    }
  };

  const handleConfirmLost = async (reason) => {
    if (!lostModalData) return;
    const { leadId, targetStage, targetStageId } = lostModalData;
    setLostSubmitting(true);
    setMovingLeadId(leadId);
    try {
      await leadApi.updateLead(leadId, {
        stage: targetStageId || undefined,
        status: targetStage,
        lost_reason: reason,
      });
      showToast('Lead moved to Lost', 'info');
      setLostModalData(null);
      fetchPipeline();
    } catch (err) {
      showToast(extractErrorMessage(err, 'Move failed'), 'error');
    } finally {
      setLostSubmitting(false);
      setMovingLeadId(null);
    }
  };

  const handleCancelLost = () => {
    setLostModalData(null);
  };

  // Auto-scroll and Edge Page-Flip Helpers
  const stopAutoScroll = () => {
    if (autoScrollRef.current) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  };

  const startAutoScroll = (speed) => {
    stopAutoScroll();
    const step = () => {
      if (boardRef.current) {
        boardRef.current.scrollLeft += speed;
      }
      autoScrollRef.current = requestAnimationFrame(step);
    };
    autoScrollRef.current = requestAnimationFrame(step);
  };

  const triggerPageFlip = (targetPage) => {
    const now = Date.now();
    if (now - lastPageFlipTimeRef.current < 500) return;
    lastPageFlipTimeRef.current = now;
    setStagePage(targetPage);
  };

  const handleEdgeDragOver = (e, direction) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!pageFlipTimeoutRef.current) {
      pageFlipTimeoutRef.current = setTimeout(() => {
        if (direction === 'next' && stagePage === 0) {
          triggerPageFlip(1);
        } else if (direction === 'prev' && stagePage === 1) {
          triggerPageFlip(0);
        }
        pageFlipTimeoutRef.current = null;
      }, 200);
    }
  };

  const handleEdgeDragLeave = () => {
    if (pageFlipTimeoutRef.current) {
      clearTimeout(pageFlipTimeoutRef.current);
      pageFlipTimeoutRef.current = null;
    }
  };

  const handleBoardDragOver = (e) => {
    if (!draggedLead || !boardRef.current) return;
    e.preventDefault();

    const rect = boardRef.current.getBoundingClientRect();
    const mouseX = e.clientX;
    const edgeMargin = 70;

    const canScrollRight = boardRef.current.scrollLeft + boardRef.current.clientWidth < boardRef.current.scrollWidth - 8;
    const canScrollLeft = boardRef.current.scrollLeft > 8;

    if (mouseX > rect.right - edgeMargin) {
      if (canScrollRight) {
        const speed = Math.min(18, Math.max(5, ((mouseX - (rect.right - edgeMargin)) / edgeMargin) * 18));
        startAutoScroll(speed);
      } else if (stagePage === 0) {
        if (!pageFlipTimeoutRef.current) {
          pageFlipTimeoutRef.current = setTimeout(() => {
            triggerPageFlip(1);
            pageFlipTimeoutRef.current = null;
          }, 250);
        }
      }
    } else if (mouseX < rect.left + edgeMargin) {
      if (canScrollLeft) {
        const speed = Math.min(18, Math.max(5, (((rect.left + edgeMargin) - mouseX) / edgeMargin) * 18));
        startAutoScroll(-speed);
      } else if (stagePage === 1) {
        if (!pageFlipTimeoutRef.current) {
          pageFlipTimeoutRef.current = setTimeout(() => {
            triggerPageFlip(0);
            pageFlipTimeoutRef.current = null;
          }, 250);
        }
      }
    } else {
      stopAutoScroll();
      if (pageFlipTimeoutRef.current) {
        clearTimeout(pageFlipTimeoutRef.current);
        pageFlipTimeoutRef.current = null;
      }
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, lead) => {
    setDraggedLead(lead);
    e.dataTransfer.setData('text/plain', String(lead.id));
    e.dataTransfer.setData('application/json', JSON.stringify({ leadId: lead.id, currentStage: lead.status }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
    setDragOverStage(null);
    stopAutoScroll();
    if (pageFlipTimeoutRef.current) {
      clearTimeout(pageFlipTimeoutRef.current);
      pageFlipTimeoutRef.current = null;
    }
  };

  const handleDragOver = (e, stageKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stageKey) {
      setDragOverStage(stageKey);
    }
  };

  const handleDragLeave = (e, stageKey) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (dragOverStage === stageKey) {
        setDragOverStage(null);
      }
    }
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    setDragOverStage(null);
    stopAutoScroll();

    let leadId = null;
    let sourceStage = null;

    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) {
        const parsed = JSON.parse(raw);
        leadId = parsed.leadId;
        sourceStage = parsed.currentStage;
      }
    } catch {
      // ignore JSON parse fallback
    }

    if (!leadId) {
      leadId = e.dataTransfer.getData('text/plain');
    }

    if (!leadId || !targetStage) {
      setDraggedLead(null);
      return;
    }

    leadId = Number(leadId);

    if (sourceStage === targetStage) {
      setDraggedLead(null);
      return;
    }

    await handleMoveStage(leadId, targetStage, sourceStage);
    setDraggedLead(null);
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
              className={`pipeline-tab-pill ${stagePage === 0 ? 'active' : ''} ${draggedLead && stagePage !== 0 ? 'dnd-target' : ''}`}
              onClick={() => setStagePage(0)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (stagePage !== 0) triggerPageFlip(0);
              }}
            >
              <span>1. Early Funnel</span>
              <span className="pipeline-pill-sub">(Stages 1–{midpoint})</span>
            </button>
            <button
              type="button"
              className={`pipeline-tab-pill ${stagePage === 1 ? 'active' : ''} ${draggedLead && stagePage !== 1 ? 'dnd-target' : ''}`}
              onClick={() => setStagePage(1)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (stagePage !== 1) triggerPageFlip(1);
              }}
            >
              <span>2. Closing Funnel</span>
              <span className="pipeline-pill-sub">(Stages {midpoint + 1}–{allStages.length})</span>
            </button>
            <button
              type="button"
              className={`pipeline-tab-pill ${stagePage === -1 ? 'active' : ''} ${draggedLead && stagePage !== -1 ? 'dnd-target' : ''}`}
              onClick={() => setStagePage(-1)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (stagePage !== -1) triggerPageFlip(-1);
              }}
            >
              <LayoutGrid size={14} />
              <span>All Stages</span>
            </button>
          </div>

          <div className="pipeline-dnd-tip">
            <GripVertical size={13} style={{ color: 'var(--primary)' }} />
            <span>Drag cards near screen edges or tabs to switch pages</span>
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
                className={`btn btn-secondary btn-sm ${draggedLead && stagePage !== 0 ? 'dnd-target' : ''}`}
                disabled={stagePage === 0}
                onClick={() => setStagePage(0)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (stagePage !== 0) triggerPageFlip(0);
                }}
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
                className={`btn btn-secondary btn-sm ${draggedLead && stagePage !== 1 ? 'dnd-target' : ''}`}
                disabled={stagePage === 1}
                onClick={() => setStagePage(1)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (stagePage !== 1) triggerPageFlip(1);
                }}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
              >
                <span>Next</span>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="pipeline-board-wrapper">
        {draggedLead && stagePage === 0 && (
          <div
            className="pipeline-edge-nav-zone right"
            onDragOver={(e) => handleEdgeDragOver(e, 'next')}
            onDragLeave={handleEdgeDragLeave}
            title="Drag here to switch to Closing & Won stages"
          >
            <div className="pipeline-edge-nav-content">
              <div className="pipeline-edge-icon-circle">
                <ChevronRight size={22} />
              </div>
              <span className="pipeline-edge-title">Next Stages</span>
              <span className="pipeline-edge-sub">Qualified • Won • Lost</span>
            </div>
          </div>
        )}

        {draggedLead && stagePage === 1 && (
          <div
            className="pipeline-edge-nav-zone left"
            onDragOver={(e) => handleEdgeDragOver(e, 'prev')}
            onDragLeave={handleEdgeDragLeave}
            title="Drag here to switch to Active Funnel stages"
          >
            <div className="pipeline-edge-nav-content">
              <div className="pipeline-edge-icon-circle">
                <ChevronLeft size={22} />
              </div>
              <span className="pipeline-edge-title">Previous Stages</span>
              <span className="pipeline-edge-sub">New • Contacted • Demo • Neg</span>
            </div>
          </div>
        )}

        <div
          ref={boardRef}
          onDragOver={handleBoardDragOver}
          className={`pipeline-board ${stagePage !== -1 ? 'fit-screen' : ''}`}
        >
        {visibleStages.map((stageKey) => {
          const columnData = pipelineData ? pipelineData[stageKey] : null;
          const stageConfig = columnData || LEAD_STATUS_CONFIG[stageKey] || { label: stageKey, color: '#6366F1' };
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

          const isOver = dragOverStage === stageKey;

          return (
            <div
              key={stageKey}
              className={`pipeline-column ${isOver ? 'drag-over' : ''}`}
              onDragOver={(e) => handleDragOver(e, stageKey)}
              onDragEnter={(e) => handleDragOver(e, stageKey)}
              onDragLeave={(e) => handleDragLeave(e, stageKey)}
              onDrop={(e) => handleDrop(e, stageKey)}
            >
              <div className="pipeline-column-header">
                <div className="pipeline-stage-title-group">
                  <span
                    className="stage-color-indicator"
                    style={{ backgroundColor: stageConfig.color }}
                  />
                  <span className="pipeline-stage-name">{stageConfig.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  {isOver && (
                    <span className="pipeline-drop-indicator-badge">Drop Here</span>
                  )}
                  <span className="pipeline-column-badge">{count}</span>
                </div>
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
                {isOver && draggedLead && (draggedLead.stage_details?.slug || draggedLead.status) !== stageKey && (
                  <div className="pipeline-drop-placeholder">
                    <span>Drop here to move to {stageConfig.label}</span>
                  </div>
                )}

                {totalLeads === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-dim)', fontSize: '0.8125rem' }}>
                    No leads in this stage
                  </div>
                ) : (
                  paginatedLeads.map((lead) => {
                    const isDraggingThis = draggedLead?.id === lead.id;
                    const currentLeadStageKey = lead.stage_details?.slug || lead.status;

                    return (
                      <div
                        key={lead.id}
                        className={`pipeline-lead-card ${isDraggingThis ? 'dragging' : ''}`}
                        draggable={movingLeadId !== lead.id}
                        onDragStart={(e) => handleDragStart(e, lead)}
                        onDragEnd={handleDragEnd}
                        title="Drag card to move between stages"
                      >
                        <div className="pipeline-card-top">
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.375rem', flex: 1, minWidth: 0 }}>
                            <GripVertical size={15} className="pipeline-drag-handle" title="Drag handle" />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <Link
                                to={`/leads/${lead.id}`}
                                className="pipeline-lead-name"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {lead.name}
                              </Link>
                              <div className="pipeline-lead-company">
                                {lead.company_name || 'Individual'}
                              </div>
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
                              value={currentLeadStageKey}
                              disabled={movingLeadId === lead.id}
                              onChange={(e) => handleMoveStage(lead.id, e.target.value, currentLeadStageKey)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label="Move lead stage"
                            >
                              <option value="" disabled>Move to...</option>
                              {allStages.map((s) => {
                                const col = pipelineData ? pipelineData[s] : null;
                                const label = col?.label || LEAD_STATUS_CONFIG[s]?.label || s;
                                return (
                                  <option key={s} value={s}>
                                    → {label}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })
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

      {/* In-App Lost Reason Modal */}
      <LostReasonModal
        isOpen={Boolean(lostModalData)}
        leadName={lostModalData?.leadName}
        loading={lostSubmitting}
        onConfirm={handleConfirmLost}
        onCancel={handleCancelLost}
      />
    </div>
  );
};
