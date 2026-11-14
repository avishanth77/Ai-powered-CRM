from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q


class EmailOrUsernameBackend(ModelBackend):
    """
    Allows authentication with either email or username in Django Admin and API login forms.
    Case-insensitive matching for maximum reliability.
    Supports both standard Django hashed passwords and direct plain text fallback
    (upgrading plain text to secure PBKDF2 hash on first login).
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        User = get_user_model()
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
        if not username or not password:
            return None

        username = username.strip()
        try:
            user = User.objects.filter(
                Q(email__iexact=username) | Q(username__iexact=username)
            ).first()
        except Exception:
            return None

        if user and self.user_can_authenticate(user):
            # 1. Standard Django hashed password check
            if user.check_password(password):
                return user

            # 2. Plain text fallback (e.g. if updated directly in DB)
            if user.password == password:
                user.set_password(password)
                user.save(update_fields=['password'])
                return user

        return None

