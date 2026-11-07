from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from accounts.models import User
from activity.models import ActivityLog
from leads.models import Lead, LeadStage, StageTaskRule, LeadStageTask
from icp.models import ICPQuestion, QuestionType, ICPQuestionOption, ICPScoringConfig, ICPStatus
from leads.services.progression import check_stage_progression


class ICPStageAutoAdvanceTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.user = User.objects.create_superuser(
            email='admin_icp@test.com',
            password='password123',
            first_name='Admin',
            last_name='User',
            role=User.Role.ADMIN
        )
        self.client.force_authenticate(user=self.user)

        # Stages
        self.stage_contacted, _ = LeadStage.objects.get_or_create(
            slug='contacted',
            defaults={'name': 'Contacted', 'display_order': 2, 'is_active': True}
        )
        self.stage_icp, _ = LeadStage.objects.get_or_create(
            slug='icp',
            defaults={'name': 'icp', 'display_order': 3, 'is_active': True}
        )
        self.stage_icp.display_order = 3
        self.stage_icp.save()

        self.stage_demo, _ = LeadStage.objects.get_or_create(
            slug='demo-scheduled',
            defaults={'name': 'Demo Scheduled', 'display_order': 4, 'is_active': True}
        )
        self.stage_demo.display_order = 4
        self.stage_demo.save()

        # Stage task rule for ICP stage
        self.rule_icp, _ = StageTaskRule.objects.get_or_create(
            stage=self.stage_icp,
            title='Verify Ideal Customer Profile (ICP) Criteria',
            defaults={
                'name': 'Complete ICP Fit Verification',
                'is_mandatory': True,
                'is_active': True
            }
        )

        # Stage task rule for Demo stage
        self.rule_demo, _ = StageTaskRule.objects.get_or_create(
            stage=self.stage_demo,
            title='Schedule Product Demo Call',
            defaults={
                'name': 'Schedule Demo with client',
                'is_mandatory': True,
                'is_active': True
            }
        )

        # Create active ICP question
        self.question = ICPQuestion.objects.create(
            question_text='What is the company employee size?',
            question_type=QuestionType.SINGLE_CHOICE,
            is_required=True,
            is_active=True,
            display_order=1
        )
        self.option_high = ICPQuestionOption.objects.create(
            question=self.question,
            option_text='50-200 employees',
            points=10,
            display_order=1
        )
        self.option_low = ICPQuestionOption.objects.create(
            question=self.question,
            option_text='1-5 employees',
            points=1,
            display_order=2
        )

        # Scoring config
        self.config, _ = ICPScoringConfig.objects.get_or_create(
            id=1,
            defaults={
                'poor_fit_max': 39,
                'potential_fit_max': 59,
                'good_fit_max': 79
            }
        )

    def test_advancing_is_blocked_from_icp_stage_when_not_tested(self):
        """Lead in ICP stage cannot manually advance to Demo Scheduled without passing ICP."""
        lead = Lead.objects.create(
            name='Test Incomplete Lead',
            phone='1234567890',
            stage=self.stage_icp,
            icp_status=Lead.ICPStatus.NOT_TESTED,
            assigned_to=self.user
        )

        can_progress, missing, msg = check_stage_progression(lead, self.stage_demo)
        self.assertFalse(can_progress)
        self.assertIn('ICP Qualification must be completed', msg)

    def test_qualifying_icp_automatically_advances_lead_to_next_stage(self):
        """When an ICP qualification qualifies (100% Strong ICP Fit), lead is automatically advanced from ICP stage."""
        lead = Lead.objects.create(
            name='Qualifying Tech Lead',
            phone='9876543210',
            stage=self.stage_icp,
            icp_status=Lead.ICPStatus.NOT_TESTED,
            assigned_to=self.user
        )

        # Task in ICP stage
        icp_task = LeadStageTask.objects.create(
            lead=lead,
            stage=self.stage_icp,
            rule=self.rule_icp,
            title='Verify Ideal Customer Profile (ICP) Criteria',
            due_date=timezone.now(),
            is_mandatory=True,
            status=LeadStageTask.Status.PENDING
        )

        payload = {
            'answers': [
                {
                    'question_id': self.question.id,
                    'value': [self.option_high.id]
                }
            ]
        }

        resp = self.client.post(f'/api/leads/{lead.id}/icp/qualify/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(resp.data['data']['stage_advanced'])
        self.assertEqual(resp.data['data']['new_stage'], self.stage_demo.name)

        lead.refresh_from_db()
        # Verify stage has changed to Demo Scheduled
        self.assertEqual(lead.stage, self.stage_demo)
        self.assertEqual(lead.icp_status, Lead.ICPStatus.STRONG_ICP_FIT)

        # Verify ICP stage task was completed
        icp_task.refresh_from_db()
        self.assertEqual(icp_task.status, LeadStageTask.Status.COMPLETED)

        # Verify tasks for Demo Scheduled were automatically created
        demo_tasks = LeadStageTask.objects.filter(lead=lead, stage=self.stage_demo)
        self.assertTrue(demo_tasks.exists())

    def test_poor_fit_does_not_advance_lead(self):
        """When ICP test results in POOR_FIT, lead stays in ICP stage."""
        # Create second question to lower percentage
        q2 = ICPQuestion.objects.create(
            question_text='Budget range?',
            question_type=QuestionType.SINGLE_CHOICE,
            is_required=True,
            is_active=True,
            display_order=2
        )
        opt_low = ICPQuestionOption.objects.create(question=q2, option_text='No budget', points=0)
        opt_max = ICPQuestionOption.objects.create(question=q2, option_text='Huge budget', points=90)

        lead = Lead.objects.create(
            name='Low Fit Lead',
            phone='5550001111',
            stage=self.stage_icp,
            icp_status=Lead.ICPStatus.NOT_TESTED,
            assigned_to=self.user
        )

        payload = {
            'answers': [
                {'question_id': self.question.id, 'value': [self.option_low.id]},
                {'question_id': q2.id, 'value': [opt_low.id]}
            ]
        }

        resp = self.client.post(f'/api/leads/{lead.id}/icp/qualify/', payload, format='json')
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertFalse(resp.data['data']['stage_advanced'])

        lead.refresh_from_db()
        self.assertEqual(lead.stage, self.stage_icp)
        self.assertEqual(lead.icp_status, Lead.ICPStatus.POOR_FIT)
