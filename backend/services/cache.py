import json
import hashlib
import re as _re
import time
from pathlib import Path
from typing import Optional, Dict

from backend.config import settings

# ── In-memory route cache ─────────────────────────────────────────────────────
_route_cache: Dict[str, tuple] = {}
_TTL = settings.ROUTE_CACHE_TTL_SECONDS


def _route_key(lat1: float, lon1: float, lat2: float, lon2: float) -> str:
    return f"{lat1:.5f},{lon1:.5f}_{lat2:.5f},{lon2:.5f}"


def get_route(lat1: float, lon1: float, lat2: float, lon2: float) -> Optional[dict]:
    key = _route_key(lat1, lon1, lat2, lon2)
    if key in _route_cache:
        val, ts = _route_cache[key]
        if time.time() - ts < _TTL:
            return val
        del _route_cache[key]
    return None


def set_route(lat1: float, lon1: float, lat2: float, lon2: float, data: dict):
    key = _route_key(lat1, lon1, lat2, lon2)
    _route_cache[key] = (data, time.time())


# ── In-memory distance matrix cache ──────────────────────────────────────────
_matrix_cache: Dict[str, tuple] = {}


def _matrix_key(coords_list: list) -> str:
    raw = json.dumps(coords_list, sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()


def get_matrix(coords_list: list) -> Optional[dict]:
    key = _matrix_key(coords_list)
    if key in _matrix_cache:
        val, ts = _matrix_cache[key]
        if time.time() - ts < _TTL:
            return val
        del _matrix_cache[key]
    return None


def set_matrix(coords_list: list, data: dict):
    key = _matrix_key(coords_list)
    _matrix_cache[key] = (data, time.time())


# ── Itinerary disk cache (JSONL) ──────────────────────────────────────────────
def _itinerary_key(
    destination: str,
    days: int,
    interests: list,
    manual_places: list,
    pace: str,
) -> str:
    raw = json.dumps({
        "destination": destination.lower().strip(),
        "days": days,
        "interests": sorted(interests),
        "manual_places": sorted(manual_places),
        "pace": pace,
        "schema_v": "2",
    }, sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()


def _cache_path() -> Path:
    p = Path(settings.CACHE_DIR)
    p.mkdir(parents=True, exist_ok=True)
    return p / "itineraries.jsonl"


def load_itinerary(
    destination: str,
    days: int,
    interests: list,
    manual_places: list,
    pace: str,
) -> Optional[dict]:
    key = _itinerary_key(destination, days, interests, manual_places, pace)
    path = _cache_path()
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            try:
                record = json.loads(line)
                if record.get("key") == key:
                    return record.get("data")
            except json.JSONDecodeError:
                continue
    return None


def save_itinerary(
    destination: str,
    days: int,
    interests: list,
    manual_places: list,
    pace: str,
    data: dict,
):
    key = _itinerary_key(destination, days, interests, manual_places, pace)
    path = _cache_path()
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps({"key": key, "data": data}) + "\n")


# ── Mid-trip suggestion cache (JSONL disk) ────────────────────────────────────
def _replan_cache_path() -> Path:
    p = Path(settings.CACHE_DIR)
    p.mkdir(parents=True, exist_ok=True)
    return p / "midtrip_suggestions.jsonl"


def _replan_key(
    destination: str,
    day_num: int,
    anchor: str,
    user_request: str,
    interests: list,
    pace: str,
) -> str:
    raw = json.dumps({
        "destination": destination.lower().strip(),
        "day_num": int(day_num),
        "anchor": anchor.lower().strip(),
        "user_request": _re.sub(r"\s+", " ", user_request.lower().strip()),
        "interests": sorted(i.lower() for i in interests),
        "pace": pace.lower().strip(),
        "schema_v": "1",
    }, sort_keys=True)
    return hashlib.md5(raw.encode()).hexdigest()


def load_midtrip(
    destination: str,
    day_num: int,
    anchor: str,
    user_request: str,
    interests: list,
    pace: str,
) -> Optional[dict]:
    key = _replan_key(destination, day_num, anchor, user_request, interests, pace)
    path = _replan_cache_path()
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            try:
                rec = json.loads(line)
                if rec.get("key") == key:
                    return rec.get("data")
            except json.JSONDecodeError:
                continue
    return None


def save_midtrip(
    destination: str,
    day_num: int,
    anchor: str,
    user_request: str,
    interests: list,
    pace: str,
    data: dict,
) -> None:
    key = _replan_key(destination, day_num, anchor, user_request, interests, pace)
    path = _replan_cache_path()
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps({"key": key, "data": data}) + "\n")
