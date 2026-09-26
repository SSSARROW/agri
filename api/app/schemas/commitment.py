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
    protocol_name: str | None = None
    volume_kg: float
    remaining_kg: float
    delivery_window_start: datetime
    delivery_window_end: datetime
    indicative_price_lkr_per_kg: float | None
    created_at: datetime


class MyCommitmentOut(CommitmentOut):
    delivered_kg: float
    # "open" | "filled" | "shortfall" (window over, not filled) | "overdelivered"
    status: str


class DeliveredBatchOut(BaseModel):
    batch_code: str
    weight_kg: float
    weighed_at: datetime
    within_window: bool
    protocol_name: str | None
    # None when the batch names no protocol; otherwise whether every checkable
    # stage of it has a matching recorded event (see tier_evaluation.py).
    tier_verified: bool | None
    provenance_path: str


class ReconciliationOut(BaseModel):
    commitment_id: uuid.UUID
    crop: str
    volume_kg: float
    delivered_kg: float
    shortfall_kg: float
    surplus_kg: float
    status: str
    batches: list[DeliveredBatchOut]


class AllocationEntry(BaseModel):
    farmer_user_id: uuid.UUID
    farmer_name: str | None
    capacity_kg: float
    allocated_kg: float


class AllocationProposalOut(BaseModel):
    commitment_id: uuid.UUID
    volume_kg: float
    allocated_kg: float
    unallocated_kg: float
    entries: list[AllocationEntry]
