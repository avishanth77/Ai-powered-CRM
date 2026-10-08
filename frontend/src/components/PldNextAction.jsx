import React from 'react';
import { ArrowRight, Gauge, Target } from 'lucide-react';
import { ICP_STATUS, PLD_STATUS } from '../utils/constants';
import { PldGateSummary } from './PldGateChecklist';
import { PldStatusBadge } from './PldStatusBadge';

const asList = (value) => (Array.isArray(value) ? value : []);

const normalizeText = (value) => String(value ?? '').trim();

const toStageId = (value) => {
  const id = Number(value);
  return Number.isFinite(id) ? id : null;
};

const normalizeStage = (stage) => {
  if (!stage || typeof stage !== 'object') return null;
  const id = toStageId(stage.id);
  if (id === null) return null;
  const name = normalizeText(stage.name || stage.slug) || `Stage ${id}`;
  const slug = normalizeText(stage.slug).toLowerCase()
    || normalizeText(stage.name).toLowerCase().replace(/[\s_]+/g, '-');
  const displayOrder = Number(stage.display_order);
  return {
    id,
    name,
    slug,
    display_order: Number.isFinite(displayOrder) ? displayOrder : id,
    is_active: stage.is_active !== false,
  };
};

const resolveCurrentStage = (lead, stages) => {
  const fromLead = normalizeStage(lead?.stage_details);
  if (fromLead) return fromLead;
  const match = asList(stages).map(normalizeStage).find((stage) => stage?.id === toStageId(lead?.stage));
  if (match) return match;
  return { id: null, name: 'Current stage', slug: '', display_order: 0, is_active: true };
};

const orderedActiveStages = (stages) => asList(stages)
  .map(normalizeStage)
  .filter((stage) => stage && stage.is_active)
  .sort((a, b) => a.display_order - b.display_order || a.id - b.id);

const requirementTab = (code) => (code === 'icp_status' ? 'icp' : 'pld');

const requirementActionLabel = (code, tab) => {
  if (code === 'icp_status') return 'Complete ICP Qualification';
  if (code === 'pld_assessment') return 'Run PLD Assessment';
  if (tab === 'icp') return 'Open ICP Qualification';
  return 'Open PLD Assessment';
};

const getPldNextAction = ({ lead, stages, pldState, icpCount } = {}) => {
  const safeLead = lead && typeof lead === 'object' ? lead : {};
  const gates = asList(pldState?.gates);
  const assessmentCount = Number(pldState?.assessment_count) || 0;
  const pldScore = Number(safeLead.pld_score ?? pldState?.pld_score) || 0;
  const pldStatus = safeLead.pld_status || pldState?.pld_status || PLD_STATUS.NOT_ASSESSED;
  const icpStatus = safeLead.icp_status || ICP_STATUS.NOT_TESTED;
  const currentStage = resolveCurrentStage(safeLead, stages);

  if (currentStage.slug === 'lost') {
    return {
      currentStage,
      milestone: 'Lead',
      title: 'Lead is closed',
      detail: 'This lead was marked Lost. Its PLD score and history remain available below.',
      scoreText: assessmentCount > 0 ? `${pldScore} pts` : 'Not scored yet',
      pldStatus,
      action: null,
      secondaryAction: { kind: 'tab', tab: 'pld', label: 'Review PLD history' },
    };
  }

  if (currentStage.slug === 'won') {
    return {
      currentStage,
      milestone: pldStatus === PLD_STATUS.QUALIFIED_PLD ? 'Qualified PLD' : 'PLD Score',
      title: 'Opportunity won',
      detail: 'This lead completed the pipeline. Use the customer record for onboarding and expansion.',
      scoreText: assessmentCount > 0 ? `${pldScore} pts` : 'Not scored yet',
      pldStatus,
      action: null,
      secondaryAction: { kind: 'tab', tab: 'pld', label: 'Review PLD history' },
    };
  }

  if (icpStatus === ICP_STATUS.NOT_TESTED) {
    return {
      currentStage,
      milestone: 'ICP Qualification',
      title: 'Qualify the ideal customer profile',
      detail: 'Complete ICP Qualification before identifying scored problems.',
      scoreText: 'Not scored yet',
      pldStatus,
      action: {
        kind: 'tab',
        tab: 'icp',
        label: icpCount > 0 ? 'Continue ICP Qualification' : 'Start ICP Qualification',
      },
      secondaryAction: null,
    };
  }

  const assessed = assessmentCount > 0 || pldStatus !== PLD_STATUS.NOT_ASSESSED;
  if (!assessed) {
    return {
      currentStage,
      milestone: 'Problem Identification',
      title: 'Identify the customer problems',
      detail: 'Select the active PLD problems that apply. The score is calculated automatically.',
      scoreText: 'Not scored yet',
      pldStatus,
      action: { kind: 'tab', tab: 'pld', label: 'Run PLD Assessment' },
      secondaryAction: null,
    };
  }

  if (pldStatus !== PLD_STATUS.QUALIFIED_PLD) {
    return {
      currentStage,
      milestone: 'PLD Score',
      title: 'Improve the PLD score',
      detail: 'This lead is below the Qualified PLD cutoff. Review the selected problems and reassess.',
      scoreText: `${pldScore} pts`,
      pldStatus,
      action: { kind: 'tab', tab: 'pld', label: 'Review problems and reassess' },
      secondaryAction: null,
    };
  }

  const pipeline = orderedActiveStages(stages).filter((stage) => stage.slug !== 'lost');
  const currentIndex = pipeline.findIndex((stage) => currentStage.id !== null && stage.id === currentStage.id);
  const nextStage = currentIndex >= 0 ? pipeline[currentIndex + 1] || null : pipeline[0] || null;

  if (!nextStage) {
    return {
      currentStage,
      milestone: 'Qualified PLD',
      title: 'Qualified PLD',
      detail: 'This lead is qualified and has reached the final active pipeline stage.',
      scoreText: `${pldScore} pts`,
      pldStatus,
      action: null,
      secondaryAction: { kind: 'tab', tab: 'pld', label: 'Review PLD history' },
    };
  }

  const gate = gates.find((entry) => toStageId(entry?.stage?.id) === nextStage.id);
  if (gate && !gate.satisfied) {
    const missing = asList(gate.missing);
    const firstMissing = missing[0] || {};
    const isPld = firstMissing.code === 'pld_status' || firstMissing.code === 'pld_assessment';
    const tab = requirementTab(firstMissing.code);
    return {
      currentStage,
      milestone: 'Qualified PLD',
      title: `Unlock ${nextStage.name}`,
      detail: firstMissing.message || `Complete the remaining requirements for ${nextStage.name}.`,
      scoreText: `${pldScore} pts`,
      pldStatus,
      action: isPld
        ? { kind: 'stage-assess', stageId: nextStage.id, stageName: nextStage.name, label: `Assess for ${nextStage.name}` }
        : { kind: 'tab', tab, label: requirementActionLabel(firstMissing.code, tab) },
      secondaryAction: { kind: 'tab', tab: 'pld', label: 'Review stage requirements' },
    };
  }

  if (nextStage.slug === 'won') {
    return {
      currentStage,
      milestone: 'Qualified PLD',
      title: 'Ready for opportunity',
      detail: 'All configured requirements are satisfied. Convert this qualified lead to a customer.',
      scoreText: `${pldScore} pts`,
      pldStatus,
      action: { kind: 'convert', stageId: nextStage.id, stageName: nextStage.name, label: 'Convert to Customer' },
      secondaryAction: { kind: 'tab', tab: 'pld', label: 'Review stage requirements' },
    };
  }

  return {
    currentStage,
    milestone: 'Qualified PLD',
    title: `Ready for ${nextStage.name}`,
    detail: 'All configured requirements are satisfied. Move the lead to the next pipeline stage.',
    scoreText: `${pldScore} pts`,
    pldStatus,
    action: { kind: 'move', stageId: nextStage.id, label: `Move to ${nextStage.name}` },
    secondaryAction: { kind: 'tab', tab: 'pld', label: 'Review stage requirements' },
  };
};

