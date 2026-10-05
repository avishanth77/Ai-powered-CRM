"""Stage gate evaluation.

A gate describes what a lead must already satisfy before it may sit in a stage.
Requirements are configured per ``LeadStage`` through ``PLDStageGate`` rows; a
stage without a row is ungated.
"""
from pld.models import ICP_RANK, PLDStatus, PLDStageGate

ICP_LABELS = dict(PLDStageGate._meta.get_field('require_icp_min_status').choices)


def get_gate(stage):
    """Return the gate configured for a stage, or None when the stage is ungated."""
    if stage is None:
        return None
    return PLDStageGate.objects.filter(stage=stage).first()


def check_gate(lead, stage):
    """
    Return the list of unmet requirements for putting ``lead`` into ``stage``.

    Each entry is ``{'code', 'message'}``. An empty list means the move is allowed.
    """
    gate = get_gate(stage)
    if gate is None or not gate.has_requirements:
        return []

    missing = []

    if gate.require_icp_min_status:
        current_rank = ICP_RANK.get(lead.icp_status, 0)
        required_rank = ICP_RANK.get(gate.require_icp_min_status, 0)
        if current_rank < required_rank:
            required_label = ICP_LABELS.get(gate.require_icp_min_status, gate.require_icp_min_status)
            missing.append({
                'code': 'icp_status',
                'message': f"ICP fit must be at least '{required_label}' (currently "
                           f"'{lead.get_icp_status_display()}').",
            })

    if gate.require_pld_qualified and lead.pld_status != PLDStatus.QUALIFIED_PLD:
        missing.append({
            'code': 'pld_status',
            'message': 'Lead must hold the Qualified PLD status before entering this stage.',
        })

    if gate.require_problems_assessed and not (lead.pk and lead.pld_assessments.exists()):
        missing.append({
            'code': 'pld_assessment',
            'message': 'A PLD assessment must be completed for this lead first.',
        })

    return missing


def _gate_dict(gate):
    return {
        'stage': {
            'id': gate.stage_id,
            'name': gate.stage.name,
            'slug': gate.stage.slug,
            'display_order': gate.stage.display_order,
        },
        'requirements': {
            'icp_min_status': gate.require_icp_min_status or None,
            'pld_qualified': gate.require_pld_qualified,
            'problems_assessed': gate.require_problems_assessed,
            'notes': gate.notes,
        },
    }


def gate_report(lead):
    """Every configured gate with its satisfied flag for the given lead."""
    gates = PLDStageGate.objects.select_related('stage').order_by('stage__display_order', 'stage__id')

    entries = []
    for gate in gates:
        entry = _gate_dict(gate)
        entry['missing'] = check_gate(lead, gate.stage)
        entry['satisfied'] = not entry['missing']
        entries.append(entry)

    return entries


def stage_gate_report(lead, stage):
    """Gate detail for a single target stage, including ungated stages."""
    gate = get_gate(stage)
    if gate is None:
        return {
            'gated': False,
            'satisfied': True,
            'missing': [],
            'stage': {'id': stage.id, 'name': stage.name, 'slug': stage.slug,
                      'display_order': stage.display_order},
            'requirements': {},
        }

    entry = _gate_dict(gate)
    missing = check_gate(lead, stage)
    entry.update({'gated': True, 'missing': missing, 'satisfied': not missing})
    return entry
