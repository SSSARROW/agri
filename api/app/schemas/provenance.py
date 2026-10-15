from datetime import datetime

from pydantic import BaseModel

from app.schemas.tier_evaluation import ProtocolEvaluationOut


class ProvenanceEvent(BaseModel):
    # Which batch this event actually happened on — needed once lineage
    # (merges) pulls a parent batch's history into the same timeline. None
    # for a plot-level event (the plot's registration photo, or the planting
    # that produced this batch's crop) folded in for origin context — it
    # happened before any batch existed, so there's no batch code to show.
    batch_code: str | None
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
    # Set when this scan itself looks like duplicate-code abuse (B-22) — see
    # provenance.py's _detect_scan_warning. None means nothing suspicious
    # about this particular scan, not that the batch has never been flagged.
    scan_warning: str | None = None
