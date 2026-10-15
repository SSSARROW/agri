from pydantic import BaseModel, Field, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime

class MultilingualText(BaseModel):
    en: str = Field(default="", description="English text (required)")
    si: Optional[str] = Field(default="", description="Sinhala text (optional)")
    ta: Optional[str] = Field(default="", description="Tamil text (optional)")

class TermsSpec(BaseModel):
    payment_timing: Optional[str] = ""
    rejection_handling: Optional[str] = ""
    other: Optional[str] = ""

class AdVersionDraftUpdate(BaseModel):
    standard_version_id: str
    title: MultilingualText
    description: MultilingualText
    grade_tier: str = Field(default="", description="e.g. BOPF, Alba, Grade 1")
    quantity_kg: float = Field(gt=0, description="Target volume in kg (>0)")
    price_type: str = Field(pattern="^(fixed|range)$", description="fixed or range")
    price_fixed: Optional[float] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    collection_window_start: str
    collection_window_end: str
    pickup_location: str = ""
    eligible_districts: List[str] = []
    terms: Optional[TermsSpec] = None
    expires_at: str

class AdCreateRequest(BaseModel):
    crop: str = Field(pattern="^(tea|cinnamon)$")
    standard_version_id: str
    title: MultilingualText
    description: MultilingualText
    grade_tier: str = ""
    quantity_kg: float = Field(gt=0)
    price_type: str = Field(pattern="^(fixed|range)$")
    price_fixed: Optional[float] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    collection_window_start: str
    collection_window_end: str
    pickup_location: str = ""
    eligible_districts: List[str] = []
    terms: Optional[TermsSpec] = None
    expires_at: str

class CloseAdRequest(BaseModel):
    reason: Optional[str] = None

class AdVersionSummary(BaseModel):
    id: str
    ad_id: str
    version_number: int
    status: str
    standard_version_id: str
    title: MultilingualText
    grade_tier: str
    quantity_kg: float
    price_type: str
    price_fixed: Optional[float] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    collection_window_start: str
    collection_window_end: str
    pickup_location: str
    eligible_districts: List[str] = []
    expires_at: str
    published_at: Optional[str] = None
    created_at: str

class AdVersionDetail(AdVersionSummary):
    description: MultilingualText
    terms: TermsSpec
    standard_name: Optional[str] = None
    standard_crop: Optional[str] = None

class AdListItem(BaseModel):
    id: str
    exporter_profile_id: str
    crop: str
    status: str
    computed_status: str
    closed_at: Optional[str] = None
    closed_reason: Optional[str] = None
    created_at: str
    updated_at: str
    current_version_number: int
    latest_version_number: Optional[int] = None
    title: MultilingualText
    latest_title: Optional[MultilingualText] = None
    grade_tier: str
    quantity_kg: float
    latest_quantity_kg: Optional[float] = None
    price_type: str
    latest_price_type: Optional[str] = None
    price_fixed: Optional[float] = None
    latest_price_fixed: Optional[float] = None
    price_min: Optional[float] = None
    latest_price_min: Optional[float] = None
    price_max: Optional[float] = None
    latest_price_max: Optional[float] = None
    expires_at: Optional[str] = None
    latest_expires_at: Optional[str] = None
    collection_window_start: Optional[str] = None
    latest_collection_start: Optional[str] = None
    collection_window_end: Optional[str] = None
    latest_collection_end: Optional[str] = None
    standard_version_id: Optional[str] = None
    latest_standard_name: Optional[str] = None

class AdDetail(BaseModel):
    id: str
    exporter_profile_id: str
    crop: str
    status: str
    computed_status: str
    closed_at: Optional[str] = None
    closed_reason: Optional[str] = None
    created_at: str
    updated_at: str
    versions: List[AdVersionSummary] = []

class PaginatedAdsResponse(BaseModel):
    items: List[AdListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
