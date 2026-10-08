"""Seed demo content for the ICP qualification test and the PLD engine.

Run after ``seed_data``:

    python backend/manage.py seed_icp_pld

Every row is created with ``get_or_create`` / ``update_or_create`` keyed on
natural keys, and history is only written for leads that have none yet, so the
command is safe to run repeatedly.
"""
from django.core.management.base import BaseCommand

from accounts.models import User
from leads.models import Lead, LeadStage
from icp.models import (
    ICPQuestion,
    ICPQuestionOption,
    QuestionType,
)
from icp.models import get_scoring_config as get_icp_scoring_config
from icp.services.scoring import (
    ICPValidationError,
    get_question_max_points,
    submit_qualification,
)
from pld.models import PLDProblem, PLDStageGate
from pld.models import get_scoring_config as get_pld_scoring_config
from pld.services.scoring import PLDValidationError, submit_assessment

# Thresholds the demo content is designed around (percentage cut-offs).
ICP_THRESHOLDS = {'poor_fit_max': 39, 'potential_fit_max': 59, 'good_fit_max': 79}
PLD_THRESHOLD = 60

ICP_QUESTIONS = [
    {
        'key': 'size',
        'question_text': 'How many employees does the company have?',
        'description': 'Company size is the strongest predictor of our fit.',
        'question_type': QuestionType.SINGLE_CHOICE,
        'is_required': True,
        'display_order': 1,
        'options': [('1-10', 5), ('11-50', 10), ('51-200', 20), ('201+', 30)],
    },
    {
        'key': 'industry',
        'question_text': 'How well does their industry match our best customers?',
        'description': 'Pick the closest match for their vertical.',
        'question_type': QuestionType.DROPDOWN,
        'is_required': True,
        'display_order': 2,
        'options': [('Core vertical', 25), ('Adjacent', 12), ('Unrelated', 0)],
    },
    {
        'key': 'traffic',
        'question_text': 'Roughly how many website visitors per month?',
        'description': 'A rough number is fine - this drives the upside case.',
        'question_type': QuestionType.NUMBER,
        'is_required': True,
        'display_order': 3,
        'scoring_rules': [
            {'min': 50000, 'max': None, 'points': 20},
            {'min': 10000, 'max': 49999, 'points': 10},
            {'min': None, 'max': None, 'points': 0},
        ],
    },
    {
        'key': 'budget',
        'question_text': 'Do they have budget approved this quarter?',
        'question_type': QuestionType.YES_NO,
        'is_required': True,
        'display_order': 4,
        'options': [('Yes', 15), ('No', 0)],
    },
    {
        'key': 'blocker',
        'question_text': 'What is their biggest growth blocker right now?',
        'description': 'Optional. Their own words are useful in discovery.',
        'question_type': QuestionType.TEXT,
        'is_required': False,
        'display_order': 5,
        'max_points': 5,
    },
]

PLD_PROBLEMS = [
    ('Manual reporting eats a full day each week',
     'Ops teams rebuilding the same spreadsheet every Monday morning.', 25, 'HIGH'),
    ('No visibility into which pipeline stage leads stall in',
     'Management cannot tell where deals are stuck or why.', 20, 'HIGH'),
    ('Follow-ups slip through the cracks',
     'Promised callbacks and tasks are missed because nothing reminds anyone.', 30, 'CRITICAL'),
    ('Duplicate outreach to the same contacts',
     'Two reps call the same person because there is no shared history.', 10, 'MEDIUM'),
    ('No shared view between sales and management',
     'Reporting for the weekly review is assembled by hand, from scratch.', 15, 'MEDIUM'),
    ('Onboarding a new rep takes over a month',
     'Everything lives in one person\'s head instead of the system.', 5, 'LOW'),
]

# slug -> requirements. Stages not listed stay ungated.
STAGE_GATES = [
    ('demo-scheduled', {
        'require_icp_min_status': '',
        'require_pld_qualified': False,
        'require_problems_assessed': True,
        'notes': 'Record a PLD assessment before booking a demo.',
    }),
    ('negotiation', {
        'require_icp_min_status': 'POTENTIAL_FIT',
        'require_pld_qualified': False,
        'require_problems_assessed': False,
        'notes': 'Only leads with at least Potential Fit reach pricing talks.',
    }),
    ('qualified', {
        'require_icp_min_status': 'GOOD_FIT',
        'require_pld_qualified': True,
        'require_problems_assessed': False,
        'notes': 'Good Fit ICP plus a Qualified PLD score is required to convert.',
    }),
]

