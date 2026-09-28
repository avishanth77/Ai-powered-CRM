"""
Transcription service layer.
Handles audio preprocessing, format validation, and calls the configured AI provider
to perform verbatim Speech-to-Text transcription.
"""
import os
import logging
from typing import Optional
from django.core.files.uploadedfile import UploadedFile
from .ai_provider import get_ai_provider, AIProviderException, AIProviderServiceError

logger = logging.getLogger(__name__)

# Supported audio extensions and maximum file size (25MB)
ALLOWED_AUDIO_EXTENSIONS = {'.mp3', '.wav', '.m4a', '.webm', '.ogg', '.aac'}
MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024  # 25 MB


class TranscriptionService:
    """
    Dedicated audio transcription service interfacing with the configured AI provider.
    """

    @staticmethod
    def validate_audio_file(file_obj) -> None:
        """
        Validates file presence, non-zero size, allowed extension, and size limit.
        """
        if not file_obj:
            raise ValueError("No audio file was provided.")

        # Check file size
        file_size = getattr(file_obj, 'size', None)
        if file_size is None and hasattr(file_obj, 'seek') and hasattr(file_obj, 'tell'):
            file_obj.seek(0, os.SEEK_END)
            file_size = file_obj.tell()
            file_obj.seek(0)

        if file_size is None or file_size == 0:
            raise ValueError("The uploaded audio file is empty (0 bytes).")

        if file_size > MAX_AUDIO_SIZE_BYTES:
            max_mb = MAX_AUDIO_SIZE_BYTES // (1024 * 1024)
            raise ValueError(f"Audio file exceeds maximum size limit of {max_mb}MB.")

        # Check extension
        name = getattr(file_obj, 'name', '') or 'audio.webm'
        ext = os.path.splitext(name)[1].lower()
        if ext and ext not in ALLOWED_AUDIO_EXTENSIONS:
            raise ValueError(
                f"Unsupported audio format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_AUDIO_EXTENSIONS))}"
            )

    @staticmethod
    def transcribe(audio_file_or_bytes, mime_type: str = 'audio/webm', filename: str = 'audio.webm') -> str:
        """
        Transcribes the given audio file or bytes into verbatim text with speaker labels.
        """
        audio_bytes = b''
        actual_filename = filename
        actual_mime = mime_type

        if isinstance(audio_file_or_bytes, (bytes, bytearray)):
            audio_bytes = bytes(audio_file_or_bytes)
        elif hasattr(audio_file_or_bytes, 'read'):
            TranscriptionService.validate_audio_file(audio_file_or_bytes)
            if hasattr(audio_file_or_bytes, 'seek'):
                audio_file_or_bytes.seek(0)
            audio_bytes = audio_file_or_bytes.read()
            if hasattr(audio_file_or_bytes, 'name'):
                actual_filename = audio_file_or_bytes.name
            if hasattr(audio_file_or_bytes, 'content_type') and audio_file_or_bytes.content_type:
                actual_mime = audio_file_or_bytes.content_type
        else:
            raise ValueError("Invalid audio input provided for transcription.")

        if not audio_bytes or len(audio_bytes) == 0:
            raise ValueError("Audio stream is empty.")

        provider = get_ai_provider()
        try:
            transcript = provider.transcribe_audio(
                audio_bytes=audio_bytes,
                mime_type=actual_mime,
                filename=actual_filename
            )
            return transcript
        except AIProviderException:
            raise
        except Exception as e:
            logger.error(f"Transcription error: {e}", exc_info=True)
            raise AIProviderServiceError(f"Transcription failed: {str(e)}") from e
