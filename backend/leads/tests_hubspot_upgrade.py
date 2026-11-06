from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from decimal import Decimal
from datetime import date
from leads.models import (
    Lead,
    LeadStage,
    LeadSource,
    CustomPropertyDefinition,
    CustomPropertyValue,
)

User = get_user_model()


class HubSpotLeadUpgradeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_superuser(
            email='admin@test.com',
            username='admin',
            password='password123',
            role='ADMIN',
            first_name='Admin',
            last_name='User'
        )
        self.executive = User.objects.create_user(
            email='exec@test.com',
            username='exec',
            password='password123',
            role='EXECUTIVE',
            first_name='Sales',
            last_name='Rep'
        )
        self.source = LeadSource.objects.create(name='Inbound Demo')
        self.stage_new = LeadStage.objects.filter(slug='new').first() or LeadStage.objects.create(
            name='New',
            slug='new',
            color='#6366F1',
            display_order=1,
            is_system=True
        )
        self.stage_qualified = LeadStage.objects.filter(slug='qualified').first() or LeadStage.objects.create(
            name='Qualified',
            slug='qualified',
            color='#10B981',
            display_order=2
        )

    def test_create_lead_with_hubspot_extended_fields(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            'first_name': 'Sarah',
            'last_name': 'Connor',
            'email': 'sarah@skynet.com',
            'phone': '1234567890',
            'mobile_phone': '9876543210',
            'job_title': 'Chief Technology Officer',
            'department': 'Engineering',
            'linkedin_url': 'https://linkedin.com/in/sarah-connor',
            'buying_role': 'DECISION_MAKER',
            'company_name': 'Cyberdyne Systems',
            'website': 'https://cyberdyne.example.com',
            'industry': 'Artificial Intelligence',
            'company_size': '51-200',
            'annual_revenue': '5000000.00',
            'country': 'USA',
            'state': 'California',
            'city': 'Sunnyvale',
            'lead_score': 85,
            'buying_intent': 'HIGH',
            'estimated_budget': '150000.00',
            'customer_requirements': 'Multi-agent CRM automation and stage gating',
            'purchasing_timeline': 'IMMEDIATE',
            'decision_maker': 'Sarah Connor (CTO)',
            'competitor_info': 'Evaluating Salesforce and HubSpot',
            'qualification_notes': 'Urgent Q4 priority with allocated budget',
            'lead_type': 'INBOUND',
            'expected_close_date': str(date.today()),
            'stage': self.stage_new.id,
            'source': self.source.id,
            'priority': 'HIGH',
        }
        res = self.client.post('/api/leads/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        lead_id = res.data['id']

        lead = Lead.objects.get(id=lead_id)
        self.assertEqual(lead.first_name, 'Sarah')
        self.assertEqual(lead.last_name, 'Connor')
        self.assertEqual(lead.name, 'Sarah Connor')
        self.assertEqual(lead.job_title, 'Chief Technology Officer')
        self.assertEqual(lead.buying_role, 'DECISION_MAKER')
        self.assertEqual(lead.lead_score, 85)
        self.assertEqual(lead.annual_revenue, Decimal('5000000.00'))

    def test_custom_properties_system(self):
        self.client.force_authenticate(user=self.admin)

        # 1. Create custom property definition
        def_payload = {
            'name': 'security_tier',
            'label': 'Security Clearance Tier',
            'field_type': 'dropdown',
            'section': 'qualification',
            'options': ['Tier 1', 'Tier 2', 'Top Secret'],
            'is_mandatory': True,
        }
        res_def = self.client.post('/api/leads/custom-properties/', def_payload, format='json')
        self.assertEqual(res_def.status_code, status.HTTP_201_CREATED, res_def.data)
        prop_id = res_def.data['id']

        # 2. Create lead with custom property
        lead_payload = {
            'name': 'John Doe',
            'phone': '1234567890',
            'email': 'john@example.com',
            'company_name': 'Tech Corp',
            'stage': self.stage_new.id,
            'custom_properties': {
                'security_tier': 'Top Secret'
            }
        }
        res_lead = self.client.post('/api/leads/', lead_payload, format='json')
        self.assertEqual(res_lead.status_code, status.HTTP_201_CREATED, res_lead.data)
        lead_id = res_lead.data['id']

        # 3. Retrieve lead detail and verify custom_properties payload
        res_detail = self.client.get(f'/api/leads/{lead_id}/')
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        custom_props = res_detail.data.get('custom_properties', [])
        self.assertTrue(len(custom_props) >= 1)
        prop_val = next((p for p in custom_props if p['name'] == 'security_tier'), None)
        self.assertIsNotNone(prop_val)
        self.assertEqual(prop_val['value_text'], 'Top Secret')

        # 4. Update custom properties via dedicated endpoint
        res_update = self.client.post(
            f'/api/leads/{lead_id}/custom-properties/',
            {'properties': {'security_tier': 'Tier 1'}},
            format='json'
        )
        self.assertEqual(res_update.status_code, status.HTTP_200_OK)
        prop_val_updated = next(p for p in res_update.data['custom_properties'] if p['name'] == 'security_tier')
        self.assertEqual(prop_val_updated['value_text'], 'Tier 1')
