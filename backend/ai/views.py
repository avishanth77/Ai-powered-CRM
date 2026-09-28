import logging
from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.db.models import Q
from drf_spectacular.utils import extend_schema

from .models import Call
from .serializers import (
    CallSerializer,
    AIChatRequestSerializer,
    CallSummaryRequestSerializer,
    UpdateTranscriptSerializer,
)
from .services.chatbot_service import ChatbotService
from .services.call_summary_service import CallSummaryService
from .services.ai_provider import AIProviderConfigurationError, AIProviderServiceError
from leads.models import Lead

logger = logging.getLogger(__name__)


class AIChatView(APIView):
    """
    POST /api/ai/chat/
    Conversational assistant for querying authorized CRM metrics, leads, and follow-ups.
    Uses real AI Provider with live CRM context.
    """
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=AIChatRequestSerializer, responses={200: dict})
    def post(self, request):
        serializer = AIChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        prompt = serializer.validated_data['prompt']
        context = serializer.validated_data.get('context', {})
        conversation_history = serializer.validated_data.get('conversation_history', [])

        result = ChatbotService.process_query(
            user=request.user,
            prompt=prompt,
            context=context,
            conversation_history=conversation_history
        )
        return Response({
            'success': True,
            'data': result
        }, status=status.HTTP_200_OK)


