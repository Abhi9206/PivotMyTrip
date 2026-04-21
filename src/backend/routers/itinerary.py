import asyncio
import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException

from backend.models.schemas import (
    PlanRequest, ItineraryResponse, DayPlan, StopModel,
    ReplanRequest, RouteGeometryRequest, RouteGeometryResponse,
    MidTripRequest, ApplyMidTripSuggestionsRequest,
)
from backend.services.llm import generate_itinerary, generate_midtrip_suggestions
from backend.services.geocoding import geocode
from backend.services.tsp import optimise_stops
from backend.services.routing import get_route_between
from backend.services.cache import load_itinerary, save_itinerary, load_midtrip, save_midtrip
from backend.utils.geo import haversine, adjust_times_from_now

router = APIRouter(prefix="/api/itinerary", tags=["itinerary"])
logger = logging.getLogger(__name__)

PACE_DURATION_MULTIPLIERS = {"relaxed": 1.20, "balanced": 1.00, "fast": 0.85}


@router.post("/generate", response_model=ItineraryResponse)
async def generate(req: PlanRequest):
    # Check cache
    cached = load_itinerary(req.destination, req.days, req.interests, req.manual_places, req.pace)
    if cached:
        cached["cached"] = True
        return ItineraryResponse(**cached)

    # Generate with LLM
    raw = await generate_itinerary(
        req.destination, req.days, req.interests, req.manual_places, req.pace,
        start_location=req.start_location
    )
    if not raw:
        raise HTTPException(500, "LLM generation failed. Please check GROQ_API_KEY or ensure Ollama is running.")

    multiplier = PACE_DURATION_MULTIPLIERS.get(req.pace, 1.0)
    plan_out = []

    for day_data in raw.get("plan", []):
        day_num = day_data.get("day", 1)
        stops_raw = day_data.get("stops", [])

        # Geocode stops
        geocoded = []
        for stop_raw in stops_raw:
            stop_name = str(stop_raw.get("name", "")).strip()
            if not stop_name:
                logger.warning("Skipping malformed stop without a name: %s", stop_raw)
                continue

            coords = await geocode(stop_name, req.destination)
            if not coords:
                logger.warning(f"Could not geocode: {stop_name}")
                continue
            lat, lon = coords
            geocoded.append({
                "id": str(uuid.uuid4()),
                "name": stop_name,
                "lat": lat,
                "lon": lon,
                "category": stop_raw.get("category", "culture"),
                "description": stop_raw.get("description", ""),
                "duration_min": int(stop_raw.get("duration_min", 60) * multiplier),
                "status": "pending",
                "visit_order": 0,
                "travel_to_next_min": 0,
                "travel_to_next_m": 0,
                "route_is_fallback": False
            })

        if not geocoded:
            continue

        # TSP optimise using the trip's transport profile
        optimised = await optimise_stops(geocoded, profile=req.transport_mode)

        # Schedule times using OSRM travel durations
        travel_durations = [s.get("travel_to_next_min", 0) for s in optimised]
        try:
            start_dt = datetime.now().replace(
                hour=int(req.start_time.split(":")[0]),
                minute=int(req.start_time.split(":")[1]),
                second=0,
                microsecond=0
            )
        except Exception:
            start_dt = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)

        scheduled = adjust_times_from_now(optimised, start_dt.isoformat(), travel_durations)

        # Compute day totals
        total_dist = sum(s.get("travel_to_next_m", 0) for s in scheduled)
        total_dur = sum(s.get("duration_min", 0) for s in scheduled) + sum(
            s.get("travel_to_next_min", 0) for s in scheduled
        )

        # Build StopModel instances — only include fields that match the model
        stop_model_fields = set(StopModel.model_fields.keys())
        stops_out = [
            StopModel(**{k: v for k, v in s.items() if k in stop_model_fields})
            for s in scheduled
        ]

        plan_out.append(DayPlan(
            day=day_num,
            theme=day_data.get("theme", f"Day {day_num}"),
            overview=day_data.get("overview", ""),
            stops=stops_out,
            total_distance_m=total_dist,
            total_duration_min=total_dur
        ))

    result = ItineraryResponse(
        destination=req.destination,
        days=req.days,
        overview=raw.get("overview", ""),
        plan=plan_out,
        cached=False,
        generated_at=datetime.now().isoformat(),
        llm_provider=raw.get("_llm_provider", "")
    )

    # Cache
    save_itinerary(
        req.destination, req.days, req.interests,
        req.manual_places, req.pace, result.model_dump()
    )
    return result


