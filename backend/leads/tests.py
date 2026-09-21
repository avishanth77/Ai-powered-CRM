from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from decimal import Decimal
from accounts.models import User
from leads.models import Lead, LeadSource
from customers.models import Customer
from activity.models import ActivityLog

class LeadAndPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.admin = User.objects.create_user(
            email='admin@test.com', password='Password@123', role=User.Role.ADMIN, is_staff=True, is_superuser=True
        )
        self.manager = User.objects.create_user(
            email='manager@test.com', password='Password@123', role=User.Role.MANAGER
        )
        self.exec_1 = User.objects.create_user(
            email='exec1@test.com', password='Password@123', role=User.Role.EXECUTIVE
        )
        self.exec_2 = User.objects.create_user(
            email='exec2@test.com', password='Password@123', role=User.Role.EXECUTIVE
        )

        # Lead Source
        self.source = LeadSource.objects.create(name='Direct Inbound')

        # Leads
        self.lead_exec_1 = Lead.objects.create(
            name='Exec 1 Lead',
            phone='+15551111111',
            email='lead1@example.com',
            source=self.source,
            status=Lead.Status.NEW,
            assigned_to=self.exec_1,
            created_by=self.exec_1,
            expected_value=Decimal('5000.00')
        )

        self.lead_exec_2 = Lead.objects.create(
            name='Exec 2 Lead',
            phone='+15552222222',
            email='lead2@example.com',
            source=self.source,
            status=Lead.Status.QUALIFIED,
            assigned_to=self.exec_2,
            created_by=self.exec_2,
            expected_value=Decimal('12000.00')
        )

    def test_executive_cannot_see_other_executives_lead(self):
        self.client.force_authenticate(user=self.exec_1)
        response = self.client.get('/api/leads/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only see own lead
        lead_ids = [item['id'] for item in response.data['results']]
        self.assertIn(self.lead_exec_1.id, lead_ids)
        self.assertNotIn(self.lead_exec_2.id, lead_ids)

    def test_executive_cannot_retrieve_other_executives_lead(self):
        self.client.force_authenticate(user=self.exec_1)
        response = self.client.get(f'/api/leads/{self.lead_exec_2.id}/')
        # ViewSet queryset scoping filters it out, returning 404
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_manager_can_see_all_leads(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.get('/api/leads/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = [item['id'] for item in response.data['results']]
        self.assertIn(self.lead_exec_1.id, lead_ids)
        self.assertIn(self.lead_exec_2.id, lead_ids)

    def test_manager_can_assign_lead(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(f'/api/leads/{self.lead_exec_1.id}/assign/', {
            'assigned_to': self.exec_2.id
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.lead_exec_1.refresh_from_db()
        self.assertEqual(self.lead_exec_1.assigned_to, self.exec_2)

    def test_executive_cannot_assign_lead(self):
        self.client.force_authenticate(user=self.exec_1)
        response = self.client.post(f'/api/leads/{self.lead_exec_1.id}/assign/', {
            'assigned_to': self.exec_2.id
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_duplicate_phone_rejected(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post('/api/leads/', {
            'name': 'Duplicate Person',
            'phone': '+15551111111',  # Same as lead_exec_1
            'email': 'unique@example.com',
            'status': Lead.Status.NEW
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertIn('phone', response.data['errors'])

    def test_negative_expected_value_rejected(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post('/api/leads/', {
            'name': 'Negative Value Lead',
            'phone': '+15559998888',
            'expected_value': -500.00
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_lost_status_requires_reason(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.patch(f'/api/leads/{self.lead_exec_1.id}/', {
            'status': Lead.Status.LOST,
            'lost_reason': ''
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_qualified_lead_conversion_success(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(f'/api/leads/{self.lead_exec_2.id}/convert/')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])

        self.lead_exec_2.refresh_from_db()
        self.assertEqual(self.lead_exec_2.status, Lead.Status.WON)
        self.assertIsNotNone(self.lead_exec_2.converted_at)

        # Check Customer created
        customer = Customer.objects.get(lead=self.lead_exec_2)
        self.assertEqual(customer.name, self.lead_exec_2.name)
        self.assertEqual(customer.phone, self.lead_exec_2.phone)

        # Check Activity Log created
        activity = ActivityLog.objects.filter(
            entity_type=ActivityLog.EntityType.LEAD,
            entity_id=str(self.lead_exec_2.id),
            action=ActivityLog.ActionType.LEAD_CONVERTED
        ).first()
        self.assertIsNotNone(activity)

    def test_unqualified_lead_conversion_rejected(self):
        self.client.force_authenticate(user=self.manager)
        # lead_exec_1 is in NEW status, not QUALIFIED
        response = self.client.post(f'/api/leads/{self.lead_exec_1.id}/convert/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_duplicate_conversion_rejected(self):
        self.client.force_authenticate(user=self.manager)
        # Convert first time
        self.client.post(f'/api/leads/{self.lead_exec_2.id}/convert/')
        # Convert second time
        response = self.client.post(f'/api/leads/{self.lead_exec_2.id}/convert/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_dashboard_summary(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/reports/summary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        kpis = response.data['data']['kpis']
        self.assertEqual(kpis['total_leads'], 2)
        self.assertEqual(kpis['new_leads'], 1)
        self.assertEqual(kpis['qualified_leads'], 1)

    def test_csv_report_export(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/reports/export/?format=csv')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv')
        content = response.content.decode('utf-8')
        self.assertIn('Lead ID', content)
        self.assertIn('Exec 1 Lead', content)
        self.assertIn('Exec 2 Lead', content)
