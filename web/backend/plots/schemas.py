from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class PlotCreate(BaseModel):
    geometry: Dict[str, Any]
    owner_user_id: str
    district: Optional[str] = None
    dsd: Optional[str] = None
    gn_division: Optional[str] = None

class PlotUpdate(BaseModel):
    district: Optional[str] = None
    dsd: Optional[str] = None
    gn_division: Optional[str] = None

class PlotResponse(BaseModel):
    id: str
    owner_user_id: Optional[str] = None
    geometry: Dict[str, Any]
    area_ha: float
    district: Optional[str] = None
    dsd: Optional[str] = None
    gn_division: Optional[str] = None
    created_at: Optional[str] = None

class PaginatedPlotsResponse(BaseModel):
    items: List[PlotResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
