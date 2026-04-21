import logging
from typing import Optional

import httpx

from backend.config import settings
from backend.utils.geo import haversine, osrm_coords_string
from backend.services.cache import get_route, set_route, get_matrix, set_matrix

logger = logging.getLogger(__name__)

# ── Valhalla free-tier routing (no API key required) ─────────────────────────
VALHALLA_URL = "https://valhalla1.openstreetmap.de"

OSRM_PROFILE_MAP = {
    "foot": "walking",
    "walk": "walking",
    "pedestrian": "walking",
    "bike": "cycling",
    "bicycle": "cycling",
    "car": "driving",
    "drive": "driving",
    "driving": "driving",
    "walking": "walking",
    "cycling": "cycling",
}

VALHALLA_COSTING_MAP = {
    "driving": "auto",
    "car": "auto",
    "auto": "auto",
    "cycling": "bicycle",
    "bike": "bicycle",
    "bicycle": "bicycle",
    "walking": "pedestrian",
    "foot": "pedestrian",
    "pedestrian": "pedestrian",
}

PROFILE_SPEED_KMH = {
    "driving": 40.0,
    "cycling": 15.0,
    "walking": 5.0,
}


def _normalize_osrm_profile(profile: str) -> str:
    return OSRM_PROFILE_MAP.get(profile.lower().strip(), "driving")


def _normalize_valhalla_costing(profile: str) -> str:
    norm = _normalize_osrm_profile(profile)
    return VALHALLA_COSTING_MAP.get(norm, "auto")


def _fallback_speed_kmh(profile: str) -> float:
    norm = _normalize_osrm_profile(profile)
    return PROFILE_SPEED_KMH.get(norm, 5.0)


def _decode_valhalla_polyline(encoded: str) -> list:
    """
    Decode Valhalla's default polyline6 encoding (precision 1e6).
    Returns [[lon, lat], ...] in GeoJSON order.
    """
    result = []
    index = 0
    lat = 0
    lng = 0
    length = len(encoded)
    while index < length:
        # latitude
        shift, value = 0, 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            value |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        lat += (~(value >> 1) if value & 1 else value >> 1)
        # longitude
        shift, value = 0, 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            value |= (b & 0x1f) << shift
            shift += 5
            if b < 0x20:
                break
        lng += (~(value >> 1) if value & 1 else value >> 1)
        result.append([lng / 1e6, lat / 1e6])   # [lon, lat] GeoJSON order
    return result


