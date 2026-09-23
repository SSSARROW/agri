import uuid
from datetime import datetime

from pydantic import BaseModel


class PhotoCheckpointOut(BaseModel):
    sequence: int
    due_date: datetime
    satisfied: bool
    status: str  # "done" | "overdue" | "upcoming"


class PlotPhotoScheduleOut(BaseModel):
    plot_id: uuid.UUID
    has_registration_photo: bool
    planted_at: datetime | None
    interval_days: int
    checkpoints: list[PhotoCheckpointOut]
