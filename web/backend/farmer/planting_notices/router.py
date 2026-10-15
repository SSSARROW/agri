from typing import List
from fastapi import APIRouter, Depends, Query, Path
from farmer.auth import get_current_farmer
from farmer.planting_notices import service
from farmer.planting_notices.schemas import (
    PaginatedFarmerNoticesResponse,
    FarmerNoticeDetail,
    FarmerPlotOption,
    NoticeReplyRequest,
    NoticeReplyResponse,
)

router = APIRouter(prefix="/api/farmer/planting-notices", tags=["farmer-planting-notices"])


@router.get("", response_model=PaginatedFarmerNoticesResponse)
async def list_farmer_planting_notices(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    List upcoming planting notices from the farmer's approved exporter.
    Safe empty list if no approved exporter or no upcoming notices.
    """
    farmer_id = current_farmer["sub"]
    return service.list_farmer_notices(farmer_id, page=page, page_size=page_size)


@router.get("/{id}", response_model=FarmerNoticeDetail)
async def get_farmer_planting_notice(
    id: str = Path(..., description="Notice ID"),
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    Get full planting notice details, public exporter profile,
    farmer's current response, and linked standard stages.
    """
    farmer_id = current_farmer["sub"]
    return service.get_farmer_notice_detail(id, farmer_id)


@router.get("/{id}/plots", response_model=List[FarmerPlotOption])
async def list_farmer_plots_for_notice(
    id: str = Path(..., description="Notice ID"),
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    Returns the farmer's own plots that can be chosen for a Ready reply.
    """
    farmer_id = current_farmer["sub"]
    # Verifies notice visibility first
    service.get_farmer_notice_detail(id, farmer_id)
    return service.list_farmer_plots(farmer_id)


@router.post("/{id}/respond", response_model=NoticeReplyResponse)
async def respond_to_planting_notice(
    body: NoticeReplyRequest,
    id: str = Path(..., description="Notice ID"),
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    Farmer replies Ready or Cannot.
    - Ready requires farmer's own plot and expected volume > 0.
    - Creates or releases binding atomically.
    - 409 if target month has started or if plot is already bound for season.
    - Idempotent.
    """
    farmer_id = current_farmer["sub"]
    return service.respond_to_notice(id, farmer_id, body.model_dump())
