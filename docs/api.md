# CRM Lite — REST API Reference

All protected endpoints require the HTTP header:
`Authorization: Bearer <access_token>`

Interactive Swagger UI documentation is available at:
`http://127.0.0.1:8000/api/docs/`

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

---

## 7. ICP Qualification Endpoints

Questions are fully admin-configurable — nothing about the test is hard-coded on the frontend.
All scores are computed by the backend from the stored configuration; the score sent by the
client is never trusted.

### Question Management

| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `GET` | `/api/icp/questions/` | List questions (active only; add `?include_inactive=true` to see all) | All |
| `POST` | `/api/icp/questions/` | Create a question with options / scoring rules | Admin, Manager |
| `GET` | `/api/icp/questions/{id}/` | Retrieve a single question | All |
| `PUT` | `/api/icp/questions/{id}/` | Update a question and its scoring | Admin, Manager |
| `DELETE` | `/api/icp/questions/{id}/` | Delete a question (history is unaffected) | Admin, Manager |
| `PATCH` | `/api/icp/questions/{id}/toggle-active/` | Activate / deactivate a question | Admin, Manager |
| `PATCH` | `/api/icp/questions/{id}/move/` | Reorder — body `{"direction": "up" \| "down"}` | Admin, Manager |

Supported question types: `SINGLE_CHOICE`, `MULTI_CHOICE`, `YES_NO`, `NUMBER`, `TEXT`, `DROPDOWN`.

- Choice types take `options: [{option_text, points}]`. `max_points` is derived automatically
  (highest option for single-choice/dropdown/yes-no, **sum** for multiple-choice).
- `NUMBER` takes `scoring_rules: [{min, max, points}]`; the first matching range wins. Leave
  `min` or `max` as `null` for an open range.
- `TEXT` uses `max_points` as flat points awarded when answered.

### Scoring Thresholds

| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `GET` | `/api/icp/config/` | Read Poor / Potential / Good Fit cut-offs | All |
| `PUT` | `/api/icp/config/` | Update cut-offs (`poor_fit_max`, `potential_fit_max`, `good_fit_max`) | Admin, Manager |

### Running the Test & History

| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `GET` | `/api/leads/{id}/icp/` | Active questions in display order + current ICP status | Lead access |
| `POST` | `/api/leads/{id}/icp/qualify/` | Submit answers; backend scores, saves and returns the result | Lead access |
| `GET` | `/api/leads/{id}/icp/history/` | All past attempts, newest first | Lead access |
| `GET` | `/api/icp/qualifications/{id}/` | One attempt with the frozen question/answer snapshot | Lead access |

Submit body — only raw answers, never scores:

```json
{ "answers": [ { "question_id": 1, "value": "4" },
               { "question_id": 2, "value": "Yes" },
               { "question_id": 3, "value": ["7", "9"] } ] }
```

Classification: `percentage = (total_score / max_score) × 100`, then
`≤ poor_fit_max → Poor Fit`, `≤ potential_fit_max → Potential Fit`, `≤ good_fit_max → Good Fit`,
otherwise `Strong ICP Fit`.

Each submission stores a **snapshot** of the question text, options and points used at that
moment, so later edits to the question set never change historical results. `Lead.icp_status`
tracks the most recent attempt and is filterable via `GET /api/leads/?icp_status=STRONG_ICP_FIT`.
