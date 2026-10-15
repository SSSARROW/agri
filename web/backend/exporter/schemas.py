from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class ExporterProfileUpdate(BaseModel):
    """Fields the exporter is allowed to edit themselves.
    status and rejection_reason are intentionally excluded."""
    company_name: Optional[str] = None
    business_reg_no: Optional[str] = None
    export_licence_no: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    districts_served: Optional[List[str]] = None
    crops_bought: Optional[List[str]] = None
    certifications: Optional[List[str]] = None


class ExporterProfileResponse(BaseModel):
    id: str
    user_id: str

    company_name: str
    business_reg_no: str
    export_licence_no: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None

    districts_served: List[str] = []
    crops_bought: List[str] = ["tea", "cinnamon"]
    certifications: List[str] = []

    # Read-only — exporter cannot modify these
    status: str
    rejection_reason: Optional[str] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
