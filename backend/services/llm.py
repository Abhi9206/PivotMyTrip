import json
import logging
import re
from typing import Optional

import httpx

from backend.config import settings
from backend.services.groq import CHAT_LIMITER, GroqServiceError, post_groq

logger = logging.getLogger(__name__)


def _build_itinerary_prompt(
    destination: str,
    days: int,
    interests: list,
    manual_places: list,
    pace: str,
    start_location: str = ""
) -> str:
    pace_desc = {
        "relaxed": "relaxed pace with 5-6 stops per day, longer visits (90-120 min each), covering morning through early evening (09:00-19:00)",
        "balanced": "balanced pace with 6-8 stops per day (60-90 min each), covering a full day from 09:00 to 20:00",
        "fast": "fast pace with 8-10 stops per day (45-60 min each), maximizing sightseeing from 09:00 to 21:00"
    }.get(pace, "balanced pace with 6-8 stops per day (60-90 min each), covering a full day from 09:00 to 20:00")

    interests_str = ", ".join(interests) if interests else "general sightseeing"
    interest_note = ""
    if interests:
        interest_note = f"\nIMPORTANT: The traveler's interests are {interests_str}. Strongly prioritize stops matching these categories. Avoid including stops from unrelated categories unless they are unmissable landmarks.\n"

    manual_str = ""
    if manual_places:
        manual_str = f"\nCRITICAL — MUST-INCLUDE PLACES: You MUST include ALL of the following specific places in the itinerary, distributed across appropriate days: {', '.join(manual_places)}. Do NOT skip any of these. Incorporate them at a logical time of day.\n"

    start_str = ""
    if start_location:
        start_str = f"\nStart location each day: {start_location} (plan routes starting from here)\n"

    return f"""You are an expert travel planner. Create a detailed {days}-day itinerary for {destination}.

Travel style: {pace_desc}
Interests: {interests_str}{interest_note}{manual_str}{start_str}

IMPORTANT RULES:
- Generate AT LEAST 6 stops per day for balanced pace (adjust for relaxed/fast pace accordingly).
- Each day must cover a FULL day of activities — do not end before 18:00.
- Stops must be geographically clustered by neighborhood to minimize travel time.
- Stop names must be specific and geocodable (e.g. "Senso-ji Temple, Asakusa, Tokyo" not just "temple").

Return ONLY valid JSON matching this structure. Do NOT include markdown code blocks or any text outside the JSON:
{{
  "destination": "{destination}",
  "overview": "Brief overview of the trip",
  "plan": [
    {{
      "day": 1,
      "theme": "Day theme",
      "overview": "What this day covers",
      "stops": [
        {{
          "name": "Exact geocodable place name",
          "category": "one of: culture|food|nature|shopping|entertainment|transport|accommodation",
          "description": "2-3 sentence description",
          "duration_min": 90,
          "suggested_time_slot": "Morning|Lunch|Afternoon|Evening|Dinner"
        }}
      ]
    }}
  ]
}}

Each day should have a logical geographic flow to minimize travel. Aim for variety — mix sightseeing, meals, and activities."""


async def _call_groq(prompt: str, model: str = "llama-3.3-70b-versatile") -> Optional[str]:
    """Call Groq API."""
    if not settings.GROQ_API_KEY:
        return None
    print("GROQ KEY LOADED:", bool(settings.GROQ_API_KEY))

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": 4096,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await post_groq(
            client,
            "https://api.groq.com/openai/v1/chat/completions",
            headers=headers,
            json=payload,
            limiter=CHAT_LIMITER,
            request_name="Groq chat completion",
        )
        if not resp:
            return None

        try:
            content = resp.json()["choices"][0]["message"]["content"]
            return content if isinstance(content, str) else None
        except (KeyError, IndexError, TypeError, ValueError) as e:
            logger.error("Groq chat response had an unexpected structure: %s", e)
            return None
    return None


