import os
import sys
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        # Skip during management commands like makemigrations, collectstatic, test
        if any(cmd in sys.argv for cmd in ['makemigrations', 'collectstatic', 'test']):
            return

        superuser_email = os.getenv('DJANGO_SUPERUSER_EMAIL')
        superuser_password = os.getenv('DJANGO_SUPERUSER_PASSWORD')

        if superuser_email and superuser_password:
            try:
                from django.contrib.auth import get_user_model
                from django.db import connection

                # Check if tables exist before attempting database queries
                if 'accounts_user' in connection.introspection.table_names():
                    User = get_user_model()
                    user, created = User.objects.get_or_create(
                        email=superuser_email,
                        defaults={
                            'username': superuser_email,
                            'first_name': os.getenv('DJANGO_SUPERUSER_FIRST_NAME', 'Admin'),
                            'last_name': os.getenv('DJANGO_SUPERUSER_LAST_NAME', 'User'),
                            'is_staff': True,
                            'is_superuser': True,
                            'role': User.Role.ADMIN,
                        }
                    )
                    if created:
                        user.set_password(superuser_password)
                        user.save(update_fields=['password'])
                        print(f"[AccountsConfig] Superuser {superuser_email} created successfully!")
                    else:
                        updated = False
                        if not user.is_superuser or not user.is_staff or user.role != User.Role.ADMIN:
                            user.is_superuser = True
                            user.is_staff = True
                            user.role = User.Role.ADMIN
                            updated = True
                        if os.getenv('RESET_SUPERUSER_PASSWORD', 'False').lower() in ('true', '1'):
                            user.set_password(superuser_password)
                            updated = True
                        if updated:
                            user.save()
                            print(f"[AccountsConfig] Superuser {superuser_email} permissions updated.")
            except Exception as e:
                # Catch gracefully on initial startup before database is ready
                print(f"[AccountsConfig] Superuser init skipped: {e}")

