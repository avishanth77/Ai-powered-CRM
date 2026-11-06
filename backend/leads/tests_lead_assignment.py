from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from leads.models import (
    Lead,
    LeadStage,
    LeadSource,
    LeadAssignmentConfig,
    LeadAssignmentRule,
)
from leads.services.assignment import assign_lead_to_salesman

User = get_user_model()


class LeadAutoAssignmentTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.admin = User.objects.create_superuser(
            username='admin_assign',
            email='admin_assign@test.com',
            password='password123',
            role='ADMIN'
        )
        self.manager = User.objects.create_user(
            username='mgr_assign',
            email='mgr_assign@test.com',
            password='password123',
            role='MANAGER'
        )
        self.salesman1 = User.objects.create_user(
            username='sales_bob',
            email='bob@test.com',
            first_name='Bob',
            last_name='Salesman',
            password='password123',
            role='EXECUTIVE'
        )
        self.salesman2 = User.objects.create_user(
            username='sales_alice',
            email='alice@test.com',
            first_name='Alice',
            last_name='Saleswoman',
            password='password123',
            role='EXECUTIVE'
        )

        # Stages & Sources
        self.stage_new = LeadStage.objects.filter(slug='new').first() or LeadStage.objects.create(
            name='New', slug='new', display_order=1
        )
        self.source_web, _ = LeadSource.objects.get_or_create(name='Website')
        self.source_event, _ = LeadSource.objects.get_or_create(name='Trade Show')

    def test_round_robin_assignment(self):
        config = LeadAssignmentConfig.get_solo()
        config.is_enabled = True
        config.strategy = LeadAssignmentConfig.Strategy.ROUND_ROBIN
        config.salesmen_pool.set([self.salesman1, self.salesman2])
        config.save()

        # Create 4 leads without owner
        lead1 = Lead.objects.create(name='Lead One', phone='1111111', stage=self.stage_new)
        assign1 = assign_lead_to_salesman(lead1, channel='manual')

        lead2 = Lead.objects.create(name='Lead Two', phone='2222222', stage=self.stage_new)
        assign2 = assign_lead_to_salesman(lead2, channel='manual')

        lead3 = Lead.objects.create(name='Lead Three', phone='3333333', stage=self.stage_new)
        assign3 = assign_lead_to_salesman(lead3, channel='manual')

        # Should alternate between salesman1 and salesman2
        self.assertIn(assign1, [self.salesman1, self.salesman2])
        self.assertNotEqual(assign1, assign2)
        self.assertEqual(assign1, assign3)

    def test_least_loaded_assignment(self):
        config = LeadAssignmentConfig.get_solo()
        config.is_enabled = True
        config.strategy = LeadAssignmentConfig.Strategy.LEAST_LOADED
        config.salesmen_pool.set([self.salesman1, self.salesman2])
        config.save()

        # Pre-assign 2 leads to salesman1
        Lead.objects.create(name='Existing 1', phone='4444441', stage=self.stage_new, assigned_to=self.salesman1)
        Lead.objects.create(name='Existing 2', phone='4444442', stage=self.stage_new, assigned_to=self.salesman1)

        # salesman2 has 0 active leads, salesman1 has 2
        new_lead = Lead.objects.create(name='Candidate Lead', phone='5555555', stage=self.stage_new)
        assigned = assign_lead_to_salesman(new_lead, channel='manual')

        self.assertEqual(assigned, self.salesman2)

    def test_custom_routing_rule_overrides_global(self):
        config = LeadAssignmentConfig.get_solo()
        config.is_enabled = True
        config.strategy = LeadAssignmentConfig.Strategy.SPECIFIC_USER
        config.specific_user = self.salesman1
        config.save()

        # Create a rule: Trade Show leads go specifically to salesman2
        rule = LeadAssignmentRule.objects.create(
            name='Trade Show VIP Route',
            is_active=True,
            order=1,
            source=self.source_event,
            strategy=LeadAssignmentConfig.Strategy.SPECIFIC_USER,
            specific_user=self.salesman2
        )

        # Lead from Trade Show
        trade_lead = Lead.objects.create(
            name='Trade Show Lead',
            phone='6666666',
            source=self.source_event,
            stage=self.stage_new
        )
        assigned_trade = assign_lead_to_salesman(trade_lead, channel='manual')
        self.assertEqual(assigned_trade, self.salesman2)

        # Lead from Website (falls back to global config -> salesman1)
        web_lead = Lead.objects.create(
            name='Web Inbound Lead',
            phone='7777777',
            source=self.source_web,
            stage=self.stage_new
        )
        assigned_web = assign_lead_to_salesman(web_lead, channel='manual')
        self.assertEqual(assigned_web, self.salesman1)

    def test_assignment_config_api_access(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.get('/api/leads/assignment-config/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('strategy', response.data)
        self.assertIn('salesmen_pool_details', response.data)

        # Update config via API
        patch_res = self.client.patch('/api/leads/assignment-config/', {
            'strategy': 'LEAST_LOADED',
            'salesmen_pool_ids': [self.salesman1.id, self.salesman2.id],
            'auto_assign_web_to_lead': True
        })
        self.assertEqual(patch_res.status_code, 200)
        self.assertEqual(patch_res.data['strategy'], 'LEAST_LOADED')
        self.assertEqual(len(patch_res.data['salesmen_pool']), 2)

    def test_assignment_rules_api_crud(self):
        self.client.force_authenticate(user=self.admin)
        post_res = self.client.post('/api/leads/assignment-rules/', {
            'name': 'Inbound Website Rule',
            'is_active': True,
            'order': 1,
            'source': self.source_web.id,
            'strategy': 'SPECIFIC_USER',
            'specific_user': self.salesman1.id,
        })
        self.assertEqual(post_res.status_code, 201)
        rule_id = post_res.data['id']

        # List rules
        list_res = self.client.get('/api/leads/assignment-rules/')
        self.assertEqual(list_res.status_code, 200)
        self.assertEqual(len(list_res.data.get('results', list_res.data)), 1)

