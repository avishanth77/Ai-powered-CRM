# CRM Lite — Production Hosting & Deployment Architecture Guide

This comprehensive guide details exactly how the **CRM Lite** platform (Django DRF Backend + React Vite SPA Frontend + PostgreSQL Database) is deployed and hosted in production.

---

## Architecture Overview

```
                                      ┌────────────────────────────────────────────────────────┐
                                      │                      End Users                         │
                                      └──────────────────────────┬─────────────────────────────┘
                                                                 │
                                         HTTPS (Port 443)        │        HTTPS (Port 443)
                                ┌────────────────────────────────┴─────────────────────────────┐
                                │                                                              │
                                ▼                                                              ▼
               ┌─────────────────────────────────┐                           ┌──────────────────────────────────┐
               │         Frontend Layer          │                           │          Backend Layer           │
               │         Hosted on VERCEL        │                           │         Hosted on RENDER         │
               │                                 │                           │                                  │
               │  • React 18 / Vite 8 SPA        │    REST API Calls (JWT)   │  • Django 5 / Django REST        │
               │  • Global Edge CDN              │──────────────────────────▶│  • Gunicorn WSGI Server          │
               │  • Client-side SPA routing      │   CORS Allowed (*.vercel) │  • WhiteNoise Static Assets      │
               │  • Auto-deploys from Git        │                           │  • Auto-deploys via build.sh     │
               └─────────────────────────────────┘                           └─────────────────┬────────────────┘
                                                                                               │
                                                                 ┌─────────────────────────────┴─────────────────────────────┐
                                                                 │                                                           │
                                                                 ▼                                                           ▼
                                                ┌─────────────────────────────────┐         ┌─────────────────────────────────┐
                                                │         Database Layer          │         │         Email Service           │
                                                │       PostgreSQL on Cloud       │         │        RESEND HTTPS API         │
                                                │   (Render / Neon / Supabase)    │         │                                 │
                                                │                                 │         │  • Outbound HTTPS Port 443      │
                                                │  • Connected via DATABASE_URL   │         │  • Custom ResendEmailBackend    │
                                                │  • SSL Connection Required      │         │  • Overcomes Render Port 587    │
                                                │  • Auto migrations on deploy    │         │    firewall block (Errno 101)   │
                                                └─────────────────────────────────┘         └─────────────────────────────────┘
```

---

## 1. Frontend Hosting: Vercel

The frontend is a decoupled Single Page Application (SPA) built with **Vite** and **React 18**, hosted on **Vercel** with worldwide edge CDN caching.

### Key Deployment Settings

| Setting | Value | Description |
| :--- | :--- | :--- |
| **Framework Preset** | `Vite` | Standard Vite React build setup |
| **Root Directory** | `frontend` | Points Vercel build to the `frontend/` subdirectory |
| **Build Command** | `npm run build` | Compiles JavaScript/CSS into `frontend/dist/` |
| **Output Directory** | `dist` | Production assets folder |
| **Node.js Version** | `18.x` or `20.x` | Modern LTS Node environment |

### SPA Routing (`vercel.json`)
Because React Router handles routing in the browser (`/dashboard`, `/leads`, `/pipeline`, `/chat`, etc.), reloading non-root paths on a static server would result in 404 errors. This is solved by the `frontend/vercel.json` file:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Frontend Environment Variables (Vercel Project Settings)

| Variable | Example Value | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://crm-lite-api.onrender.com` | Live URL of the Render Django backend (no trailing slash) |

---

## 2. Backend Hosting: Render Web Service

The backend is a **Django REST Framework** service running inside a Linux container on **Render**.

### Key Service Settings

| Setting | Value |
| :--- | :--- |
| **Service Type** | Web Service |
| **Environment** | Python 3 |
| **Region** | Oregon (US West) or Singapore / Frankfurt (Closest to DB) |
| **Branch** | `features` (or `main`) |
| **Build Command** | `./build.sh` |
| **Start Command** | `gunicorn config.wsgi:application --chdir backend --bind 0.0.0.0:$PORT` |

---

## 3. Automated Build & Migration Pipeline (`build.sh`)

Every time code is pushed to your Git repository, Render triggers `./build.sh` automatically:

```bash
#!/usr/bin/env bash
# Exit on error
set -o errexit

cd backend
# 1. Install production dependencies
pip install -r requirements.txt

# 2. Collect static files for WhiteNoise
python manage.py collectstatic --noinput

# 3. Apply database migrations
python manage.py migrate

# 4. Bootstrap Superuser (Preserving credentials on rebuilds)
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'admin@crm.com').strip()
username = os.getenv('DJANGO_SUPERUSER_USERNAME', 'admin').strip()
password = os.getenv('DJANGO_SUPERUSER_PASSWORD', 'admin12345').strip()
user = User.objects.filter(is_superuser=True).first()
if not user:
    user = User.objects.create_superuser(email=email, username=username, password=password, first_name='Admin', last_name='User')
    print(f'==> INITIAL SUPERUSER CREATED: username: {username} | email: {email}')
else:
    if not user.is_staff or not user.is_superuser:
        user.is_staff = True
        user.is_superuser = True
        user.save(update_fields=['is_staff', 'is_superuser'])
    print(f'==> Superuser {user.email} already exists. Existing password preserved.')
"
```

