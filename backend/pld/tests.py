from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from leads.models import Lead, LeadStage

from .models import PLDProblem, PLDScoringConfig, PLDStageGate, PLDStatus, PLDSeverity
from .services.gates import check_gate
from .services.scoring import classify_score, submit_assessment

User = get_user_model()


class PLDTestBase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='pld-admin@test.com', password='Password@123', role=User.Role.ADMIN,
            first_name='Pld', last_name='Admin',
        )
        self.manager = User.objects.create_user(
            email='pld-manager@test.com', password='Password@123', role=User.Role.MANAGER,
            first_name='Pld', last_name='Manager',
        )
        self.sales = User.objects.create_user(
            email='pld-sales@test.com', password='Password@123', role=User.Role.EXECUTIVE,
            first_name='Pld', last_name='Sales',
        )
        self.other_sales = User.objects.create_user(
            email='pld-other@test.com', password='Password@123', role=User.Role.EXECUTIVE,
            first_name='Other', last_name='Sales',
        )
        self.stage_new, _ = LeadStage.objects.get_or_create(
            slug='new',
            defaults={'name': 'New', 'color': '#0284c7', 'display_order': 1, 'is_active': True, 'is_system': True},
        )
        self.stage_contacted, _ = LeadStage.objects.get_or_create(
            slug='contacted',
            defaults={'name': 'Contacted', 'color': '#2563eb', 'display_order': 2, 'is_active': True},
        )
        self.stage_qualified, _ = LeadStage.objects.get_or_create(
            slug='qualified',
            defaults={'name': 'Qualified', 'color': '#059669', 'display_order': 5, 'is_active': True},
        )
        self.lead = Lead.objects.create(
            name='Acme Contact', phone='9000000001', company_name='Acme Ltd',
            stage=self.stage_new, assigned_to=self.sales, created_by=self.sales,
        )

    def login(self, user):
        self.client.force_authenticate(user=user)

    @staticmethod
    def make_problem(name, points, severity=PLDSeverity.MEDIUM, order=1, active=True):
        return PLDProblem.objects.create(
            name=name, points=points, severity=severity,
            display_order=order, is_active=active,
        )

    def make_pool(self):
        """Three problems worth 10 / 15 / 25 points (pool = 50)."""
        return (
            self.make_problem('No unified system', 10, PLDSeverity.LOW, 1),
            self.make_problem('Manual reporting', 15, PLDSeverity.MEDIUM, 2),
            self.make_problem('Revenue leakage', 25, PLDSeverity.CRITICAL, 3),
        )