@router.post("/replan")
async def replan(req: ReplanRequest):
    """Re-optimise remaining stops from current location."""
    all_stops = [dict(s) for s in req.all_stops]
    skipped = set(req.skipped_ids)

    # Mark skipped
    for stop in all_stops:
        if stop["id"] in skipped:
            stop["status"] = "skipped"

    # Separate done vs remaining
    done = [s for s in all_stops if s.get("status") in ("completed", "skipped")]
    remaining = [s for s in all_stops if s.get("status") not in ("completed", "skipped", "in-progress")]
    in_progress = [s for s in all_stops if s.get("status") == "in-progress"]

    if not remaining and not in_progress:
        return {"stops": done, "message": "All stops completed"}

    # Pin nearest to user as in-progress
    if not in_progress and remaining:
        nearest = min(
            remaining,
            key=lambda s: haversine(req.current_lat, req.current_lon, s["lat"], s["lon"])
        )
        nearest["status"] = "in-progress"
        in_progress = [nearest]
        remaining = [s for s in remaining if s["id"] != nearest["id"]]

    # Optimise remaining using the trip's transport profile
    optimised_remaining = await optimise_stops(remaining, profile=req.transport_mode) if remaining else []

    # Schedule: use current_time if a real GPS position was provided (lat/lon non-zero),
    # otherwise anchor to the day's configured start_time so Optimize doesn't shift times to evening.
    has_real_position = (req.current_lat != 0.0 or req.current_lon != 0.0)
    if has_real_position and req.current_time:
        anchor_time = req.current_time
    else:
        try:
            h, m = req.start_time.split(":")
            anchor_dt = datetime.now().replace(hour=int(h), minute=int(m), second=0, microsecond=0)
            anchor_time = anchor_dt.isoformat()
        except Exception:
            anchor_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0).isoformat()

    travel_durations = [s.get("travel_to_next_min", 0) for s in optimised_remaining]
    scheduled = adjust_times_from_now(in_progress + optimised_remaining, anchor_time, travel_durations)

    return {"stops": done + scheduled, "message": "Route optimised"}


@router.post("/route-geometry", response_model=RouteGeometryResponse)
async def route_geometry(req: RouteGeometryRequest):
    """Get road-following geometry for consecutive stop pairs — fetched concurrently."""
    stops = req.stops

    profile = req.transport_mode

    async def fetch_segment(i: int):
        a, b = stops[i], stops[i + 1]
        route = await get_route_between([a, b], profile=profile)
        return {
            "from_id": a.get("id", str(i)),
            "to_id": b.get("id", str(i + 1)),
            "geometry": route["geometry"],
            "distance_m": route["total_distance_m"],
            "duration_s": route["total_duration_s"],
            "is_fallback": route["is_fallback"],
            "steps": route.get("steps", []),
        }

    segments = await asyncio.gather(
        *[fetch_segment(i) for i in range(len(stops) - 1)]
    )
    return RouteGeometryResponse(segments=list(segments))


# ── Mid-trip endpoints ────────────────────────────────────────────────────────

@router.post("/midtrip-suggest")
async def midtrip_suggest(req: MidTripRequest):
    """Get AI suggestions for mid-trip replanning."""
    # Check cache first
    cached = load_midtrip(
        req.destination, req.day_num, req.anchor_stop_name,
        req.user_request, req.interests, req.pace,
    )
    if cached:
        cached["cached"] = True
        return cached

    result = await generate_midtrip_suggestions(
        destination=req.destination,
        day_num=req.day_num,
        anchor_name=req.anchor_stop_name,
        remaining_stops=req.remaining_stops,
        interests=req.interests,
        pace=req.pace,
        user_request=req.user_request,
        n=req.n,
    )
    if not result:
        raise HTTPException(500, "Mid-trip suggestion generation failed")

    result["cached"] = False
    save_midtrip(
        req.destination, req.day_num, req.anchor_stop_name,
        req.user_request, req.interests, req.pace, result,
    )
    return result