### Static File Handling via WhiteNoise
Render web services do not have a dedicated Nginx front-proxy by default. Static files (`admin/`, `rest_framework/`) are compressed and served directly by Python through **WhiteNoise**:

```python
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    # ...
]

STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
```

---

## 4. Database Layer (PostgreSQL)

The database runs on cloud PostgreSQL (Render PostgreSQL, Neon, or Supabase).

### Configuration in `backend/config/settings.py`

Django parses `DATABASE_URL` dynamically using `dj_database_url`:

```python
import dj_database_url

DATABASE_URL = os.getenv('DATABASE_URL')
if DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
            ssl_require=True if any(h in DATABASE_URL for h in ['neon.tech', 'render.com', 'supabase.co']) else False,
        )
    }
```

---

## 5. Email Delivery System (Resend HTTPS API)

### Why Resend Instead of Gmail SMTP?
On free hosting platforms like Render, outbound SMTP ports (`25`, `465`, `587`) are blocked at the host network firewall to prevent spam abuse. Attempting to use `smtp.gmail.com` results in:
`[Errno 101] Network is unreachable`

### The Solution: `ResendEmailBackend`
CRM Lite includes a custom HTTPS-based email backend in `backend/common/email_backend.py`. Instead of opening raw SMTP sockets, it sends emails as secure JSON POST requests over standard HTTPS (Port `443`):

```python
# settings.py
IS_RENDER = os.getenv('RENDER', '').lower() in ('true', '1')

if RESEND_API_KEY or IS_RENDER:
    EMAIL_BACKEND = 'common.email_backend.ResendEmailBackend'
```

Required Backend Environment Variables:
- `RESEND_API_KEY`: `re_xxxxxxxxxxxxxxxxxxxx`
- `RESEND_FROM_EMAIL`: `CRM Lite <onboarding@resend.dev>` (or your verified domain address)

---

## 6. Cross-Origin Resource Sharing (CORS) & Security

Because the frontend is on Vercel (`*.vercel.app`) and the backend is on Render (`*.onrender.com`), the backend must explicitly allow cross-origin requests and authorization headers.

### `settings.py` CORS Settings:

```python
CORS_ALLOW_ALL_ORIGINS = True  # Allows public endpoints / landing forms
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$",
    r"^https:\/\/.*\.vercel\.app$",
    r"^https:\/\/.*\.onrender\.com$",
    r"^null$",
]
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = [
    'https://*.vercel.app',
    'https://*.onrender.com',
]
```

---

## 7. Complete Environment Variables Checklist

### Backend (Render Dashboard -> Environment)

| Variable | Required | Example Value | Purpose |
| :--- | :---: | :--- | :--- |
| `SECRET_KEY` | **Yes** | `<64-char-random-string>` | Cryptographic signing |
| `DEBUG` | **Yes** | `False` | Disables debug tracebacks in production |
| `ALLOWED_HOSTS` | **Yes** | `*` or `*.onrender.com` | Allowed host headers |
| `DATABASE_URL` | **Yes** | `postgres://user:pass@ep-xyz.render.com/db` | Cloud Postgres connection string |
| `RESEND_API_KEY` | **Yes** | `re_123456789abcdef` | API key from Resend.com |
| `RESEND_FROM_EMAIL` | **Yes** | `CRM Lite <onboarding@resend.dev>` | Verified sender address |
| `JWT_ACCESS_LIFETIME_MINUTES` | No | `60` | Access token lifespan |
| `JWT_REFRESH_LIFETIME_DAYS` | No | `7` | Refresh token lifespan |
| `DJANGO_SUPERUSER_EMAIL` | No | `admin@crmlite.com` | Initial admin account email |
| `DJANGO_SUPERUSER_PASSWORD` | No | `YourSecurePass123!` | Initial admin account password |
| `GEMINI_API_KEY` | No | `AIzaSy...` | Powers AI Copilot & summaries |

### Frontend (Vercel Dashboard -> Settings -> Environment Variables)

| Variable | Required | Example Value | Purpose |
| :--- | :---: | :--- | :--- |
| `VITE_API_URL` | **Yes** | `https://crm-lite-api.onrender.com` | Directs React API calls to Render |

---

## 8. Deployment Workflow (How New Changes Go Live)

1. **Commit Local Changes**:
   ```bash
   git add .
   git commit -m "Your descriptive commit message"
   ```
2. **Push to GitHub**:
   ```bash
   git push origin <branch>
   ```
3. **Automated Pipeline**:
   - **Render** detects the push -> runs `./build.sh` (installs packages, runs migrations, collects static assets) -> starts Gunicorn.
   - **Vercel** detects the push -> builds the React SPA (`npm run build`) -> pushes assets to global CDN.
4. **Instant Live Update**: Within 1-2 minutes, both frontend and backend are live and synced.
