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

    Each entry is ``{'code', 'message', ...}``. An empty list means the move is allowed.
    """
    gate = get_gate(stage)
    if gate is None or not gate.has_requirements:
        return []

    # Moving to 'lost' is never blocked by PLD/ICP gates
    if stage and (stage.slug == 'lost' or stage.name.lower() == 'lost'):
        return []

    from pld.models import PLDProblem

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

    has_stage_specific_problems = PLDProblem.objects.filter(is_active=True, stage=stage).exists()

    if gate.require_pld_qualified:
        stage_assessment = (
            lead.pld_assessments.filter(stage=stage).order_by('-assessed_at', '-id').first()
            if getattr(lead, 'pk', None) else None
        )
        is_qualified = False
        if stage_assessment:
            is_qualified = (stage_assessment.pld_status == PLDStatus.QUALIFIED_PLD)
        elif not has_stage_specific_problems:
            # Fallback to legacy/unassigned assessment if this stage has no dedicated questions
            fallback = (
                lead.pld_assessments.filter(stage__isnull=True).order_by('-assessed_at', '-id').first()
                if getattr(lead, 'pk', None) else None
            )
            is_qualified = (fallback and fallback.pld_status == PLDStatus.QUALIFIED_PLD) or (lead.pld_status == PLDStatus.QUALIFIED_PLD)

        if not is_qualified:
            missing.append({
                'code': 'pld_status',
                'message': f"Lead must qualify the PLD assessment for '{stage.name}' before entering this stage.",
                'stage_id': stage.id,
                'stage_name': stage.name,
            })

    if gate.require_problems_assessed:
        has_assessment = False
        if getattr(lead, 'pk', None):
            if lead.pld_assessments.filter(stage=stage).exists():
                has_assessment = True
            elif not has_stage_specific_problems:
                has_assessment = lead.pld_assessments.exists()

        if not has_assessment:
            missing.append({
                'code': 'pld_assessment',
                'message': f"A PLD assessment for '{stage.name}' must be completed for this lead first.",
                'stage_id': stage.id,
                'stage_name': stage.name,
            })

    return missing


def _gate_dict(gate, lead=None):
    from pld.models import PLDProblem

    has_stage_problems = PLDProblem.objects.filter(is_active=True, stage=gate.stage).exists()
    problems_count = PLDProblem.objects.filter(is_active=True, stage=gate.stage).count()
    if problems_count == 0:
        problems_count = PLDProblem.objects.filter(is_active=True, stage__isnull=True).count()

    assessment_info = None
    if lead and getattr(lead, 'pk', None):
        latest = lead.pld_assessments.filter(stage=gate.stage).order_by('-assessed_at', '-id').first()
        if not latest and not has_stage_problems:
            latest = lead.pld_assessments.filter(stage__isnull=True).order_by('-assessed_at', '-id').first()

        if latest:
            assessment_info = {
                'id': latest.id,
                'total_score': latest.total_score,
                'max_score': latest.max_score,
                'percentage': float(latest.percentage),
                'pld_status': latest.pld_status,
                'assessed_at': latest.assessed_at.isoformat(),
            }

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
            'qualified_min_percentage': gate.qualified_min_percentage,
            'notes': gate.notes,
        },
        'problems_count': problems_count,
        'has_stage_specific_problems': has_stage_problems,
        'latest_assessment': assessment_info,
    }


def gate_report(lead):
    """Every configured gate with its satisfied flag for the given lead."""
    gates = PLDStageGate.objects.select_related('stage').order_by('stage__display_order', 'stage__id')

    entries = []
    for gate in gates:
        entry = _gate_dict(gate, lead=lead)
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

    entry = _gate_dict(gate, lead=lead)
    missing = check_gate(lead, stage)
    entry.update({'gated': True, 'missing': missing, 'satisfied': not missing})
    return entry
