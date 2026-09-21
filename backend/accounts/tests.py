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
