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

    def test_upload_without_name_and_phone(self):
        """Name and Phone are now optional per user requirement."""
        res = self.post_csv('Email,Company\na@x.com,Acme Corp\n')
        self.assertEqual(res.status_code, 200, res.content)
        data = res.data['data']
        self.assertEqual(data['imported'], 1)
        lead = Lead.objects.get(email='a@x.com')
        self.assertEqual(lead.company_name, 'Acme Corp')
        self.assertTrue('Acme Corp' in lead.name or lead.name.startswith('Lead'))

    def test_unrecognized_columns_without_mapping_returns_400(self):
        res = self.post_csv('UnknownColA,UnknownColB\nval1,val2\n')
        self.assertEqual(res.status_code, 400)
        self.assertIn('No recognizable lead columns', res.data['message'])

    def test_custom_column_mapping_and_skipping(self):
        import json
        csv_text = (
            'Prospect,Handy,Firm,Budget,ExtraNote\n'
            'Rohan Verma,+919999888877,Verma Tech,120000,Internal Note\n'
        )
        custom_mapping = json.dumps({
            'Prospect': 'name',
            'Handy': 'phone',
            'Firm': 'company_name',
            'Budget': 'expected_value',
            'ExtraNote': 'skip',
        })
        f = SimpleUploadedFile('custom_leads.csv', csv_text.encode('utf-8'), content_type='text/csv')
        res = self.client.post('/api/leads/import/', {
            'file': f,
            'column_mapping': custom_mapping,
            'default_priority': 'URGENT',
        }, format='multipart')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['data']['imported'], 1)
        rohan = Lead.objects.get(phone='+919999888877')
        self.assertEqual(rohan.name, 'Rohan Verma')
        self.assertEqual(rohan.company_name, 'Verma Tech')
        self.assertEqual(str(rohan.expected_value), '120000.00')
        self.assertEqual(rohan.priority, 'URGENT')

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

    def test_import_with_custom_crm_fields_and_notes(self):
        import json
        from leads.models import LeadNote
        csv_text = (
            'Full Name,Mobile,Organization,City,State,Designation,Requirements\n'
            'Priya Patel,+918888777766,Patel Logistics,Ahmedabad,Gujarat,Supply Chain VP,Looking for multi-warehouse CRM\n'
        )
        custom_mapping = json.dumps({
            'Full Name': 'name',
            'Mobile': 'phone',
            'Organization': 'company_name',
            'City': 'city',
            'State': 'state',
            'Designation': 'designation',
            'Requirements': 'notes',
        })
        f = SimpleUploadedFile('custom_crm_fields.csv', csv_text.encode('utf-8'), content_type='text/csv')
        res = self.client.post('/api/leads/import/', {
            'file': f,
            'column_mapping': custom_mapping,
        }, format='multipart')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.data['data']['imported'], 1)
        priya = Lead.objects.get(phone='+918888777766')
        self.assertEqual(priya.name, 'Priya Patel')
        self.assertEqual(priya.company_name, 'Patel Logistics')
        self.assertIn('Ahmedabad', priya.address)
        self.assertIn('Gujarat', priya.address)

        # Check that designation & notes were saved as LeadNote
        notes = list(priya.notes.all())
        self.assertTrue(len(notes) > 0)
        note_text = notes[0].note_text
        self.assertIn('Looking for multi-warehouse CRM', note_text)
        self.assertIn('Designation: Supply Chain VP', note_text)