# Answers are keyed by the question 'key' above and matched by option text.
ICP_HISTORY = [
    {
        'lead_phone': '+1 (555) 678-9012',
        'answers': {
            'size': '201+',
            'industry': 'Core vertical',
            'traffic': 75000,
            'budget': 'Yes',
            'blocker': 'Scaling outbound without adding headcount.',
        },
    },
    {
        'lead_phone': '+1 (555) 912-3456',
        'answers': {
            'size': '51-200',
            'industry': 'Core vertical',
            'traffic': 45000,
            'budget': 'Yes',
            'blocker': 'Compliance reporting is consuming the whole team.',
        },
    },
    {
        'lead_phone': '+1 (555) 567-8901',
        'answers': {
            'size': '51-200',
            'industry': 'Adjacent',
            'traffic': 25000,
            'budget': 'Yes',
            'blocker': 'Renewal season is approaching and churn risk is unclear.',
        },
    },
    {
        'lead_phone': '+1 (555) 345-6789',
        'answers': {
            'size': '11-50',
            'industry': 'Core vertical',
            'traffic': 15000,
            'budget': 'No',
            'blocker': 'Cannot attribute revenue back to campaigns.',
        },
    },
    {
        'lead_phone': '+1 (555) 234-5678',
        'answers': {
            'size': '1-10',
            'industry': 'Unrelated',
            'traffic': 3000,
            'budget': 'No',
            'blocker': 'Still figuring out who the buyer even is.',
        },
    },
    {
        'lead_phone': '+1 (555) 890-1234',
        'answers': {
            'size': '201+',
            'industry': 'Adjacent',
            'traffic': 25000,
            'budget': 'Yes',
            'blocker': 'Reporting is spread across four disconnected tools.',
        },
    },
]

PLD_HISTORY = [
    {
        'lead_phone': '+1 (555) 678-9012',
        'problems': [
            'Manual reporting eats a full day each week',
            'No visibility into which pipeline stage leads stall in',
            'Follow-ups slip through the cracks',
        ],
    },
    {
        'lead_phone': '+1 (555) 912-3456',
        'problems': [
            'Manual reporting eats a full day each week',
            'No visibility into which pipeline stage leads stall in',
            'Follow-ups slip through the cracks',
            'No shared view between sales and management',
        ],
    },
    {
        'lead_phone': '+1 (555) 456-7890',
        'problems': [
            'Duplicate outreach to the same contacts',
            'Onboarding a new rep takes over a month',
        ],
    },
    {
        'lead_phone': '+1 (555) 890-1234',
        'problems': [
            'No visibility into which pipeline stage leads stall in',
            'Follow-ups slip through the cracks',
            'No shared view between sales and management',
        ],
    },
]


