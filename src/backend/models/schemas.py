from pydantic import BaseModel, Field
from typing import List, Optional, Literal


class PlanRequest(BaseModel):
    destination: str
    days: int = Field(ge=1, le=14)
    interests: List[str] = Field(default_factory=list)
    manual_places: List[str] = Field(default_factory=list)
    pace: Literal["relaxed", "balanced", "fast"] = "balanced"
    start_time: str = "09:00"  # HH:MM
    start_location: str = ""   # user's starting point (hotel, station, etc.)
    transport_mode: Literal["walking", "cycling", "driving"] = "walking"


class StopModel(BaseModel):
    id: str
    name: str
    lat: float
    lon: float
    category: str = "culture"
    description: str = ""
    duration_min: int = 60
    planned_start: str = ""
    planned_end: str = ""
    status: str = "pending"
    visit_order: int = 0
    distance_from_user: Optional[float] = None
    eta_min: Optional[float] = None
    travel_to_next_min: float = 0
    travel_to_next_m: float = 0
    route_is_fallback: bool = False


class DayPlan(BaseModel):
    day: int
    theme: str = ""
    overview: str = ""
    stops: List[StopModel] = Field(default_factory=list)
    total_distance_m: float = 0
    total_duration_min: float = 0


class ItineraryResponse(BaseModel):
    destination: str
    days: int
    overview: str = ""
    plan: List[DayPlan] = Field(default_factory=list)
    cached: bool = False
    generated_at: str = ""
    llm_provider: str = ""


class ReplanRequest(BaseModel):
    all_stops: List[dict]
    skipped_ids: List[str] = Field(default_factory=list)
    current_lat: float = 0.0
    current_lon: float = 0.0
    time_offset_min: float = 0
    current_time: str = ""   # ISO datetime
    start_time: str = "09:00"  # HH:MM — day's configured start time
    transport_mode: str = "walking"


class RouteGeometryRequest(BaseModel):
    stops: List[dict]  # [{lat, lon, id, name}]
    day: int = 1
    transport_mode: str = "walking"


class RouteGeometryResponse(BaseModel):
    segments: List[dict]  # [{from_id, to_id, geometry, distance_m, duration_s, is_fallback}]


class TrackingUpdate(BaseModel):
    lat: float
    lon: float
    stops: List[dict]
    radius_m: float = 100


class VoiceCommandRequest(BaseModel):
    transcript: str
    itinerary_summary: str = ""


class MidTripSuggestionRequest(BaseModel):
    destination: str
    current_location: str
    interests: str
    current_stop_name: str = ""


# ── Mid-Trip Planning Models ─────────────────────────────────────────────────

class MidTripRequest(BaseModel):
    destination: str
    day_num: int
    anchor_stop_id: str
    anchor_stop_name: str
    remaining_stops: List[dict] = Field(default_factory=list)  # [{id, name, category}]
    interests: List[str] = Field(default_factory=list)
    pace: str = "balanced"
    user_request: str
    n: int = 5


class MidTripSuggestion(BaseModel):
    name: str
    category: str = "culture"
    estimated_duration_min: int = 60
    description: str = ""


class MidTripResponse(BaseModel):
    anchor: str
    request_summary: str
    intent: str
    suggestions: List[MidTripSuggestion]
    cached: bool = False


class ApplyMidTripSuggestionsRequest(BaseModel):
    destination: str
    day_num: int
    action_mode: Literal["insert", "replace", "remove"]
    insert_placement: Optional[Literal["before", "after"]] = "after"
    anchor_stop_id: str
    selected_suggestions: List[dict] = Field(default_factory=list)
    all_stops: List[dict] = Field(default_factory=list)
    start_time: str = "09:00"
    transport_mode: str = "walking"
    preserve_manual_order: bool = True
    current_time: str = ""       # ISO datetime of current simulation/real time
    current_lat: float = 0.0     # Current user latitude (0 = not provided)
    current_lon: float = 0.0     # Current user longitude (0 = not provided)

