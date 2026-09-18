import uuid

from pydantic import BaseModel, ConfigDict


class ProtocolStageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sequence: int
    day_offset: int | None
    title: str
    instructions: str
    required_event_types: list[str] | None


class ProtocolSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    crop: str
    tier: str
    name: str
    version: int
    source: str


class ProtocolOut(ProtocolSummary):
    stages: list[ProtocolStageOut]
