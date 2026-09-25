from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.core.mail import send_mail
from django.conf import settings
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers

class EmailTestView(APIView):
    """
    Test endpoint for learning and testing Django email sending.
    POST /api/email/test/
    """
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary="Send a test email using Django email subsystem",
        description="Dispatches a test email via Django's configured EMAIL_BACKEND (Console backend in development).",
        request=inline_serializer(
            name='EmailTestRequest',
            fields={
                'recipient': serializers.EmailField(default='customer@example.com'),
                'subject': serializers.CharField(default='CRM Lite Test Email'),
                'message': serializers.CharField(default='Hello from CRM Lite! Testing the Django email subsystem.'),
            }
        ),
        responses={200: inline_serializer(
            name='EmailTestResponse',
            fields={
                'success': serializers.BooleanField(),
                'message': serializers.CharField(),
                'data': serializers.DictField(),
            }
        )}
    )
    def post(self, request, *args, **kwargs):
        recipient = request.data.get('recipient', 'customer@example.com')
        subject = request.data.get('subject', 'CRM Lite Test Email')
        message = request.data.get('message', 'Hello from CRM Lite! Testing the Django email subsystem.')

        if not recipient:
            return Response({
                'success': False,
                'message': 'Recipient email address is required.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Django's built-in send_mail function
            # Parameters:
            # 1. subject: Email subject line
            # 2. message: Plain-text body
            # 3. from_email: Sender address (defaults to settings.DEFAULT_FROM_EMAIL)
            # 4. recipient_list: Python list of recipient email strings
            # 5. fail_silently: If False, raises exception on error
            sent_count = send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient],
                fail_silently=False,
            )

            return Response({
                'success': True,
                'message': f"Test email dispatched successfully to {recipient} ({sent_count} message sent).",
                'data': {
                    'recipient': recipient,
                    'subject': subject,
                    'from_email': settings.DEFAULT_FROM_EMAIL,
                    'backend': settings.EMAIL_BACKEND,
                }
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'success': False,
                'message': f"Email dispatch failed: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
