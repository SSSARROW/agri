import uuid
from datetime import datetime

from pydantic import BaseModel


class BatchCreate(BaseModel):
    plot_id: uuid.UUID
    crop: str
    # Which quality standard the farmer is committing this batch to (B-30) —
    # optional, since not every crop has a protocol seeded yet.
    protocol_id: uuid.UUID | None = None


class BatchOut(BaseModel):
    id: uuid.UUID
    code: str
    crop: str
    plot_id: uuid.UUID | None
    protocol_id: uuid.UUID | None
    protocol_name: str | None
    commitment_id: uuid.UUID | None
    created_at: datetime
    latest_status: str
    latest_occurred_at: datetime | None