class PLDProblemCrudTests(PLDTestBase):
    def test_admin_can_create_problem(self):
        self.login(self.admin)
        response = self.client.post(reverse('pld-problem-list'), {
            'name': 'No unified system',
            'description': 'Tools do not talk to each other',
            'points': 10,
            'severity': 'HIGH',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        problem = PLDProblem.objects.get(id=response.data['data']['id'])
        self.assertEqual(problem.points, 10)
        self.assertEqual(problem.severity, 'HIGH')
        self.assertEqual(problem.created_by, self.admin)
        self.assertEqual(problem.display_order, 1)

    def test_sales_cannot_create_problem(self):
        self.login(self.sales)
        response = self.client.post(reverse('pld-problem-list'), {
            'name': 'Sneaky problem', 'points': 5,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(PLDProblem.objects.filter(name='Sneaky problem').exists())

    def test_manager_can_create_problem(self):
        self.login(self.manager)
        response = self.client.post(reverse('pld-problem-list'), {
            'name': 'Manager problem', 'points': 5,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_duplicate_problem_name_rejected(self):
        self.make_problem('No unified system', 10)
        self.login(self.admin)
        response = self.client.post(reverse('pld-problem-list'), {
            'name': 'no unified system', 'points': 5,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('name', str(response.data))

    def test_problems_are_listed_in_display_order(self):
        self.make_problem('Second', 5, order=2)
        self.make_problem('First', 5, order=1)
        self.login(self.sales)
        response = self.client.get(reverse('pld-problem-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data.get('results', response.data)
        self.assertEqual([row['name'] for row in payload], ['First', 'Second'])

    def test_inactive_problems_hidden_from_sales(self):
        self.make_problem('Active one', 5, order=1, active=True)
        self.make_problem('Retired one', 5, order=2, active=False)
        self.login(self.sales)
        payload = self.client.get(reverse('pld-problem-list')).data
        rows = payload.get('results', payload)
        self.assertEqual([row['name'] for row in rows], ['Active one'])

    def test_admin_can_see_inactive_with_flag(self):
        self.make_problem('Retired one', 5, active=False)
        self.login(self.admin)
        payload = self.client.get(reverse('pld-problem-list'), {'all': 'true'}).data
        rows = payload.get('results', payload)
        self.assertEqual(len(rows), 1)

    def test_toggle_and_move_problem(self):
        problem = self.make_problem('First', 5, order=1)
        second = self.make_problem('Second', 5, order=2)
        self.login(self.admin)

        self.client.patch(reverse('pld-problem-detail', args=[problem.id]), {'is_active': False}, format='json')
        problem.refresh_from_db()
        self.assertFalse(problem.is_active)

        self.client.patch(reverse('pld-problem-move', args=[second.id]), {'direction': 'up'}, format='json')
        problem.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(problem.display_order, 2)
        self.assertEqual(second.display_order, 1)

    def test_delete_problem_keeps_history_readable(self):
        problem = self.make_problem('Fleeting', 10)
        self.lead.pld_status = PLDStatus.QUALIFIED_PLD
        self.lead.save(update_fields=['pld_status'])
        submit_assessment(self.lead, self.admin, [problem.id])

        self.login(self.admin)
        response = self.client.delete(reverse('pld-problem-detail', args=[problem.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        history = self.client.get(reverse('lead-pld-history', args=[self.lead.id]))
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        self.assertEqual(history.data['count'], 1)


class PLDScoringTests(PLDTestBase):
    def test_score_is_sum_of_selected_problem_points(self):
        a, b, _ = self.make_pool()
        assessment = submit_assessment(self.lead, self.sales, [a.id, b.id])

        self.assertEqual(assessment.total_score, 25)
        self.assertEqual(assessment.max_score, 50)
        self.assertEqual(str(assessment.percentage), '50.00')
        self.assertEqual(assessment.pld_status, PLDStatus.UNQUALIFIED)

        self.lead.refresh_from_db()
        self.assertEqual(self.lead.pld_score, 25)
        self.assertEqual(self.lead.pld_status, PLDStatus.UNQUALIFIED)

    def test_full_pool_qualifies_at_default_threshold(self):
        problems = self.make_pool()
        assessment = submit_assessment(self.lead, self.sales, [p.id for p in problems])
        self.assertEqual(assessment.percentage, 100)
        self.assertEqual(assessment.pld_status, PLDStatus.QUALIFIED_PLD)

    def test_threshold_is_configurable(self):
        a, b, _ = self.make_pool()
        config = PLDScoringConfig.objects.get_or_create(pk=1)[0]
        config.qualified_min_percentage = 50
        config.save()

        self.assertEqual(classify_score(50), PLDStatus.QUALIFIED_PLD)
        assessment = submit_assessment(self.lead, self.sales, [a.id, b.id])
        self.assertEqual(assessment.pld_status, PLDStatus.QUALIFIED_PLD)
        self.assertEqual(assessment.config_snapshot, {'qualified_min_percentage': 50})

    def test_submission_requires_at_least_one_problem(self):
        self.make_pool()
        with self.assertRaises(Exception) as ctx:
            submit_assessment(self.lead, self.sales, [])
        self.assertIn('at least one problem', str(ctx.exception))

    def test_unknown_problem_id_rejected(self):
        a, _, _ = self.make_pool()
        with self.assertRaises(Exception) as ctx:
            submit_assessment(self.lead, self.sales, [a.id, 999999])
        self.assertIn('no longer active', str(ctx.exception))

    def test_duplicate_problem_ids_counted_once(self):
        a, _, _ = self.make_pool()
        assessment = submit_assessment(self.lead, self.sales, [a.id, a.id, str(a.id)])
        self.assertEqual(assessment.total_score, 10)
        self.assertEqual(assessment.problems.count(), 1)

    def test_client_supplied_scores_are_ignored(self):
        a, _, _ = self.make_pool()
        self.login(self.sales)
        response = self.client.post(reverse('lead-pld-assess', args=[self.lead.id]), {
            'problem_ids': [a.id],
            'total_score': 999,
            'pld_status': 'QUALIFIED_PLD',
            'percentage': 100,
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['total_score'], 10)
        self.assertEqual(response.data['data']['pld_status'], PLDStatus.UNQUALIFIED)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.pld_score, 10)

    def test_snapshot_is_immune_to_later_point_changes(self):
        a, b, _ = self.make_pool()
        first = submit_assessment(self.lead, self.sales, [a.id, b.id])
        self.assertEqual(first.total_score, 25)

        # Admin re-weights both problems after the assessment.
        PLDProblem.objects.filter(id=a.id).update(points=100)
        PLDProblem.objects.filter(id=b.id).update(points=100)

        first.refresh_from_db()
        self.assertEqual(first.total_score, 25)
        self.assertEqual(first.max_score, 50)
        frozen = {(row['id'], row['points']) for row in first.problems_snapshot}
        self.assertEqual(frozen, {(a.id, 10), (b.id, 15)})

        second = submit_assessment(self.lead, self.sales, [a.id, b.id])
        self.assertEqual(second.total_score, 200)
        self.assertEqual(second.max_score, 225)
        self.assertNotEqual(second.percentage, first.percentage)

    def test_history_returns_newest_first(self):
        a, _, _ = self.make_pool()
        submit_assessment(self.lead, self.sales, [a.id])
        submit_assessment(self.lead, self.sales, [a.id])

        self.login(self.sales)
        response = self.client.get(reverse('lead-pld-history', args=[self.lead.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
        self.assertTrue(all(row['latest'] is False for row in response.data['results'][1:]))
        self.assertTrue(response.data['results'][0]['latest'])

    def test_assessment_detail_exposes_frozen_snapshot(self):
        a, _, _ = self.make_pool()
        assessment = submit_assessment(self.lead, self.sales, [a.id])
        PLDProblem.objects.filter(id=a.id).update(name='Renamed later', points=99)

        self.login(self.sales)
        response = self.client.get(reverse('pld-assessment-detail', args=[assessment.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['problems'][0]['problem_name'], 'No unified system')
        self.assertEqual(response.data['data']['problems'][0]['points_earned'], 10)


class PLDPermissionsTests(PLDTestBase):
    def test_sales_cannot_update_config(self):
        self.login(self.sales)
        response = self.client.put(reverse('pld-config'), {'qualified_min_percentage': 90}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_update_config(self):
        self.login(self.admin)
        response = self.client.put(reverse('pld-config'), {'qualified_min_percentage': 75}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['qualified_min_percentage'], 75)

    def test_config_rejects_out_of_range_threshold(self):
        self.login(self.admin)
        response = self.client.put(reverse('pld-config'), {'qualified_min_percentage': 150}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sales_can_assess_own_lead(self):
        a, _, _ = self.make_pool()
        self.login(self.sales)
        response = self.client.post(reverse('lead-pld-assess', args=[self.lead.id]), {
            'problem_ids': [a.id],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_sales_cannot_read_someone_elses_lead(self):
        self.login(self.other_sales)
        response = self.client.get(reverse('lead-pld', args=[self.lead.id]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_read_any_lead(self):
        self.make_problem('Visible problem', 10)
        self.login(self.admin)
        response = self.client.get(reverse('lead-pld', args=[self.lead.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['data']['problems']), 1)

    def test_sales_cannot_create_gate(self):
        self.login(self.sales)
        response = self.client.post(reverse('pld-gate-list'), {
            'stage': self.stage_contacted.id, 'require_pld_qualified': True,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_lead_list_exposes_pld_fields(self):
        self.login(self.admin)
        response = self.client.get(reverse('lead-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = response.data.get('results', response.data)
        self.assertIn('pld_status', rows[0])
        self.assertIn('pld_score', rows[0])

    def test_pld_status_filter(self):
        assessed = Lead.objects.create(
            name='Qualified One', phone='9000000002',
            stage=self.stage_new, assigned_to=self.sales,
        )
        problems = self.make_pool()
        submit_assessment(assessed, self.sales, [p.id for p in problems])
        assessed.refresh_from_db()
        self.assertEqual(assessed.pld_status, PLDStatus.QUALIFIED_PLD)

        self.login(self.admin)
        response = self.client.get(reverse('lead-list'), {'pld_status': 'QUALIFIED_PLD'})
        rows = response.data.get('results', response.data)
        self.assertEqual([row['id'] for row in rows], [assessed.id])


class PLDGateTests(PLDTestBase):
    def make_gate(self, stage, **kwargs):
        return PLDStageGate.objects.create(stage=stage, **kwargs)

    def test_ungated_stage_moves_freely(self):
        self.login(self.sales)
        response = self.client.patch(
            reverse('lead-detail', args=[self.lead.id]),
            {'stage': self.stage_contacted.id}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.stage_id, self.stage_contacted.id)

    def test_gate_blocks_move_when_pld_not_qualified(self):
        self.make_gate(self.stage_contacted, require_pld_qualified=True)
        self.login(self.sales)

        response = self.client.patch(
            reverse('lead-detail', args=[self.lead.id]),
            {'stage': self.stage_contacted.id}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('pld_status', response.data['errors']['missing'])
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.stage_id, self.stage_new.id)

    def test_gate_allows_move_once_qualified(self):
        self.make_gate(self.stage_contacted, require_pld_qualified=True)
        problems = self.make_pool()
        submit_assessment(self.lead, self.sales, [p.id for p in problems])

        self.login(self.sales)
        response = self.client.patch(
            reverse('lead-detail', args=[self.lead.id]),
            {'stage': self.stage_contacted.id}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.stage_id, self.stage_contacted.id)

    def test_icp_gate_blocks_when_fit_too_low(self):
        self.make_gate(self.stage_qualified, require_icp_min_status='GOOD_FIT')
        self.login(self.sales)

        response = self.client.patch(
            reverse('lead-detail', args=[self.lead.id]),
            {'stage': self.stage_qualified.id}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('icp_status', response.data['errors']['missing'])

        self.lead.icp_status = Lead.ICPStatus.STRONG_ICP_FIT
        self.lead.save(update_fields=['icp_status'])
        response = self.client.patch(
            reverse('lead-detail', args=[self.lead.id]),
            {'stage': self.stage_qualified.id}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_assessment_gate_blocks_when_never_assessed(self):
        self.make_gate(self.stage_contacted, require_problems_assessed=True)
        self.login(self.sales)

        response = self.client.patch(
            reverse('lead-detail', args=[self.lead.id]),
            {'stage': self.stage_contacted.id}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('pld_assessment', response.data['errors']['missing'])

        a, _, _ = self.make_pool()
        submit_assessment(self.lead, self.sales, [a.id])
        response = self.client.patch(
            reverse('lead-detail', args=[self.lead.id]),
            {'stage': self.stage_contacted.id}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_gate_does_not_block_lead_creation_in_gated_stage(self):
        self.make_gate(self.stage_contacted, require_pld_qualified=True)
        self.login(self.admin)

        response = self.client.post(reverse('lead-list'), {
            'name': 'Directly Contacted', 'phone': '9000000077',
            'stage': self.stage_contacted.id,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = Lead.objects.get(phone='9000000077')
        self.assertEqual(created.stage_id, self.stage_contacted.id)

    def test_gate_still_blocks_moving_existing_lead_into_gated_stage(self):
        self.make_gate(self.stage_contacted, require_pld_qualified=True)
        self.login(self.admin)

        response = self.client.patch(
            reverse('lead-detail', args=[self.lead.id]),
            {'stage': self.stage_contacted.id}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('pld_status', response.data['errors']['missing'])

    def test_saving_other_fields_does_not_recheck_gate(self):
        self.make_gate(self.stage_contacted, require_pld_qualified=True)
        self.login(self.sales)
        response = self.client.patch(
            reverse('lead-detail', args=[self.lead.id]),
            {'priority': 'HIGH'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_gate_check_endpoint_previews_missing_items(self):
        self.make_gate(self.stage_contacted, require_pld_qualified=True, notes='Score it first')
        self.login(self.sales)

        response = self.client.get(
            reverse('lead-pld-gate-check', args=[self.lead.id]),
            {'stage': self.stage_contacted.id},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data['data']
        self.assertTrue(data['gated'])
        self.assertFalse(data['satisfied'])
        self.assertEqual(data['missing'][0]['code'], 'pld_status')
        self.assertEqual(data['requirements']['notes'], 'Score it first')

    def test_gate_check_reports_ungated_stage(self):
        self.login(self.sales)
        response = self.client.get(
            reverse('lead-pld-gate-check', args=[self.lead.id]),
            {'stage': self.stage_new.id},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['data']['gated'])
        self.assertTrue(response.data['data']['satisfied'])

    def test_lead_pld_payload_lists_all_gates(self):
        self.make_gate(self.stage_contacted, require_pld_qualified=True)
        self.login(self.sales)
        response = self.client.get(reverse('lead-pld', args=[self.lead.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        gates = response.data['data']['gates']
        self.assertEqual(len(gates), 1)
        self.assertEqual(gates[0]['stage']['slug'], 'contacted')
        self.assertFalse(gates[0]['satisfied'])

    def test_admin_can_crud_gate(self):
        self.login(self.admin)
        create = self.client.post(reverse('pld-gate-list'), {
            'stage': self.stage_qualified.id,
            'require_icp_min_status': 'GOOD_FIT',
            'require_pld_qualified': True,
        }, format='json')
        self.assertEqual(create.status_code, status.HTTP_201_CREATED)
        gate_id = create.data['data']['id']

        update = self.client.patch(reverse('pld-gate-detail', args=[gate_id]), {
            'require_icp_min_status': '',
        }, format='json')
        self.assertEqual(update.status_code, status.HTTP_200_OK)
        self.assertEqual(update.data['data']['require_icp_min_status'], '')

        delete = self.client.delete(reverse('pld-gate-detail', args=[gate_id]))
        self.assertEqual(delete.status_code, status.HTTP_200_OK)
        self.assertFalse(PLDStageGate.objects.filter(id=gate_id).exists())

    def test_gate_rejects_second_row_for_same_stage(self):
        self.make_gate(self.stage_contacted, require_pld_qualified=True)
        self.login(self.admin)
        response = self.client.post(reverse('pld-gate-list'), {
            'stage': self.stage_contacted.id, 'require_problems_assessed': True,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_check_gate_helper_returns_empty_for_ungated(self):
        self.assertEqual(check_gate(self.lead, self.stage_new), [])
        self.assertEqual(check_gate(self.lead, None), [])

    def test_qualifying_stage_a_does_not_unlock_stage_b_with_its_own_pld_questions(self):
        # Stage A (Contacted) has its own problem
        prob_a = PLDProblem.objects.create(
            stage=self.stage_contacted, name='Problem A for Contacted',
            points=20, severity=PLDSeverity.HIGH, is_active=True, display_order=1,
        )
        self.make_gate(self.stage_contacted, require_pld_qualified=True)

        # Stage B (Qualified) has its own problem
        prob_b = PLDProblem.objects.create(
            stage=self.stage_qualified, name='Problem B for Qualified',
            points=30, severity=PLDSeverity.CRITICAL, is_active=True, display_order=1,
        )
        self.make_gate(self.stage_qualified, require_pld_qualified=True)

        # Qualify Contacted PLD assessment
        submit_assessment(self.lead, self.sales, [prob_a.id], stage=self.stage_contacted)

        # Moving to Contacted should now be allowed
        self.assertEqual(check_gate(self.lead, self.stage_contacted), [])

        # BUT moving to Qualified should STILL BE BLOCKED because Qualified has its own assessment!
        missing_qualified = check_gate(self.lead, self.stage_qualified)
        self.assertTrue(len(missing_qualified) > 0)
        self.assertEqual(missing_qualified[0]['code'], 'pld_status')
        self.assertIn('Qualified', missing_qualified[0]['message'])

        # Now qualify the assessment specifically for Qualified stage
        submit_assessment(self.lead, self.sales, [prob_b.id], stage=self.stage_qualified)

        # Now Qualified gate should also pass!
        self.assertEqual(check_gate(self.lead, self.stage_qualified), [])

    def test_moving_to_lost_is_not_blocked_by_pld_gates(self):
        stage_lost, _ = LeadStage.objects.get_or_create(slug='lost', defaults={'name': 'Lost', 'is_active': True})
        self.make_gate(stage_lost, require_pld_qualified=True)
        # Check gate should return empty for lost stage
        self.assertEqual(check_gate(self.lead, stage_lost), [])
