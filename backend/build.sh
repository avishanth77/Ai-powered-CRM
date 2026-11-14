#!/usr/bin/env bash
# Exit on error
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate

python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(is_superuser=True).exists():
    email = os.getenv('DJANGO_SUPERUSER_EMAIL', 'admin@crm.com').strip()
    password = os.getenv('DJANGO_SUPERUSER_PASSWORD', 'Admin@12345').strip()
    User.objects.create_superuser(email=email, password=password, first_name='Admin', last_name='User')
    print(f'==> INITIAL SUPERUSER CREATED: Email: {email} | Password: {password}')
else:
    print('==> Superuser already exists in database.')
"
