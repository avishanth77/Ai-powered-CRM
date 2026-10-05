from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from leads.models import Lead, LeadStage

from .models import (
    ICPQuestion,
    ICPQualification,
    ICPStatus,
    ICPScoringConfig,
    QuestionType,
)
from .services.scoring import (
    classify_score,
    get_question_max_points,
    submit_qualification,
)

User = get_user_model()


class ICPTestBase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='icp-admin@test.com', password='Password@123', role=User.Role.ADMIN,
            first_name='Icp', last_name='Admin',
        )
        self.manager = User.objects.create_user(
            email='icp-manager@test.com', password='Password@123', role=User.Role.MANAGER,
            first_name='Icp', last_name='Manager',
        )
        self.sales = User.objects.create_user(
            email='icp-sales@test.com', password='Password@123', role=User.Role.EXECUTIVE,
            first_name='Icp', last_name='Sales',
        )
        self.other_sales = User.objects.create_user(
            email='icp-other@test.com', password='Password@123', role=User.Role.EXECUTIVE,
            first_name='Other', last_name='Sales',
        )
        self.stage, _ = LeadStage.objects.get_or_create(
            slug='new',
            defaults={'name': 'New', 'color': '#0284c7', 'display_order': 1, 'is_active': True, 'is_system': True},
        )
        self.lead = Lead.objects.create(
            name='Acme Contact', phone='9000000001', company_name='Acme Ltd',
            stage=self.stage, assigned_to=self.sales, created_by=self.sales,
        )

    def login(self, user):
        self.client.force_authenticate(user=user)

    def make_choice_question(self, text='Which industry?', qtype=QuestionType.DROPDOWN, options=None, order=1):
        question = ICPQuestion.objects.create(question_text=text, question_type=qtype, display_order=order, max_points=0)
        for index, (label, points) in enumerate(options or [('FMCG', 10), ('Retail', 8), ('Other', 2)]):
            question.options.create(option_text=label, points=points, display_order=index + 1)
        question.max_points = get_question_max_points(question)
        question.save(update_fields=['max_points'])
        return question

    @staticmethod
    def option_id(question, label):
        """Option PKs are sequence-generated, so always resolve them by label."""
        return question.options.get(option_text=label).id


