# CRM Lite — Testing Strategy & Verification Guide

## 1. Automated Test Suite

The automated test suite runs via Django's test runner (`manage.py test`). It validates end-to-end business rules, permission boundaries, model validations, and calculations in an isolated in-memory database.

### Running Backend Tests:
```powershell
python backend/manage.py test accounts leads followups
```

## 2. Test Coverage Breakdown

### `accounts/tests.py`
- **Valid Login**: Authenticates valid credentials, returns JWT tokens and user payload.
- **Invalid Login**: Rejects invalid password with structured 401 Unauthorized response.
- **Unauthenticated Protected API**: Verifies unauthorized requests are rejected on `/api/auth/me/`.
- **Authenticated Me Endpoint**: Validates profile data and user role retrieval.

### `leads/tests.py`
- **Executive Isolation**: Verifies that a Sales Executive cannot view other executives' leads in listing queries.
- **Executive Direct Access Rejection**: Verifies that directly retrieving another executive's lead returns 404/403.
- **Manager Team Visibility**: Verifies that a Sales Manager can access all team leads across all executives.
- **Manager Assignment**: Verifies that a Sales Manager can assign and reassign leads.
- **Executive Assignment Forbidden**: Verifies that an Executive cannot assign or reassign leads (403 Forbidden).
- **Phone Deduplication**: Verifies that creating a lead with an existing phone number returns 400 Bad Request.
- **Negative Expected Value**: Verifies that negative values are rejected.
- **Mandatory Lost Reason**: Verifies that setting status to LOST without a reason fails validation.
- **Qualified Lead Conversion**: Verifies atomic transaction creating a Customer record, updating lead status to WON, setting `converted_at`, and recording activity log.
- **Unqualified Lead Conversion Rejection**: Verifies that non-QUALIFIED leads cannot convert (400 Bad Request).
- **Duplicate Conversion Rejection**: Verifies that a converted lead cannot be converted a second time.
- **Dashboard Summary Aggregation**: Verifies that real database counts match the aggregated KPI payload.
- **CSV Export Verification**: Verifies that `/api/reports/export/?format=csv` generates a valid downloadable CSV file with correct headers.

### `followups/tests.py`
- **Past Date Prevention**: Verifies that newly scheduled follow-ups cannot have a past date/time.
- **Future Follow-up Scheduling**: Validates standard scheduling.
- **Follow-up Completion with Outcome**: Verifies outcome recording, status update to COMPLETED, and `completed_at` timestamping.

## 3. Frontend Build Validation

To verify JSX syntax, CSS imports, and production bundle generation:
```powershell
cd frontend
npm run build
```
