import uuid
from datetime import datetime

from pydantic import BaseModel


class BatchCreate(BaseModel):
    plot_id: uuid.UUID
    crop: str
    # Which quality standard the farmer is committing this batch to (B-30) —
    # optional, since not every crop has a protocol seeded yet.
    protocol_id: uuid.UUID | None = None


class BatchMergeCreate(BaseModel):
    # A collector combining several farmers' individually-registered batches
    # into one at the collection point — the batches a smallholder actually
    # produces are too small to ship alone. Each parent keeps its own full
    # history; this just adds one more batch downstream of all of them.
    parent_batch_ids: list[uuid.UUID]
    crop: str
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
