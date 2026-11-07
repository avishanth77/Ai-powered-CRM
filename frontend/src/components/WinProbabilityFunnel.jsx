import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Percent,
  DollarSign,
  Info,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { leadApi } from '../api/leadApi';
import { formatCurrency } from '../utils/formatters';
import '../styles/funnel.css';

/**
 * Opportunity Stage Distribution & Win Probability Funnel
 * Matches the reference funnel diagram with SVG stacked trapezoid slices,
 * leader lines with percentage markers, stage legend, and reason rationales.
 */
export default function WinProbabilityFunnel({
  initialData = null,
  onStageClick = null,
  showBreakdownTable = true,
  compact = false,
}) {
  const parseFunnelPayload = (raw) => {
    if (!raw) return null;
    if (raw.data && (raw.data.stages || raw.data.total_leads !== undefined)) return raw.data;
    if (raw.stages || raw.total_leads !== undefined) return raw;
    return raw;
  };

  const [funnelData, setFunnelData] = useState(() => parseFunnelPayload(initialData));
  const [loading, setLoading] = useState(!initialData);
  const [selectedMetric, setSelectedMetric] = useState('distribution'); // 'distribution' | 'win_probability' | 'weighted_value'
  const [hoveredStageId, setHoveredStageId] = useState(null);

  useEffect(() => {
    if (!initialData) {
      loadFunnel();
    } else {
      setFunnelData(parseFunnelPayload(initialData));
    }
  }, [initialData]);

  const loadFunnel = async () => {
    setLoading(true);
    try {
      const res = await leadApi.getWinProbabilityFunnel();
      setFunnelData(parseFunnelPayload(res));
    } catch (err) {
      console.error('Failed to load win probability funnel:', err);
    } finally {
      setLoading(false);
    }
  };

  const stages = funnelData?.stages || [];
  const totalLeads = funnelData?.total_leads || 0;
  const totalPipelineValue = funnelData?.total_pipeline_value || 0;
  const totalWeightedForecast = funnelData?.total_weighted_forecast || 0;

  // Active stages for the funnel graphic
  const displayStages = stages.filter((s) => s.is_active !== false);

  // SVG Geometry Dimensions
  const svgWidth = compact ? 620 : 760;
  const svgHeight = compact ? 340 : 420;

  const funnelTopY = 30;
  const funnelHeight = compact ? 280 : 340;
  const centerX = compact ? 220 : 260;
  const topHalfWidth = compact ? 140 : 180; // Total top width = 280 or 360
  const neckHalfWidth = 32; // Total neck width = 64
  const gap = 3; // Gap between slices

  const numSlices = displayStages.length;
  const sliceHeight = numSlices > 0 ? (funnelHeight - (numSlices - 1) * gap) / numSlices : 40;

  // Calculate slice coordinates
  // Slices taper down from topHalfWidth to neckHalfWidth, then straight down for the last 2 slices
  const slicePoints = displayStages.map((stg, i) => {
    const yTop = funnelTopY + i * (sliceHeight + gap);
    const yBottom = yTop + sliceHeight;

    // Proportion through funnel (0 at top, 1 at neck threshold)
    const neckThresholdIndex = Math.max(1, numSlices - 2);
    let topW, bottomW;

    if (i < neckThresholdIndex) {
      const tTop = i / neckThresholdIndex;
      const tBottom = (i + 1) / neckThresholdIndex;
      topW = topHalfWidth - tTop * (topHalfWidth - neckHalfWidth);
      bottomW = topHalfWidth - tBottom * (topHalfWidth - neckHalfWidth);
    } else {
      topW = neckHalfWidth;
      bottomW = neckHalfWidth;
    }

    const xTopLeft = centerX - topW;
    const xTopRight = centerX + topW;
    const xBottomLeft = centerX - bottomW;
    const xBottomRight = centerX + bottomW;

    const points = `${xTopLeft},${yTop} ${xTopRight},${yTop} ${xBottomRight},${yBottom} ${xBottomLeft},${yBottom}`;

    // Leader line anchor & label
    const rightMidX = (xTopRight + xBottomRight) / 2;
    const midY = (yTop + yBottom) / 2;
    const leaderLineEndX = compact ? 390 : 450;
    const labelX = leaderLineEndX + 10;

    // Value to display depending on selected metric
    let displayVal = `${stg.win_probability}%`;
    if (selectedMetric === 'distribution') {
      displayVal = `${stg.distribution_percentage?.toFixed(1) || '0.0'}%`;
    } else if (selectedMetric === 'weighted_value') {
      displayVal = formatCurrency(stg.weighted_value || 0);
    }

    return {
      stage: stg,
      points,
      midY,
      rightMidX,
      leaderLineEndX,
      labelX,
      displayVal,
    };
  });

  return (
    <div className="win-probability-funnel-card">
      {/* 1. Header with Title & Metric Switcher */}
      <div className="funnel-card-header">
        <div className="funnel-header-left">
          <h3 className="funnel-main-title">
            <TrendingUp size={20} className="text-primary" />
            <span>Opportunity Stage Distribution & Win Probability Funnel</span>
          </h3>
          <p className="funnel-main-subtitle">
            Visual funnel of lead progression, stage win probabilities, rationale, and weighted revenue forecast.
          </p>
        </div>

        {/* Metric Switcher */}
        <div className="funnel-metrics-toggle">
          <button
            type="button"
            onClick={() => setSelectedMetric('distribution')}
            className={`funnel-metric-btn ${selectedMetric === 'distribution' ? 'active' : ''}`}
            title="Percentage of total deals in each stage"
          >
            Stage Distribution %
          </button>
          <button
            type="button"
            onClick={() => setSelectedMetric('win_probability')}
            className={`funnel-metric-btn ${selectedMetric === 'win_probability' ? 'active' : ''}`}
            title="Configured Win Probability for each stage"
          >
            Win Probability %
          </button>
          <button
            type="button"
            onClick={() => setSelectedMetric('weighted_value')}
            className={`funnel-metric-btn ${selectedMetric === 'weighted_value' ? 'active' : ''}`}
            title="Forecasted Expected Revenue (Value x Win%)"
          >
            Weighted Forecast ($)
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Boxes */}
      {!compact && (
        <div className="funnel-kpi-grid">
          <div className="funnel-kpi-box">
            <span className="funnel-kpi-label">Active Opportunities</span>
            <span className="funnel-kpi-value">{totalLeads}</span>
            <span className="funnel-kpi-sub">Total active leads in pipeline</span>
          </div>

          <div className="funnel-kpi-box">
            <span className="funnel-kpi-label">Total Pipeline Value</span>
            <span className="funnel-kpi-value">{formatCurrency(totalPipelineValue)}</span>
            <span className="funnel-kpi-sub">Sum of all expected values</span>
          </div>

          <div className="funnel-kpi-box">
            <span className="funnel-kpi-label">Weighted Win Forecast</span>
            <span className="funnel-kpi-value" style={{ color: 'var(--primary)' }}>
              {formatCurrency(totalWeightedForecast)}
            </span>
            <span className="funnel-kpi-sub">Expected revenue factored by stage win %</span>
          </div>
        </div>
      )}

      {/* 3. SVG Funnel Chart */}
      <div className="funnel-svg-container">
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>Loading funnel data...</p>
          </div>
        ) : displayStages.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>No active stages found.</p>
          </div>
        ) : (
          <svg
            className="funnel-svg"
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Defs for gradients & filters */}
            <defs>
              <filter id="funnel-shadow" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.08" />
              </filter>
            </defs>

            {/* Funnel Slices */}
            {slicePoints.map(({ stage, points }) => {
              const isHovered = hoveredStageId === stage.id;
              const isDimmed = hoveredStageId !== null && !isHovered;

              return (
                <polygon
                  key={stage.id}
                  points={points}
                  fill={stage.color || '#6366F1'}
                  className={`funnel-slice ${isHovered ? 'active' : ''} ${isDimmed ? 'dimmed' : ''}`}
                  onMouseEnter={() => setHoveredStageId(stage.id)}
                  onMouseLeave={() => setHoveredStageId(null)}
                  onClick={() => onStageClick && onStageClick(stage)}
                />
              );
            })}

            {/* Leader Lines and Percentage Text */}
            {slicePoints.map(({ stage, midY, rightMidX, leaderLineEndX, labelX, displayVal }) => {
              const isHovered = hoveredStageId === stage.id;

              return (
                <g
                  key={`label-${stage.id}`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredStageId(stage.id)}
                  onMouseLeave={() => setHoveredStageId(null)}
                  onClick={() => onStageClick && onStageClick(stage)}
                >
                  {/* Leader line from right edge of funnel to the label */}
                  <line
                    x1={rightMidX + 4}
                    y1={midY}
                    x2={leaderLineEndX}
                    y2={midY}
                    stroke="var(--border-strong)"
                    strokeWidth="1.2"
                    strokeDasharray={isHovered ? 'none' : '2,2'}
                  />

                  {/* Percentage Label */}
                  <text
                    x={labelX}
                    y={midY + 4}
                    fill={isHovered ? 'var(--primary)' : 'var(--text-main)'}
                    fontSize={compact ? '11px' : '12.5px'}
                    fontWeight={isHovered ? '700' : '600'}
                  >
                    {displayVal}
                  </text>
                </g>
              );
            })}

            {/* Stage Legend on the Right */}
            <g transform={`translate(${compact ? 490 : 560}, ${funnelTopY})`}>
              {displayStages.map((stage, idx) => {
                const itemY = idx * (sliceHeight + gap) + sliceHeight / 2;
                const isHovered = hoveredStageId === stage.id;

                return (
                  <g
                    key={`legend-${stage.id}`}
                    transform={`translate(0, ${itemY - 6})`}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredStageId(stage.id)}
                    onMouseLeave={() => setHoveredStageId(null)}
                    onClick={() => onStageClick && onStageClick(stage)}
                  >
                    {/* Mini funnel polygon marker */}
                    <polygon
                      points="0,0 12,0 8,8 8,13 4,13 4,8"
                      fill={stage.color || '#6366F1'}
                    />

                    {/* Stage Name */}
                    <text
                      x="18"
                      y="10"
                      fill={isHovered ? 'var(--primary)' : 'var(--text-main)'}
                      fontSize={compact ? '11px' : '12px'}
                      fontWeight={isHovered ? '700' : '500'}
                    >
                      {stage.name}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>

      {/* 4. Detailed Stage Breakdown & Rationale Cards */}
      {showBreakdownTable && displayStages.length > 0 && (
        <div className="funnel-stages-breakdown">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
            <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Stage Win Probabilities & Qualification Milestones
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {displayStages.length} Stages Configured
            </span>
          </div>

          {displayStages.map((stg) => {
            const isHovered = hoveredStageId === stg.id;

            return (
              <div
                key={stg.id}
                className="funnel-stage-row"
                style={{
                  borderLeft: `4px solid ${stg.color || '#6366F1'}`,
                  borderColor: isHovered ? 'var(--primary)' : undefined,
                }}
                onMouseEnter={() => setHoveredStageId(stg.id)}
                onMouseLeave={() => setHoveredStageId(null)}
              >
                <div className="funnel-stage-row-left">
                  <div
                    className="funnel-stage-color-indicator"
                    style={{ backgroundColor: stg.color || '#6366F1' }}
                  />

                  <div className="funnel-stage-info">
                    <div className="funnel-stage-name-wrap">
                      <h5 className="funnel-stage-name">{stg.name}</h5>

                      {/* Win Probability Chip */}
                      <span className="funnel-prob-chip">
                        🎯 {stg.win_probability}% Win Probability
                      </span>

                      {/* Distribution Tag */}
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.15rem 0.45rem',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-surface-elevated)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {stg.leads_count} {stg.leads_count === 1 ? 'deal' : 'deals'} (
                        {stg.distribution_percentage?.toFixed(1) || '0.0'}%)
                      </span>
                    </div>

                    {/* Reason / Rationale */}
                    <p className="funnel-reason-text">
                      <strong style={{ color: 'var(--text-main)' }}>Milestone / Reason:</strong>{' '}
                      {stg.win_probability_reason || (
                        <span style={{ fontStyle: 'italic', color: 'var(--text-dim)' }}>
                          No rationale specified for this stage.
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Right side stats: Pipeline Value & Weighted Forecast */}
                <div className="funnel-stage-stats-group">
                  <div className="funnel-stat-item">
                    <span className="funnel-stat-item-label">Pipeline Value</span>
                    <span className="funnel-stat-item-val">
                      {formatCurrency(stg.total_value || 0)}
                    </span>
                  </div>

                  <div className="funnel-stat-item">
                    <span className="funnel-stat-item-label">Weighted Forecast</span>
                    <span className="funnel-stat-item-val" style={{ color: 'var(--primary)' }}>
                      {formatCurrency(stg.weighted_value || 0)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}