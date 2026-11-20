# Master Project Context Memory: Texol CRM Lite (AI-Powered B2B CRM)

> **Document Version**: 2.5 (Consolidated)  
> **Last Synchronized**: November 2026  
> **Target Environment**: Production (Render + Neon + Vercel) & Local Development (Windows / PowerShell)  
> **Primary Git Repository**: `https://github.com/avishanth77/Ai-powered-CRM.git`  
> **Active Tracking Branches**: `main` (Production), `dev-new` (Active Feature Branch)

---

## 1. Executive Summary & Project Purpose

**Texol CRM Lite** is an enterprise-grade, AI-augmented B2B Customer Relationship Management (CRM) platform engineered for high-velocity sales teams. It manages the complete revenue lifecycle—from multi-channel lead capture (Web-to-Lead, Telegram bot, CSV import, manual entry) to qualification (ICP and PLD discovery), visual pipeline stage traversal, automated stage tasks, custom field gathering, product quoting, and atomic customer conversion.

### Core Value Pillars
1. **Dynamic Sales Funnel**: Fully configurable stages, win probabilities, funnel stage reasons, and stage-specific custom properties.
2. **Enforced Progression Gates**: Leads cannot skip stages without fulfilling mandatory stage tasks, Ideal Customer Profile (ICP) validation, and required fields.
3. **Decoupled Quoting Engine**: Independent Expected Deal Value combined with customizable product line items, quantities, and discounts.
4. **Omnichannel Communication**: In-app team chat, Telegram bot alerts, automated email OTP password resets via Resend HTTPS API, and public webhooks.
5. **Zero-Cost Production Ready**: Cloud deployment architecture configured across Render (Django backend), Neon Serverless PostgreSQL, and Vercel (React SPA).

---

## 2. High-Level Architecture & Tech Stack

```mermaid
graph TD
    subgraph Client Tier
        VercelSPA[React 19 + Vite SPA]
        Webhooks[Public Web-to-Lead Forms]
        Telegram[Telegram Bot Clients]
    end

    subgraph API Gateway & Security
        CORS[CORS Headers Middleware]
        WhiteNoise[WhiteNoise Static Engine]
        JWTAuth[SimpleJWT Authentication + Blacklist]
    end

    subgraph Application Tier Django 6.x
        AccountsApp[accounts: RBAC & OTP]
        LeadsApp[leads: Pipeline, Stages, Custom Fields]
        ProductsApp[products: Catalog & Quotations]
        ICPApp[icp: Scoring & Gates]
        PLDApp[pld: Discovery Rules]
        FollowupsApp[followups & stage_tasks]
        ChatApp[chat: Peer Messaging]
        ReportsApp[reports: KPI & Analytics]
        TelegramApp[telegram_bot: Webhooks]
        AIApp[ai: LLM Call Summaries]
    end

    subgraph Data Tier
        NeonDB[(Neon PostgreSQL Serverless / SQLite)]
        ResendAPI[Resend HTTPS Email API]
    end

    VercelSPA -->|JWT Bearer Tokens| CORS
    Webhooks -->|Public POST /api/leads/web-to-lead/| CORS
    Telegram -->|Webhook POST /api/telegram/| TelegramApp

    CORS --> JWTAuth
    JWTAuth --> AccountsApp
    JWTAuth --> LeadsApp
    JWTAuth --> ProductsApp
    JWTAuth --> ICPApp
    JWTAuth --> PLDApp
    JWTAuth --> FollowupsApp
    JWTAuth --> ChatApp
    JWTAuth --> ReportsApp
    JWTAuth --> AIApp

    AccountsApp --> NeonDB
    LeadsApp --> NeonDB
    ProductsApp --> NeonDB
    ICPApp --> NeonDB
    AccountsApp --> ResendAPI
```

### Technology Matrix
| Layer | Technologies / Packages | Notes & Configuration |
| :--- | :--- | :--- |
| **Backend Framework** | Django 6.x, Django REST Framework 3.18 | Python 3.12 / 3.14 compatible, Gunicorn WSGI |
| **Authentication** | `rest_framework_simplejwt` | 60-min access tokens, 7-day refresh with blacklisting |
| **Database** | PostgreSQL (Neon / Supabase), SQLite (Local) | `dj-database-url` with automated SSL enforcement |
| **Email Delivery** | Resend HTTPS API (`resend`), Fallback SMTP | Bypasses Render/cloud outbound port 25/587 blocks |
| **Frontend Framework** | React 19, Vite 8.x | React Router v7, Context API (`Auth`, `Theme`, `Toast`) |
| **UI Components & Icons** | Vanilla CSS, `lucide-react` | Glassmorphic dark/light design system, no bulky CSS frameworks |
| **Testing & Automation** | Playwright, Pytest, Django Test Runner | End-to-end automated browser verification |
| **Static Assets** | WhiteNoise 6.9 | Gzipped / Brotli compressed static assets |

