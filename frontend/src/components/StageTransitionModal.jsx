import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  TrendingUp,
  ArrowRight,
  DollarSign,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Loader2,
  Check,
} from 'lucide-react';
import { useDialogA11y } from '../hooks/useDialogA11y';
import { formatCurrency } from '../utils/formatters';

const COMMON_LOST_REASONS = [
  'Competitor Chosen',
  'Budget Constraints',
  'Feature / Product Mismatch',
  'Lost Contact / Unresponsive',
  'Project Cancelled / Delayed',
  'Timing Not Right',
];

export default function StageTransitionModal({
  isOpen,
  lead,
  sourceStage,
  targetStage,
  loading = false,
  onConfirm,
  onCancel,
  onBack,
}) {
  const isLostStage =
    targetStage &&
    (targetStage.slug === 'lost' ||
      targetStage.name?.toLowerCase() === 'lost' ||
      targetStage.label?.toLowerCase() === 'lost');

  // Stage default probability and reason
  const stageDefaultProb = isLostStage
    ? 0
    : targetStage?.win_probability !== undefined && targetStage?.win_probability !== null
    ? targetStage.win_probability
    : 10;

  const stageDefaultReason = isLostStage
    ? ''
    : targetStage?.win_probability_reason || '';

  // Check if lead already has a win probability set (override takes precedence, then current probability)
  const leadHasOverride =
    lead?.win_probability_override !== null && lead?.win_probability_override !== undefined;

  const leadCurrentProb = leadHasOverride
    ? lead.win_probability_override
    : lead?.win_probability !== null && lead?.win_probability !== undefined
    ? lead.win_probability
    : null;

  const leadCurrentReason = lead?.win_probability_reason || '';

  // If lead already has a win probability set (e.g. 100% or any value), KEEP IT CONSTANT across all stages!
  const defaultProb = isLostStage
    ? 0
    : leadCurrentProb !== null
    ? leadCurrentProb
    : stageDefaultProb;

  const defaultReason = isLostStage
    ? (leadCurrentReason || 'Deal marked as lost')
    : (leadCurrentReason || stageDefaultReason);

  const [winProb, setWinProb] = useState(defaultProb);
  const [winReason, setWinReason] = useState(defaultReason);
  const [lostReason, setLostReason] = useState('');
  const [error, setError] = useState('');

  const reasonInputRef = useRef(null);
  const dialogRef = useDialogA11y(isOpen, () => {
    if (!loading) onCancel();
  });

  useEffect(() => {
    if (isOpen && targetStage) {
      setError('');
      if (isLostStage) {
        setWinProb(0);
        setWinReason(leadCurrentReason || 'Deal marked as lost');
        setLostReason(lead?.lost_reason || '');
      } else {
        // Pre-fill with constant lead probability if set, otherwise target stage's default
        setWinProb(defaultProb);
        setWinReason(defaultReason);
      }
      const t = setTimeout(() => {
        reasonInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(t);
    }
  }, [isOpen, targetStage, isLostStage, defaultProb, defaultReason, leadCurrentReason, lead]);

  if (!isOpen || !targetStage) return null;

  const leadName = lead?.name || lead?.lead_name || 'Prospect';
  const companyName = lead?.company_name || '';
  const expectedValue = parseFloat(lead?.expected_value) || 0;
  const weightedForecast = (expectedValue * (parseInt(winProb, 10) || 0)) / 100;

  const sourceName =
    typeof sourceStage === 'string'
      ? sourceStage
      : sourceStage?.name || sourceStage?.label || lead?.stage?.name || lead?.status || 'Current Stage';

  const targetName = targetStage.name || targetStage.label || 'Target Stage';
  const targetColor = targetStage.color || '#6366F1';

  const handleProbChange = (val) => {
    let num = parseInt(val, 10);
    if (isNaN(num)) num = 0;
    if (num < 0) num = 0;
    if (num > 100) num = 100;
    setWinProb(num);
  };

  const handleResetToStageDefault = () => {
    setWinProb(stageDefaultProb);
    setWinReason(stageDefaultReason);
  };

  const handleResetToConstantLeadProb = () => {
    if (leadCurrentProb !== null) {
      setWinProb(leadCurrentProb);
      setWinReason(leadCurrentReason || stageDefaultReason);
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (isLostStage && !lostReason.trim()) {
      setError('Please provide a reason why this lead is lost.');
      return;
    }
    setError('');
    onConfirm({
      targetStage,
      winProbability: parseInt(winProb, 10) || 0,
      winProbabilityReason: (winReason || '').trim(),
      lostReason: lostReason.trim(),
    });
  };

  return (
    <div
      className="modal-backdrop"
      onClick={!loading ? onCancel : undefined}
      role="dialog"
      aria-modal="true"
      aria-labelledby="stage-transition-title"
    >
      <div
        className="modal-container modal-container-md stage-transition-modal"
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <div
              className="modal-icon-badge"
              style={{
                backgroundColor: isLostStage ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                color: isLostStage ? 'var(--danger)' : 'var(--primary)',
                padding: '0.4rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isLostStage ? <AlertCircle size={20} /> : <TrendingUp size={20} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h3 id="stage-transition-title" style={{ fontSize: '1.1rem', margin: 0, fontWeight: 700 }}>
                  {isLostStage ? 'Mark Lead as Lost' : `Move Lead to ${targetName}`}
                </h3>
                {!isLostStage && (
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--primary-subtle)',
                      color: 'var(--primary)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                    }}
                  >
                    Step 2 of 2
                  </span>
                )}
              </div>
              <p className="text-dim font-xs" style={{ margin: '2px 0 0 0' }}>
                {leadName} {companyName ? `(${companyName})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: 'var(--danger)',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          {/* Stage Transition Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span className="text-dim font-xs">Current Stage</span>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-main)' }}>
                {sourceName}
              </span>
            </div>

            <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
              <ArrowRight size={18} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
              <span className="text-dim font-xs">Target Stage</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: targetColor,
                    display: 'inline-block',
                  }}
                />
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: targetColor }}>
                  {targetName}
                </span>
              </div>
            </div>
          </div>

          {/* Deal Value & Live Forecast Summary */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.75rem 1rem',
            }}
          >
            <div>
              <span className="text-dim font-xs">Deal Value</span>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--warning)', fontFamily: 'Outfit' }}>
                {formatCurrency(expectedValue)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="text-dim font-xs">Weighted Forecast ({winProb}%)</span>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--success)', fontFamily: 'Outfit' }}>
                {formatCurrency(weightedForecast)}
              </div>
            </div>
          </div>

          {/* Win Probability Option */}
          {!isLostStage ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>
                  Win Probability (%)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {leadCurrentProb !== null ? (
                    <span
                      className="funnel-prob-chip"
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.45rem',
                        background: 'rgba(34, 197, 94, 0.12)',
                        color: 'var(--success)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                      }}
                      title="Lead probability is kept constant across stages"
                    >
                      🔒 Constant: {winProb}%
                    </span>
                  ) : (
                    <span
                      className="funnel-prob-chip"
                      style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
                      title={`Default probability configured for ${targetName}`}
                    >
                      🎯 Stage Default: {stageDefaultProb}%
                    </span>
                  )}
                  {winProb !== stageDefaultProb && (
                    <button
                      type="button"
                      onClick={handleResetToStageDefault}
                      className="btn-ghost"
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.35rem',
                        cursor: 'pointer',
                        color: 'var(--primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        border: 'none',
                        background: 'transparent',
                      }}
                      title={`Apply ${targetName} stage default (${stageDefaultProb}%)`}
                    >
                      <RotateCcw size={11} /> Use Stage Default ({stageDefaultProb}%)
                    </button>
                  )}
                  {leadCurrentProb !== null && winProb !== leadCurrentProb && (
                    <button
                      type="button"
                      onClick={handleResetToConstantLeadProb}
                      className="btn-ghost"
                      style={{
                        fontSize: '0.72rem',
                        padding: '0.15rem 0.35rem',
                        cursor: 'pointer',
                        color: 'var(--success)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                        border: 'none',
                        background: 'transparent',
                      }}
                      title={`Restore constant lead probability (${leadCurrentProb}%)`}
                    >
                      <RotateCcw size={11} /> Restore Constant ({leadCurrentProb}%)
                    </button>
                  )}
                </div>
              </div>

              {/* Slider and Number Input Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={winProb}
                  onChange={(e) => handleProbChange(e.target.value)}
                  style={{
                    flex: 1,
                    accentColor: winProb === 100 ? 'var(--success)' : 'var(--primary)',
                    cursor: 'pointer',
                  }}
                />
                <div style={{ position: 'relative', width: '80px', flexShrink: 0 }}>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="form-control"
                    value={winProb}
                    onChange={(e) => handleProbChange(e.target.value)}
                    style={{
                      paddingRight: '1.4rem',
                      fontWeight: 700,
                      textAlign: 'center',
                      fontSize: '0.9rem',
                      color: winProb === 100 ? 'var(--success)' : undefined,
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      right: '0.5rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-dim)',
                      fontSize: '0.8rem',
                      pointerEvents: 'none',
                    }}
                  >
                    %
                  </span>
                </div>
              </div>

              {/* Quick Presets */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: 'var(--radius-sm)',
                    border: winProb === 100 ? '1px solid var(--success)' : '1px solid var(--border-subtle)',
                    background: winProb === 100 ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                    color: winProb === 100 ? 'var(--success)' : 'var(--text-main)',
                    fontWeight: winProb === 100 ? 700 : 500,
                    cursor: 'pointer',
                  }}
                  onClick={() => handleProbChange(100)}
                >
                  🎯 100% (Guaranteed Win)
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: 'var(--radius-sm)',
                    border: winProb === 75 ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                    background: winProb === 75 ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    color: winProb === 75 ? 'var(--primary)' : 'var(--text-main)',
                    fontWeight: winProb === 75 ? 700 : 500,
                    cursor: 'pointer',
                  }}
                  onClick={() => handleProbChange(75)}
                >
                  75%
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: 'var(--radius-sm)',
                    border: winProb === 50 ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                    background: winProb === 50 ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    color: winProb === 50 ? 'var(--primary)' : 'var(--text-main)',
                    fontWeight: winProb === 50 ? 700 : 500,
                    cursor: 'pointer',
                  }}
                  onClick={() => handleProbChange(50)}
                >
                  50%
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.2rem 0.55rem',
                    borderRadius: 'var(--radius-sm)',
                    border: winProb === 25 ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                    background: winProb === 25 ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    color: winProb === 25 ? 'var(--primary)' : 'var(--text-main)',
                    fontWeight: winProb === 25 ? 700 : 500,
                    cursor: 'pointer',
                  }}
                  onClick={() => handleProbChange(25)}
                >
                  25%
                </button>
              </div>

              <span className="text-dim font-xs" style={{ display: 'block', marginTop: '0.25rem' }}>
                {winProb === 100
                  ? '🔒 Win Probability is 100%. Once set, this probability stays constant across all stages.'
                  : '🔒 Any Win Probability (%) set will stay constant across all stages as this deal advances.'}
              </span>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                fontSize: '0.8125rem',
                color: 'var(--danger)',
              }}
            >
              <strong>Win Probability: 0%</strong> (Deal marked as Lost)
            </div>
          )}

          {/* Lost Reason Field (if moving to Lost stage) */}
          {isLostStage && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="form-label form-label-required" style={{ margin: 0, fontWeight: 600 }}>
                Lost Reason
              </label>
              <textarea
                ref={reasonInputRef}
                className="form-control"
                rows={2}
                placeholder="Specify why this opportunity was lost..."
                value={lostReason}
                onChange={(e) => {
                  setLostReason(e.target.value);
                  if (error) setError('');
                }}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                {COMMON_LOST_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setLostReason(r);
                      if (error) setError('');
                    }}
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      background: 'var(--bg-surface-elevated)',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Win Probability Reason / Rationale Field */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="form-label" style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>
                Win Probability Reason / Progression Rationale
              </label>
              {defaultReason && winReason !== defaultReason && (
                <button
                  type="button"
                  onClick={() => setWinReason(defaultReason)}
                  style={{
                    fontSize: '0.72rem',
                    padding: '0.15rem 0.35rem',
                    cursor: 'pointer',
                    color: 'var(--primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px',
                    border: 'none',
                    background: 'transparent',
                  }}
                  title="Fill with standard stage rationale"
                >
                  <Sparkles size={11} /> Use Stage Rationale
                </button>
              )}
            </div>
            <textarea
              ref={!isLostStage ? reasonInputRef : undefined}
              className="form-control"
              rows={3}
              placeholder={
                defaultReason ||
                'Explain why this probability applies to this deal (e.g. Budget signed off, buyer approved trial)...'
              }
              value={winReason}
              onChange={(e) => setWinReason(e.target.value)}
              style={{ fontSize: '0.8125rem', lineHeight: '1.4' }}
            />
            <span className="text-dim font-xs">
              Context or milestone rationale recorded in the opportunity timeline and funnel reports.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            {onBack && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onBack}
                disabled={loading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
              >
                ← Back to Checkpoints
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: isLostStage ? 'var(--danger)' : undefined,
                borderColor: isLostStage ? 'var(--danger)' : undefined,
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Moving Stage...</span>
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>Confirm & Move to {targetName}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

