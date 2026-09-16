import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class EventCreate(BaseModel):
    # Client-generated — this is the idempotency key. Posting the same id
    # twice must create exactly one row (B-13).
    id: uuid.UUID
    event_type: str
    actor_id: uuid.UUID | None = None
    batch_id: uuid.UUID | None = None
    plot_id: uuid.UUID | None = None
    payload: dict = {}
    occurred_at: datetime


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_type: str
    actor_id: uuid.UUID | None
    batch_id: uuid.UUID | None
    plot_id: uuid.UUID | None
    payload: dict
    occurred_at: datetime
    recorded_at: datetime
