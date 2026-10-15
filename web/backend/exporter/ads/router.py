from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException

from exporter.router import get_current_exporter, require_verified_exporter
from exporter.ads.schemas import (
    AdCreateRequest,
    AdVersionDraftUpdate,
    CloseAdRequest,
    AdDetail,
    AdVersionDetail,
    PaginatedAdsResponse,
)
from exporter.ads import service

router = APIRouter(prefix="/api/exporter/ads", tags=["exporter-ads"])


@router.post("", response_model=AdDetail)
async def create_new_ad(
    body: AdCreateRequest,
    current_exporter: dict = Depends(get_current_exporter),
):
    """
    Create a new ad with draft version 1.
    Accessible to unverified exporters as well.
    """
    user_id = current_exporter["sub"]
    profile_id = service.get_exporter_profile_id_for_user(user_id)
    return service.create_ad(profile_id, body)


@router.get("", response_model=PaginatedAdsResponse)
async def list_exporter_ads(
    crop: Optional[str] = Query(None, description="Filter by crop: tea, cinnamon"),
    status: Optional[str] = Query(None, description="Filter by computed status: draft, live, expired, closed"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_exporter: dict = Depends(get_current_exporter),
):
    """
    List own ads with computed lifecycle state (draft, live, expired, closed).
    """
    user_id = current_exporter["sub"]
    profile_id = service.get_exporter_profile_id_for_user(user_id)
    return service.list_ads(
        exporter_profile_id=profile_id,
        crop=crop,
        status=status,
        page=page,
        page_size=page_size,
    )


@router.get("/{ad_id}", response_model=AdDetail)
async def get_ad(
    ad_id: str,
    current_exporter: dict = Depends(get_current_exporter),
):
    """
    Get ad details and list of version summaries.
    """
    user_id = current_exporter["sub"]
    profile_id = service.get_exporter_profile_id_for_user(user_id)
    return service.get_ad_detail(ad_id, profile_id)


@router.get("/{ad_id}/versions/{version_number}", response_model=AdVersionDetail)
async def get_ad_version(
    ad_id: str,
    version_number: int,
    current_exporter: dict = Depends(get_current_exporter),
):
    """
    Get full details of ad version N.
    """
    user_id = current_exporter["sub"]
    profile_id = service.get_exporter_profile_id_for_user(user_id)
    return service.get_version_detail(ad_id, version_number, profile_id)


@router.put("/{ad_id}/versions/{version_number}", response_model=AdVersionDetail)
async def update_draft_version(
    ad_id: str,
    version_number: int,
    body: AdVersionDraftUpdate,
    current_exporter: dict = Depends(get_current_exporter),
):
    """
    Replace fields of a DRAFT version.
    Rejects if version is published.
    """
    user_id = current_exporter["sub"]
    profile_id = service.get_exporter_profile_id_for_user(user_id)
    return service.update_draft_version(ad_id, version_number, profile_id, body)


@router.post("/{ad_id}/versions/{version_number}/publish", response_model=AdVersionDetail)
async def publish_version(
    ad_id: str,
    version_number: int,
    verified_exporter: dict = Depends(require_verified_exporter),
):
    """
    Publish a draft ad version.
    Requires verified exporter.
    Validates English title/desc, linked standard published status, dates, and prices.
    """
    user_id = verified_exporter["sub"]
    profile_id = service.get_exporter_profile_id_for_user(user_id)
    return service.publish_version(ad_id, version_number, profile_id)


@router.post("/{ad_id}/versions", response_model=AdVersionDetail)
async def create_new_draft(
    ad_id: str,
    current_exporter: dict = Depends(get_current_exporter),
):
    """
    Create a new draft version copied from the latest published version.
    Enforces the one-draft rule (rejects if a draft already exists).
    """
    user_id = current_exporter["sub"]
    profile_id = service.get_exporter_profile_id_for_user(user_id)
    return service.create_new_draft(ad_id, profile_id)


@router.post("/{ad_id}/close", response_model=AdDetail)
async def close_ad(
    ad_id: str,
    body: Optional[CloseAdRequest] = None,
    verified_exporter: dict = Depends(require_verified_exporter),
):
    """
    Close an active (published) advertisement.
    Requires verified exporter.
    """
    user_id = verified_exporter["sub"]
    profile_id = service.get_exporter_profile_id_for_user(user_id)
    reason = body.reason if body else None
    return service.close_ad(ad_id, profile_id, reason=reason)


@router.post("/{ad_id}/duplicate", response_model=AdDetail)
async def duplicate_ad(
    ad_id: str,
    current_exporter: dict = Depends(get_current_exporter),
):
    """
    Duplicate an existing ad into a new ad with draft v1.
    """
    user_id = current_exporter["sub"]
    profile_id = service.get_exporter_profile_id_for_user(user_id)
    return service.duplicate_ad(ad_id, profile_id)
