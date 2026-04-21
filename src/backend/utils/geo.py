import math
from datetime import datetime, timedelta
from typing import Tuple, List, Optional


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in metres between two points."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def walking_eta_min(distance_m: float, speed_kmh: float = 5.0) -> float:
    """Estimate walking time in minutes given distance in metres."""
    return (distance_m / 1000) / speed_kmh * 60


def to_osrm(lat: float, lon: float) -> str:
    """OSRM expects lon,lat"""
    return f"{lon},{lat}"


def to_osrm_pair(lat: float, lon: float) -> Tuple[float, float]:
    return (lon, lat)


def to_leaflet(lat: float, lon: float) -> list:
    """Leaflet expects [lat, lng]"""
    return [lat, lon]


def osrm_coords_string(stops: list) -> str:
    """Build OSRM coordinate string from list of {lat, lon} dicts"""
    return ";".join(f"{s['lon']},{s['lat']}" for s in stops)


def check_proximity(user_lat: float, user_lon: float, stops: list, radius_m: float = 100) -> list:
    """Mark stops as approaching or auto-checkin eligible. Returns updated stops."""
    updated = []
    for stop in stops:
        dist = haversine(user_lat, user_lon, stop['lat'], stop['lon'])
        stop = {**stop, 'distance_from_user': round(dist)}
        if dist <= radius_m and stop.get('status') == 'pending':
            stop['status'] = 'approaching'
        updated.append(stop)
    return updated


def adjust_times_from_now(
    stops: list,
    now_iso: str,
    travel_durations_min: Optional[List[float]] = None
) -> list:
    """
    Reschedule stop times starting from now.
    travel_durations_min: list of travel times between consecutive stops (OSRM-derived preferred).
    If None or 0 for a segment, uses walking_eta_min as fallback.
    """
    if not stops:
        return stops

    try:
        current_time = datetime.fromisoformat(now_iso)
    except Exception:
        current_time = datetime.now()

    result = []
    for i, stop in enumerate(stops):
        duration = stop.get('duration_min', 60)
        start = current_time
        end = start + timedelta(minutes=duration)
        stop = {
            **stop,
            'planned_start': start.strftime('%H:%M'),
            'planned_end': end.strftime('%H:%M'),
        }
        result.append(stop)

        # Travel to next stop
        if i < len(stops) - 1:
            if travel_durations_min and i < len(travel_durations_min) and travel_durations_min[i]:
                travel = travel_durations_min[i]
            else:
                # Haversine fallback
                next_stop = stops[i + 1]
                dist = haversine(stop['lat'], stop['lon'], next_stop['lat'], next_stop['lon'])
                travel = walking_eta_min(dist)
            current_time = end + timedelta(minutes=travel)

    return result

