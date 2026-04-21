"""
NomadAI Voice Router - Speech-to-text transcription and command parsing
"""
import logging
from fastapi import APIRouter, HTTPException, UploadFile, File
from backend.models.schemas import VoiceCommandRequest
from backend.services.llm import parse_voice_command
from backend.services.groq import GroqServiceError

router = APIRouter(prefix="/api/voice", tags=["voice"])
logger = logging.getLogger(__name__)


@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe an audio file to text using Groq Whisper."""
    from backend.services.voice import transcribe
    try:
        audio_bytes = await audio.read()
        transcript = await transcribe(audio_bytes, audio.filename or "recording.webm")
        return {"transcript": transcript}
    except Exception as e:
        logger.error("Transcription error: %s", e)
        raise HTTPException(500, f"Transcription failed: {str(e)}")


@router.post("/command")
async def parse_command(req: VoiceCommandRequest):
    """Parse a voice transcript into a structured command."""
    try:
        result = await parse_voice_command(req.transcript, req.itinerary_summary)
        if not result:
            return {
                "intent": "unknown",
                "confidence": 0.0,
                "params": {},
                "human_response": "Sorry, I couldn't understand that command.",
            }
        return result
    except GroqServiceError as e:
        raise HTTPException(503, str(e))
    except Exception as e:
        logger.error("Command parse error: %s", e)
        raise HTTPException(500, f"Command parsing failed: {str(e)}")