class Command(BaseCommand):
    help = 'Seeds demo ICP questions and PLD problems, thresholds, stage gates and sample history.'

    def handle(self, *args, **options):
        self.stdout.write('Starting ICP / PLD demo seeding...')

        manager = User.objects.filter(email='manager@crmlite.com').first()

        questions_by_key = self._seed_icp_config()
        self._seed_pld_config()
        self._seed_gates()
        self._seed_icp_history(questions_by_key, manager)
        self._seed_pld_history(manager)

        self.stdout.write(self.style.SUCCESS('==> ICP / PLD Demo Seed Complete! <=='))

    # ------------------------------------------------------------------ config

    def _seed_icp_config(self):
        config = get_icp_scoring_config()
        if (config.poor_fit_max, config.potential_fit_max, config.good_fit_max) != (
            ICP_THRESHOLDS['poor_fit_max'],
            ICP_THRESHOLDS['potential_fit_max'],
            ICP_THRESHOLDS['good_fit_max'],
        ):
            config.poor_fit_max = ICP_THRESHOLDS['poor_fit_max']
            config.potential_fit_max = ICP_THRESHOLDS['potential_fit_max']
            config.good_fit_max = ICP_THRESHOLDS['good_fit_max']
            config.save(update_fields=['poor_fit_max', 'potential_fit_max', 'good_fit_max', 'updated_at'])
        self.stdout.write(
            self.style.SUCCESS(
                '[OK] ICP thresholds set to '
                f"{config.poor_fit_max} / {config.potential_fit_max} / {config.good_fit_max}."
            )
        )

        questions_by_key = {}
        created_count = 0

        for spec in ICP_QUESTIONS:
            question, created = ICPQuestion.objects.get_or_create(
                question_text=spec['question_text'],
                defaults={
                    'description': spec.get('description', ''),
                    'question_type': spec['question_type'],
                    'is_required': spec['is_required'],
                    'is_active': True,
                    'display_order': spec['display_order'],
                    'max_points': spec.get('max_points', 0),
                    'scoring_rules': spec.get('scoring_rules', []),
                },
            )
            if created:
                created_count += 1

            options_spec = spec.get('options') or []
            if options_spec:
                for order, (text, points) in enumerate(options_spec, start=1):
                    ICPQuestionOption.objects.get_or_create(
                        question=question,
                        option_text=text,
                        defaults={'points': points, 'display_order': order},
                    )

            # Choice and number questions derive their maximum from options /
            # scoring rules; only text questions carry a stored flat value.
            if options_spec or spec.get('scoring_rules'):
                new_max_points = get_question_max_points(question)
            else:
                new_max_points = spec.get('max_points', 0)

            updates = []
            if question.max_points != new_max_points:
                question.max_points = new_max_points
                updates.append('max_points')
            if question.description != spec.get('description', ''):
                question.description = spec.get('description', '')
                updates.append('description')
            if updates:
                question.save(update_fields=updates + ['updated_at'])

            questions_by_key[spec['key']] = question

        self.stdout.write(
            self.style.SUCCESS(f'[OK] {len(questions_by_key)} ICP questions configured ({created_count} new).')
        )
        return questions_by_key

    def _seed_pld_config(self):
        config = get_pld_scoring_config()
        if config.qualified_min_percentage != PLD_THRESHOLD:
            config.qualified_min_percentage = PLD_THRESHOLD
            config.save(update_fields=['qualified_min_percentage', 'updated_at'])
        self.stdout.write(
            self.style.SUCCESS(
                f'[OK] PLD qualification threshold set to {config.qualified_min_percentage}%.'
            )
        )

        created_count = 0
        for order, (name, description, points, severity) in enumerate(PLD_PROBLEMS, start=1):
            _, created = PLDProblem.objects.get_or_create(
                name=name,
                defaults={
                    'description': description,
                    'points': points,
                    'severity': severity,
                    'is_active': True,
                    'display_order': order,
                },
            )
            if created:
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'[OK] {len(PLD_PROBLEMS)} PLD problems configured ({created_count} new).'
            )
        )

    def _seed_gates(self):
        for slug, requirements in STAGE_GATES:
            stage = LeadStage.objects.filter(slug=slug).first()
            if stage is None:
                self.stdout.write(self.style.WARNING(f'[SKIP] Stage "{slug}" not found - no gate created.'))
                continue
            _, created = PLDStageGate.objects.update_or_create(stage=stage, defaults=requirements)
            label = 'created' if created else 'updated'
            self.stdout.write(self.style.SUCCESS(f'[OK] Gate {label} for stage "{stage.name}".'))

    # ----------------------------------------------------------------- history

    def _resolve_lead(self, phone):
        return Lead.objects.filter(phone=phone).select_related('assigned_to', 'stage').first()

    def _seed_icp_history(self, questions_by_key, fallback_user):
        created_count = 0

        for entry in ICP_HISTORY:
            lead = self._resolve_lead(entry['lead_phone'])
            if lead is None:
                self.stdout.write(self.style.WARNING(
                    f'[SKIP] No lead with phone {entry["lead_phone"]} - no ICP history written.'
                ))
                continue
            if lead.icp_qualifications.exists():
                continue

            answers = []
            for key, value in entry['answers'].items():
                question = questions_by_key.get(key)
                if question is None:
                    continue
                answers.append({'question_id': question.id, 'value': value})

            if not answers:
                continue

            assessor = lead.assigned_to or fallback_user
            try:
                qualification = submit_qualification(lead, assessor, answers)
            except ICPValidationError as exc:
                self.stdout.write(self.style.WARNING(
                    f'[SKIP] ICP history for {lead.name}: {exc.message}'
                ))
                continue

            created_count += 1
            self.stdout.write(self.style.SUCCESS(
                f'[OK] ICP qualification #{qualification.id} for {lead.name}: '
                f'{qualification.total_score}/{qualification.max_score} '
                f'({qualification.percentage}%) -> {qualification.get_icp_status_display()}.'
            ))

        if created_count == 0:
            self.stdout.write('[--] ICP history already present - nothing to add.')

    def _seed_pld_history(self, fallback_user):
        created_count = 0

        for entry in PLD_HISTORY:
            lead = self._resolve_lead(entry['lead_phone'])
            if lead is None:
                self.stdout.write(self.style.WARNING(
                    f'[SKIP] No lead with phone {entry["lead_phone"]} - no PLD history written.'
                ))
                continue
            if lead.pld_assessments.exists():
                continue

            problem_ids = []
            for name in entry['problems']:
                problem = PLDProblem.objects.filter(name=name).first()
                if problem is None:
                    self.stdout.write(self.style.WARNING(
                        f'[SKIP] Problem "{name}" not found - assessment not written for {lead.name}.'
                    ))
                    problem_ids = []
                    break
                problem_ids.append(problem.id)

            if not problem_ids:
                continue

            assessor = lead.assigned_to or fallback_user
            try:
                assessment = submit_assessment(lead, assessor, problem_ids)
            except PLDValidationError as exc:
                self.stdout.write(self.style.WARNING(
                    f'[SKIP] PLD assessment for {lead.name}: {exc.message}'
                ))
                continue

            created_count += 1
            self.stdout.write(self.style.SUCCESS(
                f'[OK] PLD assessment #{assessment.id} for {lead.name}: '
                f'{assessment.total_score}/{assessment.max_score} '
                f'({assessment.percentage}%) -> {assessment.get_pld_status_display()}.'
            ))

        if created_count == 0:
            self.stdout.write('[--] PLD history already present - nothing to add.')
