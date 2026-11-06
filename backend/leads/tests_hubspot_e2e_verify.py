import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.contrib.auth import get_user_model
from leads.models import Lead, LeadStage, LeadStageTask, StageTaskRule, CustomPropertyDefinition, CustomPropertyValue
from leads.services.progression import check_stage_progression
from leads.serializers import LeadDetailSerializer, LeadCreateUpdateSerializer

User = get_user_model()

def run_e2e_verification():
    print("=== STARTING HUBSPOT CRM UPGRADE E2E VERIFICATION ===")

    # 1. Ensure test user
    user, _ = User.objects.get_or_create(
        username='hubspot_tester',
        defaults={'email': 'tester@example.com', 'role': 'MANAGER', 'is_staff': True}
    )

    # Clean up prior test runs if any
    Lead.objects.filter(email='tony@starkindustries.com').delete()

    # 2. Ensure stages exist
    stage_new, _ = LeadStage.objects.get_or_create(name='New', defaults={'slug': 'new', 'order': 1})
    stage_qual, _ = LeadStage.objects.get_or_create(name='Qualified', defaults={'slug': 'qualified', 'order': 2})

    # 3. Create Custom Property Definition
    cp_def, created = CustomPropertyDefinition.objects.get_or_create(
        name='target_contract_value',
        defaults={
            'label': 'Target Contract Value',
            'field_type': 'currency',
            'section': 'sales',
            'is_mandatory': False,
        }
    )
    print(f"[OK] CustomPropertyDefinition created/verified: {cp_def.label} ({cp_def.field_type})")

    # 4. Create Lead with HubSpot Contact, Company, Qualification & Sales fields
    lead_payload = {
        'first_name': 'Tony',
        'last_name': 'Stark',
        'email': 'tony@starkindustries.com',
        'phone': '+1-212-555-0199',
        'mobile_phone': '+1-212-555-0188',
        'job_title': 'Chief Technology Officer',
        'department': 'R&D',
        'buying_role': 'DECISION_MAKER',
        'linkedin_url': 'https://linkedin.com/in/tonystark',
        
        'company_name': 'Stark Industries',
        'company_website': 'https://starkindustries.com',
        'industry': 'Defense & Advanced Tech',
        'company_size': '1000+',
        'annual_revenue': '50000000.00',
        'country': 'United States',
        'state': 'New York',
        'city': 'New York City',
        'address': '10880 Wilshire Blvd',

        'lead_score': 95,
        'buying_intent': 'HIGH',
        'estimated_budget': '10000000.00',
        'decision_maker': 'Tony Stark',
        'purchasing_timeline': 'IMMEDIATE',
        'customer_requirements': 'Next-gen Arc Reactor energy grid interface.',
        'competitor_info': 'Hammer Industries',
        'qualification_notes': 'High budget, authorized decision maker.',

        'lead_type': 'OUTBOUND',
        'priority': 'HIGH',
        'stage': stage_new.id,
        'assigned_to': user.id,

        'custom_properties': {
            'target_contract_value': '$10,000,000'
        }
    }

    create_ser = LeadCreateUpdateSerializer(data=lead_payload)
    if not create_ser.is_valid():
        print("[FAIL] LeadCreateUpdateSerializer validation failed:", create_ser.errors)
        sys.exit(1)

    lead = create_ser.save(created_by=user)
    print(f"[OK] Lead created: {lead.name} (ID: {lead.id})")
    assert lead.name == 'Tony Stark', f"Expected Tony Stark, got {lead.name}"
    assert lead.buying_intent == 'HIGH'
    assert lead.company_name == 'Stark Industries'

    # Verify custom property value was stored
    cp_val = CustomPropertyValue.objects.filter(lead=lead, property_def=cp_def).first()
    assert cp_val is not None, "Custom property value was not created!"
    assert cp_val.value == '$10,000,000'
    print(f"[OK] Custom Property Value verified: {cp_val.property_def.label} = {cp_val.value}")

    # 5. Verify LeadDetailSerializer serializes custom properties and all fields
    detail_ser = LeadDetailSerializer(lead)
    data = detail_ser.data
    assert data['first_name'] == 'Tony'
    assert data['last_name'] == 'Stark'
    assert data['company_name'] == 'Stark Industries'
    assert 'custom_properties' in data
    cp_item = next((p for p in data['custom_properties'] if p['name'] == 'target_contract_value'), None)
    assert cp_item is not None, "Custom property definition missing in serialized custom_properties list"
    assert cp_item['value_text'] == '$10,000,000' or cp_item['display_value'] == '$10,000,000'
    print("[OK] LeadDetailSerializer serialized all fields and custom_properties list correctly!")

    # 6. Test Stage Gating Rule (Cannot move to next stage until mandatory tasks are completed)
    # Define a mandatory stage task rule for stage_new
    rule, _ = StageTaskRule.objects.get_or_create(
        stage=stage_new,
        name='Verify Arc Reactor Specs Rule',
        defaults={'is_mandatory': True, 'title': 'Verify Arc Reactor Specs', 'due_offset_value': 2}
    )
    from django.utils import timezone
    # Ensure lead has this task
    task, _ = LeadStageTask.objects.get_or_create(
        lead=lead,
        stage=stage_new,
        title='Verify Arc Reactor Specs',
        defaults={
            'is_mandatory': True,
            'priority': 'HIGH',
            'status': 'PENDING',
            'due_date': timezone.now() + timezone.timedelta(days=2)
        }
    )
    task.status = 'PENDING'
    task.save()

    # Try advancing lead to stage_qual
    can_progress, missing_tasks, msg = check_stage_progression(lead, stage_qual, user)
    print(f"Progression check with pending mandatory task: can_progress={can_progress}, missing={len(missing_tasks)}, msg={msg}")
    assert not can_progress, "Lead should NOT be allowed to advance when mandatory stage task is pending!"
    assert len(missing_tasks) > 0, "Missing tasks list should not be empty"
    print("[OK] Stage gate blocked advancement successfully as required by CRM pipeline rules!")

    # Complete the mandatory task
    task.status = 'COMPLETED'
    task.save()

    can_progress_after, missing_after, msg_after = check_stage_progression(lead, stage_qual, user)
    print(f"Progression check with completed mandatory task: can_progress={can_progress_after}")
    assert can_progress_after, f"Lead should be allowed to advance after completing task, but got msg: {msg_after}"
    print("[OK] Stage gate allowed advancement after mandatory task completion!")

    # Clean up test artifacts
    lead.delete()
    cp_def.delete()
    print("=== ALL HUBSPOT CRM UPGRADE TESTS & PIPELINE CHECKS PASSED SUCCESSFULLY! ===")

if __name__ == '__main__':
    run_e2e_verification()
