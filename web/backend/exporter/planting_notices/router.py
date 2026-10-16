from typing import Optional
from fastapi import APIRouter, Depends, Query, Path
from exporter.router import get_current_exporter, require_verified_exporter
from exporter.farmers.service import get_exporter_profile_id_for_user
from exporter.planting_notices import service
from exporter.planting_notices.schemas import (
    CreateNoticeRequest,
    UpdateDraftNoticeRequest,
    CancelNoticeRequest,
    PaginatedNoticesResponse,
    NoticeDetailResponse,
    NoticeResponsesSummaryResponse,
)

router = APIRouter(prefix="/api/exporter/planting-notices", tags=["exporter-planting-notices"])


@router.post("", response_model=NoticeDetailResponse)
async def create_planting_notice(
    body: CreateNoticeRequest,
    current_exporter: dict = Depends(get_current_exporter),
):
    """Create draft planting notice. Accessible to unverified exporters."""
    profile_id = get_exporter_profile_id_for_user(current_exporter["sub"])
    created = service.create_draft_notice(profile_id, body.model_dump())
    return service.get_notice_detail(created["id"], profile_id)


@router.get("", response_model=PaginatedNoticesResponse)
async def list_planting_notices(
    crop: Optional[str] = Query(None, description="tea|cinnamon|all"),
    state: Optional[str] = Query(None, description="draft|upcoming|past|cancelled|all"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_exporter: dict = Depends(get_current_exporter),
):
    """List notices with computed state, response counters, and volume progress."""
    profile_id = get_exporter_profile_id_for_user(current_exporter["sub"])
    return service.list_notices(profile_id, crop=crop, state=state, page=page, page_size=page_size)


@router.get("/{id}", response_model=NoticeDetailResponse)
async def get_planting_notice(
    id: str = Path(..., description="Notice ID"),
    current_exporter: dict = Depends(get_current_exporter),
):
    """Get single notice details with linked standard and response summary."""
    profile_id = get_exporter_profile_id_for_user(current_exporter["sub"])
    return service.get_notice_detail(id, profile_id)


@router.put("/{id}", response_model=NoticeDetailResponse)
async def update_draft_notice(
    body: UpdateDraftNoticeRequest,
    id: str = Path(..., description="Notice ID"),
    current_exporter: dict = Depends(get_current_exporter),
):
    """Update a draft planting notice."""
    profile_id = get_exporter_profile_id_for_user(current_exporter["sub"])
    service.update_draft_notice(id, profile_id, body.model_dump(exclude_unset=True))
    return service.get_notice_detail(id, profile_id)


@router.post("/{id}/publish", response_model=NoticeDetailResponse)
async def publish_planting_notice(
    id: str = Path(..., description="Notice ID"),
    verified_exporter: dict = Depends(require_verified_exporter),
):
    """Publish notice to approved farmers. Verified exporter only."""
    profile_id = get_exporter_profile_id_for_user(verified_exporter["sub"])
    service.publish_notice(id, profile_id)
    return service.get_notice_detail(id, profile_id)


@router.post("/{id}/cancel", response_model=NoticeDetailResponse)
async def cancel_planting_notice(
    body: CancelNoticeRequest = CancelNoticeRequest(),
    id: str = Path(..., description="Notice ID"),
    verified_exporter: dict = Depends(require_verified_exporter),
):
    """Cancel notice. Verified exporter only. Releases active bindings."""
    profile_id = get_exporter_profile_id_for_user(verified_exporter["sub"])
    service.cancel_notice(id, profile_id, body.reason)
    return service.get_notice_detail(id, profile_id)


@router.post("/{id}/duplicate", response_model=NoticeDetailResponse)
async def duplicate_planting_notice(
    id: str = Path(..., description="Notice ID"),
    current_exporter: dict = Depends(get_current_exporter),
):
    """Duplicate notice as a new draft."""
    profile_id = get_exporter_profile_id_for_user(current_exporter["sub"])
    dup = service.duplicate_notice(id, profile_id)
    return service.get_notice_detail(dup["id"], profile_id)


@router.get("/{id}/responses", response_model=NoticeResponsesSummaryResponse)
async def get_planting_notice_responses(
    id: str = Path(..., description="Notice ID"),
    response: Optional[str] = Query(None, description="ready|cannot|no_reply|all"),
    search: Optional[str] = Query(None, description="Search farmer name"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_exporter: dict = Depends(get_current_exporter),
):
    """Get response counts, progress percentage, and per-farmer breakdown."""
    profile_id = get_exporter_profile_id_for_user(current_exporter["sub"])
    return service.get_notice_responses(
        id, profile_id, response_filter=response, search=search, page=page, page_size=page_size
    )
