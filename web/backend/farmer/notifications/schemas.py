from typing import List, Optional
from pydantic import BaseModel


class FarmerNotificationItem(BaseModel):
    id: str
    notice_id: str
    reminder_slot: int
    title: str
    body: str
    language: str
    channel: str
    status: str
    sent_at: Optional[str] = None
    read_at: Optional[str] = None
    created_at: str


class PaginatedFarmerNotificationsResponse(BaseModel):
    items: List[FarmerNotificationItem]
    total: int
    unread_count: int
    page: int
    page_size: int
    total_pages: int


class MarkReadResponse(BaseModel):
    id: str
    status: str
    read_at: str
