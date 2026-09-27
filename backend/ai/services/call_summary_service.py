import logging
from django.utils import timezone
from .mock_ai_service import generate_mock_transcript, generate_mock_call_summary
from activity.services import log_activity
from activity.models import ActivityLog

logger = logging.getLogger(__name__)

class CallSummaryService:
    """
    Service layer for Call transcription and deal intelligence extraction.
    Prepared for future plug-in of real Speech-to-Text and LLM engines.
    """

    @staticmethod
    def process_call_transcription_and_summary(lead=None, notes=None, audio_file=None):
        """
        Simulate transcription and conversation analysis.
        Returns:
            dict containing 'transcript' and 'summary'
        """
        transcript = generate_mock_transcript(lead=lead, notes=notes)
        summary_data = generate_mock_call_summary(transcript=transcript, lead=lead, notes=notes)

        return {
            "transcript": transcript,
            "summary": summary_data
        }

    @staticmethod
    def record_call_activity(call, user=None):
        """
        Emit a clean ActivityLog entry so the logged call appears in the Lead's timeline.
        """
        try:
            summary_preview = call.ai_summary or "Voice call completed."
            action_preview = call.next_action or "Review notes."
            formatted_notes = f"{summary_preview}\n\nNext Action: {action_preview}"

            log_activity(
                entity_type=ActivityLog.EntityType.LEAD,
                entity_id=call.lead_id,
                action='CALL_LOGGED',
                new_value={
                    'call_id': call.id,
                    'call_type': call.call_type,
                    'duration_seconds': call.duration_seconds,
                    'ai_summary': call.ai_summary,
                    'next_action': call.next_action,
                    'customer_intent': call.customer_intent,
                    'follow_up_date': str(call.follow_up_date) if call.follow_up_date else None,
                },
                performed_by=user,
                notes=formatted_notes
            )
        except Exception as e:
            logger.error(f"Failed to record call activity for Call #{call.id}: {e}", exc_info=True)
