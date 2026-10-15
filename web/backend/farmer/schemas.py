from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class VerifiedExporterPublicItem(BaseModel):
    id: str  # exporter_profile_id
    company_name: str
    description: Optional[str] = None
    logo_url: Optional[str] = None
    districts_served: List[str] = []
    crops_bought: List[str] = []
    certifications: List[str] = []

class RequestLinkBody(BaseModel):
    exporter_profile_id: str

class FarmerLinkStatusResponse(BaseModel):
    id: str
    farmer_id: str
    exporter_profile_id: str
    exporter_company_name: Optional[str] = None
    status: str
    requested_at: str
    decided_at: Optional[str] = None
    decision_reason: Optional[str] = None

class CurrentLinkResponse(BaseModel):
    has_active_link: bool
    link: Optional[FarmerLinkStatusResponse] = None
