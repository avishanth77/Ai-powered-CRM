from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db.models import Q

User = get_user_model()

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT serializer to include user details in token payload and response."""
    username_field = User.EMAIL_FIELD

    def to_internal_value(self, data):
        data = data.copy() if hasattr(data, 'copy') else dict(data)
        identifier = str(data.get('email') or data.get('username') or '').strip()
        if identifier:
            matched_user = User.objects.filter(
                Q(email__iexact=identifier) |
                Q(username__iexact=identifier) |
                Q(email__iexact=f"{identifier}@crmlite.com")
            ).first()
            if matched_user:
                data['email'] = matched_user.email
            elif 'email' not in data and 'username' in data:
                data['email'] = identifier
        return super().to_internal_value(data)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['email'] = user.email
        token['role'] = user.role
        token['name'] = user.get_full_name() or user.email
        return token

    def validate(self, attrs):
        identifier = str(attrs.get('email') or attrs.get('username') or '').strip()
        if identifier and '@' not in identifier:
            matched_user = User.objects.filter(
                Q(email__iexact=identifier) |
                Q(username__iexact=identifier) |
                Q(email__iexact=f"{identifier}@crmlite.com")
            ).first()
            if matched_user:
                attrs['email'] = matched_user.email
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'role': self.user.role,
            'phone': self.user.phone,
        }
        return data


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'phone', 'role', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'email', 'role', 'is_active', 'created_at', 'updated_at']


class CurrentUserProfileSerializer(serializers.ModelSerializer):
    """
    Self-profile update serializer. Explicitly prevents privilege escalation
    and role/status manipulation (CWE-269 / CWE-915).
    """
    full_name = serializers.CharField(source='get_full_name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'full_name',
            'phone', 'role', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'email', 'role', 'is_active', 'created_at', 'updated_at']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name',
            'phone', 'role', 'password'
        ]

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'phone', 'role', 'is_active']


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])
    confirm_new_password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_new_password']:
            raise serializers.ValidationError({'confirm_new_password': "Passwords do not match."})
        return attrs


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        normalized_email = value.lower().strip()
        if not User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError("No account found with this email address.")
        return normalized_email


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField(required=True)
    token = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, write_only=True, validators=[validate_password])
    confirm_new_password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_new_password']:
            raise serializers.ValidationError({'confirm_new_password': "Passwords do not match."})
        return attrs


class StaffTargetSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_role = serializers.CharField(source='user.role', read_only=True)
    set_by_name = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        from .models import StaffTarget
        model = StaffTarget
        fields = [
            'id',
            'user',
            'user_name',
            'user_email',
            'user_role',
            'period_month',
            'daily_calls_target',
            'daily_leads_target',
            'daily_revenue_target',
            'monthly_calls_target',
            'monthly_leads_target',
            'monthly_deals_won_target',
            'monthly_revenue_target',
            'notes',
            'is_active',
            'set_by',
            'set_by_name',
            'progress',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'set_by']

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.email

    def get_set_by_name(self, obj):
        if obj.set_by:
            return obj.set_by.get_full_name() or obj.set_by.email
        return None

    def get_progress(self, obj):
        from .services.target_service import calculate_staff_progress
        return calculate_staff_progress(obj.user, target=obj)


class StaffTargetSaveSerializer(serializers.ModelSerializer):
    """Serializer for Admin/Manager creating or customizing staff targets."""
    class Meta:
        from .models import StaffTarget
        model = StaffTarget
        fields = [
            'user',
            'period_month',
            'daily_calls_target',
            'daily_leads_target',
            'daily_revenue_target',
            'monthly_calls_target',
            'monthly_leads_target',
            'monthly_deals_won_target',
            'monthly_revenue_target',
            'notes',
            'is_active',
        ]
        extra_kwargs = {
            'period_month': {'required': False},
        }

    def validate_period_month(self, value):
        import re
        if value and not re.match(r'^\d{4}-\d{2}$', value):
            raise serializers.ValidationError("Month must be in YYYY-MM format (e.g. 2026-11).")
        return value

    def create(self, validated_data):
        from .models import StaffTarget
        from .services.target_service import get_current_period_month

        user = validated_data['user']
        period_month = validated_data.get('period_month') or get_current_period_month()
        validated_data['period_month'] = period_month

        # Auto-upsert for (user, period_month)
        target, _ = StaffTarget.objects.update_or_create(
            user=user,
            period_month=period_month,
            defaults=validated_data
        )
        return target

