import uuid
from datetime import datetime

from pydantic import BaseModel


class BatchCreate(BaseModel):
    plot_id: uuid.UUID
    crop: str


class BatchOut(BaseModel):
    id: uuid.UUID
    code: str
    crop: str
    plot_id: uuid.UUID | None
    created_at: datetime
    latest_status: str
    latest_occurred_at: datetime | None
