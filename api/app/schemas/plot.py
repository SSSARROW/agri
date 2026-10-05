import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# A plot's boundary polygon already supports any shape — a walked circle or
# an irregular greenhouse footprint work the same as a field. This is
# separate metadata about the growing environment, since some protocol
# requirements (e.g. organic's buffer-zone-from-neighbors rule) don't apply
# cleanly to an enclosed structure.
PlotType = Literal["open_field", "greenhouse", "shade_house", "hydroponic"]


class BoundaryPoint(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class PlotCreate(BaseModel):
    # A real boundary walk (>=3 corner pins dropped while walking the plot's
    # edge) is the preferred path. center_lat/center_lon/side_m — a dropped
    # pin plus an approximate side length — is the fallback for when walking
    # isn't practical; which one was used is kept honest via boundary_source
    # on the stored plot rather than silently treated as equally precise.
    boundary_points: list[BoundaryPoint] | None = None
    # How boundary_points were captured: "walked" (GPS pins dropped in the
    # field) or "traced" (corners tapped on satellite imagery). Different
    # evidence, so it's recorded rather than assumed — see boundary_source on
    # the stored plot.
    boundary_source: Literal["walked", "traced"] = "walked"
    center_lat: float | None = Field(default=None, ge=-90, le=90)
    center_lon: float | None = Field(default=None, ge=-180, le=180)
    side_m: float | None = Field(default=None, gt=0, le=2000)
    plot_type: PlotType = "open_field"
    name: str | None = Field(default=None, max_length=60)
    district: str
    dsd: str | None = None
    gn_division: str | None = None

    @model_validator(mode="after")
    def _one_method_provided(self) -> "PlotCreate":
        if self.boundary_points is not None:
            if len(self.boundary_points) < 3:
                raise ValueError("A boundary walk needs at least 3 points.")
            return self
        if self.center_lat is not None and self.center_lon is not None and self.side_m is not None:
            return self
        raise ValueError("Provide either boundary_points (>=3) or center_lat/center_lon/side_m.")


class PlotRename(BaseModel):
    name: str | None = Field(default=None, max_length=60)


class PlotPlantingOut(BaseModel):
    """One crop currently recorded as planted on a plot — a plot can carry
    more than one of these at once (intercropping), so PlotOut holds a list
    rather than a single committed protocol."""

    crop: str
    planted_at: datetime
    # The area claimed for this crop specifically, if the farmer gave one at
    # planting time — None means the whole plot (either intercropping wasn't
    # a factor, or this planting predates area tracking).
    area_ha: float | None
    # Which protocol (if any) the farmer confirmed adherence to for this
    # crop at planting time — self-reported, not independently verified.
    protocol_id: uuid.UUID | None
    protocol_name: str | None


class PlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_user_id: uuid.UUID | None
    center_lat: float
    center_lon: float
    area_ha: float | None
    boundary_source: str
    plot_type: str
    name: str | None
    district: str | None
    dsd: str | None
    gn_division: str | None
    # Most recent planting per crop currently on this plot (intercropping
    # means more than one can be live at a time).
    plantings: list[PlotPlantingOut]
    created_at: datetime
