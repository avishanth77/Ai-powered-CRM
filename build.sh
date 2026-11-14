#!/usr/bin/env bash
# Exit on error
set -o errexit

cd backend
pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate

if [ -n "$DJANGO_SUPERUSER_EMAIL" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.contrib.auth import get_user_model
User = get_user_model()
email = os.getenv('DJANGO_SUPERUSER_EMAIL')
password = os.getenv('DJANGO_SUPERUSER_PASSWORD')
fname = os.getenv('DJANGO_SUPERUSER_FIRST_NAME', 'Admin')
lname = os.getenv('DJANGO_SUPERUSER_LAST_NAME', 'User')
if email and password and not User.objects.filter(email=email).exists():
    User.objects.create_superuser(email=email, password=password, first_name=fname, last_name=lname)
    print(f'==> Superuser {email} created successfully!')
elif User.objects.filter(email=email).exists():
    print(f'==> Superuser {email} already exists.')
"
fi