@router.post("/midtrip-apply")
async def midtrip_apply(req: ApplyMidTripSuggestionsRequest):
    """
    Geocode selected suggestions, insert/replace/remove them into the day's stops,
    optionally preserve manual order, and reschedule times.
    Returns the updated stop list.
    """
    all_stops = [dict(s) for s in req.all_stops]

    anchor_idx = next(
        (i for i, s in enumerate(all_stops) if str(s.get("id")) == str(req.anchor_stop_id)),
        -1
    )

    if anchor_idx < 0:
        raise HTTPException(400, "Anchor stop not found in itinerary.")

    async def _geocode_suggestion(sug: dict):
        coords = await geocode(sug.get("name", ""), req.destination)
        if not coords:
            logger.warning("Could not geocode mid-trip suggestion: %s", sug.get("name"))
            return None

        lat, lon = coords
        return {
            "id": str(uuid.uuid4()),
            "name": sug.get("name", "New Stop"),
            "lat": lat,
            "lon": lon,
            "category": sug.get("category", "culture"),
            "description": sug.get("description", ""),
            "duration_min": int(sug.get("estimated_duration_min", 60)),
            "status": "pending",
            "visit_order": 0,
            "travel_to_next_min": 0,
            "travel_to_next_m": 0,
            "route_is_fallback": False,
            "planned_start": "",
            "planned_end": "",
        }

    new_stops = []

    if req.action_mode != "remove":
        geocoded = await asyncio.gather(
            *[_geocode_suggestion(sug) for sug in req.selected_suggestions]
        )
        new_stops = [s for s in geocoded if s is not None]

        if not new_stops:
            failed = [s.get("name", "?") for s in req.selected_suggestions]
            raise HTTPException(
                400,
                f"Could not locate {', '.join(failed)} on the map. "
                "Try selecting different suggestions or using a more specific place name."
            )

    # -------------------------------------------------
    # Apply action to stop list
    # -------------------------------------------------
    updated_stops = [dict(s) for s in all_stops]

    if req.action_mode == "remove":
        updated_stops = [
            s for s in updated_stops
            if str(s.get("id")) != str(req.anchor_stop_id)
        ]

    elif req.action_mode == "replace":
        updated_stops[anchor_idx: anchor_idx + 1] = new_stops[:1]

    elif req.action_mode == "insert":
        if req.insert_placement == "before":
            updated_stops[anchor_idx:anchor_idx] = new_stops
        else:
            updated_stops[anchor_idx + 1: anchor_idx + 1] = new_stops

    else:
        raise HTTPException(400, f"Unsupported action mode: {req.action_mode}")

    if not updated_stops:
        return {
            "stops": [],
            "total_distance_m": 0,
            "total_duration_min": 0,
            "message": "All stops removed"
        }

    # -------------------------------------------------
    # Separate completed/skipped vs active stops
    # -------------------------------------------------
    done = [s for s in updated_stops if s.get("status") in ("completed", "skipped")]
    pending = [s for s in updated_stops if s.get("status") not in ("completed", "skipped")]

    # -------------------------------------------------
    # Route logic
    # -------------------------------------------------
    if req.preserve_manual_order:
        ordered_pending = pending

        # Reset route info
        for i in range(len(ordered_pending)):
            ordered_pending[i]["travel_to_next_min"] = 0
            ordered_pending[i]["travel_to_next_m"] = 0
            ordered_pending[i]["route_is_fallback"] = False

        # Recompute route between consecutive stops in SAME order
        for i in range(len(ordered_pending) - 1):
            route = await get_route_between(
                [ordered_pending[i], ordered_pending[i + 1]],
                profile=req.transport_mode
            )
            ordered_pending[i]["travel_to_next_m"] = route.get("total_distance_m", 0)
            ordered_pending[i]["travel_to_next_min"] = round(
                route.get("total_duration_s", 0) / 60
            )
            ordered_pending[i]["route_is_fallback"] = route.get("is_fallback", False)

        if ordered_pending:
            ordered_pending[-1]["travel_to_next_m"] = 0
            ordered_pending[-1]["travel_to_next_min"] = 0
            ordered_pending[-1]["route_is_fallback"] = False

        routed_pending = ordered_pending

    else:
        routed_pending = (
            await optimise_stops(pending, profile=req.transport_mode)
            if len(pending) > 1 else pending
        )

    # -------------------------------------------------
    # Reassign visit order before scheduling
    # -------------------------------------------------
    combined = done + routed_pending
    for i, s in enumerate(combined, start=1):
        s["visit_order"] = i

    # -------------------------------------------------
    # Reschedule times — anchor to current time when user location is known,
    # otherwise fall back to the day's configured start time.
    # -------------------------------------------------
    has_real_position = (req.current_lat != 0.0 or req.current_lon != 0.0)
    if has_real_position and req.current_time:
        anchor_time = req.current_time
    else:
        try:
            start_dt = datetime.now().replace(
                hour=int(req.start_time.split(":")[0]),
                minute=int(req.start_time.split(":")[1]),
                second=0,
                microsecond=0,
            )
            anchor_time = start_dt.isoformat()
        except Exception:
            anchor_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0).isoformat()

    travel_durations = [s.get("travel_to_next_min", 0) for s in routed_pending]
    scheduled_pending = adjust_times_from_now(
        routed_pending,
        anchor_time,
        travel_durations
    )

    final_stops = done + scheduled_pending

    # Final visit order pass
    for i, s in enumerate(final_stops, start=1):
        s["visit_order"] = i

    total_dist = sum(s.get("travel_to_next_m", 0) for s in final_stops)
    total_dur = sum(
        s.get("duration_min", 0) + s.get("travel_to_next_min", 0)
        for s in final_stops
    )

    return {
        "stops": final_stops,
        "total_distance_m": total_dist,
        "total_duration_min": total_dur,
        "message": (
            "Removed stop successfully"
            if req.action_mode == "remove"
            else f"Applied {len(new_stops)} suggestion(s) via '{req.action_mode}'"
        ),
    }
