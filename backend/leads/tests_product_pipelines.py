from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from leads.models import Pipeline, LeadStage, Lead, StageTaskRule, CustomPropertyDefinition
from products.models import Product, LeadProduct
from ai.services.chatbot_service import ChatbotService

User = get_user_model()


class ProductCustomPipelineTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin_pipe@crmlite.com',
            password='Password123!',
            first_name='Admin',
            last_name='Pipe',
            role='ADMIN',
            is_superuser=True,
            is_staff=True,
        )
        self.manager = User.objects.create_user(
            email='manager_pipe@crmlite.com',
            password='Password123!',
            first_name='Manager',
            last_name='Pipe',
            role='MANAGER',
        )
        self.exec_user = User.objects.create_user(
            email='exec_pipe@crmlite.com',
            password='Password123!',
            first_name='Exec',
            last_name='Pipe',
            role='EXECUTIVE',
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        self.default_pipeline = Pipeline.get_default()
        self.def_new, _ = LeadStage.objects.get_or_create(
            pipeline=self.default_pipeline,
            slug='new',
            defaults={'name': 'New', 'display_order': 1, 'is_system': True, 'is_active': True}
        )
        self.def_won, _ = LeadStage.objects.get_or_create(
            pipeline=self.default_pipeline,
            slug='won',
            defaults={'name': 'Won', 'display_order': 2, 'is_system': True, 'is_active': True, 'win_probability': 100}
        )

        self.prod_solar = Product.objects.create(
            name='Commercial Solar Array',
            code='SOLAR-PRO',
            unit_price=Decimal('50000.00'),
            is_active=True,
            created_by=self.admin,
        )
        self.prod_crm = Product.objects.create(
            name='CRM Standard License',
            code='CRM-STD',
            unit_price=Decimal('5000.00'),
            is_active=True,
            created_by=self.admin,
        )

    def test_create_custom_pipeline_for_product_with_bespoke_stages(self):
        res = self.client.post('/api/pipelines/', {
            'name': 'Solar Installation Pipeline',
            'description': 'Custom engineering pipeline for solar projects',
            'product': self.prod_solar.id,
            'mode': 'custom',
            'initial_stages': [
                {'name': 'New', 'color': '#0284c7', 'win_probability': 10, 'is_system': True},
                {'name': 'Site Survey', 'color': '#6366f1', 'win_probability': 35, 'is_system': False},
                {'name': 'Engineering Signoff', 'color': '#f59e0b', 'win_probability': 70, 'is_system': False},
                {'name': 'Won', 'color': '#0d9488', 'win_probability': 100, 'is_system': True},
                {'name': 'Lost', 'color': '#e11d48', 'win_probability': 0, 'is_system': True},
            ]
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        pipe_data = res.data['data']
        self.assertEqual(pipe_data['name'], 'Solar Installation Pipeline')
        self.assertEqual(pipe_data['product'], self.prod_solar.id)
        self.assertEqual(pipe_data['stages_count'], 5)

        # Verify stages scoped cleanly & display_order is contiguous 1..5
        stages_res = self.client.get(f"/api/lead-stages/?pipeline={pipe_data['id']}&all=true")
        self.assertEqual(stages_res.status_code, status.HTTP_200_OK)
        stages_list = stages_res.data.get('results', stages_res.data)
        names = [s['name'] for s in stages_list]
        self.assertEqual(names, ['New', 'Site Survey', 'Engineering Signoff', 'Won', 'Lost'])
        self.assertEqual([s['display_order'] for s in stages_list], [1, 2, 3, 4, 5])

        # Verify Default Pipeline was NOT polluted
        def_stages_res = self.client.get(f"/api/lead-stages/?pipeline={self.default_pipeline.id}&all=true")
        def_names = [s['name'] for s in def_stages_res.data.get('results', def_stages_res.data)]
        self.assertNotIn('Site Survey', def_names)
        self.assertNotIn('Engineering Signoff', def_names)

    def test_clone_mode_creates_independent_pipeline_and_rules(self):
        StageTaskRule.objects.create(
            stage=self.def_new,
            name='Initial Solar Call',
            purpose='Phone Call',
            title='Call prospect',
            is_active=True,
        )
        res = self.client.post('/api/pipelines/', {
            'name': 'CRM License Custom',
            'product': self.prod_crm.id,
            'mode': 'clone',
            'clone_from': self.default_pipeline.id,
            'clone_rules': True,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        pipe_id = res.data['data']['id']
        cloned_stages = LeadStage.objects.filter(pipeline_id=pipe_id)
        self.assertGreaterEqual(cloned_stages.count(), 2)
        cloned_new = cloned_stages.filter(slug='new').first()
        self.assertIsNotNone(cloned_new)
        self.assertEqual(StageTaskRule.objects.filter(stage=cloned_new).count(), 1)

    def test_creating_lead_with_custom_pipeline_product_auto_selects_pipeline_and_renders_kanban(self):
        # Create custom pipeline for Solar
        pipe_res = self.client.post('/api/pipelines/', {
            'name': 'Solar Workflow',
            'product': self.prod_solar.id,
            'mode': 'custom',
            'initial_stages': [
                {'name': 'New', 'color': '#0284c7', 'win_probability': 10, 'is_system': True},
                {'name': 'Roof Inspection', 'color': '#8b5cf6', 'win_probability': 45, 'is_system': False},
                {'name': 'Won', 'color': '#0d9488', 'win_probability': 100, 'is_system': True},
                {'name': 'Lost', 'color': '#e11d48', 'win_probability': 0, 'is_system': True},
            ]
        }, format='json')
        solar_pipe_id = pipe_res.data['data']['id']

        # Create lead attaching Solar product without explicitly passing pipeline/stage
        lead_res = self.client.post('/api/leads/', {
            'name': 'Apex Solar Prospect',
            'email': 'apex@solarprospect.com',
            'phone': '9988776655',
            'product_ids': [self.prod_solar.id],
        }, format='json')
        self.assertEqual(lead_res.status_code, status.HTTP_201_CREATED, lead_res.data)
        self.assertEqual(lead_res.data['pipeline'], solar_pipe_id)
        self.assertEqual(lead_res.data['stage_details']['pipeline'], solar_pipe_id)
        self.assertEqual(lead_res.data['stage_details']['name'], 'New')

        # Create a lead on Default Pipeline using CRM Standard (no custom pipeline)
        std_res = self.client.post('/api/leads/', {
            'name': 'Standard CRM Prospect',
            'email': 'std@crmprospect.com',
            'phone': '9988776644',
            'product_ids': [self.prod_crm.id],
        }, format='json')
        self.assertEqual(std_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(std_res.data['pipeline'], self.default_pipeline.id)

        # Fetch Kanban filtering by Solar product -> returns Solar Workflow columns & Apex lead only
        kanban_res = self.client.get(f"/api/leads/pipeline/?product={self.prod_solar.id}")
        self.assertEqual(kanban_res.status_code, status.HTTP_200_OK)
        self.assertEqual(kanban_res.data['pipeline']['id'], solar_pipe_id)
        self.assertIn('roof-inspection', kanban_res.data['data'])
        self.assertEqual(kanban_res.data['data']['new']['count'], 1)
        self.assertEqual(kanban_res.data['data']['new']['leads'][0]['name'], 'Apex Solar Prospect')

    def test_move_stage_within_custom_pipeline_does_not_affect_default_pipeline_order(self):
        pipe_res = self.client.post('/api/pipelines/', {
            'name': 'Solar Pipeline',
            'product': self.prod_solar.id,
            'mode': 'custom',
            'initial_stages': [
                {'name': 'New', 'is_system': True},
                {'name': 'Audit A', 'is_system': False},
                {'name': 'Audit B', 'is_system': False},
                {'name': 'Won', 'is_system': True},
            ]
        }, format='json')
        solar_pipe_id = pipe_res.data['data']['id']
        audit_b = LeadStage.objects.get(pipeline_id=solar_pipe_id, name='Audit B')
        orig_def_won_order = self.def_won.display_order

        move_res = self.client.patch(f"/api/lead-stages/{audit_b.id}/move/", {'direction': 'up'}, format='json')
        self.assertEqual(move_res.status_code, status.HTTP_200_OK)

        audit_a = LeadStage.objects.get(pipeline_id=solar_pipe_id, name='Audit A')
        audit_b.refresh_from_db()
        self.assertLess(audit_b.display_order, audit_a.display_order)

        # Default pipeline order untouched
        self.def_won.refresh_from_db()
        self.assertEqual(self.def_won.display_order, orig_def_won_order)

    def test_ai_copilot_transitions_stage_within_custom_pipeline(self):
        pipe_res = self.client.post('/api/pipelines/', {
            'name': 'Solar Workflow',
            'product': self.prod_solar.id,
            'mode': 'custom',
            'initial_stages': [
                {'name': 'New', 'is_system': True},
                {'name': 'Panel Sizing', 'is_system': False},
                {'name': 'Won', 'is_system': True},
            ]
        }, format='json')
        solar_pipe = Pipeline.objects.get(pk=pipe_res.data['data']['id'])
        new_stage = LeadStage.objects.get(pipeline=solar_pipe, slug='new')
        lead = Lead.objects.create(
            name='Helios Corp',
            phone='9123456789',
            pipeline=solar_pipe,
            stage=new_stage,
            assigned_to=self.admin,
        )

        # AI confirm executes move to 'Panel Sizing' inside custom pipeline
        result = ChatbotService.execute_confirmed_action(
            self.admin,
            {
                'action_type': 'UPDATE_LEAD_STAGE',
                'parameters': {
                    'lead_id': lead.id,
                    'stage_name': 'Panel Sizing',
                }
            }
        )
        self.assertTrue(result['success'])
        lead.refresh_from_db()
        self.assertEqual(lead.stage.name, 'Panel Sizing')
        self.assertEqual(lead.stage.pipeline_id, solar_pipe.id)

    def test_delete_custom_pipeline_safely_falls_back_leads_to_default_pipeline(self):
        pipe_res = self.client.post('/api/pipelines/', {
            'name': 'Temp Solar',
            'product': self.prod_solar.id,
            'mode': 'minimal',
        }, format='json')
        solar_pipe_id = pipe_res.data['data']['id']
        solar_new = LeadStage.objects.get(pipeline_id=solar_pipe_id, slug='new')
        lead = Lead.objects.create(
            name='Temp Lead',
            phone='9000011111',
            pipeline_id=solar_pipe_id,
            stage=solar_new,
        )

        # Deleting without fallback_to_default should require confirmation
        blocked_res = self.client.delete(f"/api/pipelines/{solar_pipe_id}/")
        self.assertEqual(blocked_res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(blocked_res.data.get('requires_confirmation'))

        # Deleting with fallback_to_default=true moves lead safely to Default Pipeline
        ok_res = self.client.delete(f"/api/pipelines/{solar_pipe_id}/", {'fallback_to_default': True}, format='json')
        self.assertEqual(ok_res.status_code, status.HTTP_200_OK)
        lead.refresh_from_db()
        self.assertEqual(lead.pipeline_id, self.default_pipeline.id)
        self.assertEqual(lead.stage.pipeline_id, self.default_pipeline.id)

        # Default pipeline itself cannot be deleted
        def_del = self.client.delete(f"/api/pipelines/{self.default_pipeline.id}/")
        self.assertEqual(def_del.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_admin_cannot_create_custom_pipeline(self):
        self.client.force_authenticate(user=self.exec_user)
        res = self.client.post('/api/pipelines/', {
            'name': 'Unauthorized Pipeline',
            'product': self.prod_solar.id,
            'mode': 'minimal',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