async def _call_ollama(prompt: str) -> Optional[str]:
    """Call Ollama API as fallback."""
    payload = {
        "model": settings.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json"
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            resp = await client.post(
                f"{settings.OLLAMA_BASE_URL}/api/generate",
                json=payload
            )
            resp.raise_for_status()
            return resp.json().get("response", "")
        except Exception as e:
            logger.error(f"Ollama failed: {e}")
            return None


def _normalize_voice_command(result: dict) -> dict:
    raw_params = result.get("params") or {}
    if not isinstance(raw_params, dict):
        raw_params = {}

    params = {
        "destination": raw_params.get("destination"),
        "days": raw_params.get("days"),
        "pace": raw_params.get("pace"),
        "start_location": raw_params.get("start_location"),
        "start_time": raw_params.get("start_time"),
        "transport_mode": raw_params.get("transport_mode"),
        "manual_places": raw_params.get("manual_places") or [],
        "stop_name": raw_params.get("stop_name"),
        "stop_after": raw_params.get("stop_after"),
        "interests": raw_params.get("interests") or [],
    }


    normalized = {
        "intent": result.get("intent", "unknown"),
        "confidence": result.get("confidence", 0.0),
        "params": params,
        "human_response": result.get(
            "human_response",
            "Sorry, I couldn't understand that command."
        ),
    }

    if normalized["intent"] not in {
        "generate_itinerary",
        "add_stop",
        "remove_stop",
        "skip_stop",
        "replan",
        "change_pace",
        "set_destination",
        "unknown",
    }:
        normalized["intent"] = "unknown"

    try:
        normalized["confidence"] = float(normalized["confidence"])
    except (TypeError, ValueError):
        normalized["confidence"] = 0.0

    return normalized


def _extract_json(text: str) -> Optional[dict]:
    """Extract and parse JSON from LLM output."""
    if not text:
        return None
    # Remove markdown code blocks
    text = re.sub(r'```(?:json)?\s*', '', text)
    text = re.sub(r'```\s*', '', text)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            try:
                return json.loads(match.group(0))
            except Exception:
                pass
    return None


async def generate_itinerary(
    destination: str,
    days: int,
    interests: list,
    manual_places: list,
    pace: str,
    start_location: str = ""
) -> Optional[dict]:
    """Generate itinerary using Groq (primary) or Ollama (fallback)."""
    prompt = _build_itinerary_prompt(destination, days, interests, manual_places, pace, start_location)

    # Try Groq first
    text = await _call_groq(prompt)
    provider = "groq"

    if not text:
        logger.info("Groq unavailable, falling back to Ollama")
        text = await _call_ollama(prompt)
        provider = "ollama"

    if not text:
        logger.error("Both Groq and Ollama failed")
        return None

    data = _extract_json(text)
    if data:
        data["_llm_provider"] = provider
    return data


async def parse_voice_command(
    transcript: str,
    current_itinerary_summary: str = ""
) -> Optional[dict]:
    """Parse voice transcript into structured command using Groq."""
    prompt = f"""Parse this voice command from a travel app user into structured trip-form fields.

Voice command: "{transcript}"
{f'Current itinerary context: {current_itinerary_summary}' if current_itinerary_summary else ''}

Important rules:
- Extract as many trip form fields as are clearly mentioned.
- Convert spoken times like "8", "8 AM", "8 in the morning", "09:30 AM" into HH:MM 24-hour format.
- Put hotel or base into "start_location".
- Put "walking", "cycling", or "driving" into "transport_mode".
- Put specific requested places into "manual_places".
- Treat words like "preferences", "preferred places", "interests", and "I want" as the same idea for the "interests" field.
- For "interests", return only these exact IDs when mentioned:
  history, food, nature, shopping, art, nightlife, adventure, architecture
- Map phrases like:
  "history and culture" -> "history"
  "art and museums" -> "art"
  "food and dining" -> "food"
  "nature and parks" -> "nature"
- If a field is not mentioned, return null or an empty list as appropriate.
- Return JSON only. No markdown. No explanation.

Return ONLY valid JSON with this structure:
{{
  "intent": "one of: generate_itinerary|add_stop|remove_stop|skip_stop|replan|change_pace|set_destination|unknown",
  "confidence": 0.0,
  "params": {{
    "destination": null,
    "days": null,
    "pace": null,
    "start_location": null,
    "start_time": null,
    "transport_mode": null,
    "manual_places": [],
    "stop_name": null,
    "stop_after": null,
    "interests": ["use only these IDs if mentioned: history|food|nature|shopping|art|nightlife|adventure|architecture"]
  }},
  "human_response": "A friendly confirmation of what you understood"
}}
"""

    text = await _call_groq(prompt, model="llama-3.1-8b-instant")
    if not text:
        raise GroqServiceError("Groq voice command parsing is unavailable.")

    result = _extract_json(text)
    if not result:
        return {
            "intent": "unknown",
            "confidence": 0.0,
            "params": {},
            "human_response": "Sorry, I couldn't understand that command."
        }
    return _normalize_voice_command(result)


# ── Mid-Trip Suggestion Functions ─────────────────────────────────────────────

def detect_replan_intent(user_request: str) -> str:
    """Classify the user's mid-trip request into a category."""
    req = (user_request or "").lower().strip()
    if any(w in req for w in ["shop", "shopping", "mall", "market", "boutique", "souvenir", "retail", "store"]):
        return "shopping"
    if any(w in req for w in ["food", "eat", "restaurant", "cafe", "coffee", "lunch", "dinner", "dessert", "bakery"]):
        return "food"
    if any(w in req for w in ["museum", "history", "art", "gallery", "culture", "cultural", "landmark"]):
        return "culture"
    if any(w in req for w in ["park", "nature", "garden", "outdoor", "walk", "trail", "waterfront"]):
        return "outdoor"
    return "general"


def _filter_by_intent(suggestions: list, intent: str) -> list:
    """Filter suggestions by detected intent using allow/block lists."""
    allowed_map = {
        "shopping": ["shopping", "market", "mall", "boutique", "retail", "souvenir"],
        "food": ["food", "restaurant", "cafe", "dessert", "street food", "bakery"],
        "culture": ["museum", "history", "cultural", "landmark", "gallery", "art", "heritage"],
        "outdoor": ["park", "garden", "outdoor", "trail", "waterfront", "nature"],
        "general": [],
    }
    blocked_map = {
        "shopping": ["dessert", "bakery", "cupcake", "cafe", "restaurant", "food"],
        "food": [],
        "culture": ["restaurant", "bakery", "shopping mall"],
        "outdoor": ["bakery", "dessert"],
        "general": [],
    }
    if intent == "general":
        return suggestions

    allowed = allowed_map.get(intent, [])
    blocked = blocked_map.get(intent, [])
    result = []
    for s in suggestions:
        text = f"{s.get('category', '')} {s.get('name', '')} {s.get('description', '')}".lower()
        if any(w in text for w in allowed) and not any(w in text for w in blocked):
            result.append(s)
    return result


async def generate_midtrip_suggestions(
    destination: str,
    day_num: int,
    anchor_name: str,
    remaining_stops: list,
    interests: list,
    pace: str,
    user_request: str,
    n: int = 5,
) -> Optional[dict]:
    """Generate mid-trip suggestions using Groq (primary) or Ollama (fallback)."""
    intent = detect_replan_intent(user_request)
    remaining_text = ", ".join(s.get("name", "") for s in remaining_stops) if remaining_stops else "No remaining planned stops."

    strict_rules = {
        "shopping": "Return ONLY shopping-related places (shops, markets, malls, boutiques). Do NOT return cafes, restaurants, or food places.",
        "food": "Return ONLY food/drink places (restaurants, cafes, dessert shops, street food).",
        "culture": "Return ONLY museums, galleries, landmarks, and cultural heritage sites.",
        "outdoor": "Return ONLY parks, gardens, waterfronts, trails, and outdoor spaces.",
        "general": "Match the user's request as closely as possible.",
    }[intent]

    schema = {
        "anchor": anchor_name,
        "request_summary": "short summary of what the user wants",
        "suggestions": [
            {
                "name": "Exact place name",
                "category": "category",
                "estimated_duration_min": 60,
                "description": "Why this fits the request"
            }
        ]
    }

    prompt = f"""You are a smart travel replanning assistant for {destination}.

Context:
- Day: {day_num}
- Traveler interests: {', '.join(interests) if interests else 'General sightseeing'}
- Pace: {pace}
- Current / anchor stop: {anchor_name}
- Remaining planned stops: {remaining_text}
- User request: {user_request}

Task: Suggest {n} real places in {destination} for the rest of today.

Rules:
1. Suggest real places that EXIST in OpenStreetMap / Google Maps in {destination}.
2. Use the OFFICIAL, commonly-known name exactly as it appears on maps.
   e.g. "Lincoln Memorial Reflecting Pool" not "National Reflecting Pool",
        "Bryant Park" not "Bryant Urban Park",
        "The Metropolitan Museum of Art" not "National Art Museum NY".
3. Do not repeat the anchor stop or remaining planned stops.
4. Keep options realistic for the same day.
5. {strict_rules}
6. Return ONLY valid JSON matching: {json.dumps(schema, indent=2)}"""

    text = await _call_groq(prompt)
    provider = "groq"
    if not text:
        text = await _call_ollama(prompt)
        provider = "ollama"
    if not text:
        return None

    data = _extract_json(text)
    if not data:
        return None

    suggestions = data.get("suggestions", [])
    filtered = _filter_by_intent(suggestions, intent)
    data["suggestions"] = filtered if filtered else suggestions  # fall back to unfiltered if all blocked
    data["intent"] = intent
    data["_llm_provider"] = provider

    if not data.get("request_summary"):
        data["request_summary"] = f"Request type: {intent}"

    return data

