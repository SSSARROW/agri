from fastapi import APIRouter, Depends, Path
from farmer.auth import get_current_farmer
from farmer.ads.reports.schemas import ReportAdRequest, ReportAdResponse
from farmer.ads.reports import service

router = APIRouter(prefix="/api/farmer/ads", tags=["farmer-ads-reports"])


@router.post("/{id}/report", response_model=ReportAdResponse)
async def report_advertisement(
    body: ReportAdRequest,
    id: str = Path(..., description="Advertisement ID"),
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    Farmer reports a live advertisement.
    - Only for live (published, non-expired, non-closed) ads.
    - One report per farmer per ad (409 on duplicate).
    - Reporting never changes the ad status automatically.
    """
    farmer_id = current_farmer["sub"]
    return service.submit_report(
        ad_id=id,
        farmer_id=farmer_id,
        reason=body.reason,
        details=body.details,
    )
