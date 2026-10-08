import React from 'react';
import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { PLD_ICP_MIN_OPTIONS } from '../utils/constants';

const icpLabel = (value) =>
  PLD_ICP_MIN_OPTIONS.find((option) => option.value === value)?.label || value;

/**
 * Renders the configured stage gates for a lead: which stage requires what, and
 * whether this lead currently satisfies it.
 */
export const PldGateChecklist = ({ gates = [], onRunStageAssessment }) => {
  if (!gates.length) {
    return (
      <p className="text-muted font-sm" style={{ margin: 0 }}>
        No stage requirements have been configured yet. An admin can add them under
        Settings → PLD Engine.
      </p>
    );
  }

  return (
    <ul className="pld-gate-list">
      {gates.map((gate) => {
        const requirements = gate.requirements || {};
        const chips = [];
        if (requirements.icp_min_status) {
          chips.push(`ICP: ${icpLabel(requirements.icp_min_status)}+`);
        }
        if (requirements.pld_qualified) {
          chips.push(requirements.qualified_min_percentage ? `Qualified PLD (≥${requirements.qualified_min_percentage}%)` : 'Qualified PLD');
        }
        if (requirements.problems_assessed) chips.push('Stage assessment completed');
        if (requirements.notes) chips.push(requirements.notes);

        const latest = gate.latest_assessment;
        const isPldBlocked = !gate.satisfied && gate.missing?.some((m) => m.code === 'pld_status' || m.code === 'pld_assessment');

        return (
          <li
            className={`pld-gate-item ${gate.satisfied ? 'pld-gate-item-satisfied' : ''}`}
            key={gate.stage.id}
          >
            <span className="pld-gate-state" aria-hidden="true">
              {gate.satisfied ? <CheckCircle2 size={16} /> : <Lock size={16} />}
            </span>
            <div className="pld-gate-body">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span className="pld-gate-stage">{gate.stage.name}</span>
                {latest && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: latest.pld_status === 'QUALIFIED_PLD' ? '#059669' : '#dc2626',
                    }}
                  >
                    {latest.percentage}% ({latest.pld_status === 'QUALIFIED_PLD' ? 'Qualified' : 'Unqualified'})
                  </span>
                )}
              </div>
              <div className="pld-gate-chips">
                {chips.length === 0 ? (
                  <span className="text-dim font-sm">No requirements</span>
                ) : (
                  chips.map((chip) => (
                    <span className="pld-gate-chip" key={chip}>
                      {chip}
                    </span>
                  ))
                )}
              </div>
              {!gate.satisfied && gate.missing?.length > 0 && (
                <ul className="pld-gate-missing">
                  {gate.missing.map((item) => (
                    <li key={item.code}>{item.message}</li>
                  ))}
                </ul>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem', flexShrink: 0 }}>
              <span
                className={`pld-gate-verdict ${gate.satisfied ? 'pld-gate-verdict-ready' : ''}`}
              >
                {gate.satisfied ? 'Ready' : 'Blocked'}
              </span>
              {onRunStageAssessment && isPldBlocked && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem', whiteSpace: 'nowrap' }}
                  onClick={() => onRunStageAssessment(gate.stage.id, gate.stage.name)}
                >
                  Assess {gate.stage.name}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

/** Compact read-only summary used in narrow headers / list rows. */
export const PldGateSummary = ({ gates = [] }) => {
  if (!gates.length) return null;
  const blocked = gates.filter((gate) => !gate.satisfied).length;

  return (
    <span className="pld-gate-summary" title={`${blocked} of ${gates.length} stage gates blocked`}>
      <ShieldCheck size={14} />
      <span>
        {gates.length - blocked}/{gates.length} gates ready
      </span>
    </span>
  );
};
