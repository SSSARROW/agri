from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field


class FarmerNoticeSummary(BaseModel):
    id: str
    crop: str
    target_month: str
    volume_needed_kg: float
    title: Dict[str, str]
    exporter_name: str
    exporter_logo_url: Optional[str] = None
    farmer_response: Optional[Literal["ready", "cannot"]] = None
    expected_volume_kg: Optional[float] = None
    plot_id: Optional[str] = None
    published_at: str


class PaginatedFarmerNoticesResponse(BaseModel):
    items: List[FarmerNoticeSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


class StandardStageSummary(BaseModel):
    id: str
    stage_order: int
    name: str
    description: Optional[str] = None
    rules_count: int = 0


class FarmerNoticeDetail(BaseModel):
    id: str
    crop: str
    target_month: str
    volume_needed_kg: float
    title: Dict[str, str]
    message: Dict[str, str]
    published_at: str
    # Exporter public profile (no phone, no email, no contact)
    exporter: Dict[str, Any]
    # Current reply
    current_response: Optional[Literal["ready", "cannot"]] = None
    current_expected_volume_kg: Optional[float] = None
    current_plot_id: Optional[str] = None
    # Linked standard version and stages
    standard_version_id: str
    standard_name: str
    standard_version_number: int
    stages: List[StandardStageSummary]


class FarmerPlotOption(BaseModel):
    id: str
    name: Optional[str] = None
    area_ha: float
    district: Optional[str] = None
    dsd: Optional[str] = None
    gn_division: Optional[str] = None


class NoticeReplyRequest(BaseModel):
    response: Literal["ready", "cannot"]
    expected_volume_kg: Optional[float] = Field(None, gt=0)
    plot_id: Optional[str] = None


class NoticeReplyResponse(BaseModel):
    status: str = "ok"
    notice_id: str
    farmer_id: str
    response: Literal["ready", "cannot"]
    expected_volume_kg: Optional[float] = None
    plot_id: Optional[str] = None
    responded_at: str
    message: str
