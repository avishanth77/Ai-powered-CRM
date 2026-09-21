from rest_framework import generics, viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema, OpenApiParameter

from .serializers import (
    CustomTokenObtainPairSerializer,
    UserSerializer,
    UserCreateSerializer,
    UserUpdateSerializer
)
from .permissions import IsAdmin, IsManagerOrAdmin

User = get_user_model()

class CustomTokenObtainPairView(TokenObtainPairView):
    """Obtain JWT access & refresh token with user details."""
    serializer_class = CustomTokenObtainPairSerializer

    @extend_schema(responses={200: CustomTokenObtainPairSerializer})
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            return Response({
                'success': True,
                'message': 'Login successful',
                'data': response.data
            })
        return response


class CurrentUserView(generics.RetrieveUpdateAPIView):
    """Retrieve or update currently logged in user profile."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object())
        return Response({
            'success': True,
            'data': serializer.data
        })


class LogoutView(APIView):
    """Logout endpoint - optionally blacklists refresh token."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass
        return Response({
            'success': True,
            'message': 'Successfully logged out.'
        }, status=status.HTTP_200_OK)


class UserViewSet(viewsets.ModelViewSet):
    """
    Manage system users.
    - List/Retrieve: Manager and Admin
    - Create/Update/Delete: Admin only
    """
    queryset = User.objects.all().order_by('first_name', 'last_name')
    filterset_fields = ['role', 'is_active']
    search_fields = ['email', 'first_name', 'last_name', 'phone']

    def get_permissions(self):
        if self.action in ['create', 'destroy']:
            return [IsAdmin()]
        elif self.action in ['update', 'partial_update']:
            return [IsAdmin()]
        # List and Retrieve accessible to Managers and Admins (needed for assigning leads)
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return UserUpdateSerializer
        return UserSerializer

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return response
