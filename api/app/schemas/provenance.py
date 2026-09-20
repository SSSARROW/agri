from datetime import datetime

from pydantic import BaseModel

from app.schemas.tier_evaluation import ProtocolEvaluationOut


class ProvenanceEvent(BaseModel):
    # Which batch this event actually happened on — needed once lineage
    # (merges) pulls a parent batch's history into the same timeline.
    batch_code: str
    event_type: str
    occurred_at: datetime
    # Sanitized: exact lat/lon/accuracy is a farmer's precise field location,
    # not something a public scan of the batch should expose (see Scan's own
    # "never store precise scanner location" rule — same privacy concern,
    # opposite direction).
    payload: dict


class ProvenancePlot(BaseModel):
    district: str | None
    dsd: str | None
    gn_division: str | None
    area_ha: float | None


class ProvenanceBatch(BaseModel):
    code: str
    crop: str
    created_at: datetime
    parent_codes: list[str]


class ProvenanceOut(BaseModel):
    batch: ProvenanceBatch
    plot: ProvenancePlot | None
    protocol: ProtocolEvaluationOut | None
    planted_at: datetime | None
    timeline: list[ProvenanceEvent]
    lineage: list[ProvenanceBatch]