async def _valhalla_route(stops: list, costing: str) -> Optional[dict]:
    """
    Route via Valhalla public instance (no API key, free).
    Uses default polyline6 shape encoding (more compatible than shape_format=geojson).
    Returns same shape as get_route_between, or None on failure.
    """
    locations = [{"lat": s["lat"], "lon": s["lon"]} for s in stops]
    payload = {
        "locations": locations,
        "costing": costing,
        "directions_options": {"units": "kilometers"},
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.post(f"{VALHALLA_URL}/route", json=payload)
            resp.raise_for_status()
            data = resp.json()
            legs = data.get("trip", {}).get("legs", [])
            if not legs:
                return None
            # Merge all leg shapes into one coordinate list
            all_coords: list = []
            for leg in legs:
                shape = leg.get("shape", "")
                if isinstance(shape, dict):
                    # GeoJSON format (newer Valhalla instances)
                    all_coords.extend(shape.get("coordinates", []))
                elif isinstance(shape, str) and shape:
                    # Default polyline6 encoding
                    all_coords.extend(_decode_valhalla_polyline(shape))
            if not all_coords:
                return None
            summary = data.get("trip", {}).get("summary", {})
            return {
                "total_distance_m": summary.get("length", 0) * 1000,
                "total_duration_s": summary.get("time", 0),
                "geometry": {"type": "LineString", "coordinates": all_coords},
                "is_fallback": False,
            }
        except Exception as e:
            logger.warning("Valhalla route failed: %s", e)
            return None


async def _valhalla_matrix(stops: list, costing: str) -> Optional[dict]:
    """
    Duration/distance matrix via Valhalla sources_to_targets.
    Returns {durations: [[]], distances: [[]], is_fallback: bool} or None.
    """
    locations = [{"lat": s["lat"], "lon": s["lon"]} for s in stops]
    payload = {
        "sources": locations,
        "targets": locations,
        "costing": costing,
    }
    async with httpx.AsyncClient(timeout=20.0) as client:
        try:
            resp = await client.post(f"{VALHALLA_URL}/sources_to_targets", json=payload)
            resp.raise_for_status()
            data = resp.json()
            rows = data.get("sources_to_targets", [])
            if not rows:
                return None
            n = len(stops)
            durations = [[0.0] * n for _ in range(n)]
            distances = [[0.0] * n for _ in range(n)]
            for i, row in enumerate(rows):
                for cell in row:
                    j = cell.get("to_index", 0)
                    durations[i][j] = cell.get("time", 0) or 0.0
                    distances[i][j] = (cell.get("distance", 0) or 0.0) * 1000  # km → m
            return {"durations": durations, "distances": distances, "is_fallback": False}
        except Exception as e:
            logger.warning("Valhalla matrix failed: %s", e)
            return None


async def get_route_between(stops: list, profile: str = "driving") -> dict:
    """
    Get road-following route between stops (list of {lat, lon}).
    Priority: OSRM → Valhalla → straight-line Haversine fallback.
    Returns: {total_distance_m, total_duration_s, geometry, is_fallback}
    """
    # Check cache for 2-stop case
    if len(stops) == 2:
        cached = get_route(stops[0]['lat'], stops[0]['lon'], stops[1]['lat'], stops[1]['lon'])
        if cached:
            return cached

    osrm_profile = _normalize_osrm_profile(profile)
    valhalla_costing = _normalize_valhalla_costing(profile)

    # ── 1. Try OSRM (public demo, short timeout so we fail fast) ─────────────
    coords_str = osrm_coords_string(stops)
    url = f"{settings.OSRM_BASE_URL}/route/v1/{osrm_profile}/{coords_str}"

    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.get(
                url,
                params={"overview": "full", "geometries": "geojson", "steps": "true"}
            )
            resp.raise_for_status()
            data = resp.json()
            route = data["routes"][0]
            # Parse turn-by-turn steps from all legs
            steps = []
            for leg in route.get("legs", []):
                for step in leg.get("steps", []):
                    maneuver = step.get("maneuver", {})
                    steps.append({
                        "instruction": step.get("name", ""),
                        "distance_m": round(step.get("distance", 0)),
                        "duration_s": round(step.get("duration", 0)),
                        "maneuver_type": maneuver.get("type", ""),
                        "maneuver_modifier": maneuver.get("modifier", "straight"),
                    })
            result = {
                "total_distance_m": route["distance"],
                "total_duration_s": route["duration"],
                "geometry": route["geometry"],
                "is_fallback": False,
                "steps": steps,
            }
            if len(stops) == 2:
                set_route(
                    stops[0]['lat'], stops[0]['lon'],
                    stops[1]['lat'], stops[1]['lon'],
                    result
                )
            return result
        except Exception as e:
            logger.warning("OSRM route failed: %s", e)

    # ── 2. Try Valhalla (free, no key) ───────────────────────────────────────
    logger.info("OSRM unavailable — trying Valhalla routing")
    valhalla = await _valhalla_route(stops, valhalla_costing)
    if valhalla:
        if len(stops) == 2:
            set_route(
                stops[0]['lat'], stops[0]['lon'],
                stops[1]['lat'], stops[1]['lon'],
                valhalla
            )
        return valhalla

    # ── 3. Final fallback: straight Haversine line ────────────────────────────
    logger.warning("Both OSRM and Valhalla failed — using straight-line fallback")
    total_dist = sum(
        haversine(stops[i]['lat'], stops[i]['lon'], stops[i + 1]['lat'], stops[i + 1]['lon'])
        for i in range(len(stops) - 1)
    )
    speed_kmh = _fallback_speed_kmh(profile)
    total_dur = (total_dist / 1000 / speed_kmh) * 3600
    coords = [[s['lon'], s['lat']] for s in stops]
    return {
        "total_distance_m": total_dist,
        "total_duration_s": total_dur,
        "geometry": {"type": "LineString", "coordinates": coords},
        "is_fallback": True,
        "steps": [],
    }


async def get_distance_matrix(stops: list, profile: str = "driving") -> dict:
    """
    Get duration/distance matrix for all stops.
    Priority: OSRM Table API → Valhalla sources_to_targets → Haversine.
    Returns: {durations: [[]], distances: [[]], is_fallback: bool}
    """
    coords_list = [{"lat": s['lat'], "lon": s['lon']} for s in stops]

    cached = get_matrix(coords_list)
    if cached:
        return cached

    osrm_profile = _normalize_osrm_profile(profile)
    valhalla_costing = _normalize_valhalla_costing(profile)

    # ── 1. Try OSRM table (short timeout so we fail fast) ───────────────────
    coords_str = osrm_coords_string(stops)
    url = f"{settings.OSRM_BASE_URL}/table/v1/{osrm_profile}/{coords_str}"

    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            resp = await client.get(url, params={"annotations": "duration,distance"})
            resp.raise_for_status()
            data = resp.json()
            result = {
                "durations": data.get("durations", []),
                "distances": data.get("distances", []),
                "is_fallback": False
            }
            set_matrix(coords_list, result)
            return result
        except Exception as e:
            logger.warning("OSRM table failed: %s", e)

    # ── 2. Try Valhalla matrix ───────────────────────────────────────────────
    logger.info("OSRM table unavailable — trying Valhalla matrix")
    valhalla = await _valhalla_matrix(stops, valhalla_costing)
    if valhalla:
        set_matrix(coords_list, valhalla)
        return valhalla

    # ── 3. Final fallback: Haversine straight-line matrix ────────────────────
    logger.warning("Both OSRM and Valhalla matrix failed — using Haversine fallback")
    n = len(stops)
    dist_matrix = [[0.0] * n for _ in range(n)]
    dur_matrix = [[0.0] * n for _ in range(n)]
    speed_kmh = _fallback_speed_kmh(profile)
    for i in range(n):
        for j in range(n):
            if i != j:
                d = haversine(
                    stops[i]['lat'], stops[i]['lon'],
                    stops[j]['lat'], stops[j]['lon']
                )
                dist_matrix[i][j] = d
                dur_matrix[i][j] = (d / 1000 / speed_kmh) * 3600
    result = {"durations": dur_matrix, "distances": dist_matrix, "is_fallback": True}
    set_matrix(coords_list, result)
    return result

