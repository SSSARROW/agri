"""
Pydantic schemas for Exporter Quality Standards API.
"""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, field_validator, model_validator


class MultilingualText(BaseModel):
    en: str = Field(..., description="English text is required")
    si: Optional[str] = None
    ta: Optional[str] = None


class MultilingualList(BaseModel):
    en: List[str] = Field(default_factory=list, description="English items list required")
    si: Optional[List[str]] = Field(default_factory=list)
    ta: Optional[List[str]] = Field(default_factory=list)


class BannedInputItem(BaseModel):
    name: str = Field(..., min_length=1)
    min_days_before_harvest: int = Field(..., ge=0)


class RequiredProofSpec(BaseModel):
    photo_count: int = Field(0, ge=0)
    photo_descriptions: List[str] = Field(default_factory=list)
    quick_fields: List[str] = Field(default_factory=list)


class StageCreateUpdate(BaseModel):
    position: int = Field(..., ge=1)
    name: str = Field(..., min_length=1)
    timing_type: str = Field(..., pattern="^(one_time|recurring)$")
    start_offset_days: int
    repeat_interval_days: Optional[int] = None
    end_offset_days: Optional[int] = None
    instructions: MultilingualText
    dos: MultilingualList
    donts: MultilingualList
    allowed_inputs: List[str] = Field(default_factory=list)
    banned_inputs: List[BannedInputItem] = Field(default_factory=list)
    required_proof: RequiredProofSpec = Field(default_factory=RequiredProofSpec)

    @model_validator(mode="after")
    def validate_stage_timing(self):
        if self.timing_type == "recurring":
            if self.repeat_interval_days is None or self.repeat_interval_days <= 0:
                raise ValueError("Recurring stage requires repeat_interval_days > 0")
        if self.end_offset_days is not None:
            if self.end_offset_days < self.start_offset_days:
                raise ValueError("end_offset_days must be greater than or equal to start_offset_days")
        return self


class DraftVersionUpdate(BaseModel):
    name: str = Field(..., min_length=1)
    grade_spec: Dict[str, Any] = Field(default_factory=dict)
    stages: List[StageCreateUpdate] = Field(default_factory=list)

    @field_validator("stages")
    @classmethod
    def validate_unique_positions(cls, stages: List[StageCreateUpdate]):
        positions = [s.position for s in stages]
        if len(positions) != len(set(positions)):
            raise ValueError("Stage positions within a version must be unique")
        return stages


class CreateStandardRequest(BaseModel):
    crop: str = Field(..., min_length=1, description="Crop name (e.g. tea, cinnamon)")
    name: str = Field("v1 Draft", min_length=1, description="Name for the initial version")
    grade_spec: Dict[str, Any] = Field(default_factory=dict)
    stages: List[StageCreateUpdate] = Field(default_factory=list)

    @field_validator("stages")
    @classmethod
    def validate_unique_positions(cls, stages: List[StageCreateUpdate]):
        positions = [s.position for s in stages]
        if len(positions) != len(set(positions)):
            raise ValueError("Stage positions within a version must be unique")
        return stages


# ── Response Schemas ────────────────────────────────────────────────────────

class StageResponse(BaseModel):
    id: str
    version_id: str
    position: int
    name: str
    timing_type: str
    start_offset_days: int
    repeat_interval_days: Optional[int] = None
    end_offset_days: Optional[int] = None
    instructions: Dict[str, Any]
    dos: Dict[str, Any]
    donts: Dict[str, Any]
    allowed_inputs: List[Any]
    banned_inputs: List[Any]
    required_proof: Dict[str, Any]
    created_at: str


class VersionSummaryResponse(BaseModel):
    id: str
    standard_id: str
    version_number: int
    name: str
    status: str
    grade_spec: Dict[str, Any]
    published_at: Optional[str] = None
    created_at: str


class VersionDetailResponse(VersionSummaryResponse):
    stages: List[StageResponse] = Field(default_factory=list)


class StandardResponse(BaseModel):
    id: str
    exporter_profile_id: str
    crop: str
    is_archived: bool
    created_at: str
    updated_at: str
    versions: List[VersionSummaryResponse] = Field(default_factory=list)


class StandardListResponse(BaseModel):
    items: List[StandardResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
