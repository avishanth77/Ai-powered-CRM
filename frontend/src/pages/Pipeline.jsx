import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { leadApi } from '../api/leadApi';
import { useToast } from '../context/ToastContext';
import { formatCurrency, getInitials } from '../utils/formatters';
import { extractErrorMessage } from '../utils/validation';
import { LEAD_STATUS_CONFIG } from '../utils/constants';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { PriorityBadge } from '../components/PriorityBadge';
import { LostReasonModal } from '../components/LostReasonModal';
import StageTaskCheckpointModal from '../components/StageTaskCheckpointModal';
import StageTransitionModal from '../components/StageTransitionModal';
import WinProbabilityFunnel from '../components/WinProbabilityFunnel';
import { productApi } from '../api/productApi';
import { useAuth } from '../context/AuthContext';
import { Kanban, Plus, ChevronLeft, ChevronRight, LayoutGrid, GripVertical, TrendingUp, Package, Filter } from 'lucide-react';

export const Pipeline = () => {
  const { showToast } = useToast();
  const { isManagerOrAdmin } = useAuth();

  const [pipelineData, setPipelineData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [movingLeadId, setMovingLeadId] = useState(null);
  const [lostModalData, setLostModalData] = useState(null);
  const [lostSubmitting, setLostSubmitting] = useState(false);
  const [checkpointModalData, setCheckpointModalData] = useState(null);
  const [transitionModalData, setTransitionModalData] = useState(null);
  const [transitionSubmitting, setTransitionSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('board'); // 'board' | 'funnel'
  const [productFilter, setProductFilter] = useState('');
  const [availableProducts, setAvailableProducts] = useState([]);

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
  const midpoint = allStages.length === 0 ? 0 : Math.ceil(allStages.length / 2);

  // Pipeline keys are lowercase slugs; LEAD_STATUS_CONFIG uses uppercase keys.
  const normalizeStatusKey = (value) => (value || '').toUpperCase().replace(/-/g, '_');

  const visibleStages =
    stagePage === 0
      ? allStages.slice(0, midpoint)
      : stagePage === 1
      ? allStages.slice(midpoint)
      : allStages;

  const fetchPipeline = async (prodId = productFilter) => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (prodId) params.product = prodId;
      const res = await leadApi.getPipeline(params);
      if (res.success && res.data) {
        setPipelineData(res.data);
        setColumnPages({});
      } else {
        setError('No pipeline data was returned.');
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to fetch pipeline stages'));
      showToast(extractErrorMessage(err, 'Failed to fetch pipeline stages'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    productApi
      .getSimpleProducts()
      .then((data) => setAvailableProducts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchPipeline(productFilter);
    return () => {
      if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);
      if (pageFlipTimeoutRef.current) clearTimeout(pageFlipTimeoutRef.current);
    };
  }, [productFilter]);

  const handleMoveStage = (leadId, targetStage, sourceStage = null) => {
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

    let leadObj = null;
    if (pipelineData) {
      for (const col of Object.values(pipelineData)) {
        const found = col.leads?.find((l) => l.id === leadId);
        if (found) {
          leadObj = found;
          break;
        }
      }
    }

    const targetStageObj = pipelineData ? pipelineData[targetStage] : null;
    const targetStageId = targetStageObj?.id;
    const sourceStageObj = pipelineData && sourceStage ? pipelineData[sourceStage] : null;

    const isLost =
      targetStage === 'lost' ||
      targetStageObj?.label?.toLowerCase() === 'lost';

    if (isLost) {
      // Mark as Lost directly opens transition modal with 0% win prob and lost reason
      setTransitionModalData({
        lead: leadObj || { id: leadId, name: `Lead #${leadId}` },
        sourceStage: sourceStageObj?.label || sourceStage,
        targetStage: {
          id: targetStageId,
          name: targetStageObj?.label || targetStage,
          slug: targetStage,
          color: targetStageObj?.color,
          win_probability: 0,
          win_probability_reason: '',
        },
        targetStageKey: targetStage,
        sourceStageKey: sourceStage,
      });
      return;
    }

    // Step 1: Open Stage Progression Checkpoint FIRST!
    setCheckpointModalData({
      lead: leadObj || { id: leadId, name: `Lead #${leadId}`, stage: { id: sourceStage, name: sourceStage } },
      sourceStage: sourceStageObj?.label || sourceStage,
      targetStage: {
        id: targetStageId,
        name: targetStageObj?.label || targetStage,
        slug: targetStage,
        color: targetStageObj?.color,
        win_probability: targetStageObj?.win_probability,
        win_probability_reason: targetStageObj?.win_probability_reason,
      },
      targetStageKey: targetStage,
      sourceStageKey: sourceStage,
    });
  };

  const handleProceedFromCheckpoint = ({ lead, targetStage, sourceStage }) => {
    const targetStageKey = checkpointModalData?.targetStageKey || targetStage?.slug || targetStage?.name;
    const sourceStageKey = checkpointModalData?.sourceStageKey || sourceStage;
    setCheckpointModalData(null);
    setTransitionModalData({
      lead,
      sourceStage: sourceStage || checkpointModalData?.sourceStage,
      targetStage,
      targetStageKey,
      sourceStageKey,
    });
  };

  const handleConfirmTransition = async ({ targetStage, winProbability, winProbabilityReason, lostReason }) => {
    if (!transitionModalData) return;
    const { lead, targetStageKey } = transitionModalData;
    const leadId = lead.id;
    const targetStageId = targetStage.id;
    const isLost =
      targetStageKey === 'lost' ||
      targetStage.slug === 'lost' ||
      targetStage.name?.toLowerCase() === 'lost';

    setTransitionSubmitting(true);
    setMovingLeadId(leadId);

    try {
      const payload = {
        stage: targetStageId || undefined,
        status: targetStageKey,
        win_probability_override: winProbability,
        win_probability_reason: winProbabilityReason,
      };
      if (isLost && lostReason) {
        payload.lost_reason = lostReason;
      }

      const updateRes = await leadApi.updateLead(leadId, payload);
      const autoCount = updateRes?.automated_tasks?.length || 0;
      showToast(
        `Lead moved to ${targetStage.name}${autoCount > 0 ? ` (${autoCount} automated task${autoCount > 1 ? 's' : ''} assigned)` : ''}`,
        'success'
      );
      setTransitionModalData(null);
      fetchPipeline();
    } catch (err) {
      const errData = err.response?.data;
      const missingList =
        errData?.missing ||
        errData?.errors?.missing ||
        errData?.missing_codes ||
        errData?.errors?.missing_codes ||
        [];
      const errorMsg = String(errData?.message || errData?.errors?.stage || '');
      const hasStageTasksMissing =
        missingList.includes('mandatory_tasks') ||
        Boolean(errData?.missing_tasks?.length) ||
        errorMsg.toLowerCase().includes('mandatory task') ||
        errorMsg.toLowerCase().includes('manager approval') ||
        Boolean(errData?.manager_approval_required);

      if (hasStageTasksMissing) {
        setTransitionModalData(null);
        setCheckpointModalData({
          lead: lead,
          targetStage: {
            id: targetStageId,
            name: targetStage.name,
            win_probability: winProbability,
            win_probability_reason: winProbabilityReason,
          },
          missingTasks: errData?.missing_tasks || [],
          errorMessage: errorMsg,
        });
      } else {
        showToast(extractErrorMessage(err, 'Move failed'), 'error');
      }
    } finally {
      setTransitionSubmitting(false);
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

  if (!pipelineData) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h3>Unable to load pipeline</h3>
        <p className="text-muted" style={{ margin: '0.5rem 0 1.5rem' }}>{error || 'No pipeline data was returned.'}</p>
        <button className="btn btn-primary" onClick={fetchPipeline}>
          Retry
        </button>
      </div>
    );
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
        <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.2rem 0.5rem' }}>
            <Package size={14} className="text-primary" />
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                fontSize: '0.8125rem',
                outline: 'none',
                cursor: 'pointer',
              }}
              aria-label="Filter pipeline by product"
            >
              <option value="">All Products ({availableProducts.length})</option>
              {availableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
            {productFilter && (
              <button
                type="button"
                onClick={() => setProductFilter('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: '0 2px',
                }}
                title="Clear product filter"
              >
                ✕
              </button>
            )}
          </div>

          <div className="filter-pills-group" style={{ margin: 0 }}>
            <button
              type="button"
              className={`filter-pill-btn ${viewMode === 'board' ? 'active' : ''}`}
              onClick={() => setViewMode('board')}
            >
              <Kanban size={13} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} />
              Kanban Board
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${viewMode === 'funnel' ? 'active' : ''}`}
              onClick={() => setViewMode('funnel')}
            >
              <TrendingUp size={13} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} />
              Win Probability Funnel
            </button>
          </div>

          <Link to="/leads/create" className="btn btn-primary">
            <Plus size={18} />
            <span>Add Lead</span>
          </Link>
        </div>
      </div>

      {viewMode === 'funnel' ? (
        <div style={{ marginTop: '1rem' }}>
          <WinProbabilityFunnel />
        </div>
      ) : (
        <>
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
          const stageConfig = columnData || LEAD_STATUS_CONFIG[normalizeStatusKey(stageKey)] || { label: stageKey, color: '#6366F1' };
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
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  Value: <span className="text-main font-semibold">{formatCurrency(totalValue)}</span>
                </div>
                <div
                  className="funnel-prob-chip"
                  style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', cursor: 'help' }}
                  title={stageConfig.win_probability_reason ? `${stageConfig.win_probability_reason}` : `Win probability: ${stageConfig.win_probability ?? 10}%`}
                >
                  🎯 {stageConfig.win_probability ?? 10}%
                </div>
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
                              {lead.products && lead.products.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginTop: '0.3rem' }}>
                                  {lead.products.slice(0, 2).map((p) => (
                                    <span
                                      key={p.id}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        fontSize: '0.65rem',
                                        padding: '0.1rem 0.35rem',
                                        borderRadius: '4px',
                                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                        color: 'var(--primary)',
                                        border: '1px solid rgba(99, 102, 241, 0.25)',
                                        maxWidth: '120px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                      }}
                                      title={`${p.name} (${p.code}) - ${formatCurrency(p.unit_price)}`}
                                    >
                                      <Package size={9} />
                                      {p.name}
                                    </span>
                                  ))}
                                  {lead.products.length > 2 && (
                                    <span
                                      style={{
                                        fontSize: '0.65rem',
                                        padding: '0.1rem 0.3rem',
                                        borderRadius: '4px',
                                        backgroundColor: 'var(--bg-card-subtle)',
                                        color: 'var(--text-dim)',
                                      }}
                                      title={lead.products.slice(2).map((p) => p.name).join(', ')}
                                    >
                                      +{lead.products.length - 2}
                                    </span>
                                  )}
                                </div>
                              )}
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
                              aria-label={`Move ${lead.name} to another stage`}
                            >
                              <option value="" disabled>Move to...</option>
                              {allStages.map((s) => {
                                const col = pipelineData ? pipelineData[s] : null;
                                const label = col?.label || LEAD_STATUS_CONFIG[normalizeStatusKey(s)]?.label || s;
                                return (
                                  <option key={s} value={s}>
                                    → {label}
                                  </option>
                                );
                              })}
                            </select>
                          </div>
                        </div>

                        {lead.stage_task_summary && (
                          <div
                            style={{
                              marginTop: '0.5rem',
                              paddingTop: '0.4rem',
                              borderTop: '1px solid rgba(255,255,255,0.06)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '0.6875rem'
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                fontWeight: 600,
                                padding: '0.125rem 0.4rem',
                                borderRadius: '9999px',
                                backgroundColor: lead.stage_task_summary.can_progress ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: lead.stage_task_summary.can_progress ? '#10b981' : '#f59e0b',
                                border: `1px solid ${lead.stage_task_summary.can_progress ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                              }}
                            >
                              {lead.stage_task_summary.can_progress ? '✓ Ready' : '⏳ Tasks Pending'}
                            </span>
                            <Link
                              to={`/leads/${lead.id}?tab=stage-tasks`}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                color: 'var(--primary)',
                                textDecoration: 'none',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                              }}
                              title="Click to view stage tasks for this deal"
                            >
                              {lead.stage_task_summary.completed_mandatory_tasks}/{lead.stage_task_summary.mandatory_tasks} Tasks →
                            </Link>
                          </div>
                        )}
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
        </>
      )}

      {/* In-App Lost Reason Modal */}
      <LostReasonModal
        isOpen={Boolean(lostModalData)}
        leadName={lostModalData?.leadName}
        loading={lostSubmitting}
        onConfirm={handleConfirmLost}
        onCancel={handleCancelLost}
      />

      {/* Step 1: Stage Task Checkpoint Modal */}
      {checkpointModalData && (
        <StageTaskCheckpointModal
          isOpen={Boolean(checkpointModalData)}
          onClose={() => setCheckpointModalData(null)}
          lead={checkpointModalData.lead}
          targetStage={checkpointModalData.targetStage}
          sourceStage={checkpointModalData.sourceStage}
          missingTasks={checkpointModalData.missingTasks}
          errorMessage={checkpointModalData.errorMessage}
          isManagerOrAdmin={isManagerOrAdmin}
          onProceedToWinProbability={handleProceedFromCheckpoint}
          onAdvanceSuccess={() => {
            showToast(`Lead advanced to ${checkpointModalData.targetStage?.name || 'next stage'} successfully!`, 'success');
            setCheckpointModalData(null);
            fetchPipeline();
          }}
        />
      )}

      {/* Step 2: Stage Transition & Win Probability Modal */}
      {transitionModalData && (
        <StageTransitionModal
          isOpen={Boolean(transitionModalData)}
          lead={transitionModalData.lead}
          sourceStage={transitionModalData.sourceStage}
          targetStage={transitionModalData.targetStage}
          loading={transitionSubmitting}
          onConfirm={handleConfirmTransition}
          onCancel={() => setTransitionModalData(null)}
          onBack={() => {
            if (transitionModalData.targetStageKey === 'lost') {
              setTransitionModalData(null);
              return;
            }
            const prev = transitionModalData;
            setTransitionModalData(null);
            setCheckpointModalData({
              lead: prev.lead,
              targetStage: prev.targetStage,
              sourceStage: prev.sourceStage,
              targetStageKey: prev.targetStageKey,
              sourceStageKey: prev.sourceStageKey,
            });
          }}
        />
      )}
    </div>
  );
};
