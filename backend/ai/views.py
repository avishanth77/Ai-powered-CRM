from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q
from drf_spectacular.utils import extend_schema

from .models import Call
from .serializers import CallSerializer, AIChatRequestSerializer, CallSummaryRequestSerializer
from .services.chatbot_service import ChatbotService
from .services.call_summary_service import CallSummaryService
from leads.models import Lead

class AIChatView(APIView):
    """
    POST /api/ai/chat/
    Conversational assistant for querying CRM metrics, leads, and follow-ups.
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=AIChatRequestSerializer, responses={200: dict})
    def post(self, request):
        serializer = AIChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        prompt = serializer.validated_data['prompt']
        context = serializer.validated_data.get('context', {})

        result = ChatbotService.process_query(request.user, prompt, context)
        return Response({
            'success': True,
            'data': result
        }, status=status.HTTP_200_OK)


class AICallSummaryView(APIView):
    """
    POST /api/ai/call-summary/
    Simulate audio transcription and conversation analysis into structured summary.
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(request=CallSummaryRequestSerializer, responses={200: dict})
    def post(self, request):
        serializer = CallSummaryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        lead = None
        lead_id = data.get('lead_id')
        if lead_id:
            lead = Lead.objects.filter(pk=lead_id).first()
            if lead and request.user.role not in ['ADMIN', 'MANAGER'] and not request.user.is_superuser:
                if lead.assigned_to != request.user and lead.created_by != request.user:
                    return Response({
                        'success': False,
                        'message': "You don't have permission to access this lead."
                    }, status=status.HTTP_403_FORBIDDEN)

        notes = data.get('notes', '')
        audio_file = data.get('audio_file')

        result = CallSummaryService.process_call_transcription_and_summary(
            lead=lead,
            notes=notes,
            audio_file=audio_file
        )

        return Response({
            'success': True,
            'data': result
        }, status=status.HTTP_200_OK)


class CallViewSet(viewsets.ModelViewSet):
    """
    POST /api/calls/
    GET /api/calls/
    GET /api/calls/<id>/
    CRUD for logged calls with AI summaries.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CallSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ['transcript', 'ai_summary', 'lead__name', 'lead__company_name']
    filterset_fields = ['call_type', 'lead']
    ordering = ['-started_at', '-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Call.objects.select_related('lead', 'created_by').all()

        if not user.is_authenticated:
            return qs.none()

        if user.role in ['ADMIN', 'MANAGER'] or user.is_superuser:
            return qs

        return qs.filter(
            Q(lead__assigned_to=user) | Q(lead__created_by=user) | Q(created_by=user)
        )

    def perform_create(self, serializer):
        lead = serializer.validated_data.get('lead')
        user = self.request.user

        if lead and user.role not in ['ADMIN', 'MANAGER'] and not user.is_superuser:
            if lead.assigned_to != user and lead.created_by != user:
                raise permissions.PermissionDenied("You don't have permission to log calls on this lead.")

        call = serializer.save(created_by=user)
        CallSummaryService.record_call_activity(call, user)


class LeadCallsView(APIView):
    """
    GET /api/leads/<id>/calls/
    Retrieve all calls associated with a lead.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, lead_id):
        lead = Lead.objects.filter(pk=lead_id).first()
        if not lead:
            return Response({'success': False, 'message': 'Lead not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if user.role not in ['ADMIN', 'MANAGER'] and not user.is_superuser:
            if lead.assigned_to != user and lead.created_by != user:
                return Response({
                    'success': False,
                    'message': "You don't have permission to view calls for this lead."
                }, status=status.HTTP_403_FORBIDDEN)

        calls = Call.objects.filter(lead=lead).order_by('-started_at')
        serializer = CallSerializer(calls, many=True)
        return Response({'success': True, 'data': serializer.data})
