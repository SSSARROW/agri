from typing import Optional
from fastapi import APIRouter, Depends, Query, Path

from farmer.auth import get_current_farmer
from farmer.notifications import service
from farmer.notifications.schemas import (
    PaginatedFarmerNotificationsResponse,
    MarkReadResponse,
)

router = APIRouter(prefix="/api/farmer/notifications", tags=["farmer-notifications"])


@router.get("", response_model=PaginatedFarmerNotificationsResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    List notifications delivered to the logged-in farmer (newest first).
    Returns unread count and empty list when none.
    """
    farmer_id = current_farmer["sub"]
    return service.list_farmer_notifications(farmer_id=farmer_id, page=page, page_size=page_size)


@router.post("/{id}/read", response_model=MarkReadResponse)
async def mark_notification_read(
    id: str = Path(...),
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    Mark a notification as read.
    Idempotent: calling on an already read notification returns 200.
    Returns 404 for notifications belonging to other farmers.
    """
    farmer_id = current_farmer["sub"]
    return service.mark_notification_read(notification_id=id, farmer_id=farmer_id)
