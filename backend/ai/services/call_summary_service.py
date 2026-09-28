"""
Call Summary Service layer.
Coordinates audio transcription, deal intelligence extraction via the configured AI provider,
and CRM activity logging.
"""
import logging
from typing import Optional, Dict, Any
from django.conf import settings
from .ai_provider import get_ai_provider, AIProviderException, AIProviderServiceError
from .transcription_service import TranscriptionService
from activity.services import log_activity
from activity.models import ActivityLog

logger = logging.getLogger(__name__)


class CallSummaryService:
    """
    Production service layer for Call transcription and deal intelligence extraction.
    Interfaces directly with the configured AI provider (Gemini or extensible alternative).
    """

    @staticmethod
    def process_call_transcription_and_summary(
        lead=None,
        notes: str = '',
        audio_file=None,
        existing_transcript: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes real transcription (if audio is provided) and structured conversation analysis.
        
        Args:
            lead: Optional Lead model instance
            notes: Optional discussion notes entered by user
            audio_file: Optional audio file object (.mp3, .wav, .m4a, .webm)
            existing_transcript: Optional pre-existing transcript to re-summarize
            
        Returns:
            dict containing 'transcript', 'summary', 'ai_provider', 'ai_model'
        """
        transcript = (existing_transcript or '').strip()

        # Step 1: Transcribe audio if provided
        if audio_file:
            logger.info("Transcribing audio file for lead: %s", getattr(lead, 'id', 'N/A'))
            transcribed_text = TranscriptionService.transcribe(audio_file)
            if transcribed_text:
                transcript = transcribed_text

        # If no audio transcript, fall back to discussion notes
        if not transcript:
            if notes and notes.strip():
                transcript = f"Call Discussion Notes:\n{notes.strip()}"
            else:
                raise ValueError("No audio recording or call notes were provided for analysis.")

        # Step 2: Build lead context for grounded analysis
        lead_context = None
        if lead:
            stage_name = lead.stage.name if lead.stage else (getattr(lead, 'status', '') or '')
            lead_context = {
                "name": lead.name,
                "company_name": lead.company_name or "",
                "stage": stage_name,
                "expected_value": float(lead.expected_value or 0),
                "phone": lead.phone or "",
            }

        # Step 3: Real AI Analysis using configured provider
        provider = get_ai_provider()
        provider_name = getattr(settings, 'AI_PROVIDER', 'gemini')
        model_name = getattr(settings, 'GEMINI_MODEL', 'gemini-2.5-flash')

        logger.info("Generating structured AI summary using provider: %s", provider_name)
        summary_data = provider.summarize_call(
            transcript=transcript,
            lead_context=lead_context
        )

        return {
            "transcript": transcript,
            "summary": summary_data,
            "ai_provider": provider_name,
            "ai_model": model_name,
        }

    @staticmethod
    def record_call_activity(call, user=None):
        """
        Emits a clean ActivityLog entry so the logged call appears in the Lead's timeline.
        """
        try:
            summary_preview = call.ai_summary or "Voice call completed."
            action_preview = call.next_action or "Review notes."
            formatted_notes = f"{summary_preview}\n\nNext Action: {action_preview}"

            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=str(call.lead_id),
                action='CALL_LOGGED',
                new_value={
                    'call_id': call.id,
                    'call_type': call.call_type,
                    'duration_seconds': call.duration_seconds,
                    'ai_summary': call.ai_summary,
                    'next_action': call.next_action,
                    'customer_intent': call.customer_intent,
                    'follow_up_date': str(call.follow_up_date) if call.follow_up_date else None,
                    'processing_status': call.processing_status,
                },
                performed_by=user,
                notes=formatted_notes
            )
        except Exception as e:
            logger.error("Failed to record call activity for Call #%s: %s", getattr(call, 'id', 'N/A'), e, exc_info=True)
