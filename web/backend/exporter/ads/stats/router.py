from typing import Optional
from fastapi import APIRouter, Depends, Query

from exporter.router import get_current_exporter
from exporter.farmers.service import get_exporter_profile_id_for_user
from exporter.ads.stats import service
from exporter.ads.stats.schemas import AdStatsResponse

router = APIRouter(prefix="/api/exporter/ads", tags=["exporter-ads-stats"])


@router.get("/{ad_id}/stats", response_model=AdStatsResponse)
async def get_ad_stats(
    ad_id: str,
    days: Optional[int] = Query(None, ge=1, le=365, description="Return views-per-day series for the last N days"),
    current_exporter: dict = Depends(get_current_exporter),
):
    """
    Returns view and acceptance stats for an exporter's own ad.
    Accessible to unverified exporters (read-only).
    Returns 404 for ads belonging to other exporters.
    """
    user_id = current_exporter["sub"]
    profile_id = get_exporter_profile_id_for_user(user_id)
    return service.get_ad_stats(ad_id=ad_id, exporter_profile_id=profile_id, days=days)
