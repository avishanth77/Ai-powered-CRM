"""
Django settings for CRM Lite project.
"""
from pathlib import Path
from datetime import timedelta
import os
import dj_database_url
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env
load_dotenv(BASE_DIR / '.env', override=True)

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-crm-lite-super-secret-key-change-in-production-2026!#')
DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 't')

ALLOWED_HOSTS = ['*'] if DEBUG else [host.strip() for host in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1,.onrender.com,.vercel.app').split(',') if host.strip()]

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third party packages
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'drf_spectacular',

    # Local CRM apps
    'accounts',
    'leads',
    'customers',
    'followups',
    'reports',
    'activity',
    'notifications',
    'icp',
    'pld',
    'ai',
    'products',
    'telegram_bot',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# Database
DATABASE_URL = os.getenv('DATABASE_URL')

if DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.config(
            default=DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
            ssl_require=True if any(h in DATABASE_URL for h in ['neon.tech', 'render.com', 'supabase.co', 'supabase.com']) or 'sslmode=require' in DATABASE_URL else False,
        )
    }
else:
    DB_ENGINE = os.getenv('DB_ENGINE', 'sqlite3').lower()

    if DB_ENGINE == 'postgresql':
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': os.getenv('DB_NAME', 'crm_lite_db'),
                'USER': os.getenv('DB_USER', 'postgres'),
                'PASSWORD': os.getenv('DB_PASSWORD', 'postgres'),
                'HOST': os.getenv('DB_HOST', 'localhost'),
                'PORT': os.getenv('DB_PORT', '5432'),
            }
        }
    else:
        # Development fallback
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': BASE_DIR / os.getenv('DB_NAME', 'crm_lite.db'),
            }
        }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 10}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Custom User Model & Authentication Backends
AUTH_USER_MODEL = 'accounts.User'
AUTHENTICATION_BACKENDS = [
    'accounts.backends.EmailOrUsernameBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static & Media files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# WhiteNoise production static storage (with hashed filenames & compression)
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS - Enable cross-origin requests for decoupled frontend, test portals, and public forms
CORS_ALLOW_ALL_ORIGINS = True
cors_origins_env = os.getenv(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175,http://192.168.1.54:5173,http://192.168.1.54:5174'
)
CORS_ALLOWED_ORIGINS = [orig.strip() for orig in cors_origins_env.split(',') if orig.strip()] + ['null']
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$",
    r"^https:\/\/.*\.vercel\.app$",
    r"^https:\/\/.*\.onrender\.com$",
    r"^null$",
]
CORS_ALLOW_CREDENTIALS = True
from corsheaders.defaults import default_headers
CORS_ALLOW_HEADERS = list(default_headers) + [
    'bypass-tunnel-reminder',
    'ngrok-skip-browser-warning',
]

csrf_trusted_env = os.getenv('CSRF_TRUSTED_ORIGINS', 'https://*.vercel.app,https://*.onrender.com')
CSRF_TRUSTED_ORIGINS = [orig.strip() for orig in csrf_trusted_env.split(',') if orig.strip()]

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/min',
        'user': '600/min',
        'ai': '30/min',
        'public_contact': '30/min',
    },
    'DEFAULT_FILTER_BACKENDS': (
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ),
    'DEFAULT_PAGINATION_CLASS': 'common.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 20,
    'EXCEPTION_HANDLER': 'common.exceptions.custom_exception_handler',
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# SimpleJWT Settings
raw_access = os.getenv('JWT_ACCESS_LIFETIME_MINUTES')
access_mins = int(raw_access) if raw_access and raw_access.strip().isdigit() else 15

raw_refresh = os.getenv('JWT_REFRESH_LIFETIME_DAYS')
refresh_days = int(raw_refresh) if raw_refresh and raw_refresh.strip().isdigit() else 7

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=access_mins),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=refresh_days),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
}

# Security Headers & Cookies Hardening
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SECURE_REFERRER_POLICY = 'same-origin'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

# DRF Spectacular OpenAPI documentation
SPECTACULAR_SETTINGS = {
    'TITLE': 'CRM Lite API',
    'DESCRIPTION': 'Customer Follow-Up & Lead Management Web App REST API with role-based access control, analytics, and automated workflows.',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'COMPONENT_SPLIT_REQUEST': True,
}

# ==============================================================================
# EMAIL CONFIGURATION
# ==============================================================================
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', 'aatralcollegemagazine@gmail.com')
raw_email_password = os.getenv('EMAIL_HOST_PASSWORD', 'lmzz efbn ytkj cfso')
EMAIL_HOST_PASSWORD = raw_email_password.replace(' ', '') if raw_email_password else ''

EMAIL_BACKEND = os.getenv(
    'EMAIL_BACKEND',
    'django.core.mail.backends.smtp.EmailBackend' if EMAIL_HOST_USER and EMAIL_HOST_PASSWORD else 'django.core.mail.backends.console.EmailBackend'
)
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() in ('true', '1', 't')
EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', 'False').lower() in ('true', '1', 't')
EMAIL_TIMEOUT = int(os.getenv('EMAIL_TIMEOUT', 15))
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', f'CRM Lite <{EMAIL_HOST_USER}>')
SERVER_EMAIL = DEFAULT_FROM_EMAIL

# ==============================================================================
# AI SERVICE CONFIGURATION
# ==============================================================================
AI_PROVIDER = os.getenv('AI_PROVIDER', 'gemini').lower()
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', os.getenv('GOOGLE_API_KEY', ''))
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')

# ==============================================================================
# TELEGRAM BOT INTEGRATION
# ==============================================================================
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_BOT_USERNAME = os.getenv('TELEGRAM_BOT_USERNAME', 'mycrm_sales_copilot_bot').lstrip('@')
TELEGRAM_WEBHOOK_SECRET = os.getenv('TELEGRAM_WEBHOOK_SECRET', 'crm_lite_telegram_secret_2026')

