from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import timedelta
from accounts.models import User
from leads.models import Lead
from followups.models import FollowUp

class FollowUpTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.manager = User.objects.create_user(
            email='manager@test.com', password='Password@123', role=User.Role.MANAGER
        )
        self.exec_user = User.objects.create_user(
            email='exec@test.com', password='Password@123', role=User.Role.EXECUTIVE
        )

        self.lead = Lead.objects.create(
            name='Test Company Lead',
            phone='+15554443333',
            assigned_to=self.exec_user
        )

    def test_cannot_schedule_followup_in_past(self):
        self.client.force_authenticate(user=self.exec_user)
        past_time = timezone.now() - timedelta(days=1)
        response = self.client.post('/api/follow-ups/', {
            'lead': self.lead.id,
            'follow_up_at': past_time.isoformat(),
            'purpose': FollowUp.Purpose.PHONE_CALL
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_schedule_future_followup_success(self):
        self.client.force_authenticate(user=self.exec_user)
        future_time = timezone.now() + timedelta(days=2)
        response = self.client.post('/api/follow-ups/', {
            'lead': self.lead.id,
            'follow_up_at': future_time.isoformat(),
            'purpose': FollowUp.Purpose.DEMO
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], FollowUp.Status.PENDING)

    def test_complete_followup_with_outcome(self):
        self.client.force_authenticate(user=self.exec_user)
        future_time = timezone.now() + timedelta(days=1)
        fu = FollowUp.objects.create(
            lead=self.lead,
            assigned_to=self.exec_user,
            follow_up_at=future_time,
            purpose=FollowUp.Purpose.PHONE_CALL
        )

        response = self.client.post(f'/api/follow-ups/{fu.id}/complete/', {
            'outcome': 'Spoke with Director of Engineering. Moving to commercial proposal.'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        fu.refresh_from_db()
        self.assertEqual(fu.status, FollowUp.Status.COMPLETED)
        self.assertIn('Director of Engineering', fu.outcome)
        self.assertIsNotNone(fu.completed_at)


class CalendarEventsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.manager = User.objects.create_user(
            email='cal_mgr@test.com', password='Password@123', role=User.Role.MANAGER
        )
        self.exec1 = User.objects.create_user(
            email='cal_exec1@test.com', password='Password@123', role=User.Role.EXECUTIVE
        )
        self.exec2 = User.objects.create_user(
            email='cal_exec2@test.com', password='Password@123', role=User.Role.EXECUTIVE
        )

        self.lead1 = Lead.objects.create(name='Lead Alpha', phone='1234567890', assigned_to=self.exec1)
        self.lead2 = Lead.objects.create(name='Lead Beta', phone='9876543210', assigned_to=self.exec2)

        now = timezone.now()
        # Event 1: exec1, tomorrow, phone_call, pending
        self.ev1 = FollowUp.objects.create(
            lead=self.lead1,
            assigned_to=self.exec1,
            follow_up_at=now + timedelta(days=1),
            purpose=FollowUp.Purpose.PHONE_CALL,
            status=FollowUp.Status.PENDING
        )
        # Event 2: exec2, in 3 days, demo, pending
        self.ev2 = FollowUp.objects.create(
            lead=self.lead2,
            assigned_to=self.exec2,
            follow_up_at=now + timedelta(days=3),
            purpose=FollowUp.Purpose.DEMO,
            status=FollowUp.Status.PENDING
        )
        # Event 3: exec1, in 10 days, meeting, completed
        self.ev3 = FollowUp.objects.create(
            lead=self.lead1,
            assigned_to=self.exec1,
            follow_up_at=now + timedelta(days=10),
            purpose=FollowUp.Purpose.MEETING,
            status=FollowUp.Status.COMPLETED,
            outcome='Met client'
        )

    def test_unauthenticated_request_blocked(self):
        resp = self.client.get('/api/calendar/events/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_executive_sees_only_own_events(self):
        self.client.force_authenticate(user=self.exec1)
        resp = self.client.get('/api/calendar/events/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get('results', [])
        ids = [e['id'] for e in results]
        self.assertIn(self.ev1.id, ids)
        self.assertIn(self.ev3.id, ids)
        self.assertNotIn(self.ev2.id, ids)

    def test_manager_sees_all_and_can_filter_by_user(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get('/api/calendar/events/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data.get('count'), 3)

        # Filter by exec2
        resp2 = self.client.get(f'/api/calendar/events/?assigned_to={self.exec2.id}')
        self.assertEqual(resp2.status_code, status.HTTP_200_OK)
        self.assertEqual(resp2.data.get('count'), 1)
        self.assertEqual(resp2.data.get('results')[0]['id'], self.ev2.id)

    def test_date_range_filtering(self):
        self.client.force_authenticate(user=self.manager)
        now = timezone.now()
        start = (now + timedelta(days=2)).isoformat()
        end = (now + timedelta(days=5)).isoformat()

        resp = self.client.get(f'/api/calendar/events/?start={start}&end={end}')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        results = resp.data.get('results', [])
        ids = [e['id'] for e in results]
        self.assertEqual(ids, [self.ev2.id])

    def test_status_and_purpose_filtering(self):
        self.client.force_authenticate(user=self.manager)

        # Filter by COMPLETED
        resp = self.client.get('/api/calendar/events/?status=COMPLETED')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        ids = [e['id'] for e in resp.data.get('results', [])]
        self.assertEqual(ids, [self.ev3.id])

        # Filter by DEMO
        resp_purpose = self.client.get('/api/calendar/events/?purpose=demo')
        self.assertEqual(resp_purpose.status_code, status.HTTP_200_OK)
        ids_purpose = [e['id'] for e in resp_purpose.data.get('results', [])]
        self.assertEqual(ids_purpose, [self.ev2.id])