class ICPQuestionCrudTests(ICPTestBase):
    def test_admin_can_create_question_with_options(self):
        self.login(self.admin)
        response = self.client.post(reverse('icp-question-list'), {
            'question_text': 'How many employees does the company have?',
            'description': 'Approximate headcount',
            'question_type': QuestionType.DROPDOWN,
            'is_required': True,
            'options': [
                {'option_text': '1-10 employees', 'points': 5},
                {'option_text': '11-50 employees', 'points': 10},
                {'option_text': '51-200 employees', 'points': 15},
                {'option_text': '200+ employees', 'points': 20},
            ],
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        question = ICPQuestion.objects.get(id=response.data['data']['id'])
        self.assertEqual(question.options.count(), 4)
        self.assertEqual(question.max_points, 20)
        self.assertEqual(question.created_by, self.admin)

    def test_max_points_derived_for_multi_choice_is_sum(self):
        self.login(self.manager)
        response = self.client.post(reverse('icp-question-list'), {
            'question_text': 'Which channels do you sell through?',
            'question_type': QuestionType.MULTI_CHOICE,
            'options': [
                {'option_text': 'FMCG', 'points': 10},
                {'option_text': 'Retail', 'points': 8},
                {'option_text': 'Manufacturing', 'points': 5},
                {'option_text': 'Other', 'points': 2},
            ],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['max_points'], 25)

    def test_yes_no_question_gets_default_options(self):
        self.login(self.admin)
        response = self.client.post(reverse('icp-question-list'), {
            'question_text': 'Does the company currently use an ERP?',
            'question_type': QuestionType.YES_NO,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        question = ICPQuestion.objects.get(id=response.data['data']['id'])
        self.assertEqual([o.option_text for o in question.options.all()], ['Yes', 'No'])

    def test_number_question_requires_scoring_rules(self):
        self.login(self.admin)
        response = self.client.post(reverse('icp-question-list'), {
            'question_text': 'How many employees?',
            'question_type': QuestionType.NUMBER,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('scoring_rules', response.data.get('errors', {}))

    def test_number_question_max_points_from_rules(self):
        self.login(self.admin)
        response = self.client.post(reverse('icp-question-list'), {
            'question_text': 'How many employees?',
            'question_type': QuestionType.NUMBER,
            'scoring_rules': [
                {'min': 100, 'max': None, 'points': 20},
                {'min': 50, 'max': 99, 'points': 15},
                {'min': 10, 'max': 49, 'points': 8},
                {'min': None, 'max': 9, 'points': 3},
            ],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['max_points'], 20)

    def test_text_question_uses_admin_configured_points(self):
        self.login(self.admin)
        response = self.client.post(reverse('icp-question-list'), {
            'question_text': 'Describe the current sales process',
            'question_type': QuestionType.TEXT,
            'max_points': 5,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['max_points'], 5)

    def test_choice_question_requires_options(self):
        self.login(self.admin)
        response = self.client.post(reverse('icp-question-list'), {
            'question_text': 'Broken question',
            'question_type': QuestionType.SINGLE_CHOICE,
            'options': [],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_sales_user_cannot_create_question(self):
        self.login(self.sales)
        response = self.client.post(reverse('icp-question-list'), {
            'question_text': 'Unauthorized',
            'question_type': QuestionType.DROPDOWN,
            'options': [{'option_text': 'A', 'points': 1}],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_sales_user_can_read_active_questions(self):
        self.make_choice_question()
        ICPQuestion.objects.create(question_text='Inactive', question_type=QuestionType.TEXT, is_active=False, max_points=1)
        self.login(self.sales)
        response = self.client.get(reverse('icp-question-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rows = response.data['results']
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['question_text'], 'Which industry?')

    def test_admin_sees_inactive_questions_with_flag(self):
        self.make_choice_question()
        ICPQuestion.objects.create(question_text='Inactive', question_type=QuestionType.TEXT, is_active=False, max_points=1)
        self.login(self.admin)
        response = self.client.get(reverse('icp-question-list'), {'include_inactive': 'true'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)

    def test_question_detail_uses_success_envelope(self):
        question = self.make_choice_question()
        self.login(self.admin)
        response = self.client.get(reverse('icp-question-detail', args=[question.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['id'], question.id)

    def test_admin_can_edit_question_and_points(self):
        question = self.make_choice_question()
        self.login(self.admin)
        response = self.client.put(
            reverse('icp-question-detail', args=[question.id]),
            {
                'question_text': 'Which industry does the company operate in?',
                'question_type': QuestionType.DROPDOWN,
                'is_required': True,
                'is_active': True,
                'options': [
                    {'option_text': 'FMCG', 'points': 15},
                    {'option_text': 'Retail', 'points': 8},
                    {'option_text': 'Other', 'points': 0},
                ],
            },
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        question.refresh_from_db()
        self.assertEqual(question.max_points, 15)
        self.assertEqual(question.options.count(), 3)

    def test_sales_user_cannot_edit_question(self):
        question = self.make_choice_question()
        self.login(self.sales)
        response = self.client.patch(
            reverse('icp-question-detail', args=[question.id]),
            {'question_text': 'Hacked'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_delete_question(self):
        question = self.make_choice_question()
        self.login(self.admin)
        response = self.client.delete(reverse('icp-question-detail', args=[question.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(ICPQuestion.objects.filter(id=question.id).exists())

    def test_toggle_active(self):
        question = self.make_choice_question()
        self.login(self.manager)
        response = self.client.patch(reverse('icp-question-toggle-active', args=[question.id]), {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        question.refresh_from_db()
        self.assertFalse(question.is_active)

    def test_reorder_questions(self):
        first = self.make_choice_question('First', order=1)
        second = self.make_choice_question('Second', order=2)
        self.login(self.manager)
        response = self.client.patch(reverse('icp-question-move', args=[second.id]), {'direction': 'up'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        second.refresh_from_db()
        first.refresh_from_db()
        self.assertEqual(second.display_order, 1)
        self.assertEqual(first.display_order, 2)

    def test_display_order_is_assigned_automatically(self):
        self.make_choice_question('First', order=1)
        self.login(self.manager)
        response = self.client.post(reverse('icp-question-list'), {
            'question_text': 'Automatic order',
            'question_type': QuestionType.TEXT,
            'max_points': 2,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['data']['display_order'], 2)


class ICPScoringTests(ICPTestBase):
    def test_classification_boundaries(self):
        config = ICPScoringConfig.objects.create(poor_fit_max=39, potential_fit_max=59, good_fit_max=79)
        self.assertEqual(classify_score(0, config), ICPStatus.POOR_FIT)
        self.assertEqual(classify_score(39, config), ICPStatus.POOR_FIT)
        self.assertEqual(classify_score(40, config), ICPStatus.POTENTIAL_FIT)
        self.assertEqual(classify_score(59, config), ICPStatus.POTENTIAL_FIT)
        self.assertEqual(classify_score(60, config), ICPStatus.GOOD_FIT)
        self.assertEqual(classify_score(79, config), ICPStatus.GOOD_FIT)
        self.assertEqual(classify_score(80, config), ICPStatus.STRONG_ICP_FIT)
        self.assertEqual(classify_score(100, config), ICPStatus.STRONG_ICP_FIT)
        config.delete()

    def test_scoring_across_all_question_types(self):
        size = self.make_choice_question('Company size', QuestionType.DROPDOWN, [('1-10', 5), ('11-50', 10)], order=1)
        erp = ICPQuestion.objects.create(question_text='Uses ERP?', question_type=QuestionType.YES_NO, display_order=2, max_points=0)
        erp.options.create(option_text='Yes', points=10, display_order=1)
        erp.options.create(option_text='No', points=3, display_order=2)
        erp.max_points = get_question_max_points(erp)
        erp.save(update_fields=['max_points'])

        multi = ICPQuestion.objects.create(
            question_text='Channels', question_type=QuestionType.MULTI_CHOICE, display_order=3, max_points=0,
        )
        multi.options.create(option_text='Retail', points=8, display_order=1)
        multi.options.create(option_text='D2C', points=6, display_order=2)
        multi.max_points = get_question_max_points(multi)
        multi.save(update_fields=['max_points'])

        employees = ICPQuestion.objects.create(
            question_text='Employees', question_type=QuestionType.NUMBER, display_order=4,
            scoring_rules=[{'min': 100, 'max': None, 'points': 20}, {'min': 10, 'max': 99, 'points': 8},
                           {'min': None, 'max': 9, 'points': 3}],
        )
        employees.max_points = get_question_max_points(employees)
        employees.save(update_fields=['max_points'])

        ICPQuestion.objects.create(
            question_text='Notes', question_type=QuestionType.TEXT, display_order=5, max_points=5, is_required=False,
        )

        expected_max = 10 + 10 + 14 + 20 + 5
        # The optional text question is intentionally left unanswered.
        answers = [
            {'question_id': size.id, 'value': self.option_id(size, '11-50')},
            {'question_id': erp.id, 'value': 'Yes'},
            {'question_id': multi.id, 'value': [
                self.option_id(multi, 'Retail'), self.option_id(multi, 'D2C'),
            ]},
            {'question_id': employees.id, 'value': '150'},
        ]
        qualification = submit_qualification(self.lead, self.sales, answers)

        self.assertEqual(qualification.max_score, expected_max)
        self.assertEqual(qualification.total_score, 10 + 10 + 14 + 20)
        expected_pct = (54 / expected_max) * 100
        self.assertAlmostEqual(float(qualification.percentage), round(expected_pct, 2), places=1)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.icp_status, qualification.icp_status)
        self.assertEqual(qualification.answers.count(), 4)

    def test_number_rules_evaluated_in_order(self):
        question = ICPQuestion.objects.create(
            question_text='Employees', question_type=QuestionType.NUMBER, display_order=1,
            scoring_rules=[
                {'min': 100, 'max': None, 'points': 20},
                {'min': 50, 'max': 99, 'points': 15},
                {'min': 10, 'max': 49, 'points': 8},
                {'min': None, 'max': 9, 'points': 3},
            ],
        )
        question.max_points = get_question_max_points(question)
        question.save(update_fields=['max_points'])

        cases = [(500, 20), (100, 20), (99, 15), (50, 15), (49, 8), (10, 8), (9, 3), (0, 3)]
        for value, expected in cases:
            qualification = submit_qualification(self.lead, self.sales, [{'question_id': question.id, 'value': value}])
            self.assertEqual(qualification.total_score, expected, f'value {value}')
        self.assertEqual(qualification.max_score, 20)

    def test_multiple_choice_points_are_summed(self):
        question = ICPQuestion.objects.create(
            question_text='Channels', question_type=QuestionType.MULTI_CHOICE, display_order=1, max_points=0,
        )
        for index, (label, points) in enumerate([('FMCG', 10), ('Retail', 8), ('Manufacturing', 5), ('Other', 2)]):
            question.options.create(option_text=label, points=points, display_order=index + 1)
        question.max_points = get_question_max_points(question)
        question.save(update_fields=['max_points'])

        option_ids = list(question.options.values_list('id', flat=True))
        qualification = submit_qualification(
            self.lead, self.sales, [{'question_id': question.id, 'value': [option_ids[0], option_ids[2]]}]
        )
        self.assertEqual(qualification.total_score, 15)
        self.assertEqual(qualification.max_score, 25)

    def test_text_question_awards_flat_points(self):
        question = ICPQuestion.objects.create(
            question_text='Describe process', question_type=QuestionType.TEXT, display_order=1, max_points=5,
        )
        answered = submit_qualification(self.lead, self.sales, [{'question_id': question.id, 'value': 'Manual spreadsheets'}])
        self.assertEqual(answered.total_score, 5)

    def test_optional_text_question_left_blank_scores_zero(self):
        question = ICPQuestion.objects.create(
            question_text='Describe process', question_type=QuestionType.TEXT,
            display_order=1, max_points=5, is_required=False,
        )
        blank = submit_qualification(self.lead, self.sales, [{'question_id': question.id, 'value': '   '}])
        self.assertEqual(blank.total_score, 0)
        self.assertEqual(blank.max_score, 5)

    def test_required_question_must_be_answered(self):
        ICPQuestion.objects.create(
            question_text='Required text', question_type=QuestionType.TEXT, display_order=1, max_points=5, is_required=True,
        )
        from .services.scoring import ICPValidationError
        with self.assertRaises(ICPValidationError):
            submit_qualification(self.lead, self.sales, [])

    def test_client_supplied_points_are_ignored(self):
        question = self.make_choice_question('Uses ERP?', QuestionType.YES_NO, [('Yes', 10), ('No', 2)])
        yes_id = self.option_id(question, 'Yes')
        qualification = submit_qualification(self.lead, self.sales, [{
            'question_id': question.id, 'value': yes_id, 'points': 9999, 'score': 100, 'total_score': 500,
        }])
        self.assertEqual(qualification.total_score, 10)
        self.assertEqual(qualification.max_score, 10)

    def test_answer_for_inactive_question_is_rejected(self):
        question = self.make_choice_question('Old question')
        question.is_active = False
        question.save(update_fields=['is_active'])
        from .services.scoring import ICPValidationError
        with self.assertRaises(ICPValidationError):
            submit_qualification(self.lead, self.sales, [
                {'question_id': question.id, 'value': self.option_id(question, 'FMCG')}
            ])


class ICPSnapshotTests(ICPTestBase):
    def test_old_results_are_unchanged_after_config_change(self):
        question = self.make_choice_question('Does the company use ERP?', QuestionType.YES_NO, [('Yes', 10), ('No', 2)])
        first = submit_qualification(self.lead, self.sales, [{'question_id': question.id, 'value': 'Yes'}])

        # Admin changes scoring later.
        question.options.update(points=0)
        question.options.filter(option_text='Yes').update(points=15)
        question.max_points = get_question_max_points(question)
        question.save(update_fields=['max_points'])

        first.refresh_from_db()
        answer = first.answers.first()
        self.assertEqual(first.total_score, 10)
        self.assertEqual(first.max_score, 10)
        self.assertEqual(answer.points_earned, 10)
        self.assertEqual(answer.selected_options[0]['points'], 10)
        self.assertEqual(answer.question_snapshot['question_text'], 'Does the company use ERP?')

        # A new qualification uses the new points.
        second = submit_qualification(self.lead, self.sales, [{'question_id': question.id, 'value': 'Yes'}])
        self.assertEqual(second.total_score, 15)
        self.assertEqual(second.max_score, 15)

        # First record is still intact after both runs.
        first.refresh_from_db()
        self.assertEqual(first.total_score, 10)
        self.assertEqual(first.answers.first().selected_options[0]['points'], 10)

    def test_history_is_not_overwritten(self):
        question = self.make_choice_question('Industry', QuestionType.DROPDOWN, [('FMCG', 10), ('Retail', 5)])
        submit_qualification(self.lead, self.sales, [
            {'question_id': question.id, 'value': self.option_id(question, 'FMCG')}
        ])
        submit_qualification(self.lead, self.sales, [
            {'question_id': question.id, 'value': self.option_id(question, 'Retail')}
        ])
        self.assertEqual(ICPQualification.objects.filter(lead=self.lead).count(), 2)

    def test_snapshot_survives_question_deletion(self):
        question = self.make_choice_question('Industry', QuestionType.DROPDOWN, [('FMCG', 10), ('Retail', 5)])
        qualification = submit_qualification(self.lead, self.sales, [
            {'question_id': question.id, 'value': self.option_id(question, 'FMCG')}
        ])

        question.delete()

        qualification.refresh_from_db()
        answer = qualification.answers.first()
        self.assertIsNone(answer.question_id)
        self.assertEqual(answer.question_snapshot['question_text'], 'Industry')
        self.assertEqual(answer.selected_options[0]['text'], 'FMCG')

    def test_thresholds_snapshot_recorded(self):
        question = self.make_choice_question('Industry', QuestionType.DROPDOWN, [('FMCG', 10), ('Retail', 5)])
        qualification = submit_qualification(self.lead, self.sales, [
            {'question_id': question.id, 'value': self.option_id(question, 'FMCG')}
        ])
        self.assertEqual(
            qualification.thresholds_snapshot,
            {'poor_fit_max': 39, 'potential_fit_max': 59, 'good_fit_max': 79},
        )


class LeadICPApiTests(ICPTestBase):
    def test_sales_user_can_load_active_questions_for_lead(self):
        self.make_choice_question('Industry', order=2)
        self.make_choice_question('Company size', order=1)
        inactive = ICPQuestion.objects.create(
            question_text='Hidden', question_type=QuestionType.TEXT, is_active=False, display_order=3, max_points=1,
        )

        self.login(self.sales)
        response = self.client.get(reverse('lead-icp', args=[self.lead.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data['data']
        self.assertEqual(len(data['questions']), 2)
        self.assertEqual([q['question_text'] for q in data['questions']], ['Company size', 'Industry'])
        self.assertNotIn(inactive.id, [q['id'] for q in data['questions']])
        self.assertEqual(data['icp_status'], ICPStatus.NOT_TESTED)
        self.assertEqual(data['qualification_count'], 0)

    def test_submit_qualification_scores_and_saves(self):
        question = self.make_choice_question('Industry', QuestionType.DROPDOWN, [('FMCG', 10), ('Retail', 5)])
        self.login(self.sales)
        response = self.client.post(
            reverse('lead-icp-qualify', args=[self.lead.id]),
            {'answers': [{'question_id': question.id, 'value': self.option_id(question, 'FMCG')}]},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data['data']
        self.assertEqual(data['total_score'], 10)
        self.assertEqual(data['max_score'], 10)
        self.assertEqual(float(data['percentage']), 100.0)
        self.assertEqual(data['icp_status'], ICPStatus.STRONG_ICP_FIT)
        self.assertEqual(data['qualified_by'], self.sales.id)
        self.assertEqual(len(data['answers']), 1)

        self.lead.refresh_from_db()
        self.assertEqual(self.lead.icp_status, ICPStatus.STRONG_ICP_FIT)

    def test_submit_qualification_missing_required_returns_400(self):
        ICPQuestion.objects.create(
            question_text='Required', question_type=QuestionType.TEXT, display_order=1, max_points=5, is_required=True,
        )
        self.login(self.sales)
        response = self.client.post(
            reverse('lead-icp-qualify', args=[self.lead.id]), {'answers': []}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertIn('errors', response.data)

    def test_no_active_questions_returns_400(self):
        self.login(self.sales)
        response = self.client.post(
            reverse('lead-icp-qualify', args=[self.lead.id]), {'answers': []}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('no active ICP questions', response.data['message'])

    def test_history_endpoint_lists_attempts_newest_first(self):
        question = self.make_choice_question('Industry', QuestionType.DROPDOWN, [('FMCG', 10), ('Retail', 5)])
        fmcg_id = self.option_id(question, 'FMCG')
        retail_id = self.option_id(question, 'Retail')
        self.login(self.sales)
        for value in (fmcg_id, retail_id):
            self.client.post(
                reverse('lead-icp-qualify', args=[self.lead.id]),
                {'answers': [{'question_id': question.id, 'value': value}]},
                format='json',
            )

        response = self.client.get(reverse('lead-icp-history', args=[self.lead.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)
        self.assertTrue(response.data['results'][0]['latest'])
        self.assertEqual(response.data['results'][0]['total_score'], 5)
        self.assertEqual(response.data['results'][1]['total_score'], 10)
        self.assertEqual(response.data['results'][0]['qualified_by_details']['email'], 'icp-sales@test.com')

    def test_qualification_detail_returns_snapshot(self):
        question = self.make_choice_question('Industry', QuestionType.DROPDOWN, [('FMCG', 10), ('Retail', 5)])
        self.login(self.sales)
        create = self.client.post(
            reverse('lead-icp-qualify', args=[self.lead.id]),
            {'answers': [{'question_id': question.id, 'value': self.option_id(question, 'FMCG')}]},
            format='json',
        )
        qualification_id = create.data['data']['id']

        response = self.client.get(reverse('icp-qualification-detail', args=[qualification_id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        answers = response.data['data']['answers']
        self.assertEqual(len(answers), 1)
        self.assertEqual(answers[0]['question_text'], 'Industry')
        self.assertEqual(answers[0]['answer_value'], 'FMCG')
        self.assertEqual(answers[0]['points_earned'], 10)

    def test_sales_user_cannot_access_other_sales_lead(self):
        self.login(self.other_sales)
        response = self.client.get(reverse('lead-icp', args=[self.lead.id]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        qualify = self.client.post(
            reverse('lead-icp-qualify', args=[self.lead.id]), {'answers': []}, format='json'
        )
        self.assertEqual(qualify.status_code, status.HTTP_403_FORBIDDEN)

        history = self.client.get(reverse('lead-icp-history', args=[self.lead.id]))
        self.assertEqual(history.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_can_access_all_leads(self):
        self.login(self.manager)
        response = self.client.get(reverse('lead-icp', args=[self.lead.id]))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_anonymous_is_rejected(self):
        response = self.client.get(reverse('lead-icp', args=[self.lead.id]))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_lead_icp_status_is_exposed_on_lead_serializer(self):
        question = self.make_choice_question('Industry', QuestionType.DROPDOWN, [('FMCG', 10), ('Retail', 5)])
        self.login(self.sales)
        self.client.post(
            reverse('lead-icp-qualify', args=[self.lead.id]),
            {'answers': [{'question_id': question.id, 'value': self.option_id(question, 'FMCG')}]},
            format='json',
        )
        detail = self.client.get(f'/api/leads/{self.lead.id}/')
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data['icp_status'], ICPStatus.STRONG_ICP_FIT)

        listing = self.client.get('/api/leads/', {'icp_status': ICPStatus.STRONG_ICP_FIT})
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data['count'], 1)

    def test_lead_filter_by_icp_status_not_tested(self):
        self.login(self.sales)
        listing = self.client.get('/api/leads/', {'icp_status': ICPStatus.NOT_TESTED})
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data['count'], 1)


class ICPScoringConfigApiTests(ICPTestBase):
    def test_sales_user_can_read_config_but_not_update(self):
        self.login(self.sales)
        read = self.client.get(reverse('icp-config'))
        self.assertEqual(read.status_code, status.HTTP_200_OK)
        self.assertEqual(read.data['data']['poor_fit_max'], 39)

        write = self.client.put(reverse('icp-config'), {'poor_fit_max': 50}, format='json')
        self.assertEqual(write.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_update_thresholds_and_affects_scoring(self):
        question = self.make_choice_question('Industry', QuestionType.DROPDOWN, [('FMCG', 10), ('Retail', 5)])
        self.login(self.admin)

        update = self.client.put(
            reverse('icp-config'), {'poor_fit_max': 50, 'potential_fit_max': 70, 'good_fit_max': 90}, format='json'
        )
        self.assertEqual(update.status_code, status.HTTP_200_OK)

        qualification = submit_qualification(self.lead, self.sales, [
            {'question_id': question.id, 'value': self.option_id(question, 'Retail')}
        ])
        self.assertEqual(float(qualification.percentage), 50.0)
        self.assertEqual(qualification.icp_status, ICPStatus.POOR_FIT)

    def test_thresholds_must_be_ascending(self):
        self.login(self.admin)
        response = self.client.put(
            reverse('icp-config'), {'poor_fit_max': 80, 'potential_fit_max': 50, 'good_fit_max': 90}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)