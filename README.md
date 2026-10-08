# CRM Lite — Customer Follow-Up & Lead Management Web App

![Python](https://img.shields.io/badge/Python-3.14-blue.svg)
![Django](https://img.shields.io/badge/Django-6.1-green.svg)
![DRF](https://img.shields.io/badge/Django_REST_Framework-3.18-red.svg)
![React](https://img.shields.io/badge/React-19-cyan.svg)
![Vite](https://img.shields.io/badge/Vite-8.3-purple.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Ready-blue.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

A complete, production-grade CRM web application engineered for sales teams to track prospects, manage interaction follow-ups, visualize deals across a sales pipeline, convert qualified leads into customers with atomic transactions, and analyze performance with real-time KPI dashboards and CSV reports.

---

## Table of Contents

1. [Key Features](#key-features)
2. [Technology Stack](#technology-stack)
3. [System Architecture](#system-architecture)
4. [User Roles & Permissions](#user-roles--permissions)
5. [Installation & Local Setup](#installation--local-setup)
6. [Database Setup & Seed Data](#database-setup--seed-data)
7. [Default User Credentials](#default-user-credentials)
8. [Running the Application](#running-the-application)
9. [API Documentation (Swagger UI)](#api-documentation)
10. [Automated Testing](#automated-testing)
11. [Optional Microservice (FastAPI)](#optional-fastapi-search-microservice)
12. [Project Documentation Directory](#project-documentation-directory)

---

## 1. Key Features

- **End-to-End Sales Pipeline**: Visual Kanban board (`NEW` → `CONTACTED` → `DEMO_SCHEDULED` → `NEGOTIATION` → `QUALIFIED` → `WON` or `LOST`).
- **Atomic Customer Conversion**: Convert qualified leads to official customers inside a safe `transaction.atomic()` block, preserving original notes, activities, and communication logs.
- **Smart Follow-Up Engine**: Schedule future interactions with automated overdue detection, today's schedule alerts, and outcome completion logging.
- **Communication Timeline**: Chronological activity audit trail and interaction notes (`CALL`, `WHATSAPP`, `EMAIL`, `MEETING`, `DEMO`, `OBJECTION`, `GENERAL`).
- **Real-Time KPI Dashboard**: Zero hardcoded stats. Aggregates conversion rate %, total expected value, overdue counts, monthly trends, and stage breakdowns directly from the database.
- **Reporting & CSV Export**: User performance summaries and filtered streaming CSV report downloads.
- **AI Lead Synthesis (Optional Feature)**: Summarizes prospect requirements, objections, and next recommended actions clearly labeled with AI disclaimers.
- **Federated Search Microservice (Optional Feature)**: Ultra-low-latency global prospect search using FastAPI.

---

## 2. Technology Stack

### Backend
- **Core**: Python, Django 6.x, Django REST Framework 3.18
- **Authentication**: JWT via `djangorestframework-simplejwt`
- **Filtering & Search**: `django-filter`, DRF SearchFilter & OrderingFilter
- **Documentation**: OpenAPI 3.0 via `drf-spectacular`
- **Database**: PostgreSQL (Production) / SQLite (Zero-config local development)

### Frontend
- **Framework**: React 19 + Vite
- **Routing**: React Router v7
- **HTTP Client**: Axios with automatic token refresh on 401
- **Design System**: Vanilla/Plain CSS (No Tailwind CSS) with modern dark glassmorphism, responsive grids, and Google Fonts (`Plus Jakarta Sans` & `Outfit`).
- **Icons**: `lucide-react`

---

## 3. System Architecture

```
Client Browser (React SPA on Vite :5173)
       │
       │ HTTP / Axios (Bearer JWT)
       ▼
Django REST Framework (:8000)
 ├── /api/auth/        (Login, Refresh, Me, Logout)
 ├── /api/leads/       (CRUD, Kanban Pipeline, Notes, Conversion, Timeline)
 ├── /api/customers/   (Converted Customer Accounts)
 ├── /api/follow-ups/  (Scheduling, Overdue Engine, Completion)
 ├── /api/reports/     (Real-time KPIs, CSV Export)
 ├── /api/users/       (Team Member Management)
 └── /api/docs/        (Swagger UI & OpenAPI Schema)
       │
       ▼
Relational Database (PostgreSQL / SQLite)
```

---

## 4. User Roles & Permissions

CRM Lite enforces strict backend permissions across three distinct tiers:

| Feature / Action | Admin / Mentor | Sales Manager | Sales Executive |
|---|:---:|:---:|:---:|
| User Management | Full Control | View Only | No Access |
| Lead Visibility | All Leads | All Team Leads | Assigned / Created Only |
| Lead Creation & Notes | Yes | Yes | Yes |
| Lead Assignment / Reassignment | Yes | Yes | Forbidden (403) |
| Customer Conversion | Yes | Yes | Forbidden (403) |
| Delete Lead Record | Yes | Forbidden (403) | Forbidden (403) |
| View Performance Reports | Org-Wide | Team-Wide | Own Metrics Only |
| Export Reports to CSV | Yes | Yes | Forbidden (403) |

---

## 5. Installation & Local Setup

### Prerequisites
- Python 3.10+ (Python 3.14 recommended)
- Node.js 18+ and npm 9+
- Git

### 1. Clone Repository & Setup Virtual Environment
```powershell
git clone <repository-url>
cd "final project ai"

# Create and activate Python virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1   # On Windows
# source venv/bin/activate    # On Linux/macOS
```

### 2. Install Backend Dependencies
```powershell
pip install -r backend/requirements.txt
```

### 3. Install Frontend Dependencies
```powershell
cd frontend
npm install
cd ..
```

---

## 6. Database Setup & Seed Data

### 1. Apply Django Migrations
```powershell
python backend/manage.py migrate
```

### 2. Populate Development Seed Data
Generates realistic user accounts, active lead sources, sample leads in various pipeline stages, scheduled follow-ups, and activity logs:
```powershell
python backend/manage.py seed_data
```

---

## 7. Default User Credentials

| Role | Email | Password |
|---|---|---|
| **Admin / Mentor** | `admin@crmlite.com` | `Admin@123` |
| **Sales Manager** | `manager@crmlite.com` | `Manager@123` |
| **Sales Executive** | `alex@crmlite.com` | `Alex@123` |
| **Sales Executive** | `sarah@crmlite.com` | `Sarah@123` |

*(The login page also provides 1-click demo buttons to automatically populate these credentials for quick review.)*

---

## 8. Running the Application

### Start Backend Server:
```powershell
python backend/manage.py runserver 8000
```
API runs at: `http://127.0.0.1:8000/api/`

### Start Frontend Dev Server:
```powershell
cd frontend
npm run dev
```
Web app runs at: `http://localhost:5173/`

---

## 9. API Documentation

Interactive Swagger documentation is auto-generated by `drf-spectacular`:
- **Swagger UI**: [http://127.0.0.1:8000/api/docs/](http://127.0.0.1:8000/api/docs/)
- **Redoc UI**: [http://127.0.0.1:8000/api/redoc/](http://127.0.0.1:8000/api/redoc/)
- **OpenAPI 3.0 Schema**: [http://127.0.0.1:8000/api/schema/](http://127.0.0.1:8000/api/schema/)

---

## 10. Automated Testing

Run the automated test suite covering authentication, role isolation, lead CRUD, past follow-up rejection, and atomic customer conversion:
```powershell
python backend/manage.py test accounts leads followups
```

Build and validate the frontend production bundle:
```powershell
cd frontend
npm run build
```

---

## 11. Optional FastAPI Search Microservice

CRM Lite includes an optional standalone search microservice for sub-10ms federated prospect queries:

### Running the Search Service:
```powershell
uvicorn fastapi_service.main:app --port 8001 --reload
```
Test global search endpoint:
```
GET http://localhost:8001/search/?q=Apex
```

---

## 12. Project Documentation Directory

Detailed technical architectural specifications are available in `docs/`:
- [Architecture & Design Decisions](docs/architecture.md)
- [Database Schema & ER Diagram](docs/database.md)
- [Complete REST API Reference](docs/api.md)
- [Authentication & Token Refresh](docs/authentication.md)
- [Permissions & RBAC Matrix](docs/permissions.md)
- [Testing & Quality Assurance](docs/testing.md)
- [Production Deployment Guide](docs/deployment.md)
