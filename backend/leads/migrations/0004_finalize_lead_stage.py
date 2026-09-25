import django.db.models.deletion
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('leads', '0003_populate_initial_stages_and_migrate_leads'),
    ]

    operations = [
        migrations.RemoveIndex(
            model_name='lead',
            name='leads_lead_status_e23abe_idx',
        ),
        migrations.RemoveField(
            model_name='lead',
            name='status',
        ),
        migrations.AlterField(
            model_name='lead',
            name='stage',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='leads',
                to='leads.leadstage',
            ),
        ),
        migrations.AddIndex(
            model_name='lead',
            index=models.Index(fields=['stage'], name='leads_lead_stage_e23abe_idx'),
        ),
    ]
