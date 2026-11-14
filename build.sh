#!/usr/bin/env bash
# Exit on error
set -o errexit

cd backend
pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate

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
else:
    user.email = email
    user.username = username
    user.is_staff = True
    user.is_superuser = True
    user.is_active = True
    user.role = User.Role.ADMIN
    user.set_password(password)
    user.save()
print(f'==> ADMIN CREDENTIALS SYNCHRONIZED: username: {username} | email: {email} | password: {password}')
"
