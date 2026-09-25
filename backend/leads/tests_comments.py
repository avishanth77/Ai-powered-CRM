from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

from leads.models import Lead, LeadStage, InternalComment, CommentMention
from notifications.models import Notification

User = get_user_model()


class InternalCommentsAndMentionsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.manager = User.objects.create_user(
            email='mgr@crm.test',
            password='Password@123',
            first_name='David',
            last_name='Manager',
            role=User.Role.MANAGER
        )
        self.exec1 = User.objects.create_user(
            email='sarah@crm.test',
            password='Password@123',
            first_name='Sarah',
            last_name='Executive',
            role=User.Role.EXECUTIVE
        )
        self.exec2 = User.objects.create_user(
            email='alex@crm.test',
            password='Password@123',
            first_name='Alex',
            last_name='Sales',
            role=User.Role.EXECUTIVE
        )

        stage = LeadStage.objects.filter(slug='new').first()
        if not stage:
            stage = LeadStage.objects.create(name='New Stage', slug='new-test-stage')

        self.lead1 = Lead.objects.create(
            name='Acme Enterprise',
            phone='1234567890',
            stage=stage,
            assigned_to=self.exec1,
            created_by=self.manager
        )
        self.lead2 = Lead.objects.create(
            name='Beta Corp',
            phone='9876543210',
            stage=stage,
            assigned_to=self.exec2,
            created_by=self.manager
        )

    def test_create_comment_on_lead(self):
        self.client.force_authenticate(user=self.exec1)
        resp = self.client.post(f'/api/leads/{self.lead1.id}/comments/', {
            'content': 'Client requested custom contract terms.'
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['content'], 'Client requested custom contract terms.')
        self.assertEqual(resp.data['author_details']['email'], self.exec1.email)

        # Verify in DB
        comment = InternalComment.objects.get(id=resp.data['id'])
        self.assertEqual(comment.lead, self.lead1)
        self.assertEqual(comment.author, self.exec1)

    def test_comment_with_mention_dispatches_notification(self):
        self.client.force_authenticate(user=self.exec1)
        resp = self.client.post(f'/api/leads/{self.lead1.id}/comments/', {
            'content': 'Hey @mgr@crm.test please review the discount.',
            'mentioned_user_ids': [self.manager.id]
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

        comment = InternalComment.objects.get(id=resp.data['id'])
        self.assertTrue(CommentMention.objects.filter(comment=comment, mentioned_user=self.manager).exists())

        # Verify notification created for mentioned manager
        notif = Notification.objects.filter(
            recipient=self.manager,
            notification_type=Notification.NotificationType.INTERNAL_MENTION
        ).first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.actor, self.exec1)
        self.assertIn('Sarah Executive mentioned you', notif.title)
        self.assertIn('/leads/', notif.action_url)

    def test_threaded_reply_and_parent_notification(self):
        # Sarah creates parent comment
        parent = InternalComment.objects.create(
            lead=self.lead1,
            author=self.exec1,
            content='Initial query about pricing.'
        )

        # Manager replies
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(f'/api/leads/{self.lead1.id}/comments/', {
            'content': 'Approved up to 15% discount.',
            'parent': parent.id
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data['parent'], parent.id)

        # Sarah should receive notification about the comment reply
        notif = Notification.objects.filter(
            recipient=self.exec1,
            notification_type=Notification.NotificationType.INTERNAL_COMMENT
        ).first()
        self.assertIsNotNone(notif)
        self.assertEqual(notif.actor, self.manager)
        self.assertIn('David Manager', notif.title)

    def test_executive_cannot_view_or_comment_unassigned_lead(self):
        # exec2 tries to access lead1 (assigned to exec1)
        self.client.force_authenticate(user=self.exec2)
        resp_get = self.client.get(f'/api/leads/{self.lead1.id}/comments/')
        self.assertEqual(resp_get.status_code, status.HTTP_403_FORBIDDEN)

        resp_post = self.client.post(f'/api/leads/{self.lead1.id}/comments/', {
            'content': 'Attempting unauthorized comment'
        })
        self.assertEqual(resp_post.status_code, status.HTTP_403_FORBIDDEN)

    def test_edit_comment_permissions(self):
        comment = InternalComment.objects.create(
            lead=self.lead1,
            author=self.exec1,
            content='Original message'
        )

        # Another executive cannot edit
        self.client.force_authenticate(user=self.exec2)
        resp_bad = self.client.patch(f'/api/comments/{comment.id}/', {
            'content': 'Hacked message'
        })
        self.assertEqual(resp_bad.status_code, status.HTTP_403_FORBIDDEN)

        # Author can edit
        self.client.force_authenticate(user=self.exec1)
        resp_ok = self.client.patch(f'/api/comments/{comment.id}/', {
            'content': 'Updated accurate message'
        })
        self.assertEqual(resp_ok.status_code, status.HTTP_200_OK)
        comment.refresh_from_db()
        self.assertEqual(comment.content, 'Updated accurate message')
        self.assertTrue(comment.is_edited)

    def test_soft_delete_preserves_tree_structure(self):
        comment = InternalComment.objects.create(
            lead=self.lead1,
            author=self.exec1,
            content='Confidential note'
        )

        self.client.force_authenticate(user=self.exec1)
        resp = self.client.delete(f'/api/comments/{comment.id}/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        comment.refresh_from_db()
        self.assertTrue(comment.is_deleted)

        # Check serialized output in list
        resp_list = self.client.get(f'/api/leads/{self.lead1.id}/comments/')
        self.assertEqual(resp_list.status_code, status.HTTP_200_OK)
        item = resp_list.data['results'][0]
        self.assertEqual(item['display_content'], '[This comment has been deleted]')

    def test_mention_suggestions_api(self):
        self.client.force_authenticate(user=self.exec1)
        resp = self.client.get('/api/users/mention-suggestions/?q=David')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        emails = [u['email'] for u in resp.data]
        self.assertIn(self.manager.email, emails)
        # Excludes self
        self.assertNotIn(self.exec1.email, emails)
