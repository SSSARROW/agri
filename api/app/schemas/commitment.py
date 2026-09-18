import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CommitmentCreate(BaseModel):
    crop: str
    protocol_id: uuid.UUID | None = None
    volume_kg: float = Field(gt=0)
    delivery_window_start: datetime
    delivery_window_end: datetime
    indicative_price_lkr_per_kg: float | None = Field(default=None, gt=0)


class CommitmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    buyer_user_id: uuid.UUID
    crop: str
    protocol_id: uuid.UUID | None
    volume_kg: float
    remaining_kg: float
    delivery_window_start: datetime
    delivery_window_end: datetime
    indicative_price_lkr_per_kg: float | None
    created_at: datetime
