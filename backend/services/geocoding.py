import asyncio
import logging
import math
import re
from typing import Optional, Tuple

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

# In-process cache: city name → (lat, lon) center
_city_center_cache: dict[str, Optional[Tuple[float, float]]] = {}

# Nominatim requires max 1 req/sec — semaphore enforces this even with asyncio.gather
_nominatim_sem = asyncio.Semaphore(1)

# Per-city lock to prevent duplicate geocoding under asyncio.gather
_city_locks: dict[str, asyncio.Lock] = {}

# Prefixes that LLMs add but Nominatim may not index
_STRIP_PREFIXES = re.compile(
    r"^(the|a|an|national|historic|old|new|great|grand|royal|city of|town of|"
    r"saint|st\.?|mount|mt\.?|fort|ft\.?|lake|lakes|point|port)\s+",
    re.IGNORECASE,
)


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _candidate_queries(place: str, city: str) -> list[str]:
    """
    Generate a prioritised list of Nominatim query strings for a place.
    Tries the exact LLM name first, then progressively looser variants.
    """
    queries: list[str] = []
    p = place.strip()

    # 1. Exact name + city
    if city:
        queries.append(f"{p}, {city}")
    # 2. Exact name alone
    queries.append(p)

    # 3. Strip leading article/adjective and retry with city
    stripped = _STRIP_PREFIXES.sub("", p).strip()
    if stripped and stripped.lower() != p.lower():
        if city:
            queries.append(f"{stripped}, {city}")
        queries.append(stripped)

    # 4. First 3 significant words + city (handles long names like
    #    "National Mall and Memorial Parks Visitor Center")
    words = p.split()
    if len(words) > 3:
        short = " ".join(words[:3])
        if city:
            queries.append(f"{short}, {city}")
        queries.append(short)

    # 5. Last word only (often the landmark type) + city
    if len(words) > 1:
        last = words[-1]
        if city:
            queries.append(f"{last}, {city}")

    # De-duplicate while preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for q in queries:
        if q.lower() not in seen:
            seen.add(q.lower())
            deduped.append(q)
    return deduped


async def _geocode_city_center(city: str) -> Optional[Tuple[float, float]]:
    """
    Get the lat/lon center of a city for viewbox biasing.
    Cached per process to avoid repeated Nominatim calls.
    """
    if city in _city_center_cache:
        return _city_center_cache[city]

    if city not in _city_locks:
        _city_locks[city] = asyncio.Lock()
    async with _city_locks[city]:
        if city in _city_center_cache:
            return _city_center_cache[city]

        url = f"{settings.NOMINATIM_BASE_URL}/search"
        params = {"q": city, "format": "json", "limit": 1}
        headers = {"User-Agent": "NomadAI/1.0 travel-planner"}

        async with httpx.AsyncClient(timeout=8.0) as client:
            try:
                async with _nominatim_sem:
                    await asyncio.sleep(0.5)
                    resp = await client.get(url, params=params, headers=headers)
                    resp.raise_for_status()
                    results = resp.json()
                if results:
                    center = (float(results[0]["lat"]), float(results[0]["lon"]))
                    _city_center_cache[city] = center
                    return center
            except Exception as e:
                logger.warning(f"City center geocode failed for '{city}': {e}")

        _city_center_cache[city] = None
        return None


async def _try_query(
    query: str,
    client: httpx.AsyncClient,
    url: str,
    headers: dict,
    city_center: Optional[Tuple[float, float]],
) -> Optional[Tuple[float, float]]:
    """
    Fire a single Nominatim query and return the best result.
    Uses city_center to pick the closest match when multiple candidates exist.
    Returns None if no result is within 100 km of the city center (when known).
    """
    params: dict = {"q": query, "format": "json", "limit": 5}
    if city_center:
        clat, clon = city_center
        radius = 0.8
        params["viewbox"] = f"{clon - radius},{clat + radius},{clon + radius},{clat - radius}"

    async with _nominatim_sem:
        await asyncio.sleep(0.5)
        try:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            results = resp.json()
        except Exception as e:
            logger.warning(f"Nominatim request failed for '{query}': {e}")
            return None

    if not results:
        return None

    if city_center and len(results) > 0:
        clat, clon = city_center
        best = min(results, key=lambda r: _haversine_km(clat, clon, float(r["lat"]), float(r["lon"])))
        dist = _haversine_km(clat, clon, float(best["lat"]), float(best["lon"]))
        if dist <= 100:
            return float(best["lat"]), float(best["lon"])
        # All candidates are far — only return if there's no city bias (last-resort)
        logger.debug("Geocode '%s': nearest result is %.0f km from city center, skipping", query, dist)
        return None

    return float(results[0]["lat"]), float(results[0]["lon"])


async def geocode(place: str, city: str = "") -> Optional[Tuple[float, float]]:
    """
    Geocode a place name to (lat, lon).

    Strategy (stops on first success):
      1. Exact LLM name + city
      2. Exact LLM name alone (ranked by city proximity)
      3. Name without leading adjective/article  (e.g. "National Reflecting Pool" → "Reflecting Pool")
      4. First 3 words + city  (handles very long names)
      5. Last word + city  (landmark type as last resort)

    For each candidate query, up to 5 Nominatim results are fetched and the
    one closest to the city centre is returned (provided it's within 100 km).
    """
    city_center = await _geocode_city_center(city) if city else None
    queries = _candidate_queries(place, city)

    url = f"{settings.NOMINATIM_BASE_URL}/search"
    headers = {"User-Agent": "NomadAI/1.0 travel-planner"}

    async with httpx.AsyncClient(timeout=12.0) as client:
        for q in queries:
            result = await _try_query(q, client, url, headers, city_center)
            if result:
                if q != f"{place}, {city}" and q != place:
                    logger.info("Geocoded '%s' via fallback query '%s'", place, q)
                return result

    logger.warning("Could not geocode '%s' (city=%s) after %d attempts", place, city, len(queries))
    return None
