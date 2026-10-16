from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class RequiredProof(BaseModel):
    photo_count: int = 0
    photo_descriptions: List[str] = []
    quick_fields: List[str] = []


class StageWithStatus(BaseModel):
    stage_id: str
    position: int
    name: str
    timing_type: str
    start_offset_days: int
    instructions: Dict[str, Any]
    dos: Dict[str, Any]
    donts: Dict[str, Any]
    allowed_inputs: List[str] = []
    required_proof: RequiredProof
    # none | pending | approved | rejected — the farmer's latest submission
    # for this stage, if any.
    submission_status: Optional[str] = None
    submission_id: Optional[str] = None
    # True once an exporter has reopened a rejected submission — only then
    # can the farmer submit again for this stage.
    can_resubmit: bool = True


class StandardWithStages(BaseModel):
    standard_id: str
    crop: str
    standard_name: str
    version_number: int
    stages: List[StageWithStatus]


class FarmerStandardsResponse(BaseModel):
    has_approved_exporter: bool
    exporter_company_name: Optional[str] = None
    standards: List[StandardWithStages] = []


class SubmitProofBody(BaseModel):
    photo_urls: List[str] = Field(..., min_length=1)
    quick_field_answers: Dict[str, Any] = {}
    note: Optional[str] = None
    plot_id: Optional[str] = None


class SubmissionOut(BaseModel):
    id: str
    link_id: str
    stage_id: str
    stage_name: str
    photo_urls: List[str]
    quick_field_answers: Dict[str, Any]
    note: Optional[str] = None
    status: str
    submitted_at: str
    reviewed_at: Optional[str] = None
    review_notes: Optional[str] = None


class MySubmissionsResponse(BaseModel):
    items: List[SubmissionOut]
    total: int