---

## 3. Local Development & Operational Setup

### Running Local Services

```powershell
# 1. Backend (Django) - Port 8000
cd "d:\texol\final project ai"
python backend/manage.py migrate
python backend/manage.py runserver 127.0.0.1:8000

# 2. Frontend (Vite) - Port 5174 (Port 5173 reserved/avoided)
npm --prefix frontend run dev -- --port 5174
```

### Default Credentials & Test Accounts
| Role | Email Address | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@crmlite.com` | `Admin@123` (or `admin12345`) | Full system access, settings, stages, users, assignment rules |
| **Sales Manager** | `manager@crmlite.com` | `Manager@123` | Pipeline override, task reassignment, conversions, reports |
| **Sales Executive** | `sales@crmlite.com` | `Sales@123` | Assigned lead operations, stage tasks, ICP questions, notes |

---

## 4. Key Functional Modules & Business Logic

### A. Dynamic Lead Stages & Pipeline Customization
- **Model**: `LeadStage` (`backend/leads/models.py`)
- **Properties**: `name`, `slug`, `display_order`, `color`, `win_probability` (0–100%), `win_probability_reason`, `is_system`, `is_active`.
- **Features**:
  - Drag-and-drop Kanban pipeline board with win-probability weighted deal values.
  - Safe deletion: Requires transferring active leads to an alternate active stage before deletion.

### B. Admin-Customizable Stage Custom Input Fields
- **Models**:
  - `CustomPropertyDefinition`: Linked via `stage = models.ForeignKey(LeadStage, null=True, blank=True)` and `section = 'stage'`.
  - `CustomPropertyValue`: EAV store holding `value_text` and `value_json`.
- **Supported Field Types**: `text`, `number`, `dropdown`, `multi_select`, `checkbox`, `date`, `currency`, `textarea`, `url`, `email`, `phone`.
- **Admin Management**: `StageCustomFieldsManager.jsx` at `/settings?tab=stage-fields`.
- **Rep In-Tab Card**: `StageCustomFieldsCard.jsx` in `HubSpotOverviewTab.jsx`.
- **Serializer Support**: `LeadCreateUpdateSerializer` accepts `stage_custom_properties` as a write-only dictionary and persists values via `_save_custom_properties(lead, stage_custom_props)`.

### C. Ideal Customer Profile (ICP) Qualification Engine
- **Models**: `ICPQuestion`, `ICPResponse` (`backend/icp/models.py`).
- **Scoring & Status**:
  - `QUALIFIED` (Score >= 70% of max threshold).
  - `DISQUALIFIED` (Fails critical disqualifying answers).
  - `NOT_TESTED` (Pending rep evaluation).
- **Overview Tab Embedding**: `IcpOverviewCard.jsx` renders directly inside the Overview tab when a lead is in the `icp` stage.
- **Stage Gating**: `check_stage_progression` blocks leads from advancing beyond `icp` unless status is `QUALIFIED`.

### D. Stage Tasks & Automated Progression Rules
- **Models**: `LeadStageTask`, `StageTaskRule` (`backend/leads/models.py`).
- **Trigger**: Entering a stage automatically provisions tasks assigned to the lead's owner based on `StageTaskRule`.
- **Gating**: Mandatory stage tasks block pipeline advance until completed.

### E. Products & Decoupled Expected Deal Value
- **Models**: `Product`, `LeadProduct` (`backend/products/models.py`).
- **Design Decision**: `expected_value` on `Lead` can be manually adjusted without being strictly constrained by catalog unit prices. Reps can specify product quantities (units needed) and custom discounted rates.

### F. Lead Dashboard Monetary Metrics
- **Location**: `Leads.jsx` & `reports/views.py`.
- **Cards**: Total Leads, New Prospects, Total Leads Qualified, and High Priority leads, each displaying both **count** and **total monetary value** formatted in regional currency ($).

---

## 5. Database Schema & Key Relationships

```mermaid
erDiagram
    User ||--o{ Lead : "assigned_to / created_by"
    User ||--o{ LeadNote : "authors"
    User ||--o{ ChatMessage : "sends"
    
    LeadStage ||--o{ Lead : "current stage"
    LeadStage ||--o{ CustomPropertyDefinition : "owns stage fields"
    LeadStage ||--o{ StageTaskRule : "defines auto-tasks"
    
    Lead ||--o{ CustomPropertyValue : "stores field values"
    CustomPropertyDefinition ||--o{ CustomPropertyValue : "defines structure"
    
    Lead ||--o{ LeadStageTask : "tracked tasks"
    Lead ||--o{ LeadProduct : "attached products"
    Product ||--o{ LeadProduct : "catalog item"
    
    Lead ||--o{ ICPResponse : "qualification answers"
    ICPQuestion ||--o{ ICPResponse : "evaluates"
    
    Lead ||--o| Customer : "converts to"
```

---

## 6. Frontend Route & Component Directory Map

```text
frontend/src/
├── api/
│   ├── api.js                   # Axios client with JWT refresh interceptor
│   ├── authApi.js               # Login, register, profile, OTP reset
│   ├── leadApi.js               # Leads, stages, custom properties, handovers
│   ├── chatApi.js               # Peer chat, messaging history, unread counts
│   └── followupApi.js           # Overdue reminders, follow-ups
├── components/
│   ├── Navbar.jsx               # Global search, theme toggle, chat badge, user menu
│   ├── Sidebar.jsx              # Navigation menu with role guards
│   ├── StageCustomFieldsManager.jsx # Admin stage custom fields manager
│   ├── StageTasksManager.jsx    # Admin automated task rules
│   ├── IcpQuestionsManager.jsx  # Admin ICP qualification question builder
│   ├── ProductSelector.jsx      # Product line items with quantity inputs
│   └── hubspot/
│       ├── HubSpotOverviewTab.jsx   # Lead Details Overview
│       ├── StageCustomFieldsCard.jsx# Rep stage fields card
│       └── IcpOverviewCard.jsx      # Interactive ICP questionnaire card
├── pages/
│   ├── Dashboard.jsx            # KPI cards, conversion funnels, recent activity
│   ├── Leads.jsx                # Lead table, monetary summary cards, filters
│   ├── LeadDetails.jsx          # Tabbed lead hub (Overview, Activities, Tasks)
│   ├── Pipeline.jsx             # Visual drag-and-drop Kanban board
│   ├── Settings.jsx             # Lead stages, custom fields, sources, web-to-lead
│   └── Chat.jsx                 # Real-time internal team messenger
```

---

## 7. Cloud Deployment & Environment Variables

### Production Topology
- **Backend**: Render Web Service running `gunicorn config.wsgi:application --bind 0.0.0.0:$PORT` via `backend/build.sh`.
- **Database**: Neon Serverless PostgreSQL with SSL mode `require`.
- **Frontend**: Vercel Single Page Application with rewrite rule `/* -> /index.html`.

### Essential Environment Variables
```env
# Backend (.env)
DJANGO_SECRET_KEY="<production-random-secret>"
DEBUG=False
ALLOWED_HOSTS=".onrender.com,localhost,127.0.0.1"
DATABASE_URL="postgresql://user:password@ep-xyz.neon.tech/crm_lite?sslmode=require"
CORS_ALLOWED_ORIGINS="https://your-crm.vercel.app,http://localhost:5174"
CORS_ALLOW_ALL_ORIGINS=True

# Resend HTTPS Email API (Bypasses SMTP port blocks)
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxx"
DEFAULT_FROM_EMAIL="onboarding@resend.dev"

# Frontend (.env)
VITE_API_BASE_URL="https://your-crm-backend.onrender.com"
```

---

## 8. Git Commit Milestones & History

| Commit Hash | Commit Message Summary |
| :--- | :--- |
| **`a1f62d3`** | `fix(leads): declare stage_custom_properties on LeadCreateUpdateSerializer to resolve 500 on stage transition` |
| **`8c6913c`** | `feat(pipeline): add admin-customizable stage custom input fields with add/remove management` |
| **`acb5278`** | `feat(icp): render ICP qualification questions directly in Overview tab when lead is in ICP stage` |
| **`06a1f93`** | `feat(ui): remove Problem-Led Discovery (PLD) from lead details and lead management pages` |
| **`12d916e`** | `feat: ignore video media, add customizable pricing, lead dashboard monetary metrics, and auto-task assigning` |
| **`46a1259`** | `fix(mail): force Resend HTTPS backend on Render and prevent fallback to blocked SMTP port 587` |
| **`d778814`** | `feat(email): add Resend HTTPS API backend to bypass cloud SMTP port blocks` |
| **`2559550`** | `feat(deploy): configure zero-cost production hosting with Render, Vercel, Neon, and WhiteNoise` |
