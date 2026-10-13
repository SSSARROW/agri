from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException

from exporter.router import get_current_exporter, require_verified_exporter
from exporter.farmers.schemas import (
    PaginatedFarmerLinksResponse,
    FarmerLinkDetailResponse,
    DecisionActionRequest,
)
from exporter.farmers import service

router = APIRouter(prefix="/api/exporter/farmers", tags=["exporter-farmers"])


@router.get("", response_model=PaginatedFarmerLinksResponse)
async def list_farmers(
    status: Optional[str] = Query("requested", description="Filter by status (default: requested)"),
    district: Optional[str] = Query(None, description="Filter by district"),
    crop: Optional[str] = Query(None, description="Filter by crop"),
    search: Optional[str] = Query(None, description="Search by farmer name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_exporter: dict = Depends(get_current_exporter),
):
    """
    List links to this exporter.
    Default status: 'requested'.
    Phone numbers are masked (returned as null) unless link is approved.
    Accessible to unverified exporters as well.
    """
    user_id = current_exporter["sub"]
    profile_id = service.get_exporter_profile_id_for_user(user_id)
    return service.list_exporter_farmer_links(
        exporter_profile_id=profile_id,
        status=status,
        district=district,
        crop=crop,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.get("/{link_id}", response_model=FarmerLinkDetailResponse)
async def get_farmer_link(
    link_id: str,
    current_exporter: dict = Depends(get_current_exporter),
):
    """
    Get detailed farmer link: farmer info, plots, crops, status, dates.
    Phone returned ONLY if status is approved.
    Returns 404 if link belongs to another exporter.
    """
    user_id = current_exporter["sub"]
    profile_id = service.get_exporter_profile_id_for_user(user_id)
    return service.get_farmer_link_detail(link_id, profile_id)


@router.post("/{link_id}/approve", response_model=FarmerLinkDetailResponse)
async def approve_farmer(
    link_id: str,
    verified_exporter: dict = Depends(require_verified_exporter),
):
    """
    Approve a requested farmer link.
    Requires verified exporter.
    Returns 409 Conflict if farmer already has another active link.
    """
    user_id = verified_exporter["sub"]
    profile_id = service.get_exporter_profile_id_for_user(user_id)
    return service.approve_farmer_link(link_id, profile_id)


@router.post("/{link_id}/decline", response_model=FarmerLinkDetailResponse)
async def decline_farmer(
    link_id: str,
    body: Optional[DecisionActionRequest] = None,
    verified_exporter: dict = Depends(require_verified_exporter),
):
    """
    Decline a requested farmer link with optional reason.
    Requires verified exporter.
    """
    user_id = verified_exporter["sub"]
    profile_id = service.get_exporter_profile_id_for_user(user_id)
    reason = body.reason if body else None
    return service.decline_farmer_link(link_id, profile_id, reason=reason)


@router.post("/{link_id}/remove", response_model=FarmerLinkDetailResponse)
async def remove_farmer(
    link_id: str,
    body: Optional[DecisionActionRequest] = None,
    verified_exporter: dict = Depends(require_verified_exporter),
):
    """
    Remove an approved farmer link with optional reason.
    Requires verified exporter.
    """
    user_id = verified_exporter["sub"]
    profile_id = service.get_exporter_profile_id_for_user(user_id)
    reason = body.reason if body else None
    return service.remove_farmer_link(link_id, profile_id, reason=reason)
