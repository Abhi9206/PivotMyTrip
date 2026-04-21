"""
NomadAI Tracking Router - GPS proximity and auto check-in endpoints
"""
from fastapi import APIRouter
from backend.models.schemas import TrackingUpdate
from backend.utils.geo import check_proximity

router = APIRouter(prefix="/api/tracking", tags=["tracking"])


@router.post("/update")
async def update_location(req: TrackingUpdate):
    """Update user GPS location and check proximity to stops."""
    updated_stops = check_proximity(req.lat, req.lon, req.stops, req.radius_m)
    return {
        "stops": updated_stops,
        "user_lat": req.lat,
        "user_lon": req.lon,
    }
