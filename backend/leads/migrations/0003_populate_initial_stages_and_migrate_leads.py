from django.db import migrations

def populate_stages_and_migrate_leads(apps, schema_editor):
    LeadStage = apps.get_model('leads', 'LeadStage')
    Lead = apps.get_model('leads', 'Lead')

    stages_data = [
        {
            'name': 'New',
            'slug': 'new',
            'description': 'Newly created lead',
            'color': '#0284c7',
            'display_order': 1,
            'is_active': True,
            'is_system': True,
        },
        {
            'name': 'Contacted',
            'slug': 'contacted',
            'description': 'Initial contact made with lead',
            'color': '#2563eb',
            'display_order': 2,
            'is_active': True,
            'is_system': False,
        },
        {
            'name': 'Demo Scheduled',
            'slug': 'demo-scheduled',
            'description': 'Product demo scheduled with prospect',
            'color': '#7c3aed',
            'display_order': 3,
            'is_active': True,
            'is_system': False,
        },
        {
            'name': 'Negotiation',
            'slug': 'negotiation',
            'description': 'Terms and pricing under negotiation',
            'color': '#d97706',
            'display_order': 4,
            'is_active': True,
            'is_system': False,
        },
        {
            'name': 'Qualified',
            'slug': 'qualified',
            'description': 'Lead is qualified for conversion',
            'color': '#059669',
            'display_order': 5,
            'is_active': True,
            'is_system': False,
        },
        {
            'name': 'Won',
            'slug': 'won',
            'description': 'Deal won / converted',
            'color': '#0d9488',
            'display_order': 6,
            'is_active': True,
            'is_system': True,
        },
        {
            'name': 'Lost',
            'slug': 'lost',
            'description': 'Deal lost or archived',
            'color': '#e11d48',
            'display_order': 7,
            'is_active': True,
            'is_system': True,
        },
    ]

    stage_map = {}
    for st_info in stages_data:
        stage, _ = LeadStage.objects.get_or_create(
            slug=st_info['slug'],
            defaults=st_info
        )
        stage_map[st_info['slug']] = stage
        stage_map[st_info['name'].lower()] = stage

    status_slug_mapping = {
        'new': 'new',
        'contacted': 'contacted',
        'demo_scheduled': 'demo-scheduled',
        'demo scheduled': 'demo-scheduled',
        'negotiation': 'negotiation',
        'qualified': 'qualified',
        'won': 'won',
        'lost': 'lost',
    }

    default_stage = stage_map['new']
    for lead in Lead.objects.all():
        raw_status = (lead.status or '').strip().lower()
        slug = status_slug_mapping.get(raw_status, 'new')
        lead.stage = stage_map.get(slug, default_stage)
        lead.save(update_fields=['stage'])

def reverse_populate(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('leads', '0002_add_leadstage_leadhandover'),
    ]

    operations = [
        migrations.RunPython(populate_stages_and_migrate_leads, reverse_populate),
    ]
