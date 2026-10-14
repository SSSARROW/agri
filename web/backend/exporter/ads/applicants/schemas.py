from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class ApplicantPlotSummary(BaseModel):
    id: str
    name: str
    area_ha: Optional[float] = None
    district: Optional[str] = None
    crops: List[str] = []

class ApplicantItem(BaseModel):
    acceptance_id: str
    farmer_id: str
    farmer_name: str
    farmer_district: Optional[str] = None
    dsd: Optional[str] = None
    gn_division: Optional[str] = None
    farm_size_ha: Optional[float] = None
    plots: List[ApplicantPlotSummary] = []
    supply_quantity_kg: float
    accepted_at: str
    withdrawn_at: Optional[str] = None
    derived_status: str
    link_status: str
    ad_version_number: int
    terms_hash: str
    phone: Optional[str] = None

class AdApplicantsResponse(BaseModel):
    ad_id: str
    crop: str
    ad_title: Dict[str, str] = {}
    target_quantity_kg: float
    approved_quantity_kg: float
    pending_quantity_kg: float
    remaining_quantity_kg: float
    is_filled: bool
    items: List[ApplicantItem]
    total: int
    page: int
    page_size: int
    total_pages: int

class DeclineApplicantRequest(BaseModel):
    reason: Optional[str] = None
