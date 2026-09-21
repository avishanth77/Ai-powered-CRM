# CRM Lite — Authentication & Session Architecture

## 1. Overview

CRM Lite uses industry-standard stateless **JSON Web Tokens (JWT)** via `djangorestframework-simplejwt`.

```
User Login -> POST /api/auth/login/ -> Receives { access, refresh, user }
                                            │
                                            ▼ Stored in localStorage
Axios Request -> Sends `Authorization: Bearer <access>`
     │
     ├─► If 200 OK: Process response
     └─► If 401 Unauthorized:
             │
             ├─► POST /api/auth/refresh/ with <refresh>
             ├─► If Refresh 200: Update <access> and replay original request
             └─► If Refresh Fails: Clear tokens and redirect to /login
```

## 2. JWT Configuration (`backend/config/settings.py`)

- **Access Token Lifetime**: 60 minutes (configurable via `JWT_ACCESS_LIFETIME_MINUTES` in `.env`)
- **Refresh Token Lifetime**: 7 days (configurable via `JWT_REFRESH_LIFETIME_DAYS` in `.env`)
- **Token Rotation**: Enabled (`ROTATE_REFRESH_TOKENS = True`)
- **Custom Claims**:
  - `user_id`: Integer ID
  - `email`: User's unique email address
  - `role`: Role (`ADMIN`, `MANAGER`, `EXECUTIVE`)
  - `name`: Full display name

## 3. Client-Side Axios Refresh Queue

To prevent race conditions when multiple API requests trigger a 401 simultaneously:
1. An `isRefreshing` flag locks subsequent 401 requests into a `failedQueue`.
2. A single refresh request is sent to `/api/auth/refresh/`.
3. Once the new access token arrives, all queued promises are resolved with the new token and re-executed in parallel.
