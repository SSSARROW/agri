from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

class EventCreate(BaseModel):
    id: str
    event_type: str
    batch_id: Optional[str] = None
    plot_id: Optional[str] = None
    payload: Dict[str, Any]
    occurred_at: datetime

class EventResponse(BaseModel):
    id: str
    event_type: str
    user_id: str
    batch_id: Optional[str] = None
    plot_id: Optional[str] = None
    payload: Dict[str, Any]
    occurred_at: str
    recorded_at: str

class PaginatedEventsResponse(BaseModel):
    items: List[EventResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
