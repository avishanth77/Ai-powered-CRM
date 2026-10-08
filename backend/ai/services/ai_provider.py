"""
AI Provider abstraction and concrete implementations.
Supports Gemini API out of the box with an extensible architecture for future providers.
"""
from abc import ABC, abstractmethod
import json
import logging
import re
from typing import Dict, Any, Optional, List
from django.conf import settings
from .prompts import (
    CALL_TRANSCRIPTION_SYSTEM_PROMPT,
    CALL_SUMMARY_SYSTEM_PROMPT,
    CHATBOT_SYSTEM_PROMPT,
)

logger = logging.getLogger(__name__)


class AIProviderException(Exception):
    """Base exception for AI provider operations."""
    pass


class AIProviderConfigurationError(AIProviderException):
    """Raised when an AI provider's API key or configuration is missing or invalid."""
    pass


class AIProviderServiceError(AIProviderException):
    """Raised when the AI provider API returns an error or rate limit."""
    pass


class BaseAIProvider(ABC):
    """
    Abstract AI Provider Interface.
    Decouples Django views and CRM models from vendor-specific LLM implementations.
    """

    @abstractmethod
    def transcribe_audio(
        self,
        audio_bytes: bytes,
        mime_type: str = 'audio/webm',
        filename: str = 'audio.webm'
    ) -> str:
        """
        Transcribe raw audio bytes into verbatim speaker-labeled text.
        """
        pass

    @abstractmethod
    def summarize_call(
        self,
        transcript: str,
        lead_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze call transcript and return structured deal intelligence JSON.
        """
        pass

    @abstractmethod
    def chat(
        self,
        message: str,
        crm_context: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Conversational assistant query with live CRM context.
        """
        pass


def _clean_json_response(text: str) -> Dict[str, Any]:
    """
    Extracts and parses JSON from model responses, cleanly handling markdown code blocks.
    """
    cleaned = (text or '').strip()
    if cleaned.startswith('```'):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith('```'):
            lines = lines[1:]
        if lines and lines[-1].startswith('```'):
            lines = lines[:-1]
        cleaned = '\n'.join(lines).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as err:
        logger.error(f"Failed to decode JSON from AI response: {cleaned[:300]}")
        # Attempt regex fallback to find innermost or outermost JSON object
        match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise AIProviderServiceError(f"Model returned invalid JSON: {err}") from err


class GeminiProvider(BaseAIProvider):
    """
    Official Gemini implementation using the Google GenAI SDK.
    Supports native multimodal audio transcription and structured JSON generation.
    """

    def __init__(self, api_key: Optional[str] = None, model_name: Optional[str] = None):
        self.api_key = api_key
        self.model_name = model_name or getattr(settings, 'GEMINI_MODEL', 'gemini-2.5-flash')
        self._client = None
        self._cached_key = None

    def _resolve_api_key(self) -> str:
        """
        Dynamically resolves the Gemini API key from:
        1. Passed in explicit key
        2. Django settings (settings.GEMINI_API_KEY)
        3. os.environ ('GEMINI_API_KEY' or 'GOOGLE_API_KEY')
        4. Fresh reload from backend/.env (ensures keys saved while dev server is running take effect immediately)
        """
        key = (self.api_key or getattr(settings, 'GEMINI_API_KEY', '') or '').strip()
        if not key:
            key = (os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY') or '').strip()

        # If still empty, dynamically reload backend/.env in case user saved .env while runserver was active
        if not key:
            try:
                from dotenv import load_dotenv
                from pathlib import Path
                base_dir = getattr(settings, 'BASE_DIR', None)
                if not base_dir:
                    base_dir = Path(__file__).resolve().parent.parent.parent
                env_path = Path(base_dir) / '.env'
                if env_path.exists():
                    load_dotenv(env_path, override=True)
                    key = (os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY') or '').strip()
            except Exception as e:
                logger.debug(f"Dynamic .env reload failed: {e}")

        # Strip accidental surrounding quotes or whitespace
        if key and len(key) >= 2:
            if (key.startswith('"') and key.endswith('"')) or (key.startswith("'") and key.endswith("'")):
                key = key[1:-1].strip()

        return key

    def _get_client(self):
        resolved_key = self._resolve_api_key()
        if not resolved_key:
            raise AIProviderConfigurationError(
                "Gemini API key is not configured. Please paste your API key into backend/.env "
                "(e.g. GEMINI_API_KEY=AIzaSy...) and make sure to SAVE the file (Ctrl+S)."
            )

        if self._client is None or self._cached_key != resolved_key:
            try:
                from google import genai
                self._client = genai.Client(api_key=resolved_key)
                self._cached_key = resolved_key
            except Exception as e:
                logger.error(f"Failed to initialize Google GenAI client: {e}")
                raise AIProviderConfigurationError(f"Google GenAI client initialization failed: {e}") from e
        return self._client

    def transcribe_audio(
        self,
        audio_bytes: bytes,
        mime_type: str = 'audio/webm',
        filename: str = 'audio.webm'
    ) -> str:
        """
        Uses Gemini's native audio understanding to transcribe speech accurately.
        """
        if not audio_bytes or len(audio_bytes) == 0:
            raise AIProviderServiceError("Audio content is empty or corrupted.")

        client = self._get_client()
        from google.genai import types

        # Normalize common audio MIME types
        clean_mime = (mime_type or '').lower()
        if 'webm' in clean_mime:
            clean_mime = 'audio/webm'
        elif 'mp3' in clean_mime or 'mpeg' in clean_mime:
            clean_mime = 'audio/mp3'
        elif 'wav' in clean_mime or 'wave' in clean_mime:
            clean_mime = 'audio/wav'
        elif 'm4a' in clean_mime or 'mp4' in clean_mime or 'aac' in clean_mime:
            clean_mime = 'audio/mp4'
        elif 'ogg' in clean_mime:
            clean_mime = 'audio/ogg'
        else:
            fn = (filename or '').lower()
            if fn.endswith('.mp3'):
                clean_mime = 'audio/mp3'
            elif fn.endswith('.wav'):
                clean_mime = 'audio/wav'
            elif fn.endswith('.m4a'):
                clean_mime = 'audio/mp4'
            elif fn.endswith('.ogg'):
                clean_mime = 'audio/ogg'
            elif fn.endswith('.webm'):
                clean_mime = 'audio/webm'
            else:
                clean_mime = 'audio/webm'

        try:
            audio_part = types.Part.from_bytes(data=audio_bytes, mime_type=clean_mime)
            prompt = (
                f"{CALL_TRANSCRIPTION_SYSTEM_PROMPT}\n\n"
                f"Audio file: {filename}\n"
                f"Please transcribe this customer conversation verbatim."
            )

            response = client.models.generate_content(
                model=self.model_name,
                contents=[audio_part, prompt],
            )

            transcript = (response.text or '').strip()
            if not transcript:
                raise AIProviderServiceError("Gemini generated an empty transcription for the audio.")

            return transcript
        except AIProviderException:
            raise
        except Exception as e:
            logger.error(f"Gemini transcription failed: {e}", exc_info=True)
            raise AIProviderServiceError(f"Speech-to-text service encountered an error: {e}") from e

    def summarize_call(
        self,
        transcript: str,
        lead_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyzes transcript and returns validated structured JSON.
        """
        if not transcript or not transcript.strip():
            raise AIProviderServiceError("Cannot summarize empty transcript.")

        client = self._get_client()
        from google.genai import types

        context_str = ""
        if lead_context:
            context_str = (
                f"Context regarding this CRM lead:\n"
                f"- Lead Name: {lead_context.get('name', 'Unknown')}\n"
                f"- Company: {lead_context.get('company_name', 'N/A')}\n"
                f"- Current Stage: {lead_context.get('stage', 'N/A')}\n"
                f"- Value: ₹{lead_context.get('expected_value', 0)}\n\n"
            )

        full_prompt = (
            f"{CALL_SUMMARY_SYSTEM_PROMPT}\n\n"
            f"{context_str}"
            f"--- CALL TRANSCRIPT ---\n"
            f"{transcript}\n"
            f"--- END TRANSCRIPT ---\n\n"
            f"Respond with the required JSON object now:"
        )

        try:
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,  # Low temperature for factual precision
            )
            response = client.models.generate_content(
                model=self.model_name,
                contents=full_prompt,
                config=config
            )

            raw_text = response.text or "{}"
            data = _clean_json_response(raw_text)

            # Validate and normalize structure
            objections_list = list(data.get("objections") or data.get("customer_objections") or [])
            summary = {
                "summary": str(data.get("summary") or "").strip(),
                "key_points": list(data.get("key_points") or []),
                "customer_requirements": list(data.get("customer_requirements") or []),
                "objections": objections_list,
                "customer_objections": objections_list,
                "customer_intent": str(data.get("customer_intent") or "Interested").strip(),
                "next_action": str(data.get("next_action") or "").strip(),
                "follow_up_date": data.get("follow_up_date") or None,
            }

            # Fallback if next_action was empty
            if not summary["next_action"]:
                summary["next_action"] = "Review call discussion and follow up"

            return summary
        except AIProviderException:
            raise
        except Exception as e:
            logger.error(f"Gemini call summary failed: {e}", exc_info=True)
            raise AIProviderServiceError(f"AI call summary service encountered an error: {e}") from e

    def chat(
        self,
        message: str,
        crm_context: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Conversational CRM assistant using Gemini and authorized CRM data.
        """
        client = self._get_client()
        from google.genai import types

        context_dump = json.dumps(crm_context or {}, indent=2, default=str)
        prompt = (
            f"{CHATBOT_SYSTEM_PROMPT}\n\n"
            f"--- AUTHORIZED LIVE CRM DATA CONTEXT ---\n"
            f"{context_dump}\n"
            f"--- END CRM DATA CONTEXT ---\n\n"
            f"User Question: {message}\n\n"
            f"Respond with a JSON object with this exact structure:\n"
            f"{{\n"
            f'  "response": "Helpful markdown-formatted answer answering the question concisely with facts from CRM context.",\n'
            f'  "intent": "OVERDUE_LEADS | LEAD_SUMMARY | DAILY_AGENDA | PIPELINE_SUMMARY | HIGH_VALUE_LEADS | RECENT_ACTIVITY | ACTION_CONFIRMATION | GENERAL",\n'
            f'  "suggestions": ["Follow-up question 1", "Follow-up question 2"],\n'
            f'  "action_required": false,\n'
            f'  "action_payload": null\n'
            f"}}\n\n"
            f"If the user requests a CRM mutation (e.g. reassigning a lead, moving a lead stage, or scheduling a follow-up), "
            f"set action_required to true and populate action_payload with one of these standard schemas:\n"
            f'- For reassigning a lead:\n'
            f'{{"action_type": "REASSIGN_LEAD", "description": "Reassign <Lead Name> to <User Email>", "parameters": {{"lead_id": 123, "lead_name": "...", "user_email": "...", "user_id": null}}}}\n'
            f'- For updating/moving lead stage:\n'
            f'{{"action_type": "UPDATE_LEAD_STAGE", "description": "Move <Lead Name> to <Stage Name> stage", "parameters": {{"lead_id": 123, "stage_id": 2, "stage_name": "..."}}}}\n'
            f'- For scheduling follow-up:\n'
            f'{{"action_type": "SCHEDULE_FOLLOWUP", "description": "Schedule follow-up for <Lead Name> on <Date>", "parameters": {{"lead_id": 123, "date": "YYYY-MM-DD", "purpose": "..."}}}}\n'
        )

        try:
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
            )
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=config
            )

            data = _clean_json_response(response.text or "{}")
            return {
                "response": data.get("response") or "I processed your request.",
                "intent": data.get("intent") or "GENERAL",
                "suggestions": data.get("suggestions") or ["What should I do today?", "Show my overdue leads"],
                "action_required": bool(data.get("action_required", False)),
                "action_payload": data.get("action_payload"),
            }
        except AIProviderException:
            raise
        except Exception as e:
            logger.error(f"Gemini chat failed: {e}", exc_info=True)
            raise AIProviderServiceError(f"AI Assistant encountered an error: {e}") from e


def get_ai_provider(provider_name: Optional[str] = None) -> BaseAIProvider:
    """
    Factory function returning the configured AI Provider instance.
    """
    name = (provider_name or getattr(settings, 'AI_PROVIDER', 'gemini')).lower()

    if name == 'gemini':
        return GeminiProvider()

    # Extensible for other providers in future (e.g. 'openai', 'local')
    raise AIProviderConfigurationError(f"Unsupported AI provider: {name}")
