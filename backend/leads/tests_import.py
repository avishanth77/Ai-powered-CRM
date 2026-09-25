import io

from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from accounts.models import User
from leads.models import Lead, LeadSource, LeadStage


class LeadImportTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='imp_admin@x.com', password='x', role='ADMIN',
            first_name='A', last_name='B',
        )
        self.source = LeadSource.objects.create(name='Website')
        self.stage = LeadStage.objects.filter(slug='new').first()
        if not self.stage:
            self.stage = LeadStage.objects.create(
                name='New', slug='new', display_order=1, is_system=True,
            )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

    def post_csv(self, text, name='leads.csv'):
        f = SimpleUploadedFile(name, text.encode('utf-8'), content_type='text/csv')
        return self.client.post('/api/leads/import/', {'file': f}, format='multipart')

    def test_happy_path_and_row_errors(self):
        csv_text = (
            'Name,Phone,Email,Company,Source,Priority,Expected Value,Address\n'
            'John Doe,+911234567890,john@x.com,Acme,Website,HIGH,50000,Street 1\n'
            'Bad Row,,bad-email,,Nope,WRONG,abc,\n'
            'Jane Roe,+919876543210,,,,,\n'
        )
        res = self.post_csv(csv_text)
        self.assertEqual(res.status_code, 200, res.content)
        data = res.data['data']
        self.assertEqual(data['imported'], 2, data)
        self.assertEqual(data['skipped'], 1, data)
        self.assertEqual(len(data['errors']), 1, data)
        self.assertEqual(Lead.objects.count(), 2)
        john = Lead.objects.get(phone='+911234567890')
        self.assertEqual(john.name, 'John Doe')
        self.assertEqual(john.source_id, self.source.id)
        self.assertEqual(john.priority, 'HIGH')
        self.assertEqual(str(john.expected_value), '50000.00')

    def test_missing_file_and_bad_extension(self):
        res = self.client.post('/api/leads/import/', {}, format='multipart')
        self.assertEqual(res.status_code, 400)
        f = SimpleUploadedFile('x.txt', b'a,b', content_type='text/plain')
        res = self.client.post('/api/leads/import/', {'file': f}, format='multipart')
        self.assertEqual(res.status_code, 400)

    def test_missing_required_columns(self):
        res = self.post_csv('Email,Company\na@x.com,Acme\n')
        self.assertEqual(res.status_code, 400)

    def test_executive_can_import(self):
        ex = User.objects.create_user(
            email='imp_exec@x.com', password='x', role='EXECUTIVE',
            first_name='E', last_name='X',
        )
        self.client.force_authenticate(user=ex)
        res = self.post_csv('Name,Phone\nSolo,+911111111111\n')
        self.assertEqual(res.status_code, 200, res.content)
        lead = Lead.objects.get(phone='+911111111111')
        self.assertEqual(lead.created_by_id, ex.id)
        self.assertEqual(lead.assigned_to_id, ex.id)
