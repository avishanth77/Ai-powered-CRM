from django.test import TestCase
from django.contrib.auth import get_user_model
from notifications.models import Notification
from notifications.services import NotificationService
from leads.models import Lead, LeadStage

User = get_user_model()


class NotificationModelAndServiceTests(TestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            email='sarah@crmlite.local',
            password='password123',
            first_name='Sarah',
            last_name='Thomas',
            role=User.Role.EXECUTIVE
        )
        self.user2 = User.objects.create_user(
            email='john@crmlite.local',
            password='password123',
            first_name='John',
            last_name='Mathew',
            role=User.Role.MANAGER
        )
        self.stage = LeadStage.objects.filter(slug='new').first()
        if not self.stage:
            self.stage = LeadStage.objects.create(
                name='Test Stage',
                slug='test-stage',
                color='#6366F1',
                display_order=99
            )
        self.lead = Lead.objects.create(
            name='ABC Technologies',
            phone='9876543210',
            email='contact@abctech.com',
            company_name='ABC Technologies',
            stage=self.stage,
            assigned_to=self.user1,
            created_by=self.user2
        )

    def test_notification_creation_and_mark_as_read(self):
        notif = Notification.objects.create(
            recipient=self.user1,
            actor=self.user2,
            notification_type=Notification.NotificationType.LEAD_ASSIGNED,
            title='Lead Assigned',
            message='ABC Technologies was assigned to you.',
            entity_type='lead',
            entity_id=str(self.lead.id),
            action_url=f'/leads/{self.lead.id}'
        )
        self.assertFalse(notif.is_read)
        self.assertIsNone(notif.read_at)

        notif.mark_as_read()
        self.assertTrue(notif.is_read)
        self.assertIsNotNone(notif.read_at)

    def test_service_create_notification_prevents_self_notification(self):
        notif = NotificationService.create_notification(
            recipient=self.user1,
            actor=self.user1,
            notification_type=Notification.NotificationType.LEAD_ASSIGNED,
            title='Self Title',
            message='Self Message'
        )
        self.assertIsNone(notif)
        self.assertEqual(Notification.objects.count(), 0)

    def test_service_unread_count_and_mark_all_read(self):
        NotificationService.create_notification(
            recipient=self.user1,
            actor=self.user2,
            notification_type=Notification.NotificationType.LEAD_ASSIGNED,
            title='Notif 1',
            message='Message 1'
        )
        NotificationService.create_notification(
            recipient=self.user1,
            actor=self.user2,
            notification_type=Notification.NotificationType.FOLLOW_UP_CREATED,
            title='Notif 2',
            message='Message 2'
        )
        NotificationService.create_notification(
            recipient=self.user2,
            actor=self.user1,
            notification_type=Notification.NotificationType.SYSTEM,
            title='Notif for user2',
            message='Message for user2'
        )

        self.assertEqual(NotificationService.get_unread_count(self.user1), 2)
        self.assertEqual(NotificationService.get_unread_count(self.user2), 1)

        updated = NotificationService.mark_all_as_read(self.user1)
        self.assertEqual(updated, 2)
        self.assertEqual(NotificationService.get_unread_count(self.user1), 0)
        self.assertEqual(NotificationService.get_unread_count(self.user2), 1)

    def test_notify_lead_assigned(self):
        notif = NotificationService.notify_lead_assigned(
            lead=self.lead,
            assignee=self.user1,
            actor=self.user2
        )
        self.assertIsNotNone(notif)
        self.assertEqual(notif.recipient, self.user1)
        self.assertEqual(notif.notification_type, Notification.NotificationType.LEAD_ASSIGNED)
        self.assertIn('ABC Technologies', notif.message)
        self.assertEqual(notif.action_url, f'/leads/{self.lead.id}')

    def test_notify_lead_handed_over(self):
        notif = NotificationService.notify_lead_handed_over(
            lead=self.lead,
            new_assignee=self.user1,
            old_assignee=self.user2,
            handed_over_by=self.user2,
            reason='Territory realignment'
        )
        self.assertIsNotNone(notif)
        self.assertEqual(notif.recipient, self.user1)
        self.assertEqual(notif.notification_type, Notification.NotificationType.LEAD_HANDED_OVER)
        self.assertIn('Territory realignment', notif.message)


