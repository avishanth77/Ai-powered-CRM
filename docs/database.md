# CRM Lite — Relational Database Schema & ER Diagram

## 1. Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ Lead : "assigned_leads"
    User ||--o{ Lead : "created_leads"
    User ||--o{ Customer : "created_customers"
    User ||--o{ FollowUp : "assigned_followups"
    User ||--o{ LeadNote : "authored_notes"
    User ||--o{ ActivityLog : "performed_activities"

    LeadSource ||--o{ Lead : "leads"

    Lead ||--o| Customer : "customer_profile (OneToOne)"
    Lead ||--o{ FollowUp : "follow_ups"
    Lead ||--o{ LeadNote : "notes"

    Customer ||--o{ FollowUp : "customer_followups"

    User {
        int id PK
        string email UK
        string first_name
        string last_name
        string phone
        string role "ADMIN | MANAGER | EXECUTIVE"
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    LeadSource {
        int id PK
        string name UK
        text description
        boolean is_active
        datetime created_at
    }

    Lead {
        int id PK
        string name
        string phone INDEX
        string email INDEX
        string company_name
        int source_id FK
        string status INDEX "NEW | CONTACTED | DEMO_SCHEDULED | NEGOTIATION | QUALIFIED | WON | LOST"
        string priority "LOW | MEDIUM | HIGH | URGENT"
        int assigned_to_id FK INDEX
        decimal expected_value
        text address
        datetime created_at INDEX
        datetime updated_at
        datetime converted_at
        text lost_reason
    }

    Customer {
        int id PK
        int lead_id FK_UK
        string name
        string phone INDEX
        string email INDEX
        string company_name
        text address
        datetime converted_at INDEX
        int created_by_id FK
        datetime created_at
        datetime updated_at
    }

    FollowUp {
        int id PK
        int lead_id FK
        int customer_id FK
        int assigned_to_id FK INDEX
        datetime follow_up_at INDEX
        string purpose
        string status INDEX "PENDING | COMPLETED | CANCELLED | OVERDUE"
        text outcome
        datetime completed_at
        datetime created_at
        datetime updated_at
    }

    LeadNote {
        int id PK
        int lead_id FK
        int user_id FK
        string note_type "CALL | WHATSAPP | EMAIL | MEETING | DEMO | OBJECTION | GENERAL"
        text note_text
        datetime created_at
    }

    ActivityLog {
        int id PK
        string entity_type INDEX
        string entity_id INDEX
        string action INDEX
        json old_value
        json new_value
        text notes
        int performed_by_id FK
        datetime created_at INDEX
    }
```

## 2. Integrity & Deletion Rules

- **Lead -> Customer**: `OneToOneField` with `on_delete=models.PROTECT`. Deleting a lead that has been converted is prevented to protect financial history.
- **LeadSource -> Lead**: `models.SET_NULL`. Deleting a marketing channel preserves historical leads.
- **User -> Assigned Leads/FollowUps**: `models.SET_NULL`. If an employee leaves the company, historical assignments are cleared without deleting sales records.
- **Lead -> LeadNotes & FollowUps**: `models.CASCADE`. Deleting a raw prospecting lead cleans up its associated notes and follow-ups.

## 3. Database Indexing Strategy

Targeted composite and single-field B-Tree indexes are applied on:
1. `leads_lead.phone`: Fast deduplication lookup during lead creation.
2. `leads_lead.email`: Global search filter speedup.
3. `leads_lead.status`: Fast pipeline aggregation queries.
4. `leads_lead.assigned_to`: Executive role isolation filtering.
5. `leads_lead.created_at`: Monthly trends and date range reporting.
6. `followups_followup.follow_up_at` & `status`: Instant overdue task identification.
7. `activity_activitylog.entity_type` & `entity_id`: Real-time audit timeline retrieval for lead detail views.
