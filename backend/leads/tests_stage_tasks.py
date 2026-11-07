from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from leads.models import Lead, LeadStage, StageTaskRule
from followups.models import FollowUp
from activity.models import ActivityLog
from leads.services import execute_stage_task_automations

User = get_user_model()


class StageTaskAutomationTests(APITestCase):
    def setUp(self):
        # Create test users with roles
        self.admin = User.objects.create_user(
            email='admin_tasks@example.com',
            password='Password123!',
            first_name='Admin',
            last_name='User',
            role='ADMIN'
        )
        self.manager = User.objects.create_user(
            email='manager_tasks@example.com',
            password='Password123!',
            first_name='Manager',
            last_name='User',
            role='MANAGER'
        )
        self.executive = User.objects.create_user(
            email='exec_tasks@example.com',
            password='Password123!',
            first_name='Executive',
            last_name='User',
            role='EXECUTIVE'
        )
        self.rep1 = User.objects.create_user(
            email='rep1_tasks@example.com',
            password='Password123!',
            first_name='Rep',
            last_name='One',
            role='EXECUTIVE'
        )
        self.rep2 = User.objects.create_user(
            email='rep2_tasks@example.com',
            password='Password123!',
            first_name='Rep',
            last_name='Two',
            role='EXECUTIVE'
        )

        # Get or create pipeline stages
        self.stage_new, _ = LeadStage.objects.get_or_create(
            slug='new',
            defaults={'name': 'New', 'display_order': 1, 'is_system': True}
        )
        self.stage_contacted, _ = LeadStage.objects.get_or_create(
            slug='contacted',
            defaults={'name': 'Contacted', 'display_order': 2}
        )
        self.stage_demo, _ = LeadStage.objects.get_or_create(
            slug='demo-scheduled',
            defaults={'name': 'Demo Scheduled', 'display_order': 3}
        )
        self.stage_won, _ = LeadStage.objects.get_or_create(
            slug='won',
            defaults={'name': 'Won', 'display_order': 4, 'is_system': True}
        )

        # Create a lead
        self.lead = Lead.objects.create(
            name='Acme Corporation',
            company_name='Acme Inc',
            phone='+1234567890',
            email='contact@acme.com',
            stage=self.stage_new,
            priority=Lead.Priority.HIGH,
            assigned_to=self.rep1,
            created_by=self.manager
        )

    def test_admin_can_create_stage_task_rule(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            'stage': self.stage_contacted.id,
            'name': 'Welcome Call',
            'purpose': 'Phone Call',
            'title': 'Initial Discovery',
            'description_template': 'Call {lead_name} at {phone} to discuss requirements.',
            'assignee_strategy': StageTaskRule.AssigneeStrategy.LEAD_OWNER,
            'due_offset_value': 2,
            'due_offset_unit': StageTaskRule.OffsetUnit.HOURS,
            'priority_filter': 'ALL',
            'prevent_duplicate': True,
            'is_active': True
        }
        res = self.client.post('/api/stage-task-rules/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['name'], 'Welcome Call')
        self.assertEqual(res.data['stage'], self.stage_contacted.id)
        self.assertEqual(res.data['created_by'], self.admin.id)

    def test_manager_can_create_and_update_rule(self):
        self.client.force_authenticate(user=self.manager)
        rule = StageTaskRule.objects.create(
            stage=self.stage_demo,
            name='Product Demo Prep',
            purpose='Demo',
            assignee_strategy=StageTaskRule.AssigneeStrategy.SPECIFIC_USER,
            specific_user=self.rep2,
            due_offset_value=1,
            due_offset_unit=StageTaskRule.OffsetUnit.DAYS,
            created_by=self.manager
        )
        patch_res = self.client.patch(
            f'/api/stage-task-rules/{rule.id}/',
            {'due_offset_value': 3},
            format='json'
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        rule.refresh_from_db()
        self.assertEqual(rule.due_offset_value, 3)

    def test_executive_cannot_create_or_delete_rule(self):
        self.client.force_authenticate(user=self.executive)
        rule = StageTaskRule.objects.create(
            stage=self.stage_contacted,
            name='Restricted Rule',
            created_by=self.admin
        )
        # Cannot create
        post_res = self.client.post('/api/stage-task-rules/', {'name': 'Exec Rule', 'stage': self.stage_demo.id})
        self.assertEqual(post_res.status_code, status.HTTP_403_FORBIDDEN)
        # Cannot delete
        del_res = self.client.delete(f'/api/stage-task-rules/{rule.id}/')
        self.assertEqual(del_res.status_code, status.HTTP_403_FORBIDDEN)
        # Can read
        get_res = self.client.get(f'/api/stage-task-rules/{rule.id}/')
        self.assertEqual(get_res.status_code, status.HTTP_200_OK)

    def test_toggle_active_action(self):
        self.client.force_authenticate(user=self.admin)
        rule = StageTaskRule.objects.create(
            stage=self.stage_contacted,
            name='Toggleable Rule',
            is_active=True,
            created_by=self.admin
        )
        res = self.client.patch(f'/api/stage-task-rules/{rule.id}/toggle-active/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        rule.refresh_from_db()
        self.assertFalse(rule.is_active)

    def test_by_stage_endpoint(self):
        self.client.force_authenticate(user=self.admin)
        StageTaskRule.objects.create(
            stage=self.stage_contacted,
            name='Rule 1',
            created_by=self.admin
        )
        res = self.client.get('/api/stage-task-rules/by-stage/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data['data']
        contacted_group = next((g for g in data if g['stage_id'] == self.stage_contacted.id), None)
        self.assertIsNotNone(contacted_group)
        self.assertGreaterEqual(contacted_group['rules_count'], 1)

    def test_automation_service_lead_owner_strategy(self):
        # Create rule for Contacted stage assigned to LEAD_OWNER
        StageTaskRule.objects.create(
            stage=self.stage_contacted,
            name='First Contact Call',
            purpose='Phone Call',
            title='Reach out to Lead',
            description_template='Call {lead_name} at {phone}. Stage: {stage_name}',
            assignee_strategy=StageTaskRule.AssigneeStrategy.LEAD_OWNER,
            due_offset_value=1,
            due_offset_unit=StageTaskRule.OffsetUnit.DAYS,
            created_by=self.admin
        )

        tasks = execute_stage_task_automations(
            lead=self.lead,
            new_stage=self.stage_contacted,
            old_stage=self.stage_new,
            actor=self.admin
        )

        self.assertEqual(len(tasks), 1)
        task = tasks[0]
        self.assertEqual(task.lead, self.lead)
        self.assertEqual(task.assigned_to, self.rep1)  # lead's assigned rep
        self.assertEqual(task.purpose, 'Phone Call')
        self.assertIn('[Reach out to Lead]', task.notes)
        self.assertIn('Call Acme Corporation at +1234567890', task.notes)
        self.assertIn('Stage: Contacted', task.notes)
        # Check ActivityLog
        log = ActivityLog.objects.filter(entity_type=ActivityLog.EntityType.FOLLOW_UP, entity_id=task.id).first()
        self.assertIsNotNone(log)

    def test_automation_round_robin_strategy(self):
        rule = StageTaskRule.objects.create(
            stage=self.stage_demo,
            name='Demo Assignment Rotation',
            purpose='Demo',
            assignee_strategy=StageTaskRule.AssigneeStrategy.ROUND_ROBIN,
            due_offset_value=2,
            due_offset_unit=StageTaskRule.OffsetUnit.DAYS,
            created_by=self.admin
        )
        rule.round_robin_users.set([self.rep1, self.rep2])

        # Execution 1: should pick rep1
        lead1 = Lead.objects.create(name='Lead 1', phone='111', stage=self.stage_new)
        tasks1 = execute_stage_task_automations(lead=lead1, new_stage=self.stage_demo, actor=self.admin)
        self.assertEqual(len(tasks1), 1)
        self.assertEqual(tasks1[0].assigned_to, self.rep1)

        # Execution 2: should pick rep2
        lead2 = Lead.objects.create(name='Lead 2', phone='222', stage=self.stage_new)
        tasks2 = execute_stage_task_automations(lead=lead2, new_stage=self.stage_demo, actor=self.admin)
        self.assertEqual(len(tasks2), 1)
        self.assertEqual(tasks2[0].assigned_to, self.rep2)

        # Execution 3: should wrap back to rep1
        lead3 = Lead.objects.create(name='Lead 3', phone='333', stage=self.stage_new)
        tasks3 = execute_stage_task_automations(lead=lead3, new_stage=self.stage_demo, actor=self.admin)
        self.assertEqual(len(tasks3), 1)
        self.assertEqual(tasks3[0].assigned_to, self.rep1)

    def test_priority_filter_and_prevent_duplicate(self):
        StageTaskRule.objects.create(
            stage=self.stage_contacted,
            name='Urgent Only Task',
            purpose='WhatsApp',
            assignee_strategy=StageTaskRule.AssigneeStrategy.LEAD_OWNER,
            priority_filter='URGENT',
            created_by=self.admin
        )
        # self.lead has priority HIGH, not URGENT
        tasks = execute_stage_task_automations(lead=self.lead, new_stage=self.stage_contacted, actor=self.admin)
        self.assertEqual(len(tasks), 0)

        # Update lead priority to URGENT
        self.lead.priority = Lead.Priority.URGENT
        self.lead.save()
        tasks2 = execute_stage_task_automations(lead=self.lead, new_stage=self.stage_contacted, actor=self.admin)
        self.assertEqual(len(tasks2), 1)

        # Calling again with prevent_duplicate=True should not duplicate
        tasks3 = execute_stage_task_automations(lead=self.lead, new_stage=self.stage_contacted, actor=self.admin)
        self.assertEqual(len(tasks3), 0)

    def test_lead_stage_update_triggers_automation_end_to_end(self):
        # Configure rule on Demo Scheduled stage
        StageTaskRule.objects.create(
            stage=self.stage_demo,
            name='Auto Prep Demo',
            purpose='Proposal',
            assignee_strategy=StageTaskRule.AssigneeStrategy.SPECIFIC_USER,
            specific_user=self.manager,
            due_offset_value=1,
            due_offset_unit=StageTaskRule.OffsetUnit.DAYS,
            created_by=self.admin
        )

        self.client.force_authenticate(user=self.admin)
        # Move lead stage via API (mimicking drag & drop in Pipeline or dropdown in Lead Details)
        patch_res = self.client.patch(
            f'/api/leads/{self.lead.id}/',
            {'stage': self.stage_demo.id},
            format='json'
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)

        # Check that follow-up was automatically created and assigned to manager
        fu = FollowUp.objects.filter(lead=self.lead, purpose='Proposal').first()
        self.assertIsNotNone(fu)
        self.assertEqual(fu.assigned_to, self.manager)
        self.assertEqual(fu.status, FollowUp.Status.PENDING)