class AIActionExecuteView(APIView):
    """
    POST /api/ai/execute-action/
    Executes a user-confirmed write action safely through Django permissions and business rules.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        action_payload = request.data.get('action_payload')
        if not action_payload or not isinstance(action_payload, dict):
            return Response({
                'success': False,
                'message': 'Invalid or missing action payload.'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = ChatbotService.execute_confirmed_action(request.user, action_payload)
            return Response(result, status=status.HTTP_200_OK)
        except PermissionError as pe:
            return Response({
                'success': False,
                'message': str(pe)
            }, status=status.HTTP_403_FORBIDDEN)
        except ValueError as ve:
            return Response({
                'success': False,
                'message': str(ve)
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error("Failed to execute confirmed AI action: %s", e, exc_info=True)
            return Response({
                'success': False,
                'message': "Failed to execute confirmed action. Please try again."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AICallSummaryView(APIView):
    """
    POST /api/ai/call-summary/
    Transcribe audio and analyze conversation into structured deal summary using real AI.
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
            if not lead:
                return Response({
                    'success': False,
                    'message': 'Lead not found.'
                }, status=status.HTTP_404_NOT_FOUND)

            if request.user.role not in ['ADMIN', 'MANAGER'] and not request.user.is_superuser:
                if lead.assigned_to != request.user and lead.created_by != request.user:
                    return Response({
                        'success': False,
                        'message': "You don't have permission to access this lead."
                    }, status=status.HTTP_403_FORBIDDEN)

        notes = data.get('notes', '')
        audio_file = data.get('audio_file')
        call_id = data.get('call_id')

        target_call = None
        if call_id:
            target_call = Call.objects.filter(pk=call_id).first()
            if target_call:
                if request.user.role not in ['ADMIN', 'MANAGER'] and not request.user.is_superuser:
                    if (target_call.lead and target_call.lead.assigned_to != request.user and target_call.lead.created_by != request.user) and target_call.created_by != request.user:
                        return Response({
                            'success': False,
                            'message': "You don't have permission to modify this call."
                        }, status=status.HTTP_403_FORBIDDEN)
                target_call.processing_status = Call.ProcessingStatus.ANALYZING
                target_call.save(update_fields=['processing_status'])

        try:
            result = CallSummaryService.process_call_transcription_and_summary(
                lead=lead or (target_call.lead if target_call else None),
                notes=notes,
                audio_file=audio_file,
                existing_transcript=target_call.transcript if target_call else None
            )

            # If existing call record was supplied (e.g. retry), update it
            if target_call:
                target_call.transcript = result.get('transcript', '')
                summary_data = result.get('summary', {})
                target_call.ai_summary = summary_data.get('summary', '')
                target_call.key_points = summary_data.get('key_points', [])
                target_call.customer_requirements = summary_data.get('customer_requirements', [])
                target_call.objections = summary_data.get('objections', [])
                target_call.customer_intent = summary_data.get('customer_intent', 'Interested')
                target_call.next_action = summary_data.get('next_action', '')
                target_call.follow_up_date = summary_data.get('follow_up_date')
                target_call.processing_status = Call.ProcessingStatus.COMPLETED
                target_call.save()

            return Response({
                'success': True,
                'data': result
            }, status=status.HTTP_200_OK)

        except ValueError as ve:
            if target_call:
                target_call.processing_status = Call.ProcessingStatus.FAILED
                target_call.save(update_fields=['processing_status'])
            return Response({
                'success': False,
                'message': str(ve)
            }, status=status.HTTP_400_BAD_REQUEST)

        except AIProviderConfigurationError as ce:
            if target_call:
                target_call.processing_status = Call.ProcessingStatus.FAILED
                target_call.save(update_fields=['processing_status'])
            return Response({
                'success': False,
                'message': f"AI Configuration Error: {str(ce)}"
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        except AIProviderServiceError as se:
            if target_call:
                target_call.processing_status = Call.ProcessingStatus.FAILED
                target_call.save(update_fields=['processing_status'])
            return Response({
                'success': False,
                'message': f"AI Service Error: {str(se)}"
            }, status=status.HTTP_502_BAD_GATEWAY)

        except Exception as e:
            logger.error("Unexpected error in AICallSummaryView: %s", e, exc_info=True)
            if target_call:
                target_call.processing_status = Call.ProcessingStatus.FAILED
                target_call.save(update_fields=['processing_status'])
            return Response({
                'success': False,
                'message': "An unexpected error occurred while processing the call recording. Please try again."
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CallViewSet(viewsets.ModelViewSet):
    """
    POST /api/calls/
    GET /api/calls/
    GET /api/calls/<id>/
    PATCH /api/calls/<id>/
    CRUD for logged calls with AI summaries.
    """
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CallSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    search_fields = ['transcript', 'ai_summary', 'lead__name', 'lead__company_name']
    filterset_fields = ['call_type', 'lead', 'processing_status']
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

    @action(detail=True, methods=['patch', 'post'], url_path='transcript')
    def update_transcript(self, request, pk=None):
        """
        Allows editing the transcript and optionally reanalyzing it with the AI Provider.
        """
        call = self.get_object()
        serializer = UpdateTranscriptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_transcript = serializer.validated_data['transcript']
        reanalyze = serializer.validated_data.get('reanalyze', False)

        call.transcript = new_transcript

        if reanalyze:
            try:
                call.processing_status = Call.ProcessingStatus.ANALYZING
                call.save(update_fields=['transcript', 'processing_status'])

                result = CallSummaryService.process_call_transcription_and_summary(
                    lead=call.lead,
                    existing_transcript=new_transcript
                )
                summary_data = result['summary']
                call.ai_summary = summary_data.get('summary', '')
                call.key_points = summary_data.get('key_points', [])
                call.customer_requirements = summary_data.get('customer_requirements', [])
                call.objections = summary_data.get('objections', [])
                call.customer_intent = summary_data.get('customer_intent', 'Interested')
                call.next_action = summary_data.get('next_action', '')
                call.follow_up_date = summary_data.get('follow_up_date')
                call.processing_status = Call.ProcessingStatus.COMPLETED
                call.save()
            except Exception as e:
                call.processing_status = Call.ProcessingStatus.FAILED
                call.save(update_fields=['processing_status'])
                logger.error("Re-analysis failed for Call #%s: %s", call.id, e, exc_info=True)
                return Response({
                    'success': False,
                    'message': f"Failed to re-analyze transcript: {str(e)}"
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            call.save(update_fields=['transcript'])

        return Response({
            'success': True,
            'message': 'Transcript updated successfully.',
            'data': CallSerializer(call).data
        })

    @action(detail=True, methods=['post'], url_path='retry')
    def retry_analysis(self, request, pk=None):
        """
        Retries transcription and analysis for a failed call without duplicating records.
        """
        call = self.get_object()
        try:
            call.processing_status = Call.ProcessingStatus.ANALYZING
            call.save(update_fields=['processing_status'])

            result = CallSummaryService.process_call_transcription_and_summary(
                lead=call.lead,
                audio_file=call.audio_file if call.audio_file else None,
                existing_transcript=call.transcript if call.transcript else None
            )
            summary_data = result['summary']
            if result.get('transcript'):
                call.transcript = result['transcript']
            call.ai_summary = summary_data.get('summary', '')
            call.key_points = summary_data.get('key_points', [])
            call.customer_requirements = summary_data.get('customer_requirements', [])
            call.objections = summary_data.get('objections', [])
            call.customer_intent = summary_data.get('customer_intent', 'Interested')
            call.next_action = summary_data.get('next_action', '')
            call.follow_up_date = summary_data.get('follow_up_date')
            call.processing_status = Call.ProcessingStatus.COMPLETED
            call.save()

            return Response({
                'success': True,
                'message': 'Call re-analyzed successfully.',
                'data': CallSerializer(call).data
            })
        except Exception as e:
            call.processing_status = Call.ProcessingStatus.FAILED
            call.save(update_fields=['processing_status'])
            return Response({
                'success': False,
                'message': f"Retry failed: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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
