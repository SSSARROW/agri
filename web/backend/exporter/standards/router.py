"""
Exporter Quality Standards API router — prefix: /api/exporter/standards
All endpoints require the exporter role.
Draft operations can be saved by unverified exporters; publishing requires a verified exporter.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, Path
from exporter.router import get_current_exporter, require_verified_exporter
from exporter.standards import service, templates
from exporter.standards.schemas import (
    CreateStandardRequest,
    DraftVersionUpdate,
    StandardResponse,
    StandardListResponse,
    VersionDetailResponse,
)

router = APIRouter(prefix="/api/exporter/standards", tags=["exporter-standards"])


@router.post("", response_model=StandardResponse, status_code=201)
@router.post("/", response_model=StandardResponse, status_code=201)
async def create_standard(
    body: CreateStandardRequest,
    current_exporter: dict = Depends(get_current_exporter),
):
    """Create a new quality standard with an initial draft version (v1)."""
    profile = service.get_exporter_profile_by_user_id(current_exporter["sub"])
    return service.create_standard(profile["id"], body)


@router.get("", response_model=StandardListResponse)
@router.get("/", response_model=StandardListResponse)
async def list_standards(
    crop: Optional[str] = Query(None),
    is_archived: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_exporter: dict = Depends(get_current_exporter),
):
    """List own quality standards with optional crop/archived filters and pagination."""
    profile = service.get_exporter_profile_by_user_id(current_exporter["sub"])
    return service.list_standards(
        exporter_profile_id=profile["id"],
        crop=crop,
        is_archived=is_archived,
        page=page,
        page_size=page_size,
    )


@router.get("/templates")
async def get_templates(
    crop: Optional[str] = Query(None, description="Optional crop filter: tea or cinnamon"),
    current_exporter: dict = Depends(get_current_exporter),
):
    """Return crop quality-standard templates and grade-spec field definitions."""
    return templates.get_templates(crop=crop)


@router.get("/{id}", response_model=StandardResponse)
async def get_standard(
    id: str = Path(...),
    current_exporter: dict = Depends(get_current_exporter),
):
    """Get full details of a quality standard with version summaries."""
    profile = service.get_exporter_profile_by_user_id(current_exporter["sub"])
    return service.get_standard_full(id, profile["id"])


@router.get("/{id}/versions/{n}", response_model=VersionDetailResponse)
async def get_version(
    id: str = Path(...),
    n: int = Path(..., ge=1),
    current_exporter: dict = Depends(get_current_exporter),
):
    """Get a specific version (n) with all its stages."""
    profile = service.get_exporter_profile_by_user_id(current_exporter["sub"])
    return service.get_version_detail(id, n, profile["id"])


@router.put("/{id}/versions/{n}", response_model=VersionDetailResponse)
async def update_draft_version(
    body: DraftVersionUpdate,
    id: str = Path(...),
    n: int = Path(..., ge=1),
    current_exporter: dict = Depends(get_current_exporter),
):
    """Replace name, grade_spec, and stages of a DRAFT version. Rejects if published."""
    profile = service.get_exporter_profile_by_user_id(current_exporter["sub"])
    return service.update_draft_version(id, n, profile["id"], body)


@router.post("/{id}/versions/{n}/publish", response_model=VersionDetailResponse)
async def publish_version(
    id: str = Path(...),
    n: int = Path(..., ge=1),
    verified_exporter: dict = Depends(require_verified_exporter),
):
    """Publish a draft version. Requires a verified exporter."""
    profile = service.get_exporter_profile_by_user_id(verified_exporter["sub"])
    return service.publish_version(id, n, profile["id"])


@router.post("/{id}/versions", response_model=VersionDetailResponse, status_code=201)
async def create_new_draft(
    id: str = Path(...),
    current_exporter: dict = Depends(get_current_exporter),
):
    """Create a new draft version by copying the latest published version."""
    profile = service.get_exporter_profile_by_user_id(current_exporter["sub"])
    return service.create_new_draft(id, profile["id"])


@router.post("/{id}/duplicate", response_model=StandardResponse, status_code=201)
async def duplicate_standard(
    id: str = Path(...),
    current_exporter: dict = Depends(get_current_exporter),
):
    """Copy a standard into a new standard with a draft v1."""
    profile = service.get_exporter_profile_by_user_id(current_exporter["sub"])
    return service.duplicate_standard(id, profile["id"])


@router.post("/{id}/archive", response_model=StandardResponse)
async def archive_standard(
    id: str = Path(...),
    current_exporter: dict = Depends(get_current_exporter),
):
    """Archive a quality standard."""
    profile = service.get_exporter_profile_by_user_id(current_exporter["sub"])
    return service.set_archive_status(id, profile["id"], is_archived=True)


@router.post("/{id}/unarchive", response_model=StandardResponse)
async def unarchive_standard(
    id: str = Path(...),
    current_exporter: dict = Depends(get_current_exporter),
):
    """Unarchive a quality standard."""
    profile = service.get_exporter_profile_by_user_id(current_exporter["sub"])
    return service.set_archive_status(id, profile["id"], is_archived=False)
