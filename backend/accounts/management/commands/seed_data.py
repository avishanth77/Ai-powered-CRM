from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from accounts.models import User
from leads.models import LeadSource, Lead, LeadNote
from customers.models import Customer
from followups.models import FollowUp
from activity.models import ActivityLog
from activity.services import log_activity

class Command(BaseCommand):
    help = 'Seeds database with realistic CRM data for development, testing, and live demo.'

    def handle(self, *args, **options):
        self.stdout.write("Starting CRM Lite database seeding...")

        # 1. Create Users
        admin, _ = User.objects.get_or_create(
            email='admin@crmlite.com',
            defaults={
                'username': 'admin@crmlite.com',
                'first_name': 'Eleanor',
                'last_name': 'Vance',
                'role': User.Role.ADMIN,
                'phone': '+1 (555) 019-2831',
                'is_staff': True,
                'is_superuser': True,
            }
        )
        admin.username = 'admin@crmlite.com'
        admin.set_password('Admin@123')
        admin.save()

        manager, _ = User.objects.get_or_create(
            email='manager@crmlite.com',
            defaults={
                'username': 'manager@crmlite.com',
                'first_name': 'Marcus',
                'last_name': 'Sterling',
                'role': User.Role.MANAGER,
                'phone': '+1 (555) 018-9942',
                'is_staff': True,
            }
        )
        manager.username = 'manager@crmlite.com'
        manager.set_password('Manager@123')
        manager.save()

        exec_alex, _ = User.objects.get_or_create(
            email='alex@crmlite.com',
            defaults={
                'username': 'alex@crmlite.com',
                'first_name': 'Alex',
                'last_name': 'Rivera',
                'role': User.Role.EXECUTIVE,
                'phone': '+1 (555) 014-4411',
            }
        )
        exec_alex.username = 'alex@crmlite.com'
        exec_alex.set_password('Alex@123')
        exec_alex.save()

        exec_sarah, _ = User.objects.get_or_create(
            email='sarah@crmlite.com',
            defaults={
                'username': 'sarah@crmlite.com',
                'first_name': 'Sarah',
                'last_name': 'Chen',
                'role': User.Role.EXECUTIVE,
                'phone': '+1 (555) 017-7722',
            }
        )
        exec_sarah.username = 'sarah@crmlite.com'
        exec_sarah.set_password('Sarah@123')
        exec_sarah.save()

        self.stdout.write(self.style.SUCCESS("[OK] Users created (admin@crmlite.com, manager@crmlite.com, alex@crmlite.com, sarah@crmlite.com)"))

        # 2. Create Lead Sources
        sources_data = [
            ('Website', 'Inbound contact form and landing pages'),
            ('LinkedIn', 'Outreach and B2B LinkedIn campaign'),
            ('Referral', 'Existing customer and partner referrals'),
            ('Google Ads', 'PPC Search and display network ads'),
            ('WhatsApp', 'Direct inbound WhatsApp inquiries'),
            ('Cold Call', 'Outbound sales prospecting campaign'),
            ('Conference', 'Industry expo and tech conference leads'),
        ]
        source_objs = {}
        for name, desc in sources_data:
            s, _ = LeadSource.objects.get_or_create(name=name, defaults={'description': desc})
            source_objs[name] = s

        self.stdout.write(self.style.SUCCESS(f"[OK] {len(source_objs)} Lead Sources initialized."))

        # 3. Create Leads across Pipeline Stages
        now = timezone.now()

        leads_data = [
            {
                'name': 'Sophia Martinez',
                'company_name': 'Apex Logistics Corp',
                'phone': '+1 (555) 234-5678',
                'email': 'sophia@apexlogistics.io',
                'source': source_objs['Website'],
                'status': Lead.Status.NEW,
                'priority': Lead.Priority.HIGH,
                'assigned_to': exec_alex,
                'expected_value': Decimal('15000.00'),
                'address': '742 Evergreen Terrace, Springfield, OR',
                'created_by': manager,
            },
            {
                'name': 'David Kim',
                'company_name': 'Nexus FinTech Labs',
                'phone': '+1 (555) 345-6789',
                'email': 'david.kim@nexusfin.com',
                'source': source_objs['LinkedIn'],
                'status': Lead.Status.CONTACTED,
                'priority': Lead.Priority.MEDIUM,
                'assigned_to': exec_alex,
                'expected_value': Decimal('28000.00'),
                'address': '101 Market St, Suite 400, San Francisco, CA',
                'created_by': exec_alex,
            },
            {
                'name': 'Amara Patel',
                'company_name': 'Zenith Health Systems',
                'phone': '+1 (555) 456-7890',
                'email': 'amara@zenithhealth.org',
                'source': source_objs['Referral'],
                'status': Lead.Status.DEMO_SCHEDULED,
                'priority': Lead.Priority.URGENT,
                'assigned_to': exec_sarah,
                'expected_value': Decimal('45000.00'),
                'address': '500 Medical Center Way, Austin, TX',
                'created_by': manager,
            },
            {
                'name': 'Liam O\'Connor',
                'company_name': 'Crestline Retailers',
                'phone': '+1 (555) 567-8901',
                'email': 'liam@crestlineretail.com',
                'source': source_objs['Google Ads'],
                'status': Lead.Status.NEGOTIATION,
                'priority': Lead.Priority.HIGH,
                'assigned_to': exec_sarah,
                'expected_value': Decimal('32000.00'),
                'address': '120 Broadway, New York, NY',
                'created_by': exec_sarah,
            },
            {
                'name': 'Elena Rostova',
                'company_name': 'Quantum Cloud Solutions',
                'phone': '+1 (555) 678-9012',
                'email': 'elena@quantumcloud.de',
                'source': source_objs['LinkedIn'],
                'status': Lead.Status.QUALIFIED,
                'priority': Lead.Priority.URGENT,
                'assigned_to': exec_alex,
                'expected_value': Decimal('60000.00'),
                'address': 'Friedrichstraße 45, Berlin, Germany',
                'created_by': manager,
            },
            {
                'name': 'Robert Taylor',
                'company_name': 'Harbor Marine Logistics',
                'phone': '+1 (555) 789-0123',
                'email': 'rtaylor@harbormarine.com',
                'source': source_objs['Cold Call'],
                'status': Lead.Status.LOST,
                'priority': Lead.Priority.LOW,
                'assigned_to': exec_alex,
                'expected_value': Decimal('8500.00'),
                'address': '88 Harbor Dr, Seattle, WA',
                'created_by': exec_alex,
                'lost_reason': 'Competitor offered a free onboarding tier; budget frozen until Q4.',
            },
            {
                'name': 'Chloe Dupont',
                'company_name': 'Lumina Media Group',
                'phone': '+1 (555) 890-1234',
                'email': 'chloe@luminamedia.fr',
                'source': source_objs['Website'],
                'status': Lead.Status.WON,
                'priority': Lead.Priority.HIGH,
                'assigned_to': exec_sarah,
                'expected_value': Decimal('38000.00'),
                'address': '14 Rue de Rivoli, Paris, France',
                'created_by': manager,
                'converted_at': now - timedelta(days=5),
            },
            {
                'name': 'Carlos Gomez',
                'company_name': 'Sol Real Estate Partners',
                'phone': '+1 (555) 901-2345',
                'email': 'cgomez@solrealestate.es',
                'source': source_objs['WhatsApp'],
                'status': Lead.Status.NEW,
                'priority': Lead.Priority.MEDIUM,
                'assigned_to': exec_sarah,
                'expected_value': Decimal('19500.00'),
                'address': 'Paseo de la Castellana 28, Madrid, Spain',
                'created_by': exec_sarah,
            },
            {
                'name': 'Aisha Al-Mansoor',
                'company_name': 'Emirates Smart Logistics',
                'phone': '+1 (555) 912-3456',
                'email': 'aisha@esmartlogistics.ae',
                'source': source_objs['Conference'],
                'status': Lead.Status.QUALIFIED,
                'priority': Lead.Priority.HIGH,
                'assigned_to': exec_alex,
                'expected_value': Decimal('52000.00'),
                'address': 'Sheikh Zayed Road, Dubai, UAE',
                'created_by': manager,
            }
        ]

        created_leads = []
        for l_data in leads_data:
            lead, _ = Lead.objects.get_or_create(
                phone=l_data['phone'],
                defaults=l_data
            )
            created_leads.append(lead)

        self.stdout.write(self.style.SUCCESS(f"[OK] {len(created_leads)} Leads created across pipeline."))

        # 4. Create Customer from the WON lead (Lumina Media Group)
        won_lead = Lead.objects.filter(status=Lead.Status.WON).first()
        if won_lead and not hasattr(won_lead, 'customer_profile'):
            customer = Customer.objects.create(
                lead=won_lead,
                name=won_lead.name,
                phone=won_lead.phone,
                email=won_lead.email,
                company_name=won_lead.company_name,
                address=won_lead.address,
                converted_at=won_lead.converted_at or now,
                created_by=manager
            )
            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=won_lead.id,
                action=ActivityLog.ActionType.LEAD_CONVERTED,
                performed_by=manager,
                notes=f"Converted to Customer #{customer.id} ({customer.name})"
            )
            log_activity(
                entity_type=ActivityLog.EntityType.CUSTOMER,
                entity_id=customer.id,
                action=ActivityLog.ActionType.CUSTOMER_CREATED,
                performed_by=manager,
                notes=f"Customer record created from Lead #{won_lead.id}"
            )
            self.stdout.write(self.style.SUCCESS(f"[OK] Customer record created: {customer.name} (Lumina Media Group)."))

        # 5. Add Communication Notes
        demo_lead = Lead.objects.filter(status=Lead.Status.DEMO_SCHEDULED).first()
        if demo_lead:
            LeadNote.objects.get_or_create(
                lead=demo_lead,
                user=exec_sarah,
                note_type=LeadNote.NoteType.CALL,
                note_text="Had a 20-minute introductory call. Client is expanding their cardiology department and needs urgent automation."
            )
            LeadNote.objects.get_or_create(
                lead=demo_lead,
                user=exec_sarah,
                note_type=LeadNote.NoteType.DEMO,
                note_text="Scheduled live product demonstration for upcoming Thursday with the VP of Medical Informatics."
            )

        neg_lead = Lead.objects.filter(status=Lead.Status.NEGOTIATION).first()
        if neg_lead:
            LeadNote.objects.get_or_create(
                lead=neg_lead,
                user=exec_sarah,
                note_type=LeadNote.NoteType.OBJECTION,
                note_text="Client asked for a 12% discount on the enterprise tier and requested SLA guarantee for 99.9% uptime."
            )

        qual_lead = Lead.objects.filter(status=Lead.Status.QUALIFIED).first()
        if qual_lead:
            LeadNote.objects.get_or_create(
                lead=qual_lead,
                user=exec_alex,
                note_type=LeadNote.NoteType.MEETING,
                note_text="Security review passed with high marks. Procurement has approved budget. Ready for contract signature."
            )

        self.stdout.write(self.style.SUCCESS("[OK] Communication notes attached to active leads."))

        # 6. Create Follow-ups (Overdue, Today, Upcoming, Completed)
        followups_data = [
            # Overdue
            {
                'lead': Lead.objects.filter(status=Lead.Status.CONTACTED).first(),
                'assigned_to': exec_alex,
                'follow_up_at': now - timedelta(days=2, hours=3),
                'purpose': FollowUp.Purpose.PHONE_CALL,
                'status': FollowUp.Status.PENDING,
            },
            # Today
            {
                'lead': Lead.objects.filter(status=Lead.Status.DEMO_SCHEDULED).first(),
                'assigned_to': exec_sarah,
                'follow_up_at': now + timedelta(hours=3),
                'purpose': FollowUp.Purpose.DEMO,
                'status': FollowUp.Status.PENDING,
            },
            # Upcoming
            {
                'lead': Lead.objects.filter(status=Lead.Status.NEGOTIATION).first(),
                'assigned_to': exec_sarah,
                'follow_up_at': now + timedelta(days=2),
                'purpose': FollowUp.Purpose.PROPOSAL,
                'status': FollowUp.Status.PENDING,
            },
            # Completed
            {
                'lead': Lead.objects.filter(status=Lead.Status.QUALIFIED).first(),
                'assigned_to': exec_alex,
                'follow_up_at': now - timedelta(days=1),
                'purpose': FollowUp.Purpose.MEETING,
                'status': FollowUp.Status.COMPLETED,
                'outcome': 'Met with CTO and Chief Architect. Finalized technical compliance roadmap.',
                'completed_at': now - timedelta(hours=18),
            }
        ]

        for fu_data in followups_data:
            if fu_data['lead']:
                FollowUp.objects.get_or_create(
                    lead=fu_data['lead'],
                    purpose=fu_data['purpose'],
                    follow_up_at=fu_data['follow_up_at'],
                    defaults=fu_data
                )

        self.stdout.write(self.style.SUCCESS("[OK] Follow-ups generated (Overdue, Today, Upcoming, Completed)."))

        # 7. Add sample Activity Logs for history
        for lead in created_leads[:5]:
            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=lead.id,
                action=ActivityLog.ActionType.LEAD_CREATED,
                performed_by=lead.created_by or admin,
                notes=f"Lead '{lead.name}' created"
            )

        self.stdout.write(self.style.SUCCESS("[OK] Activity logs recorded."))
        self.stdout.write(self.style.SUCCESS("==> CRM Lite Seed Data Generation Complete! <=="))
