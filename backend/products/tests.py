from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from products.models import Product, LeadProduct, CustomerProduct
from leads.models import Lead, LeadStage
from customers.models import Customer

User = get_user_model()


class MultiProductCRMTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin = User.objects.create_superuser(
            email='admin@products-test.com',
            username='admin_prod',
            first_name='Admin',
            last_name='User',
            role='ADMIN',
            password='password123'
        )

        self.rep = User.objects.create_user(
            email='rep@products-test.com',
            username='rep_prod',
            first_name='Sales',
            last_name='Rep',
            role='EXECUTIVE',
            password='password123'
        )

        self.stage_new, _ = LeadStage.objects.get_or_create(
            slug='new',
            defaults={'name': 'New', 'display_order': 1, 'is_active': True}
        )
        self.stage_won, _ = LeadStage.objects.get_or_create(
            slug='won',
            defaults={'name': 'Won', 'display_order': 10, 'is_active': True}
        )

        self.prod_erp = Product.objects.create(
            name='Enterprise Cloud ERP',
            code='ERP-TEST',
            category='Software',
            unit_price=Decimal('50000.00'),
            billing_cycle='ANNUAL',
            is_active=True
        )
        self.prod_ai = Product.objects.create(
            name='AI Copilot Deal Intelligence',
            code='AI-TEST',
            category='AI',
            unit_price=Decimal('15000.00'),
            billing_cycle='MONTHLY',
            is_active=True
        )

    def test_product_crud_as_admin(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post('/api/products/', {
            'name': 'Cloud Security Suite',
            'code': 'SEC-TEST',
            'category': 'Security',
            'unit_price': '30000.00',
            'billing_cycle': 'ANNUAL',
            'is_active': True,
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['code'], 'SEC-TEST')

        # List products
        res_list = self.client.get('/api/products/')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        # Should have at least 3 products
        self.assertGreaterEqual(len(res_list.data['results'] if 'results' in res_list.data else res_list.data), 3)

    def test_multi_product_lead_creation_and_value_calculation(self):
        self.client.force_authenticate(user=self.rep)
        payload = {
            'name': 'Acme Global Corp',
            'phone': '+1-555-0199',
            'email': 'procurement@acme.com',
            'stage': self.stage_new.id,
            'product_ids': [self.prod_erp.id, self.prod_ai.id],
        }
        res = self.client.post('/api/leads/', payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        lead_id = res.data['id']

        lead = Lead.objects.get(id=lead_id)
        # Verify 2 products attached
        self.assertEqual(lead.lead_products.count(), 2)
        # Expected value should automatically equal sum of products (50,000 + 15,000 = 65,000)
        self.assertEqual(lead.expected_value, Decimal('65000.00'))

        # Fetch lead details API
        res_detail = self.client.get(f'/api/leads/{lead_id}/')
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_detail.data['products']), 2)
        product_names = [p['name'] for p in res_detail.data['products']]
        self.assertIn('Enterprise Cloud ERP', product_names)
        self.assertIn('AI Copilot Deal Intelligence', product_names)

    def test_filter_leads_by_product(self):
        self.client.force_authenticate(user=self.admin)
        # Lead A has ERP
        lead_a = Lead.objects.create(name='Lead A', phone='111-222-3333', stage=self.stage_new)
        LeadProduct.objects.create(lead=lead_a, product=self.prod_erp, unit_price=self.prod_erp.unit_price)

        # Lead B has AI
        lead_b = Lead.objects.create(name='Lead B', phone='444-555-6666', stage=self.stage_new)
        LeadProduct.objects.create(lead=lead_b, product=self.prod_ai, unit_price=self.prod_ai.unit_price)

        # Filter by ERP product
        res = self.client.get(f'/api/leads/?product={self.prod_erp.id}')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data['results'] if 'results' in res.data else res.data
        lead_names = [l['name'] for l in results]
        self.assertIn('Lead A', lead_names)
        self.assertNotIn('Lead B', lead_names)

        # Filter pipeline by AI product
        res_pipeline = self.client.get(f'/api/leads/pipeline/?product={self.prod_ai.id}')
        self.assertEqual(res_pipeline.status_code, status.HTTP_200_OK)
        pipeline_new_leads = res_pipeline.data['data']['new']['leads']
        pipe_names = [l['name'] for l in pipeline_new_leads]
        self.assertIn('Lead B', pipe_names)
        self.assertNotIn('Lead A', pipe_names)

    def test_winning_lead_converts_lead_products_to_customer_products(self):
        self.client.force_authenticate(user=self.admin)
        lead = Lead.objects.create(
            name='Won Enterprise Deal',
            phone='999-888-7777',
            email='vp@enterprisecorp.com',
            stage=self.stage_new
        )
        LeadProduct.objects.create(lead=lead, product=self.prod_erp, unit_price=self.prod_erp.unit_price, quantity=2)

        # Move to Won stage
        res = self.client.patch(f'/api/leads/{lead.id}/', {'stage': self.stage_won.id}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        lead.refresh_from_db()
        self.assertTrue(hasattr(lead, 'customer_profile'))
        customer = lead.customer_profile
        self.assertIsNotNone(customer)

        # Verify CustomerProduct record was automatically copied
        cust_prods = CustomerProduct.objects.filter(customer=customer)
        self.assertEqual(cust_prods.count(), 1)
        self.assertEqual(cust_prods.first().product, self.prod_erp)
        self.assertEqual(cust_prods.first().quantity, 2)