"""
URL configuration for CRM Lite project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

from accounts.views import (
    CustomTokenObtainPairView,
    CurrentUserView,
    LogoutView,
    UserViewSet,
)

# Top-level API router for Users
user_router = DefaultRouter()
user_router.register(r'', UserViewSet, basename='system-users')

urlpatterns = [
    path('admin/', admin.site.urls),

    # Authentication Endpoints
    path('api/auth/login/', CustomTokenObtainPairView.as_view(), name='auth-login'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    path('api/auth/me/', CurrentUserView.as_view(), name='auth-me'),
    path('api/auth/logout/', LogoutView.as_view(), name='auth-logout'),

    # System Users Management
    path('api/users/', include(user_router.urls)),

    # Core CRM Modules
    path('api/leads/', include('leads.urls')),
    path('api/customers/', include('customers.urls')),
    path('api/follow-ups/', include('followups.urls')),
    path('api/activity/', include('activity.urls')),
    path('api/reports/', include('reports.urls')),

    # API Documentation (Swagger UI & OpenAPI Schema)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
