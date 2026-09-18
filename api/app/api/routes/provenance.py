import hashlib

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import Batch, Event, Plot, Protocol, ProtocolStage, Scan
from app.db.session import get_db
from app.schemas.protocol import ProtocolStageOut
from app.schemas.provenance import ProvenanceBatch, ProvenanceEvent, ProvenanceOut, ProvenancePlot, ProvenanceProtocol

router = APIRouter(prefix="/provenance", tags=["provenance"])

# Any per-event field that pins down where the farmer physically was — fine
# for internal traceability, not fine to hand to an anonymous scanner.
_PRIVATE_PAYLOAD_KEYS = {"lat", "lon", "accuracy_m"}


def _sanitize_payload(payload: dict) -> dict:
    return {k: v for k, v in payload.items() if k not in _PRIVATE_PAYLOAD_KEYS}


async def _load_lineage(db: AsyncSession, root: Batch) -> list[Batch]:
    """Walks parent_batch_ids outward from `root`, breadth-first, returning
    every ancestor found (not including root itself). Shallow in practice —
    merges are rare writes — so a Python walk is simpler than a recursive CTE
    and cheap enough at this depth."""
    ancestors: dict = {}
    frontier = list(root.parent_batch_ids or [])
    seen_ids = {root.id}
    while frontier:
        batch_id = frontier.pop()
        if batch_id in seen_ids:
            continue
        seen_ids.add(batch_id)
        batch = await db.get(Batch, batch_id)
        if batch is None:
            continue
        ancestors[batch.id] = batch
        frontier.extend(batch.parent_batch_ids or [])
    return list(ancestors.values())


@router.get("/{batch_code}", response_model=ProvenanceOut)
async def get_provenance(
    batch_code: str,
    request: Request,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
    db: AsyncSession = Depends(get_db),
) -> ProvenanceOut:
    normalized = batch_code.strip().upper()
    batch = (await db.execute(select(Batch).where(Batch.code == normalized))).scalar_one_or_none()
    if batch is None:
        raise AppError(code="not_found", message="No batch found with that code.", status_code=status.HTTP_404_NOT_FOUND)

    ancestors = await _load_lineage(db, batch)
    all_batches = [batch] + ancestors
    code_by_id = {b.id: b.code for b in all_batches}

    events_result = await db.execute(
        select(Event).where(Event.batch_id.in_(code_by_id.keys())).order_by(Event.occurred_at)
    )
    timeline = [
        ProvenanceEvent(
            batch_code=code_by_id[e.batch_id],
            event_type=e.event_type,
            occurred_at=e.occurred_at,
            payload=_sanitize_payload(e.payload),
        )
        for e in events_result.scalars().all()
    ]

    plot = await db.get(Plot, batch.plot_id) if batch.plot_id else None
    plot_out = (
        ProvenancePlot(district=plot.district, dsd=plot.dsd, gn_division=plot.gn_division, area_ha=float(plot.area_ha) if plot.area_ha is not None else None)
        if plot is not None
        else None
    )

    planted_at = None
    if batch.plot_id is not None:
        planted_stmt = (
            select(Event.occurred_at)
            .where(
                Event.plot_id == batch.plot_id,
                Event.event_type == "planted",
                Event.occurred_at <= batch.created_at,
            )
            .order_by(Event.occurred_at.desc())
            .limit(1)
        )
        planted_at = (await db.execute(planted_stmt)).scalar_one_or_none()

    protocol_out = None
    if batch.protocol_id is not None:
        protocol = await db.get(Protocol, batch.protocol_id)
        if protocol is not None:
            stage_rows = (
                (
                    await db.execute(
                        select(ProtocolStage)
                        .where(ProtocolStage.protocol_id == protocol.id)
                        .order_by(ProtocolStage.sequence)
                    )
                )
                .scalars()
                .all()
            )
            protocol_out = ProvenanceProtocol(
                id=protocol.id,
                tier=protocol.tier,
                name=protocol.name,
                source=protocol.source,
                stages=[ProtocolStageOut.model_validate(s) for s in stage_rows],
            )

    def to_provenance_batch(b: Batch) -> ProvenanceBatch:
        return ProvenanceBatch(
            code=b.code,
            crop=b.crop,
            created_at=b.created_at,
            parent_codes=[code_by_id.get(pid, str(pid)) for pid in (b.parent_batch_ids or [])],
        )

    # Best-effort scan log for abuse monitoring (Scan is separate from the
    # append-only Event log on purpose — a public hit isn't provenance data).
    # Never let logging failure break the actual provenance lookup.
    try:
        client_ip = request.client.host if request.client else "unknown"
        db.add(
            Scan(
                batch_id=batch.id,
                hashed_ip=hashlib.sha256(client_ip.encode()).hexdigest(),
                coarse_lat=round(lat, 2) if lat is not None else None,
                coarse_lon=round(lon, 2) if lon is not None else None,
                user_agent=request.headers.get("user-agent"),
            )
        )
        await db.commit()
    except Exception:
        await db.rollback()

    return ProvenanceOut(
        batch=to_provenance_batch(batch),
        plot=plot_out,
        protocol=protocol_out,
        planted_at=planted_at,
        timeline=timeline,
        lineage=[to_provenance_batch(a) for a in ancestors],
    )
