from typing import Optional, Literal
from pydantic import BaseModel, Field

ReportReason = Literal["fake_ad", "wrong_information", "suspicious_exporter", "other"]


class ReportAdRequest(BaseModel):
    reason: ReportReason
    details: Optional[str] = Field(None, max_length=500)


class ReportAdResponse(BaseModel):
    report_id: str
    ad_id: str
    farmer_id: str
    reason: str
    details: Optional[str] = None
    status: str
    created_at: str
    message: str
