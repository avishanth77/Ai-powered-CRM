from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from decimal import Decimal
from accounts.models import User
from leads.models import Lead, LeadSource, LeadStage, LeadHandover
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
        self.inactive_exec = User.objects.create_user(
            email='inactive@test.com', password='Password@123', role=User.Role.EXECUTIVE, is_active=False
        )

        # Lead Source
        self.source = LeadSource.objects.create(name='Direct Inbound')

        # Ensure system stages exist
        self.stage_new, _ = LeadStage.objects.get_or_create(
            slug='new',
            defaults={'name': 'New', 'color': '#0284c7', 'display_order': 1, 'is_active': True, 'is_system': True}
        )
        self.stage_contacted, _ = LeadStage.objects.get_or_create(
            slug='contacted',
            defaults={'name': 'Contacted', 'color': '#2563eb', 'display_order': 2, 'is_active': True, 'is_system': False}
        )
        self.stage_demo, _ = LeadStage.objects.get_or_create(
            slug='demo-scheduled',
            defaults={'name': 'Demo Scheduled', 'color': '#7c3aed', 'display_order': 3, 'is_active': True, 'is_system': False}
        )
        self.stage_qualified, _ = LeadStage.objects.get_or_create(
            slug='qualified',
            defaults={'name': 'Qualified', 'color': '#059669', 'display_order': 5, 'is_active': True, 'is_system': False}
        )
        self.stage_won, _ = LeadStage.objects.get_or_create(
            slug='won',
            defaults={'name': 'Won', 'color': '#0d9488', 'display_order': 6, 'is_active': True, 'is_system': True}
        )
        self.stage_lost, _ = LeadStage.objects.get_or_create(
            slug='lost',
            defaults={'name': 'Lost', 'color': '#e11d48', 'display_order': 7, 'is_active': True, 'is_system': True}
        )

        # Leads
        self.lead_exec_1 = Lead.objects.create(
            name='Exec 1 Lead',
            phone='+15551111111',
            email='lead1@example.com',
            source=self.source,
            stage=self.stage_new,
            assigned_to=self.exec_1,
            created_by=self.exec_1,
            expected_value=Decimal('5000.00')
        )

        self.lead_exec_2 = Lead.objects.create(
            name='Exec 2 Lead',
            phone='+15552222222',
            email='lead2@example.com',
            source=self.source,
            stage=self.stage_qualified,
            assigned_to=self.exec_2,
            created_by=self.exec_2,
            expected_value=Decimal('12000.00')
        )

    # ============================================================
    # FEATURE 1: LEAD STAGE TESTS (1 to 11)
    # ============================================================

    def test_01_admin_can_create_stage(self):
        """1. Admin can create stage."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/lead-stages/', {
            'name': 'Proposal Sent',
            'description': 'Proposal has been sent to customer',
            'color': '#6366F1',
            'display_order': 4,
            'is_active': True,
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['name'], 'Proposal Sent')
        self.assertEqual(response.data['slug'], 'proposal-sent')

    def test_02_manager_cannot_create_stage(self):
        """2. Manager cannot create stage."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.post('/api/lead-stages/', {
            'name': 'Manager Stage',
            'color': '#6366F1',
            'display_order': 4
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_03_executive_cannot_create_stage(self):
        """3. Executive cannot create stage."""
        self.client.force_authenticate(user=self.exec_1)
        response = self.client.post('/api/lead-stages/', {
            'name': 'Executive Stage',
            'color': '#6366F1',
            'display_order': 4
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_04_admin_can_rename_stage(self):
        """4. Admin can rename stage."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(f'/api/lead-stages/{self.stage_demo.id}/', {
            'name': 'Demo / Meeting Scheduled'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.stage_demo.refresh_from_db()
        self.assertEqual(self.stage_demo.name, 'Demo / Meeting Scheduled')

    def test_05_existing_leads_retain_stage_after_rename(self):
        """5. Existing leads retain stage after rename."""
        # Create a lead with demo stage
        lead = Lead.objects.create(
            name='Meeting Lead',
            phone='+15553334444',
            stage=self.stage_demo,
            assigned_to=self.exec_1
        )
        self.assertEqual(lead.stage_id, self.stage_demo.id)

        # Admin renames the stage
        self.client.force_authenticate(user=self.admin)
        self.client.patch(f'/api/lead-stages/{self.stage_demo.id}/', {
            'name': 'Demo / Meeting Scheduled'
        })

        # Lead should retain stage ID and reflect new name
        lead.refresh_from_db()
        self.assertEqual(lead.stage_id, self.stage_demo.id)
        self.assertEqual(lead.stage.name, 'Demo / Meeting Scheduled')
        self.assertEqual(lead.status, 'Demo / Meeting Scheduled')

    def test_06_admin_can_deactivate_stage(self):
        """6. Admin can deactivate stage."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(f'/api/lead-stages/{self.stage_contacted.id}/toggle-active/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.stage_contacted.refresh_from_db()
        self.assertFalse(self.stage_contacted.is_active)

    def test_07_inactive_stage_cannot_be_selected_for_new_leads(self):
        """7. Inactive stage cannot be selected for new leads."""
        # Deactivate contacted stage
        self.stage_contacted.is_active = False
        self.stage_contacted.save()

        self.client.force_authenticate(user=self.manager)
        response = self.client.post('/api/leads/', {
            'name': 'Lead with Inactive Stage',
            'phone': '+15559876543',
            'stage': self.stage_contacted.id
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_08_existing_leads_remain_unchanged_when_stage_deactivated(self):
        """8. Existing leads remain unchanged when stage is deactivated."""
        lead = Lead.objects.create(
            name='Contacted Lead',
            phone='+15554445555',
            stage=self.stage_contacted,
            assigned_to=self.exec_1
        )

        # Deactivate stage
        self.client.force_authenticate(user=self.admin)
        self.client.patch(f'/api/lead-stages/{self.stage_contacted.id}/toggle-active/')

        lead.refresh_from_db()
        self.assertEqual(lead.stage_id, self.stage_contacted.id)
        self.assertEqual(lead.stage.name, 'Contacted')

    def test_09_cannot_delete_stage_with_leads_without_migration(self):
        """9. Cannot delete stage with leads without migration."""
        self.client.force_authenticate(user=self.admin)
        # lead_exec_1 is in stage_new
        response = self.client.delete(f'/api/lead-stages/{self.stage_new.id}/')
        # System stage protection AND leads exist protection
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        # Create custom stage with lead
        custom_stage = LeadStage.objects.create(name='Review', slug='review', display_order=10)
        Lead.objects.create(name='In Review', phone='+15556667777', stage=custom_stage, assigned_to=self.exec_1)

        # Deleting without move_to_stage fails
        response = self.client.delete(f'/api/lead-stages/{custom_stage.id}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Move these leads to another stage', response.data['message'])

        # Deleting WITH move_to_stage succeeds
        response = self.client.delete(f'/api/lead-stages/{custom_stage.id}/', {
            'move_to_stage': self.stage_new.id
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(LeadStage.objects.filter(id=custom_stage.id).exists())

    def test_10_duplicate_stage_names_are_rejected(self):
        """10. Duplicate stage names are rejected (case-insensitive)."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/lead-stages/', {
            'name': 'new',  # Duplicate of 'New'
            'color': '#123456',
            'display_order': 20
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue('name' in response.data or 'name' in response.data.get('errors', {}))

    def test_11_stage_ordering_works(self):
        """11. Stage ordering works."""
        self.client.force_authenticate(user=self.admin)
        # Move demo up
        initial_order = self.stage_demo.display_order
        response = self.client.patch(f'/api/lead-stages/{self.stage_demo.id}/move/', {
            'direction': 'up'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.stage_demo.refresh_from_db()
        self.assertLess(self.stage_demo.display_order, initial_order)

    # ============================================================
    # FEATURE 2: LEAD HANDOVER TESTS (12 to 22)
    # ============================================================

    def test_12_manager_can_hand_over_lead(self):
        """12. Manager can hand over lead."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(f'/api/leads/{self.lead_exec_1.id}/handover/', {
            'new_assigned_to': self.exec_2.id,
            'reason': 'Customer requested another executive'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.lead_exec_1.refresh_from_db()
        self.assertEqual(self.lead_exec_1.assigned_to, self.exec_2)

    def test_13_admin_can_hand_over_lead(self):
        """13. Admin can hand over lead."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f'/api/leads/{self.lead_exec_1.id}/handover/', {
            'new_assigned_to': self.exec_2.id,
            'reason': 'Territory realignment'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.lead_exec_1.refresh_from_db()
        self.assertEqual(self.lead_exec_1.assigned_to, self.exec_2)

    def test_14_executive_cannot_hand_over_lead(self):
        """14. Executive cannot hand over lead."""
        self.client.force_authenticate(user=self.exec_1)
        response = self.client.post(f'/api/leads/{self.lead_exec_1.id}/handover/', {
            'new_assigned_to': self.exec_2.id,
            'reason': 'Trying to reassign own lead'
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_15_cannot_hand_over_to_inactive_user(self):
        """15. Cannot hand over to inactive user."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(f'/api/leads/{self.lead_exec_1.id}/handover/', {
            'new_assigned_to': self.inactive_exec.id,
            'reason': 'Assigning to inactive user'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_16_cannot_hand_over_to_manager_if_only_executives_allowed(self):
        """16. Cannot hand over to manager if only executives are allowed."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(f'/api/leads/{self.lead_exec_1.id}/handover/', {
            'new_assigned_to': self.manager.id,
            'reason': 'Assigning to manager'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_17_cannot_hand_over_to_same_executive(self):
        """17. Cannot hand over to same executive."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(f'/api/leads/{self.lead_exec_1.id}/handover/', {
            'new_assigned_to': self.exec_1.id,  # Same as current
            'reason': 'Reassign to same person'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_18_handover_updates_assigned_to(self):
        """18. Handover updates assigned_to."""
        self.client.force_authenticate(user=self.manager)
        self.client.post(f'/api/leads/{self.lead_exec_1.id}/handover/', {
            'new_assigned_to': self.exec_2.id,
            'reason': 'Transferred to Sarah'
        })
        self.lead_exec_1.refresh_from_db()
        self.assertEqual(self.lead_exec_1.assigned_to_id, self.exec_2.id)

    def test_19_handover_creates_lead_handover_record(self):
        """19. Handover creates LeadHandover record."""
        self.client.force_authenticate(user=self.manager)
        self.client.post(f'/api/leads/{self.lead_exec_1.id}/handover/', {
            'new_assigned_to': self.exec_2.id,
            'reason': 'Workload balancing'
        })
        record = LeadHandover.objects.filter(lead=self.lead_exec_1).first()
        self.assertIsNotNone(record)
        self.assertEqual(record.previous_assignee, self.exec_1)
        self.assertEqual(record.new_assignee, self.exec_2)
        self.assertEqual(record.handed_over_by, self.manager)
        self.assertEqual(record.reason, 'Workload balancing')

    def test_20_handover_creates_activity_log(self):
        """20. Handover creates ActivityLog."""
        self.client.force_authenticate(user=self.manager)
        self.client.post(f'/api/leads/{self.lead_exec_1.id}/handover/', {
            'new_assigned_to': self.exec_2.id,
            'reason': 'Performance reallocation'
        })
        log = ActivityLog.objects.filter(
            entity_type=ActivityLog.EntityType.LEAD,
            entity_id=str(self.lead_exec_1.id),
            action=ActivityLog.ActionType.LEAD_REASSIGNED
        ).first()
        self.assertIsNotNone(log)
        self.assertIn('Performance reallocation', log.notes)
        self.assertEqual(log.performed_by, self.manager)

    def test_21_handover_reason_is_stored(self):
        """21. Handover reason is stored."""
        reason_text = "Customer explicitly requested Sarah due to regional proximity."
        self.client.force_authenticate(user=self.manager)
        self.client.post(f'/api/leads/{self.lead_exec_1.id}/handover/', {
            'new_assigned_to': self.exec_2.id,
            'reason': reason_text
        })
        record = LeadHandover.objects.filter(lead=self.lead_exec_1).first()
        self.assertEqual(record.reason, reason_text)

    def test_22_handover_history_is_preserved(self):
        """22. Handover history is preserved across multiple transfers."""
        self.client.force_authenticate(user=self.manager)
        # First handover: exec_1 -> exec_2
        self.client.post(f'/api/leads/{self.lead_exec_1.id}/handover/', {
            'new_assigned_to': self.exec_2.id,
            'reason': 'First transfer'
        })
        # Second handover: exec_2 -> exec_1
        self.client.post(f'/api/leads/{self.lead_exec_1.id}/handover/', {
            'new_assigned_to': self.exec_1.id,
            'reason': 'Second transfer back'
        })
        records = LeadHandover.objects.filter(lead=self.lead_exec_1).order_by('created_at')
        self.assertEqual(records.count(), 2)
        self.assertEqual(records[0].previous_assignee, self.exec_1)
        self.assertEqual(records[0].new_assignee, self.exec_2)
        self.assertEqual(records[1].previous_assignee, self.exec_2)
        self.assertEqual(records[1].new_assignee, self.exec_1)

    # ============================================================
    # EXISTING COMPATIBILITY & INTEGRATION TESTS
    # ============================================================

    def test_executive_cannot_see_other_executives_lead(self):
        self.client.force_authenticate(user=self.exec_1)
        response = self.client.get('/api/leads/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = [item['id'] for item in response.data['results']]
        self.assertIn(self.lead_exec_1.id, lead_ids)
        self.assertNotIn(self.lead_exec_2.id, lead_ids)

    def test_manager_can_see_all_leads(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.get('/api/leads/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        lead_ids = [item['id'] for item in response.data['results']]
        self.assertIn(self.lead_exec_1.id, lead_ids)
        self.assertIn(self.lead_exec_2.id, lead_ids)

    def test_duplicate_phone_rejected(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post('/api/leads/', {
            'name': 'Duplicate Person',
            'phone': '+15551111111',
            'email': 'unique@example.com',
            'stage': self.stage_new.id
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

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
            'stage': self.stage_lost.id,
            'lost_reason': ''
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_qualified_lead_conversion_success(self):
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(f'/api/leads/{self.lead_exec_2.id}/convert/')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])

        self.lead_exec_2.refresh_from_db()
        self.assertEqual(self.lead_exec_2.stage.slug, 'won')
        self.assertIsNotNone(self.lead_exec_2.converted_at)

        customer = Customer.objects.get(lead=self.lead_exec_2)
        self.assertEqual(customer.name, self.lead_exec_2.name)

        activity = ActivityLog.objects.filter(
            entity_type=ActivityLog.EntityType.LEAD,
            entity_id=str(self.lead_exec_2.id),
            action=ActivityLog.ActionType.LEAD_CONVERTED
        ).first()
        self.assertIsNotNone(activity)

    def test_dashboard_summary(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/reports/summary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        kpis = response.data['data']['kpis']
        self.assertEqual(kpis['total_leads'], 2)
        self.assertEqual(kpis['new_leads'], 1)
        self.assertEqual(kpis['qualified_leads'], 1)
        self.assertIn('leads_by_executive', response.data['data'])
        self.assertIn('recent_handovers', response.data['data'])

    def test_csv_report_export(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get('/api/reports/export/?format=csv')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response['Content-Type'], 'text/csv')
        content = response.content.decode('utf-8')
        self.assertIn('Lead ID', content)
        self.assertIn('Exec 1 Lead', content)
        self.assertIn('Exec 2 Lead', content)
