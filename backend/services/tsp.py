import logging
from typing import List

from backend.services.routing import get_distance_matrix
from backend.utils.geo import haversine

logger = logging.getLogger(__name__)


async def optimise_stops(stops: list, profile: str = "walking") -> list:
    """
    Reorder stops using nearest-neighbor + 2-opt.
    Uses OSRM duration matrix (falls back to Haversine).
    Locked stops (completed/in-progress) stay in place.
    Returns stops with updated visit_order and travel_duration_to_next_min.
    """
    if len(stops) <= 1:
        if stops:
            return [{**stops[0], "visit_order": 1, "travel_to_next_min": 0, "travel_to_next_m": 0, "route_is_fallback": False}]
        return stops

    # Separate locked and free stops
    locked = [i for i, s in enumerate(stops) if s.get('status') in ('completed', 'in-progress', 'checked-in')]

    # Get duration matrix using the correct transport profile
    matrix_data = await get_distance_matrix(stops, profile=profile)
    dur_matrix = matrix_data.get("durations", [])
    dist_matrix = matrix_data.get("distances", [])
    is_fallback = matrix_data.get("is_fallback", True)

    n = len(stops)

    # Nearest-neighbor from index 0
    visited = [False] * n
    order = []

    # Start with first locked stop if any, else stop 0
    if locked:
        current = locked[0]
    else:
        current = 0

    visited[current] = True
    order.append(current)

    while len(order) < n:
        best_next = -1
        best_dur = float('inf')
        for j in range(n):
            if not visited[j] and j not in locked:
                d = dur_matrix[current][j] if dur_matrix and len(dur_matrix) > current and len(dur_matrix[current]) > j else float('inf')
                if d < best_dur:
                    best_dur = d
                    best_next = j
        if best_next == -1:
            # Add any remaining unvisited
            for j in range(n):
                if not visited[j]:
                    best_next = j
                    break
        if best_next == -1:
            break
        visited[best_next] = True
        order.append(best_next)
        current = best_next

    # 2-opt improvement (skip locked positions)
    def route_duration(route: list) -> float:
        if not dur_matrix:
            return 0.0
        total = 0.0
        for i in range(len(route) - 1):
            ri, rj = route[i], route[i + 1]
            if len(dur_matrix) > ri and len(dur_matrix[ri]) > rj:
                total += dur_matrix[ri][rj]
        return total

    improved = True
    iterations = 0
    while improved and iterations < 300:
        improved = False
        iterations += 1
        for i in range(1, len(order) - 1):
            for j in range(i + 1, len(order)):
                 if order[i] in locked or order[j] in locked:
                     continue
                 new_order = order[:i] + order[i:j + 1][::-1] + order[j + 1:]
                 if route_duration(new_order) < route_duration(order):
                     order = new_order
                     improved = True

    # Reorder stops and assign travel times
    reordered = []
    for rank, orig_idx in enumerate(order):
        stop = {**stops[orig_idx], "visit_order": rank + 1, "route_is_fallback": is_fallback}
        # Travel duration to next stop
        if rank < len(order) - 1:
            next_idx = order[rank + 1]
            dur_s = 0.0
            dist_m = 0.0
            if dur_matrix and len(dur_matrix) > orig_idx and len(dur_matrix[orig_idx]) > next_idx:
                dur_s = dur_matrix[orig_idx][next_idx] or 0.0
            if dist_matrix and len(dist_matrix) > orig_idx and len(dist_matrix[orig_idx]) > next_idx:
                dist_m = dist_matrix[orig_idx][next_idx] or 0.0
            stop["travel_to_next_min"] = round(dur_s / 60, 1)
            stop["travel_to_next_m"] = round(dist_m)
        else:
            stop["travel_to_next_min"] = 0
            stop["travel_to_next_m"] = 0
        reordered.append(stop)

    return reordered


