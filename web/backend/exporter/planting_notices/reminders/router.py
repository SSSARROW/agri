from typing import Optional
from fastapi import APIRouter, Depends, Query, Path

from exporter.router import get_current_exporter, require_verified_exporter
from exporter.farmers.service import get_exporter_profile_id_for_user
from exporter.planting_notices.reminders import service
from exporter.planting_notices.reminders.schemas import (
    NoticeRemindersResponse,
    RetryFailedResponse,
)

router = APIRouter(prefix="/api/exporter/planting-notices", tags=["exporter-notice-reminders"])


@router.get("/{id}/reminders", response_model=NoticeRemindersResponse)
async def get_notice_reminders(
    id: str = Path(...),
    slot: Optional[int] = Query(None, description="Filter by reminder slot: 30, 14, 7"),
    status: Optional[str] = Query(None, description="Filter by status: sent, failed, skipped, pending"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_exporter: dict = Depends(get_current_exporter),
):
    """
    Get reminder statistics per slot and delivery log for own planting notice.
    Viewing is allowed for both verified and unverified exporters.
    """
    profile_id = get_exporter_profile_id_for_user(current_exporter["sub"])
    return service.get_notice_reminders(
        notice_id=id,
        exporter_profile_id=profile_id,
        slot_filter=slot,
        status_filter=status,
        page=page,
        page_size=page_size,
    )


@router.post("/{id}/reminders/retry-failed", response_model=RetryFailedResponse)
async def retry_failed_reminders(
    id: str = Path(...),
    verified_exporter: dict = Depends(require_verified_exporter),
):
    """
    Reset failed reminder records (attempts < 3) back to pending.
    Requires verified exporter. Does not trigger dispatch by itself.
    """
    profile_id = get_exporter_profile_id_for_user(verified_exporter["sub"])
    return service.retry_failed_reminders(notice_id=id, exporter_profile_id=profile_id)
