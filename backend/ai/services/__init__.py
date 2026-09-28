"""
AI services package initialization.
"""
from .ai_provider import (
    BaseAIProvider,
    GeminiProvider,
    get_ai_provider,
    AIProviderException,
    AIProviderConfigurationError,
    AIProviderServiceError,
)
from .transcription_service import TranscriptionService
from .prompts import (
    CALL_TRANSCRIPTION_SYSTEM_PROMPT,
    CALL_SUMMARY_SYSTEM_PROMPT,
    CHATBOT_SYSTEM_PROMPT,
)

__all__ = [
    'BaseAIProvider',
    'GeminiProvider',
    'get_ai_provider',
    'AIProviderException',
    'AIProviderConfigurationError',
    'AIProviderServiceError',
    'TranscriptionService',
    'CALL_TRANSCRIPTION_SYSTEM_PROMPT',
    'CALL_SUMMARY_SYSTEM_PROMPT',
    'CHATBOT_SYSTEM_PROMPT',
]