/**
 * Compact PLD progress strip for the Lead page sidebar.
 * It only reads existing lead/stage/gate state and never changes scoring or gates.
 */
export const PldNextAction = ({
  lead,
  stages = [],
  pldState = {},
  icpCount = 0,
  onSelectTab,
  onMoveStage,
  onConvert,
  onRunStageAssessment,
}) => {
  if (!lead) return null;
  const next = getPldNextAction({ lead, stages, pldState, icpCount });
  const gates = asList(pldState?.gates);

  const handleAction = () => {
    if (!next.action) return;
    if (next.action.kind === 'stage-assess') {
      if (onRunStageAssessment) {
        onRunStageAssessment(next.action.stageId, next.action.stageName);
      } else {
        onSelectTab?.('pld');
      }
    } else if (next.action.kind === 'tab') {
      onSelectTab?.(next.action.tab);
    } else if (next.action.kind === 'move') {
      onMoveStage?.(next.action.stageId);
    } else if (next.action.kind === 'convert') {
      if (onConvert) {
        onConvert();
      } else if (next.action.stageId !== null && next.action.stageId !== undefined) {
        onMoveStage?.(next.action.stageId);
      } else {
        onSelectTab?.('pld');
      }
    }
  };

  const actionLabel = next.action && next.action.kind === 'convert' && !onConvert && next.action.stageName
    ? `Move to ${next.action.stageName}`
    : next.action?.label;

  const handleSecondary = () => {
    if (next.secondaryAction?.kind === 'tab') onSelectTab?.(next.secondaryAction.tab);
  };

  return (
    <section className="pld-next-action" aria-label="Current PLD stage and next action">
      <div className="pld-next-action-head">
        <span className="pld-next-action-eyebrow">
          <Gauge size={14} aria-hidden="true" />
          PLD progress
        </span>
        <PldStatusBadge status={next.pldStatus} size="sm" />
      </div>

      <div className="pld-next-action-stage">
        <span className="pld-next-action-label">Current stage</span>
        <strong>{next.currentStage.name} • {next.milestone}</strong>
      </div>

      <div className="pld-next-action-score">
        <span className="pld-next-action-label">PLD score</span>
        <span className="pld-score-chip">{next.scoreText}</span>
      </div>

      <p className="pld-next-action-title">{next.title}</p>
      <p className="pld-next-action-detail">{next.detail}</p>

      {next.action && (
        <div className="pld-next-action-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={handleAction}>
            {next.action.kind === 'tab' ? (
              <Target size={14} aria-hidden="true" />
            ) : (
              <ArrowRight size={14} aria-hidden="true" />
            )}
            <span>{actionLabel}</span>
          </button>
          {next.secondaryAction && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleSecondary}>
              <span>{next.secondaryAction.label}</span>
            </button>
          )}
        </div>
      )}

      <div className="pld-next-action-gates">
        {gates.length > 0 ? (
          <PldGateSummary gates={gates} />
        ) : (
          <span className="text-dim font-sm">No stage requirements configured.</span>
        )}
      </div>
    </section>
  );
};
