from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class PlotSummary(BaseModel):
    id: str
    name: Optional[str] = None
    area_ha: Optional[float] = None
    district: Optional[str] = None
    dsd: Optional[str] = None
    gn_division: Optional[str] = None
    plot_type: Optional[str] = None
    boundary_source: Optional[str] = None

class FarmerSummary(BaseModel):
    id: str
    name: str
    district: Optional[str] = None
    dsd: Optional[str] = None
    gn_division: Optional[str] = None
    farm_address: Optional[str] = None
    farm_size_ha: Optional[float] = None
    phone: Optional[str] = None  # Populated ONLY if status == 'approved'
    crops: List[str] = []
    total_plots: int = 0
    total_plot_area_ha: float = 0.0

class FarmerLinkListItem(BaseModel):
    id: str
    farmer_id: str
    exporter_profile_id: str
    status: str
    requested_at: str
    decided_at: Optional[str] = None
    decision_reason: Optional[str] = None
    farmer: FarmerSummary

class PaginatedFarmerLinksResponse(BaseModel):
    items: List[FarmerLinkListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    pending_count: int

class FarmerLinkDetailResponse(BaseModel):
    id: str
    farmer_id: str
    exporter_profile_id: str
    status: str
    requested_at: str
    decided_at: Optional[str] = None
    decision_reason: Optional[str] = None
    farmer: FarmerSummary
    plots: List[PlotSummary] = []

class DecisionActionRequest(BaseModel):
    reason: Optional[str] = None
