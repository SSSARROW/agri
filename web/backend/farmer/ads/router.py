from typing import Optional
from fastapi import APIRouter, Depends, Query, Path

from farmer.auth import get_current_farmer
from farmer.ads.schemas import (
    PaginatedOpenAdsResponse,
    OpenAdDetail,
    AcceptAdRequest,
    AcceptAdResponse,
    MyAcceptancesResponse,
)
from farmer.ads.service import (
    list_open_ads,
    get_open_ad_detail,
    accept_ad,
    withdraw_acceptance,
    get_my_acceptances,
)

router = APIRouter(prefix="/api/farmer/ads", tags=["farmer-ads"])


@router.get("", response_model=PaginatedOpenAdsResponse)
async def get_open_ads(
    crop: Optional[str] = Query(None, description="Filter by crop (tea, cinnamon)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    Returns live, open advertisements matching the farmer's registered district.
    Excludes filled ads and expired ads.
    """
    farmer_id = current_farmer["sub"]
    return list_open_ads(farmer_id=farmer_id, crop=crop, page=page, page_size=page_size)


@router.get("/my-acceptances", response_model=MyAcceptancesResponse)
async def list_farmer_acceptances(
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    Returns all purchase requests accepted by the authenticated farmer with their derived statuses.
    """
    farmer_id = current_farmer["sub"]
    return get_my_acceptances(farmer_id=farmer_id)


@router.get("/{id}", response_model=OpenAdDetail)
async def get_ad_details(
    id: str = Path(..., description="Advertisement ID"),
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    Returns full details of the live advertisement including commercial terms,
    the linked published quality standard version, and all quality stages.
    """
    farmer_id = current_farmer["sub"]
    return get_open_ad_detail(ad_id=id, farmer_id=farmer_id)


@router.post("/{id}/accept", response_model=AcceptAdResponse)
async def accept_advertisement(
    body: AcceptAdRequest,
    id: str = Path(..., description="Advertisement ID"),
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    Farmer accepts a live advertisement with specified supply quantity.
    Validates terms, district eligibility, and links.
    """
    farmer_id = current_farmer["sub"]
    return accept_ad(
        ad_id=id,
        farmer_id=farmer_id,
        ad_version_id=body.ad_version_id,
        supply_quantity_kg=body.supply_quantity_kg,
    )


@router.post("/{id}/withdraw")
async def withdraw_ad_acceptance(
    id: str = Path(..., description="Advertisement ID"),
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    Farmer withdraws a pending advertisement acceptance.
    Allowed only while status is pending.
    """
    farmer_id = current_farmer["sub"]
    return withdraw_acceptance(ad_id=id, farmer_id=farmer_id)
