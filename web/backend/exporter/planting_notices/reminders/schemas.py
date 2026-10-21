from typing import List, Optional, Dict
from pydantic import BaseModel


class SlotStats(BaseModel):
    slot: int  # 30, 14, 7
    scheduled_date: str
    sent: int = 0
    failed: int = 0
    skipped: int = 0
    skipped_reasons: Dict[str, int] = {}
    pending: int = 0


class DeliveryItem(BaseModel):
    id: str
    farmer_name: str
    reminder_slot: int
    channel: str
    status: str
    skip_reason: Optional[str] = None
    sent_at: Optional[str] = None
    attempts: int = 0
    last_error: Optional[str] = None
    created_at: str


class NoticeRemindersResponse(BaseModel):
    notice_id: str
    provider: str
    slots: List[SlotStats]
    deliveries: List[DeliveryItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class RetryFailedResponse(BaseModel):
    notice_id: str
    retried_count: int
    message: str
