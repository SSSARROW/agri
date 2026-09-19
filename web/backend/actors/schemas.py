from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class ActorUpdate(BaseModel):
    is_active: Optional[bool] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    district: Optional[str] = None

class ActorResponse(BaseModel):
    id: str
    email: str
    role: str
    name: Optional[str] = None
    phone: Optional[str] = None
    district: Optional[str] = None
    dsd: Optional[str] = None
    gn_division: Optional[str] = None
    farm_address: Optional[str] = None
    farm_size_ha: Optional[float] = None
    business_name: Optional[str] = None
    business_reg_no: Optional[str] = None
    business_address: Optional[str] = None
    export_license_no: Optional[str] = None
    is_active: bool = True
    created_at: Optional[str] = None

class PaginatedActorsResponse(BaseModel):
    items: List[ActorResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
