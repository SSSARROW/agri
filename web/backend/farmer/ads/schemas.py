from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ExporterPublicProfile(BaseModel):
    company_name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    certifications: List[str] = []

class OpenAdItem(BaseModel):
    id: str
    crop: str
    grade_tier: str
    quantity_kg: float
    approved_quantity_kg: float
    remaining_quantity_kg: float
    price_type: str
    price_fixed: Optional[float] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    collection_window_start: str
    collection_window_end: str
    pickup_location: Optional[str] = None
    eligible_districts: List[str] = []
    expires_at: str
    title: Dict[str, str]
    exporter: ExporterPublicProfile

class PaginatedOpenAdsResponse(BaseModel):
    items: List[OpenAdItem]
    total: int
    page: int
    page_size: int
    total_pages: int

class StandardStageItem(BaseModel):
    position: int
    name: str
    timing_type: str
    start_offset_days: int
    instructions: Dict[str, Any]
    dos: Dict[str, Any]
    donts: Dict[str, Any]
    allowed_inputs: List[str] = []
    banned_inputs: List[Dict[str, Any]] = []
    required_proof: Dict[str, Any] = {}

class OpenAdDetail(BaseModel):
    id: str
    crop: str
    status: str
    computed_status: str
    ad_version_id: str
    version_number: int
    title: Dict[str, str]
    description: Dict[str, str]
    grade_tier: str
    quantity_kg: float
    approved_quantity_kg: float
    remaining_quantity_kg: float
    price_type: str
    price_fixed: Optional[float] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    collection_window_start: str
    collection_window_end: str
    pickup_location: Optional[str] = None
    eligible_districts: List[str] = []
    terms: Dict[str, Any] = {}
    expires_at: str
    exporter: ExporterPublicProfile
    standard_name: str
    standard_version_number: int
    standard_stages: List[StandardStageItem]
    terms_hash: str

class AcceptAdRequest(BaseModel):
    ad_version_id: str
    supply_quantity_kg: float = Field(..., gt=0, description="Supply quantity must be greater than 0")

class AcceptAdResponse(BaseModel):
    acceptance_id: str
    ad_id: str
    ad_version_id: str
    farmer_id: str
    link_id: str
    supply_quantity_kg: float
    terms_hash: str
    accepted_at: str
    derived_status: str
    message: str

class FarmerAcceptanceItem(BaseModel):
    acceptance_id: str
    ad_id: str
    ad_title: Dict[str, str]
    crop: str
    grade_tier: str
    ad_version_number: int
    exporter_name: str
    exporter_logo_url: Optional[str] = None
    supply_quantity_kg: float
    price_type: str
    price_fixed: Optional[float] = None
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    collection_window_start: str
    collection_window_end: str
    accepted_at: str
    withdrawn_at: Optional[str] = None
    derived_status: str
    link_status: str

class MyAcceptancesResponse(BaseModel):
    items: List[FarmerAcceptanceItem]
    total: int
