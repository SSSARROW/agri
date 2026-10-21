from typing import Optional
from fastapi import APIRouter, Depends, Query, Path

from exporter.router import get_current_exporter, require_verified_exporter
from exporter.farmers.service import get_exporter_profile_id_for_user
from exporter.stage_proofs import service
from exporter.stage_proofs.schemas import (
    PaginatedSubmissionsResponse,
    SubmissionDetail,
    ReviewActionRequest,
)

router = APIRouter(prefix="/api/exporter/stage-proofs", tags=["exporter-stage-proofs"])


@router.get("", response_model=PaginatedSubmissionsResponse)
async def list_submissions(
    status: Optional[str] = Query("pending", description="Filter by status (pending/approved/rejected), omit for all"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_exporter: dict = Depends(get_current_exporter),
):
    """Stage proof submissions from farmers following this exporter's standards."""
    user_id = current_exporter["sub"]
    profile_id = get_exporter_profile_id_for_user(user_id)
    return service.list_submissions(profile_id, status, page, page_size)


@router.get("/{submission_id}", response_model=SubmissionDetail)
async def get_submission(
    submission_id: str = Path(...),
    current_exporter: dict = Depends(get_current_exporter),
):
    user_id = current_exporter["sub"]
    profile_id = get_exporter_profile_id_for_user(user_id)
    return service.get_submission_detail(submission_id, profile_id)


@router.post("/{submission_id}/approve", response_model=SubmissionDetail)
async def approve_submission(
    body: Optional[ReviewActionRequest] = None,
    submission_id: str = Path(...),
    verified_exporter: dict = Depends(require_verified_exporter),
):
    user_id = verified_exporter["sub"]
    profile_id = get_exporter_profile_id_for_user(user_id)
    notes = body.notes if body else None
    return service.approve_submission(submission_id, profile_id, notes)


@router.post("/{submission_id}/reject", response_model=SubmissionDetail)
async def reject_submission(
    body: ReviewActionRequest,
    submission_id: str = Path(...),
    verified_exporter: dict = Depends(require_verified_exporter),
):
    """Rejecting requires a reason (body.notes) — shown to the farmer so
    they know what to fix, and it's what the farmer-side UI displays while
    the stage stays blocked until this exporter reopens it."""
    user_id = verified_exporter["sub"]
    profile_id = get_exporter_profile_id_for_user(user_id)
    return service.reject_submission(submission_id, profile_id, body.notes)


@router.post("/{submission_id}/reopen", response_model=SubmissionDetail)
async def reopen_submission(
    submission_id: str = Path(...),
    verified_exporter: dict = Depends(require_verified_exporter),
):
    """Lets the farmer submit again for this stage after a rejection."""
    user_id = verified_exporter["sub"]
    profile_id = get_exporter_profile_id_for_user(user_id)
    return service.reopen_submission(submission_id, profile_id)
