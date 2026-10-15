from typing import Optional, List
from pydantic import BaseModel


class AcceptanceSummary(BaseModel):
    total: int
    pending: int
    approved: int
    declined: int
    withdrawn: int


class DailyViewPoint(BaseModel):
    date: str   # ISO date "YYYY-MM-DD"
    views: int


class AdStatsResponse(BaseModel):
    ad_id: str
    computed_status: str
    # Views
    total_views: int
    unique_viewers: int
    # Accepts
    accepts: AcceptanceSummary
    # Rates
    view_to_accept_rate: float  # % of unique viewers who also accepted
    # Quantity
    target_quantity_kg: float
    approved_quantity_kg: float
    pending_quantity_kg: float
    filled_percentage: float
    # Cheap scalar for Applicants badge
    pending_count: int
    # Optional views-per-day series (only when ?days= is provided)
    views_per_day: Optional[List[DailyViewPoint]] = None
