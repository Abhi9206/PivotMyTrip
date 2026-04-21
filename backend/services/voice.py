"""
NomadAI Voice Service - Audio transcription using Groq Whisper
"""
import io
import logging
from typing import Optional

import httpx

from backend.config import settings
from backend.services.groq import GroqServiceError, post_groq, _get_audio_limiter

logger = logging.getLogger(__name__)

GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
WHISPER_MODEL = "whisper-large-v3-turbo"


async def transcribe(audio_bytes: bytes, filename: str = "recording.webm") -> str:
    """
    Transcribe audio bytes to text using Groq Whisper.
    Returns the transcript string or raises GroqServiceError.
    """
    if not settings.GROQ_API_KEY:
        raise GroqServiceError(
            "GROQ_API_KEY is not configured. Voice transcription is unavailable."
        )

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
    }

    audio_stream = io.BytesIO(audio_bytes)
    audio_stream.name = filename

    # Determine MIME type from extension
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "webm"
    mime_map = {
        "webm": "audio/webm",
        "mp3": "audio/mpeg",
        "mp4": "audio/mp4",
        "wav": "audio/wav",
        "m4a": "audio/mp4",
        "ogg": "audio/ogg",
        "flac": "audio/flac",
    }
    mime = mime_map.get(ext, "audio/webm")

    files = {
        "file": (filename, audio_bytes, mime),
        "model": (None, WHISPER_MODEL),
        "response_format": (None, "text"),
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await post_groq(
            client,
            GROQ_TRANSCRIPTION_URL,
            headers=headers,
            files=files,
            limiter=_get_audio_limiter(),
            request_name="Groq Whisper transcription",
        )

    if resp is None:
        raise GroqServiceError("Groq Whisper transcription request failed.")

    # response_format=text returns plain text
    transcript = resp.text.strip()
    if not transcript:
        raise GroqServiceError("Groq returned an empty transcript.")

    logger.info("Transcribed %d bytes → %d chars", len(audio_bytes), len(transcript))
    return transcript
