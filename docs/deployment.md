# CRM Lite — Production Deployment Guide

## 1. Environment Configuration

1. Copy `.env.example` to `.env` in `backend/`:
   ```bash
   cp backend/.env.example backend/.env
   ```
2. Configure production variables:
   - `DEBUG=False`
   - `SECRET_KEY=<strong-random-secret-key>`
   - `ALLOWED_HOSTS=yourdomain.com,api.yourdomain.com`
   - `DB_ENGINE=postgresql`
   - `DB_NAME=crm_lite_db`
   - `DB_USER=crm_admin`
   - `DB_PASSWORD=<secure-db-password>`
   - `DB_HOST=127.0.0.1`
   - `DB_PORT=5432`
   - `CORS_ALLOWED_ORIGINS=https://yourdomain.com`

---

## 2. PostgreSQL Setup

```sql
CREATE DATABASE crm_lite_db;
CREATE USER crm_admin WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE crm_lite_db TO crm_admin;
ALTER DATABASE crm_lite_db OWNER TO crm_admin;
```

Apply migrations and collect static files:
```bash
python backend/manage.py migrate
python backend/manage.py collectstatic --noinput
```

---

## 3. Production WSGI Server (Gunicorn)

Install `gunicorn`:
```bash
pip install gunicorn
```

Run Gunicorn bound to localhost or UNIX socket:
```bash
gunicorn config.wsgi:application \
  --chdir backend \
  --bind 127.0.0.1:8000 \
  --workers 3 \
  --timeout 120
```

---

## 4. Frontend Production Build & Hosting

Build static assets in `frontend/`:
```bash
cd frontend
npm install
npm run build
```
The output `frontend/dist/` directory can be served via Nginx or Cloudflare Pages.

---

## 5. Nginx Reverse Proxy Configuration Example

```nginx
server {
    listen 80;
    server_name yourcrmdomain.com;

    # Frontend Static Build
    location / {
        root /var/www/crm-lite/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Django Backend API & Admin
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Static & Media files
    location /static/ {
        alias /var/www/crm-lite/backend/staticfiles/;
    }
    location /media/ {
        alias /var/www/crm-lite/backend/media/;
    }
}
```
