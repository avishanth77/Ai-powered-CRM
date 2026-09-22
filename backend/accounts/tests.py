from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from accounts.models import User

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
        # 1. Request reset token
        forgot_res = self.client.post('/api/auth/forgot-password/', {
            'email': 'testuser@crmlite.com'
        })
        self.assertEqual(forgot_res.status_code, status.HTTP_200_OK)
        self.assertTrue(forgot_res.data['success'])
        uid = forgot_res.data['data']['uid']
        token = forgot_res.data['data']['token']

        # 2. Reset password using uid and token
        reset_res = self.client.post('/api/auth/reset-password/', {
            'uid': uid,
            'token': token,
            'new_password': 'ResetPassword@789',
            'confirm_new_password': 'ResetPassword@789'
        })
        self.assertEqual(reset_res.status_code, status.HTTP_200_OK)
        self.assertTrue(reset_res.data['success'])

        # 3. Verify user can log in with reset password
        login_res = self.client.post('/api/auth/login/', {
            'email': 'testuser@crmlite.com',
            'password': 'ResetPassword@789'
        })
        self.assertEqual(login_res.status_code, status.HTTP_200_OK)
        self.assertTrue(login_res.data['success'])
