# Django & DRF Hardening

## settings.py (production)
```python
DEBUG = False
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]      # never commit
ALLOWED_HOSTS = ["example.com"]
SECURE_SSL_REDIRECT = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "same-origin"
CSRF_TRUSTED_ORIGINS = ["https://example.com"]
AUTH_PASSWORD_VALIDATORS = [...]  # keep all 4 defaults, min_length >= 10
```
Run `python manage.py check --deploy` and fix every warning.

## DRF
```python
REST_FRAMEWORK = {
  "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
  "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],  # deny by default
  "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle","rest_framework.throttling.UserRateThrottle"],
  "DEFAULT_THROTTLE_RATES": {"anon": "30/min", "user": "120/min"},
}
```
- **Object-level permissions**: filter `get_queryset()` by `request.user`; add custom `BasePermission.has_object_permission`.
- **Serializers**: explicit `fields = [...]` (never `"__all__"` with sensitive fields); `read_only_fields` for `id`, `is_staff`, `owner`; set owner from `request.user` in `perform_create`, not from payload (mass assignment).
- **JWT (simplejwt)**: `ACCESS_TOKEN_LIFETIME` 5-15 min, `ROTATE_REFRESH_TOKENS=True`, `BLACKLIST_AFTER_ROTATION=True`.
- **CORS** (django-cors-headers): explicit `CORS_ALLOWED_ORIGINS`; never `CORS_ALLOW_ALL_ORIGINS=True` with credentials.
- Disable browsable API and Swagger in production or protect them.
- **Admin**: change URL, require MFA/IP allowlist, strong staff passwords.
- Pagination limit cap (`max_page_size`) to avoid data dumps/DoS.

## Tests to add
```python
def test_user_cannot_access_other_users_order(auth_client, other_user_order):
    r = auth_client.get(f"/api/orders/{other_user_order.id}/")
    assert r.status_code in (403, 404)

def test_cannot_set_is_staff_via_payload(auth_client):
    r = auth_client.patch("/api/me/", {"is_staff": True}, format="json")
    assert not User.objects.get(pk=auth_client.user.pk).is_staff
```
