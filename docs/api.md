# CRM Lite — REST API Reference

All protected endpoints require the HTTP header:
`Authorization: Bearer <access_token>`

Interactive Swagger UI documentation is available at:
`http://localhost:8000/api/docs/`

---

## 1. Authentication Endpoints

### POST `/api/auth/login/`
Authenticates user and returns JWT pair and profile summary.
- **Request Body**: `{"email": "...", "password": "..."}`
- **Response**: `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access": "eyJhbGciOiJIUzI1Ni...",
    "refresh": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "id": 1,
      "email": "admin@crmlite.com",
      "first_name": "Eleanor",
      "last_name": "Vance",
      "role": "ADMIN"
    }
  }
}
```

### POST `/api/auth/refresh/`
Issues a new access token using a valid refresh token.
- **Request Body**: `{"refresh": "..."}`
- **Response**: `200 OK` with `{"access": "..."}`

### GET `/api/auth/me/`
Returns currently authenticated user profile.

### POST `/api/auth/logout/`
Logs out and optionally blacklists the refresh token.

---

## 2. Lead Management Endpoints

| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `GET` | `/api/leads/` | List leads (filtered, searched, paginated) | All (scoped) |
| `POST` | `/api/leads/` | Create a new lead record | All |
| `GET` | `/api/leads/{id}/` | Retrieve lead profile details | Admin, Manager, Assigned Rep |
| `PATCH` | `/api/leads/{id}/` | Update lead contact or stage | Admin, Manager, Assigned Rep |
| `DELETE` | `/api/leads/{id}/` | Permanently remove lead | Admin only |
| `POST` | `/api/leads/{id}/convert/` | Convert QUALIFIED lead to Customer | Admin, Manager |
| `POST` | `/api/leads/{id}/assign/` | Reassign lead to a sales rep | Admin, Manager |
| `GET` | `/api/leads/{id}/notes/` | List communication notes | Admin, Manager, Assigned Rep |
| `POST` | `/api/leads/{id}/notes/` | Add a communication note | Admin, Manager, Assigned Rep |
| `GET` | `/api/leads/{id}/timeline/` | Retrieve chronological audit trail | Admin, Manager, Assigned Rep |
| `GET` | `/api/leads/{id}/ai_summary/`| AI synthesis of notes & next action | Admin, Manager, Assigned Rep |
| `GET` | `/api/leads/pipeline/` | Get leads grouped by status stage | All (scoped) |

### Query Parameters for `/api/leads/`:
- `status`: `NEW`, `CONTACTED`, `DEMO_SCHEDULED`, `NEGOTIATION`, `QUALIFIED`, `WON`, `LOST`
- `priority`: `LOW`, `MEDIUM`, `HIGH`, `URGENT`
- `source`: Integer ID of LeadSource
- `assigned_to`: Integer User ID
- `keyword`: Search across `name`, `phone`, `email`, and `company_name`
- `page`: Page number (default: 1)
- `page_size`: Records per page (default: 20)

---

## 3. Customer Endpoints

| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `GET` | `/api/customers/` | List converted customer accounts | All |
| `GET` | `/api/customers/{id}/` | Retrieve customer account details | All |
| `PATCH` | `/api/customers/{id}/` | Update customer billing info | Admin, Manager |

---

## 4. Follow-up Endpoints

| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `GET` | `/api/follow-ups/` | List scheduled follow-ups | All (scoped) |
| `POST` | `/api/follow-ups/` | Schedule new follow-up | All |
| `POST` | `/api/follow-ups/{id}/complete/` | Complete follow-up & log outcome | Assigned Rep, Manager, Admin |
| `GET` | `/api/follow-ups/overdue/` | List all overdue follow-ups | All (scoped) |
| `GET` | `/api/follow-ups/today/` | List tasks scheduled for today | All (scoped) |

---

## 5. Reports & Analytics Endpoints

| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `GET` | `/api/reports/summary/` | Real-time KPI summary & charts | All (scoped) |
| `GET` | `/api/reports/export/?format=csv` | Download CSV performance report | Admin, Manager |

---

## 6. User Management Endpoints

| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `GET` | `/api/users/` | List active team members | Admin, Manager |
| `POST` | `/api/users/` | Create a new user account | Admin only |
| `PATCH` | `/api/users/{id}/` | Update user details or role | Admin only |
| `DELETE` | `/api/users/{id}/` | Deactivate/delete user account | Admin only |
