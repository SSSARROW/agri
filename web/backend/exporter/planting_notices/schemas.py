from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field

CropType = Literal["tea", "cinnamon"]
NoticeStatus = Literal["draft", "published", "cancelled"]
ComputedNoticeState = Literal["draft", "upcoming", "past", "cancelled"]


class MultilingualText(BaseModel):
    en: str = Field(..., min_length=1, description="English text (required)")
    si: Optional[str] = Field(default="", description="Sinhala text (optional)")
    ta: Optional[str] = Field(default="", description="Tamil text (optional)")


class CreateNoticeRequest(BaseModel):
    crop: CropType
    standard_version_id: str
    target_month: str = Field(..., description="Target month in YYYY-MM-01 or YYYY-MM format")
    volume_needed_kg: float = Field(gt=0, description="Target volume required in kg")
    eligible_districts: List[str] = Field(default_factory=list, description="Districts eligible (empty = all)")
    title: MultilingualText
    message: MultilingualText


class UpdateDraftNoticeRequest(BaseModel):
    crop: Optional[CropType] = None
    standard_version_id: Optional[str] = None
    target_month: Optional[str] = None
    volume_needed_kg: Optional[float] = Field(None, gt=0)
    eligible_districts: Optional[List[str]] = None
    title: Optional[MultilingualText] = None
    message: Optional[MultilingualText] = None


class CancelNoticeRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)


class NoticeResponseCounts(BaseModel):
    ready: int = 0
    cannot: int = 0
    no_reply: int = 0
    eligible_total: int = 0


class NoticeListItem(BaseModel):
    id: str
    exporter_profile_id: str
    crop: str
    status: str
    computed_state: ComputedNoticeState
    standard_version_id: str
    standard_name: Optional[str] = None
    standard_version_number: Optional[int] = None
    target_month: str
    volume_needed_kg: float
    total_expected_volume_kg: float = 0.0
    volume_percentage: float = 0.0
    eligible_districts: List[str] = []
    title: Dict[str, str]
    created_at: str
    published_at: Optional[str] = None
    cancelled_at: Optional[str] = None
    counts: NoticeResponseCounts


class PaginatedNoticesResponse(BaseModel):
    items: List[NoticeListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


class NoticeDetailResponse(BaseModel):
    id: str
    exporter_profile_id: str
    crop: str
    status: str
    computed_state: ComputedNoticeState
    standard_version_id: str
    standard_name: Optional[str] = None
    standard_version_number: Optional[int] = None
    target_month: str
    volume_needed_kg: float
    eligible_districts: List[str]
    title: Dict[str, str]
    message: Dict[str, str]
    published_at: Optional[str] = None
    cancelled_at: Optional[str] = None
    cancelled_reason: Optional[str] = None
    created_at: str
    updated_at: str
    counts: NoticeResponseCounts
    total_expected_volume_kg: float
    volume_percentage: float


class FarmerResponseItem(BaseModel):
    farmer_id: str
    farmer_name: str
    district: Optional[str] = None
    phone: Optional[str] = None  # Returned ONLY for approved farmers
    response: Literal["ready", "cannot", "no_reply"]
    expected_volume_kg: Optional[float] = None
    plot_id: Optional[str] = None
    plot_name: Optional[str] = None
    plot_area_ha: Optional[float] = None
    responded_at: Optional[str] = None


class NoticeResponsesSummaryResponse(BaseModel):
    notice_id: str
    volume_needed_kg: float
    total_expected_volume_kg: float
    volume_percentage: float
    counts: NoticeResponseCounts
    items: List[FarmerResponseItem]
    total: int
    page: int
    page_size: int
    total_pages: int