from rest_framework.test import APITestCase
from rest_framework import status


class NotificationAPITests(APITestCase):
    def setUp(self):
        self.user1 = User.objects.create_user(
            email='alice@crmlite.local',
            password='password123',
            first_name='Alice',
            last_name='Cooper',
            role=User.Role.EXECUTIVE
        )
        self.user2 = User.objects.create_user(
            email='bob@crmlite.local',
            password='password123',
            first_name='Bob',
            last_name='Builder',
            role=User.Role.MANAGER
        )
        self.notif_user1_a = Notification.objects.create(
            recipient=self.user1,
            actor=self.user2,
            notification_type=Notification.NotificationType.LEAD_ASSIGNED,
            title='Lead 1 Assigned',
            message='Lead 1 assigned to Alice',
            is_read=False
        )
        self.notif_user1_b = Notification.objects.create(
            recipient=self.user1,
            actor=self.user2,
            notification_type=Notification.NotificationType.LEAD_STAGE_CHANGED,
            title='Stage Changed',
            message='Stage changed for Lead 2',
            is_read=False
        )
        self.notif_user2 = Notification.objects.create(
            recipient=self.user2,
            actor=self.user1,
            notification_type=Notification.NotificationType.SYSTEM,
            title='System Alert',
            message='Alert for Bob',
            is_read=False
        )

    def test_unauthenticated_requests_blocked(self):
        resp = self.client.get('/api/notifications/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_notifications_user_scoped(self):
        self.client.force_authenticate(user=self.user1)
        resp = self.client.get('/api/notifications/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get('results', resp.data)
        ids = [item['id'] for item in results]
        self.assertIn(self.notif_user1_a.id, ids)
        self.assertIn(self.notif_user1_b.id, ids)
        self.assertNotIn(self.notif_user2.id, ids)

    def test_unread_count_api(self):
        self.client.force_authenticate(user=self.user1)
        resp = self.client.get('/api/notifications/unread-count/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get('count'), 2)

    def test_mark_as_read_api(self):
        self.client.force_authenticate(user=self.user1)
        resp = self.client.patch(f'/api/notifications/{self.notif_user1_a.id}/read/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.notif_user1_a.refresh_from_db()
        self.assertTrue(self.notif_user1_a.is_read)
        self.assertIsNotNone(self.notif_user1_a.read_at)

    def test_cannot_access_or_modify_other_user_notification(self):
        self.client.force_authenticate(user=self.user1)
        # Trying to read Bob's notification
        resp = self.client.patch(f'/api/notifications/{self.notif_user2.id}/read/')
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

        # Trying to delete Bob's notification
        resp = self.client.delete(f'/api/notifications/{self.notif_user2.id}/')
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_mark_all_read_api(self):
        self.client.force_authenticate(user=self.user1)
        resp = self.client.patch('/api/notifications/mark-all-read/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get('updated_count'), 2)

        # Verify in DB
        self.notif_user1_a.refresh_from_db()
        self.notif_user1_b.refresh_from_db()
        self.notif_user2.refresh_from_db()
        self.assertTrue(self.notif_user1_a.is_read)
        self.assertTrue(self.notif_user1_b.is_read)
        self.assertFalse(self.notif_user2.is_read)

    def test_delete_own_notification(self):
        self.client.force_authenticate(user=self.user1)
        resp = self.client.delete(f'/api/notifications/{self.notif_user1_a.id}/')
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Notification.objects.filter(id=self.notif_user1_a.id).exists())

