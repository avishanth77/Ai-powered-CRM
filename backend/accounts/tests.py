from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from accounts.models import User, StaffTarget
from leads.models import Lead, LeadStage
from followups.models import FollowUp

class AuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='testuser@crmlite.com',
            password='Password@123',
            first_name='Test',
            last_name='User',
            role=User.Role.EXECUTIVE
        )

    def test_valid_login(self):
        response = self.client.post('/api/auth/login/', {
            'email': 'testuser@crmlite.com',
            'password': 'Password@123'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertIn('access', response.data['data'])
        self.assertIn('refresh', response.data['data'])
        self.assertEqual(response.data['data']['user']['email'], 'testuser@crmlite.com')

    def test_invalid_login(self):
        response = self.client.post('/api/auth/login/', {
            'email': 'testuser@crmlite.com',
            'password': 'WrongPassword'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertFalse(response.data['success'])

    def test_unauthenticated_protected_api(self):
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_authenticated_me_endpoint(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['data']['email'], 'testuser@crmlite.com')
        self.assertEqual(response.data['data']['role'], 'EXECUTIVE')

    def test_change_password_success(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/auth/change-password/', {
            'old_password': 'Password@123',
            'new_password': 'NewPassword@456',
            'confirm_new_password': 'NewPassword@456',
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPassword@456'))

    def test_change_password_invalid_old(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/auth/change-password/', {
            'old_password': 'IncorrectPassword',
            'new_password': 'NewPassword@456',
            'confirm_new_password': 'NewPassword@456',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_forgot_and_reset_password_flow(self):
        # 1. Request reset OTP (ensure no token/uid leaked in response)
        forgot_res = self.client.post('/api/auth/forgot-password/', {
            'email': 'testuser@crmlite.com'
        })
        self.assertEqual(forgot_res.status_code, status.HTTP_200_OK)
        self.assertTrue(forgot_res.data['success'])
        self.assertNotIn('token', forgot_res.data.get('data', {}))
        self.assertNotIn('uid', forgot_res.data.get('data', {}))

        # 2. Verify OTP was set in database
        self.user.refresh_from_db()
        self.assertTrue(self.user.reset_otp)
        self.assertEqual(len(self.user.reset_otp), 6)
        otp = self.user.reset_otp

        # 3. Test wrong code fails
        wrong_code_res = self.client.post('/api/auth/reset-password/', {
            'email': 'testuser@crmlite.com',
            'code': '000000',
            'new_password': 'ResetPassword@789',
            'confirm_new_password': 'ResetPassword@789'
        })
        self.assertEqual(wrong_code_res.status_code, status.HTTP_400_BAD_REQUEST)

        # 4. Reset password using valid 6-digit OTP code and email
        reset_res = self.client.post('/api/auth/reset-password/', {
            'email': 'testuser@crmlite.com',
            'code': otp,
            'new_password': 'ResetPassword@789',
            'confirm_new_password': 'ResetPassword@789'
        })
        self.assertEqual(reset_res.status_code, status.HTTP_200_OK)
        self.assertTrue(reset_res.data['success'])

        # 5. Verify OTP was invalidated after reset
        self.user.refresh_from_db()
        self.assertIsNone(self.user.reset_otp)

        # 6. Verify user can log in with new password
        login_res = self.client.post('/api/auth/login/', {
            'email': 'testuser@crmlite.com',
            'password': 'ResetPassword@789'
        })
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertTrue(login_res.data['success'])


class StaffTargetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_superuser(
            email='admin@crmlite.com',
            password='AdminPassword@123',
            first_name='Admin',
            last_name='Mentor',
            role=User.Role.ADMIN
        )
        self.staff_user1 = User.objects.create_user(
            email='sarah.rep@crmlite.com',
            password='StaffPassword@123',
            first_name='Sarah',
            last_name='Connor',
            role=User.Role.EXECUTIVE
        )
        self.staff_user2 = User.objects.create_user(
            email='john.rep@crmlite.com',
            password='StaffPassword@123',
            first_name='John',
            last_name='Doe',
            role=User.Role.EXECUTIVE
        )

        self.won_stage, _ = LeadStage.objects.get_or_create(
            slug='won',
            defaults={
                'name': 'Won Stage',
                'display_order': 10,
                'is_active': True,
                'is_system': True,
            }
        )
        self.new_stage, _ = LeadStage.objects.get_or_create(
            slug='new',
            defaults={
                'name': 'New Stage',
                'display_order': 1,
                'is_active': True,
                'is_system': True,
            }
        )

    def test_admin_can_set_custom_staff_target(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post('/api/targets/', {
            'user': self.staff_user1.id,
            'period_month': '2026-11',
            'daily_calls_target': 25,
            'daily_leads_target': 8,
            'daily_revenue_target': '12000.00',
            'monthly_calls_target': 500,
            'monthly_leads_target': 120,
            'monthly_deals_won_target': 10,
            'monthly_revenue_target': '250000.00',
            'notes': 'Q4 High-priority push for enterprise SaaS.'
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        target = StaffTarget.objects.get(user=self.staff_user1, period_month='2026-11')
        self.assertEqual(target.daily_calls_target, 25)
        self.assertEqual(target.monthly_calls_target, 500)
        self.assertEqual(target.set_by, self.admin_user)
        self.assertEqual(target.notes, 'Q4 High-priority push for enterprise SaaS.')

    def test_executive_cannot_create_or_modify_targets(self):
        self.client.force_authenticate(user=self.staff_user1)
        response = self.client.post('/api/targets/', {
            'user': self.staff_user2.id,
            'period_month': '2026-11',
            'daily_calls_target': 50,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_executive_can_view_own_target_and_progress(self):
        from decimal import Decimal
        from django.utils import timezone

        # Admin sets target for Sarah
        StaffTarget.objects.create(
            user=self.staff_user1,
            period_month='2026-11',
            daily_calls_target=10,
            daily_leads_target=4,
            daily_revenue_target=Decimal('10000.00'),
            monthly_calls_target=200,
            monthly_leads_target=50,
            monthly_deals_won_target=5,
            monthly_revenue_target=Decimal('100000.00'),
            set_by=self.admin_user
        )

        # Log some activities for Sarah
        now = timezone.now()
        lead = Lead.objects.create(
            name='Enterprise Prospect',
            phone='+919876543210',
            email='client@enterprise.com',
            stage=self.new_stage,
            assigned_to=self.staff_user1,
            expected_value=Decimal('50000.00')
        )

        FollowUp.objects.create(
            lead=lead,
            assigned_to=self.staff_user1,
            follow_up_at=now,
            status=FollowUp.Status.COMPLETED,
            completed_at=now
        )

        # Authenticate as Sarah
        self.client.force_authenticate(user=self.staff_user1)
        response = self.client.get('/api/targets/current/?month=2026-11')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        data = response.data['data']
        self.assertEqual(data['user_email'], 'sarah.rep@crmlite.com')
        self.assertEqual(data['daily']['calls']['actual'], 1)
        self.assertEqual(data['daily']['calls']['target'], 10)
        self.assertEqual(data['daily']['calls']['percentage'], 10.0)
        self.assertEqual(data['daily']['leads']['actual'], 1)

    def test_team_targets_overview_endpoint(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/targets/overview/?month=2026-11')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        data = response.data['data']
        self.assertIn('team_aggregates', data)
        self.assertIn('leaderboard', data)
        self.assertIn('presets', data)
        self.assertGreaterEqual(data['total_staff_count'], 2)

