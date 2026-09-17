import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PlotCreate(BaseModel):
    # A dropped GPS pin + an approximate side length stands in for full
    # polygon drawing (W-11, web) until that exists — good enough for a
    # farmer registering a small plot from their phone.
    center_lat: float = Field(ge=-90, le=90)
    center_lon: float = Field(ge=-180, le=180)
    side_m: float = Field(gt=0, le=2000)
    district: str
    dsd: str | None = None
    gn_division: str | None = None


class PlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_user_id: uuid.UUID | None
    center_lat: float
    center_lon: float
    area_ha: float | None
    district: str | None
    dsd: str | None
    gn_division: str | None
    created_at: datetime
