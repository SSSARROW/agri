import uuid
from datetime import datetime

from pydantic import BaseModel


class StageEvaluationOut(BaseModel):
    sequence: int
    title: str
    instructions: str
    day_offset: int | None
    due_date: datetime | None
    required_event_types: list[str] | None
    # None = not mechanically checkable (a standing rule like "use no
    # synthetic pesticides" — nothing in the event log proves compliance
    # either way). True/False only applies to stages with required_event_types.
    satisfied: bool | None
    # "standing" | "done" | "overdue" | "upcoming" | "pending"
    status: str


class ProtocolEvaluationOut(BaseModel):
    protocol_id: uuid.UUID
    protocol_name: str
    protocol_tier: str
    protocol_source: str
    stages: list[StageEvaluationOut]
    required_total: int
    required_satisfied: int
    # Only true once every stage that has a checkable required_event_types
    # requirement is satisfied — and only if there was at least one such
    # stage to check (an all-standing-rules protocol can't self-certify).
    tier_achieved: bool
