"""
NomadAI Groq Service - Rate limiting and HTTP helpers for Groq API calls
"""
import asyncio
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ── Rate limiter ───────────────────────────────────────────────────────────────
# Groq free tier: ~30 req/min for chat, ~20 req/min for audio
_CHAT_RATE = 28  # conservative req/min
_AUDIO_RATE = 18

class _TokenBucket:
    """Simple token bucket for async rate limiting."""
    def __init__(self, rate_per_min: float):
        self._rate = rate_per_min / 60.0  # tokens per second
        self._tokens = rate_per_min       # start full
        self._last = asyncio.get_event_loop().time() if asyncio._get_running_loop() else 0.0
        self._lock = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            try:
                now = asyncio.get_event_loop().time()
            except RuntimeError:
                return
            elapsed = now - self._last
            self._last = now
            self._tokens = min(self._rate * 60, self._tokens + elapsed * self._rate)
            if self._tokens < 1:
                wait = (1 - self._tokens) / self._rate
                await asyncio.sleep(wait)
                self._tokens = 0
            else:
                self._tokens -= 1


# Lazily initialised so they're created inside the event loop
_chat_limiter: Optional[_TokenBucket] = None
_audio_limiter: Optional[_TokenBucket] = None


def _get_chat_limiter() -> _TokenBucket:
    global _chat_limiter
    if _chat_limiter is None:
        _chat_limiter = _TokenBucket(_CHAT_RATE)
    return _chat_limiter


def _get_audio_limiter() -> _TokenBucket:
    global _audio_limiter
    if _audio_limiter is None:
        _audio_limiter = _TokenBucket(_AUDIO_RATE)
    return _audio_limiter


class GroqServiceError(Exception):
    """Raised when the Groq API is unavailable or returns an error."""


# ── HTTP helper ────────────────────────────────────────────────────────────────

async def post_groq(
    client: httpx.AsyncClient,
    url: str,
    *,
    headers: dict,
    json: dict = None,
    data=None,
    files=None,
    limiter: Optional[_TokenBucket] = None,
    request_name: str = "Groq request",
) -> Optional[httpx.Response]:
    """
    POST to Groq with optional rate limiting and structured error handling.
    Returns the response object on success, None on failure.
    """
    if limiter is None:
        limiter = _get_chat_limiter()

    await limiter.acquire()

    try:
        if json is not None:
            resp = await client.post(url, headers=headers, json=json)
        else:
            resp = await client.post(url, headers=headers, data=data, files=files)

        if resp.status_code == 429:
            retry_after = float(resp.headers.get("retry-after", 5))
            logger.warning("%s hit rate limit; waiting %.1fs", request_name, retry_after)
            await asyncio.sleep(retry_after)
            # Retry once
            if json is not None:
                resp = await client.post(url, headers=headers, json=json)
            else:
                resp = await client.post(url, headers=headers, data=data, files=files)

        resp.raise_for_status()
        return resp

    except httpx.HTTPStatusError as e:
        logger.error("%s HTTP error %s: %s", request_name, e.response.status_code, e.response.text[:200])
        return None
    except httpx.RequestError as e:
        logger.error("%s request error: %s", request_name, e)
        return None


# Module-level instances — created lazily on first import (no running loop needed at definition time)
CHAT_LIMITER = _get_chat_limiter()
AUDIO_LIMITER = _get_audio_limiter()
