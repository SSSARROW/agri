from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class SubmissionListItem(BaseModel):
    id: str
    link_id: str
    farmer_id: str
    farmer_name: str
    stage_id: str
    stage_name: str
    plot_name: Optional[str] = None
    photo_count: int
    status: str
    submitted_at: str
    # True when this submission is the reason its relationship needs
    # attention (rejected, not yet reopened) — same condition the farmer
    # sees as "waiting on the exporter."
    needs_attention: bool = False


class PaginatedSubmissionsResponse(BaseModel):
    items: List[SubmissionListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    pending_count: int


class SubmissionDetail(BaseModel):
    id: str
    link_id: str
    farmer_id: str
    farmer_name: str
    stage_id: str
    stage_name: str
    stage_instructions: Dict[str, Any]
    plot_name: Optional[str] = None
    photo_urls: List[str]
    quick_field_answers: Dict[str, Any]
    note: Optional[str] = None
    status: str
    submitted_at: str
    reviewed_at: Optional[str] = None
    review_notes: Optional[str] = None
    reopened_at: Optional[str] = None


class ReviewActionRequest(BaseModel):
    notes: Optional[str] = None
