from typing import Optional
from fastapi import APIRouter, Depends, Query, Path

from exporter.router import get_current_exporter, require_verified_exporter
from exporter.farmers.service import get_exporter_profile_id_for_user
from exporter.ads.applicants.schemas import (
    AdApplicantsResponse,
    DeclineApplicantRequest,
)
from exporter.ads.applicants import service

router = APIRouter(prefix="/api/exporter/ads/{id}/applicants", tags=["exporter-ads-applicants"])


@router.get("", response_model=AdApplicantsResponse)
async def list_applicants(
    id: str = Path(..., description="Advertisement ID"),
    status: Optional[str] = Query(None, description="Filter by status (pending, approved, declined, withdrawn)"),
    search: Optional[str] = Query(None, description="Search by farmer name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_exporter: dict = Depends(get_current_exporter),
):
    """
    List applicants (purchase request acceptances) for this advertisement.
    Returns applicant details, supply quantities, and overall ad capacity metrics.
    Phone is masked unless applicant is approved.
    Accessible to unverified exporters in read-only mode.
    """
    user_id = current_exporter["sub"]
    profile_id = get_exporter_profile_id_for_user(user_id)
    return service.list_ad_applicants(
        ad_id=id,
        exporter_profile_id=profile_id,
        status=status,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.post("/{acceptance_id}/approve")
async def approve_applicant(
    id: str = Path(..., description="Advertisement ID"),
    acceptance_id: str = Path(..., description="Acceptance ID"),
    verified_exporter: dict = Depends(require_verified_exporter),
):
    """
    Approve an applicant's supply for this advertisement.
    Enforces over-allocation capacity checks and delegates to Step 4 link approval.
    Requires verified exporter.
    """
    user_id = verified_exporter["sub"]
    profile_id = get_exporter_profile_id_for_user(user_id)
    return service.approve_ad_applicant(
        ad_id=id,
        acceptance_id=acceptance_id,
        exporter_profile_id=profile_id,
    )


@router.post("/{acceptance_id}/decline")
async def decline_applicant(
    body: Optional[DeclineApplicantRequest] = None,
    id: str = Path(..., description="Advertisement ID"),
    acceptance_id: str = Path(..., description="Acceptance ID"),
    verified_exporter: dict = Depends(require_verified_exporter),
):
    """
    Decline an applicant's supply for this advertisement with optional reason.
    Delegates to Step 4 link decline.
    Requires verified exporter.
    """
    user_id = verified_exporter["sub"]
    profile_id = get_exporter_profile_id_for_user(user_id)
    reason = body.reason if body else None
    return service.decline_ad_applicant(
        ad_id=id,
        acceptance_id=acceptance_id,
        exporter_profile_id=profile_id,
        reason=reason,
    )
