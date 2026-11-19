from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import ChatMessage

User = get_user_model()


class ChatTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            email='alice@crmlite.com',
            password='Password@123',
            first_name='Alice',
            last_name='Smith',
            role=User.Role.EXECUTIVE
        )
        self.user2 = User.objects.create_user(
            email='bob@crmlite.com',
            password='Password@123',
            first_name='Bob',
            last_name='Jones',
            role=User.Role.MANAGER
        )

    def test_send_message_and_retrieve_stream(self):
        self.client.force_authenticate(user=self.user1)

        # 1. Send message to Bob
        response = self.client.post('/api/chat/messages/', {
            'recipient': self.user2.id,
            'message': 'Hello Bob, could you review the Acme deal?'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['data']['message'], 'Hello Bob, could you review the Acme deal?')
        self.assertTrue(response.data['data']['is_me'])

        # 2. Check Bob's unread count
        self.client.force_authenticate(user=self.user2)
        unread_res = self.client.get('/api/chat/unread-count/')
        self.assertEqual(unread_res.status_code, status.HTTP_200_OK)
        self.assertEqual(unread_res.data['unread_count'], 1)

        # 3. Bob opens chat stream with Alice (should fetch and mark as read)
        stream_res = self.client.get(f'/api/chat/messages/?user_id={self.user1.id}')
        self.assertEqual(stream_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(stream_res.data['data']), 1)
        self.assertFalse(stream_res.data['data'][0]['is_me'])

        # 4. Check Bob's unread count again (should now be 0)
        unread_after = self.client.get('/api/chat/unread-count/')
        self.assertEqual(unread_after.data['unread_count'], 0)

        # 5. Bob replies
        reply_res = self.client.post('/api/chat/messages/', {
            'recipient': self.user1.id,
            'message': 'Sure Alice! The pricing looks solid.'
        })
        self.assertEqual(reply_res.status_code, status.HTTP_201_CREATED)

        # 6. Check conversations list for Bob
        conv_res = self.client.get('/api/chat/conversations/')
        self.assertEqual(conv_res.status_code, status.HTTP_200_OK)
        self.assertEqual(conv_res.data['count'], 1)
        self.assertEqual(conv_res.data['data'][0]['user']['id'], self.user1.id)
        self.assertEqual(conv_res.data['data'][0]['last_message'], 'Sure Alice! The pricing looks solid.')

    def test_cannot_message_self(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.post('/api/chat/messages/', {
            'recipient': self.user1.id,
            'message': 'Talking to myself'
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_conversations_with_no_prior_messages(self):
        # Create a user with zero messages
        User.objects.create_user(
            email='charlie@crmlite.com',
            password='Password@123',
            first_name='Charlie',
            last_name='Day',
            role=User.Role.EXECUTIVE
        )
        self.client.force_authenticate(user=self.user1)
        conv_res = self.client.get('/api/chat/conversations/')
        self.assertEqual(conv_res.status_code, status.HTTP_200_OK)
        self.assertTrue(conv_res.data['success'])
        # Should list both Bob and Charlie even though there are no messages
        self.assertGreaterEqual(conv_res.data['count'], 2)

