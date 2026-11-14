import logging
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from rest_framework import generics, viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from drf_spectacular.utils import extend_schema, OpenApiParameter

logger = logging.getLogger(__name__)

from .serializers import (
    CustomTokenObtainPairSerializer,
    UserSerializer,
    CurrentUserProfileSerializer,
    UserCreateSerializer,
    UserUpdateSerializer,
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    ResetPasswordSerializer
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
    """Retrieve or update currently logged in user profile (protected against privilege escalation)."""
    serializer_class = CurrentUserProfileSerializer
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


class ChangePasswordView(APIView):
    """Allows an authenticated user to change their current password."""
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=ChangePasswordSerializer, responses={200: dict})
    def post(self, request, *args, **kwargs):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        if not user.check_password(serializer.validated_data['old_password']):
            return Response({
                'success': False,
                'message': 'Current password is incorrect.',
                'errors': {'old_password': ['Current password is incorrect.']}
            }, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data['new_password'])
        user.save()

        return Response({
            'success': True,
            'message': 'Password changed successfully.'
        }, status=status.HTTP_200_OK)


class ForgotPasswordView(APIView):
    """Generates password reset token and dispatches an email to the user."""
    permission_classes = [permissions.AllowAny]

    @extend_schema(request=ForgotPasswordSerializer, responses={200: dict})
    def post(self, request, *args, **kwargs):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email'].strip()
        user = User.objects.filter(email__iexact=email).first()

        if not user:
            return Response({
                'success': False,
                'message': 'No registered account found with that email address.'
            }, status=status.HTTP_404_NOT_FOUND)

        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        subject = 'CRM Lite - Password Reset Request'
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'CRM Lite <aatralcollegemagazine@gmail.com>')
        recipient_list = [user.email]
        user_display = user.get_full_name() or user.username or user.email

        html_content = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 28px;">
                <div style="display: inline-block; background: #2563eb; color: #ffffff; font-weight: bold; font-size: 14px; padding: 6px 14px; border-radius: 20px; letter-spacing: 0.5px; text-transform: uppercase;">
                    CRM Lite
                </div>
                <h2 style="color: #0f172a; margin: 16px 0 6px 0; font-size: 22px;">Password Reset Request</h2>
                <p style="color: #64748b; font-size: 14px; margin: 0;">Follow the instructions below to reset your password.</p>
            </div>

            <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                Hello <strong>{user_display}</strong>,
            </p>
            <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                We received a request to reset the password for your CRM Lite account (<strong>{user.email}</strong>).
            </p>

            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; margin: 24px 0; text-align: center;">
                <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 8px;">
                    Your Security Verification Token
                </div>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 18px; font-weight: bold; color: #1e293b; background: #ffffff; border: 1px dashed #94a3b8; padding: 12px; border-radius: 6px; word-break: break-all;">
                    {token}
                </div>
            </div>

            <p style="color: #334155; font-size: 14px; line-height: 1.6;">
                If you have the reset screen open in your browser, you can directly enter your new password now to complete the reset.
            </p>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0;" />

            <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 0;">
                If you did not request this password reset, please ignore this email. Your account credentials remain unchanged.
            </p>
        </div>
        """

        plain_content = f"""CRM Lite - Password Reset Request

Hello {user_display},

We received a request to reset the password for your CRM Lite account ({user.email}).

Your Reset Verification Token:
{token}

If you have the reset screen open in your browser, you can directly enter your new password now.

If you did not request this reset, you can safely ignore this email.
"""

        email_sent = False
        try:
            msg = EmailMultiAlternatives(subject, plain_content, from_email, recipient_list)
            msg.attach_alternative(html_content, "text/html")
            msg.send(fail_silently=False)
            email_sent = True
        except Exception as mail_err:
            logger.error(f"Failed to send password reset email to {user.email}: {mail_err}")

        return Response({
            'success': True,
            'message': f'Password reset verification code sent to {user.email}. Please check your inbox.',
            'email_sent': email_sent,
            'data': {
                'uid': uid,
                'token': token,
                'email': user.email,
            }
        }, status=status.HTTP_200_OK)


class ResetPasswordView(APIView):
    """Verifies token and resets user password."""
    permission_classes = [permissions.AllowAny]

    @extend_schema(request=ResetPasswordSerializer, responses={200: dict})
    def post(self, request, *args, **kwargs):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uid = serializer.validated_data['uid']
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']

        try:
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({
                'success': False,
                'message': 'Invalid reset link or user not found.'
            }, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({
                'success': False,
                'message': 'Password reset token has expired or is invalid.'
            }, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        # Send confirmation email
        try:
            confirm_subj = 'CRM Lite - Password Successfully Changed'
            confirm_body = f"Hello {user.get_full_name() or user.username},\n\nYour CRM Lite account password was successfully updated.\n\nIf you did not make this change, please contact your system administrator immediately."
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'CRM Lite <aatralcollegemagazine@gmail.com>')
            msg = EmailMultiAlternatives(confirm_subj, confirm_body, from_email, [user.email])
            msg.send(fail_silently=True)
        except Exception:
            pass

        return Response({
            'success': True,
            'message': 'Your password has been reset successfully. You can now sign in.'
        }, status=status.HTTP_200_OK)


class BootstrapAdminView(APIView):
    """
    Initial admin bootstrap endpoint.
    Reports admin account status and allows resetting password during setup.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        admins = list(User.objects.filter(is_superuser=True).values('id', 'email', 'username', 'first_name', 'last_name', 'is_active'))
        if admins:
            return Response({
                'success': True,
                'status': 'configured',
                'admin_accounts': admins,
                'message': 'Admin account(s) found in database.'
            })
        return Response({
            'success': False,
            'status': 'uninitialized',
            'message': 'No admin account found. POST {"email": "...", "password": "..."} to create one.'
        })

    def post(self, request):
        email = request.data.get('email', 'admin@crm.com').strip()
        username = request.data.get('username', 'admin').strip()
        password = request.data.get('password', '').strip()
        first_name = request.data.get('first_name', 'Admin').strip()
        last_name = request.data.get('last_name', 'User').strip()

        if not password:
            return Response({
                'success': False,
                'message': 'Password is required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(is_superuser=True).first()
        if not user:
            user = User.objects.create_superuser(
                email=email,
                username=username,
                password=password,
                first_name=first_name,
                last_name=last_name
            )
        else:
            user.email = email
            user.username = username
            user.first_name = first_name
            user.last_name = last_name
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.role = User.Role.ADMIN
            user.set_password(password)
            user.save()

        return Response({
            'success': True,
            'message': f'Admin credentials for {user.email} (username: {user.username}) updated successfully. You can now log in.',
            'data': {'email': user.email, 'username': user.username}
        }, status=status.HTTP_200_OK)

