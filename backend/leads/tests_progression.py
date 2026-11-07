import datetime
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from leads.models import Lead, LeadStage, StageTaskRule, LeadStageTask
from followups.models import FollowUp

User = get_user_model()

class TaskBasedLeadProgressionTests(APITestCase):
    def setUp(self):
        # Create users: admin, manager, rep
        self.admin = User.objects.create_superuser(
            email='admin@example.com',
            username='admin',
            first_name='Admin',
            last_name='User',
            role='ADMIN',
            password='password123'
        )
        self.manager = User.objects.create_user(
            email='manager@example.com',
            username='manager',
            first_name='Manager',
            last_name='User',
            role='MANAGER',
            password='password123'
        )
        self.rep = User.objects.create_user(
            email='rep@example.com',
            username='rep',
            first_name='Sales',
            last_name='Rep',
            role='EXECUTIVE',
            password='password123'
        )

        # Get or create test stages
        self.stage_new, _ = LeadStage.objects.get_or_create(
            slug='new',
            defaults={'name': 'New', 'display_order': 1, 'color': '#3B82F6', 'is_active': True}
        )
        self.stage_contacted, _ = LeadStage.objects.get_or_create(
            slug='contacted',
            defaults={'name': 'Contacted', 'display_order': 2, 'color': '#10B981', 'is_active': True}
        )
        self.stage_qualified, _ = LeadStage.objects.get_or_create(
            slug='qualified',
            defaults={'name': 'Qualified', 'display_order': 3, 'color': '#8B5CF6', 'is_active': True}
        )
        self.stage_lost, _ = LeadStage.objects.get_or_create(
            slug='lost',
            defaults={'name': 'Lost', 'display_order': 99, 'color': '#EF4444', 'is_active': True}
        )

        # Clean existing rules for testing predictability
        StageTaskRule.objects.filter(stage__in=[self.stage_new, self.stage_contacted]).delete()
        self.stage_contacted.require_manager_approval = False
        self.stage_contacted.save()

        # Stage rules for stage_new
        self.rule_mandatory = StageTaskRule.objects.create(
            stage=self.stage_new,
            name='Discovery Call Rule',
            title='Initial Discovery Call',
            description_template='Call customer to qualify requirements',
            assignee_strategy='LEAD_OWNER',
            due_offset_value=1,
            due_offset_unit='DAYS',
            is_mandatory=True,
            task_priority='HIGH',
            is_active=True,
            order=1
        )
        self.rule_optional = StageTaskRule.objects.create(
            stage=self.stage_new,
            name='Brochure Rule',
            title='Send Company Brochure',
            description_template='Optional email brochure',
            assignee_strategy='LEAD_OWNER',
            due_offset_value=2,
            due_offset_unit='DAYS',
            is_mandatory=False,
            task_priority='LOW',
            is_active=True,
            order=2
        )

        # Create lead in stage_new owned by rep
        self.lead = Lead.objects.create(
            name='Acme Corp Lead',
            company_name='Acme Corp',
            email='lead@acme.com',
            phone='+1234567890',
            stage=self.stage_new,
            assigned_to=self.rep,
            created_by=self.manager
        )

    def test_tasks_automatically_instantiated_on_lead_creation_or_progression(self):
        self.client.force_authenticate(user=self.rep)
        
        # When querying stage-tasks for the lead, they should be instantiated
        response = self.client.get(f'/api/leads/{self.lead.id}/stage-tasks/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        tasks = response.data['data']['tasks']
        self.assertEqual(len(tasks), 2)

        titles = [t['title'] for t in tasks]
        self.assertIn('Initial Discovery Call', titles)
        self.assertIn('Send Company Brochure', titles)

        # Verify LeadStageTask created in DB
        db_tasks = LeadStageTask.objects.filter(lead=self.lead, stage=self.stage_new)
        self.assertEqual(db_tasks.count(), 2)

        # Verify synced FollowUp also created
        followups = FollowUp.objects.filter(lead=self.lead)
        self.assertEqual(followups.count(), 2)

    def test_mandatory_task_blocks_stage_advancement(self):
        self.client.force_authenticate(user=self.rep)

        # Attempt to move lead from New to Contacted without completing mandatory task
        url = f'/api/leads/{self.lead.id}/'
        payload = {'stage': self.stage_contacted.id}
        response = self.client.patch(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('mandatory_tasks', str(response.data))

        # Refresh lead, stage should remain stage_new
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.stage, self.stage_new)

    def test_completing_mandatory_task_allows_progression_even_if_optional_incomplete(self):
        self.client.force_authenticate(user=self.rep)

        # Ensure tasks instantiated
        self.client.get(f'/api/leads/{self.lead.id}/stage-tasks/')
        mandatory_task = LeadStageTask.objects.get(lead=self.lead, rule=self.rule_mandatory)

        # Complete mandatory task via toggle-complete endpoint
        toggle_url = f'/api/leads/stage-tasks/{mandatory_task.id}/toggle-complete/'
        toggle_res = self.client.post(toggle_url, {'outcome_notes': 'Discovery call went great!'}, format='json')
        self.assertEqual(toggle_res.status_code, status.HTTP_200_OK)

        mandatory_task.refresh_from_db()
        self.assertEqual(mandatory_task.status, 'COMPLETED')
        self.assertIsNotNone(mandatory_task.completed_at)
        self.assertEqual(mandatory_task.completed_by, self.rep)

        # The optional task is still PENDING
        optional_task = LeadStageTask.objects.get(lead=self.lead, rule=self.rule_optional)
        self.assertEqual(optional_task.status, 'PENDING')

        # Now move lead to Contacted
        url = f'/api/leads/{self.lead.id}/'
        payload = {'stage': self.stage_contacted.id}
        move_res = self.client.patch(url, payload, format='json')
        self.assertEqual(move_res.status_code, status.HTTP_200_OK)

        self.lead.refresh_from_db()
        self.assertEqual(self.lead.stage, self.stage_contacted)

    def test_reopening_task_revokes_progression_eligibility(self):
        self.client.force_authenticate(user=self.rep)

        # Ensure tasks instantiated
        self.client.get(f'/api/leads/{self.lead.id}/stage-tasks/')
        mandatory_task = LeadStageTask.objects.get(lead=self.lead, rule=self.rule_mandatory)

        # Complete it
        self.client.post(f'/api/leads/stage-tasks/{mandatory_task.id}/toggle-complete/', {'outcome_notes': 'Done'})

        # Now reopen it
        reopen_res = self.client.post(f'/api/leads/stage-tasks/{mandatory_task.id}/toggle-complete/')
        self.assertEqual(reopen_res.status_code, status.HTTP_200_OK)
        mandatory_task.refresh_from_db()
        self.assertEqual(mandatory_task.status, 'PENDING')

        # Try to advance
        url = f'/api/leads/{self.lead.id}/'
        payload = {'stage': self.stage_contacted.id}
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('mandatory_tasks', str(response.data))

    def test_lost_stage_is_always_permitted(self):
        self.client.force_authenticate(user=self.rep)

        # Even with mandatory task pending, moving to Lost with reason is allowed
        url = f'/api/leads/{self.lead.id}/'
        payload = {
            'stage': self.stage_lost.id,
            'lost_reason': 'Competitor chosen'
        }
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.lead.refresh_from_db()
        self.assertEqual(self.lead.stage, self.stage_lost)

    def test_manager_approval_stage_restriction(self):
        # Set require_manager_approval on stage_contacted
        self.stage_contacted.require_manager_approval = True
        self.stage_contacted.save()

        # Move lead to stage_contacted
        self.lead.stage = self.stage_contacted
        self.lead.save()

        # Sales rep tries to advance lead beyond stage_contacted to stage_qualified
        self.client.force_authenticate(user=self.rep)
        url = f'/api/leads/{self.lead.id}/'
        payload = {'stage': self.stage_qualified.id}
        rep_res = self.client.patch(url, payload, format='json')
        self.assertEqual(rep_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('manager_approval_required', str(rep_res.data))

        # Manager performs the move -> should succeed
        self.client.force_authenticate(user=self.manager)
        mgr_res = self.client.patch(url, payload, format='json')
        self.assertEqual(mgr_res.status_code, status.HTTP_200_OK)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.stage, self.stage_qualified)

    def test_no_duplicate_tasks_on_revisit(self):
        self.client.force_authenticate(user=self.rep)
        # Instantiate
        self.client.get(f'/api/leads/{self.lead.id}/stage-tasks/')
        self.assertEqual(LeadStageTask.objects.filter(lead=self.lead, stage=self.stage_new).count(), 2)

        # Trigger progression check again or call endpoint again
        self.client.get(f'/api/leads/{self.lead.id}/stage-tasks/')
        self.assertEqual(LeadStageTask.objects.filter(lead=self.lead, stage=self.stage_new).count(), 2)

    def test_stage_change_with_win_probability_and_reason(self):
        # Configure stage win probability and default reason
        self.stage_contacted.win_probability = 30
        self.stage_contacted.win_probability_reason = "Initial contact made"
        self.stage_contacted.save()

        self.client.force_authenticate(user=self.rep)
        # Ensure tasks instantiated and complete mandatory task in current stage to allow progression
        self.client.get(f'/api/leads/{self.lead.id}/stage-tasks/')
        mandatory_task = LeadStageTask.objects.get(lead=self.lead, rule=self.rule_mandatory)
        mandatory_task.status = 'COMPLETED'
        mandatory_task.save()

        url = f'/api/leads/{self.lead.id}/'
        payload = {
            'stage': self.stage_contacted.id,
            'win_probability_override': 45,
            'win_probability_reason': 'Prospect has high engagement and requested immediate proposal.',
        }
        res = self.client.patch(url, payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.lead.refresh_from_db()
        self.assertEqual(self.lead.stage, self.stage_contacted)
        self.assertEqual(self.lead.effective_win_probability, 45)
        self.assertEqual(self.lead.win_probability_override, 45)
        self.assertEqual(self.lead.win_probability_reason, 'Prospect has high engagement and requested immediate proposal.')

    def test_win_probability_remains_constant_across_stages(self):
        """Setting win probability to 100% or any value keeps it constant across all stage transitions."""
        # Remove rules to allow free stage transitions for probability testing
        StageTaskRule.objects.filter(stage__in=[self.stage_new, self.stage_contacted, self.stage_qualified]).delete()

        self.stage_new.win_probability = 10
        self.stage_new.save()
        self.stage_contacted.win_probability = 30
        self.stage_contacted.save()
        self.stage_qualified.win_probability = 70
        self.stage_qualified.save()

        self.client.force_authenticate(user=self.rep)
        lead = Lead.objects.create(
            name='Constant Win Prob Lead',
            phone='+1-555-999-8888',
            stage=self.stage_new,
            assigned_to=self.rep,
            win_probability_override=100,
            win_probability_reason='100% committed by enterprise executive team.'
        )

        # 1. In Stage New, probability is 100%
        self.assertEqual(lead.effective_win_probability, 100)

        # 2. Transition to Contacted without sending win_probability_override
        res = self.client.patch(f'/api/leads/{lead.id}/', {'stage': self.stage_contacted.id}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        lead.refresh_from_db()
        self.assertEqual(lead.stage, self.stage_contacted)
        self.assertEqual(lead.effective_win_probability, 100)
        self.assertEqual(lead.win_probability_override, 100)

        # 3. Transition to Qualified
        res = self.client.patch(f'/api/leads/{lead.id}/', {'stage': self.stage_qualified.id}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        lead.refresh_from_db()
        self.assertEqual(lead.stage, self.stage_qualified)
        self.assertEqual(lead.effective_win_probability, 100)
        self.assertEqual(lead.win_probability_override, 100)

        # 4. Transition to Lost
        res = self.client.patch(f'/api/leads/{lead.id}/', {'stage': self.stage_lost.id, 'lost_reason': 'Competitor chosen'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        lead.refresh_from_db()
        self.assertEqual(lead.stage, self.stage_lost)
        self.assertEqual(lead.effective_win_probability, 0)

        # 5. Transition back out of Lost to Qualified
        res = self.client.patch(f'/api/leads/{lead.id}/', {'stage': self.stage_qualified.id}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        lead.refresh_from_db()
        self.assertEqual(lead.stage, self.stage_qualified)
        self.assertEqual(lead.effective_win_probability, 100)
        self.assertEqual(lead.win_probability_override, 100)

