import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.geo import haversine_distance_m
from app.core.tier_evaluation import evaluate_batch_protocol, get_planted_at
from app.db.models import Batch, Event, Plot, Protocol, Scan
from app.db.session import get_db
from app.schemas.provenance import ProvenanceBatch, ProvenanceEvent, ProvenanceOut, ProvenancePlot

router = APIRouter(prefix="/provenance", tags=["provenance"])

# A single retail unit's QR code is expected to be scanned by roughly one
# buyer from roughly one place. A code that's later scanned from somewhere
# implausibly far away, or far more often than a single unit plausibly would
# be, most likely means it's been copied onto more than one physical
# product (B-22) — either is worth a warning even though neither proves it.
_DISTANT_SCAN_KM = 100.0
_HIGH_VOLUME_WINDOW = timedelta(hours=1)
_HIGH_VOLUME_THRESHOLD = 30

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


async def resolve_batch_by_code(db: AsyncSession, batch_code: str) -> Batch | None:
    normalized = batch_code.strip().upper()
    return (await db.execute(select(Batch).where(Batch.code == normalized))).scalar_one_or_none()


async def _detect_scan_warning(db: AsyncSession, *, batch_id, lat: float | None, lon: float | None) -> str | None:
    """Checks this scan against every prior scan of the same code (see
    _DISTANT_SCAN_KM / _HIGH_VOLUME_THRESHOLD above for what counts as
    suspicious). Called before the new Scan row is inserted, so "prior"
    here really does mean prior."""
    prior_scans = (await db.execute(select(Scan).where(Scan.batch_id == batch_id))).scalars().all()

    if lat is not None and lon is not None:
        for prior in prior_scans:
            if prior.coarse_lat is None or prior.coarse_lon is None:
                continue
            distance_km = haversine_distance_m(lat, lon, prior.coarse_lat, prior.coarse_lon) / 1000
            if distance_km > _DISTANT_SCAN_KM:
                return (
                    "This code has been scanned from two very different locations. "
                    "It may have been copied onto more than one product — buy with caution."
                )

    cutoff = datetime.now(timezone.utc) - _HIGH_VOLUME_WINDOW
    recent_count = sum(1 for s in prior_scans if s.scanned_at >= cutoff)
    if recent_count + 1 > _HIGH_VOLUME_THRESHOLD:
        return (
            "This code has been scanned an unusually high number of times recently. "
            "It may have been copied onto more than one product — buy with caution."
        )

    return None


async def log_scan(db: AsyncSession, *, batch_id, request: Request, lat: float | None, lon: float | None) -> str | None:
    """Best-effort scan log for abuse monitoring (Scan is separate from the
    append-only Event log on purpose — a public hit isn't provenance data).
    Never let logging failure break the actual provenance lookup. Shared by
    the JSON API and the HTML page — both are "someone looked this batch up".

    Returns the B-22 warning message for this scan, if any, so the caller can
    surface it in the response actually being returned to whoever just
    triggered it."""
    try:
        warning = await _detect_scan_warning(db, batch_id=batch_id, lat=lat, lon=lon)
        client_ip = request.client.host if request.client else "unknown"
        db.add(
            Scan(
                batch_id=batch_id,
                hashed_ip=hashlib.sha256(client_ip.encode()).hexdigest(),
                coarse_lat=round(lat, 2) if lat is not None else None,
                coarse_lon=round(lon, 2) if lon is not None else None,
                user_agent=request.headers.get("user-agent"),
                flagged=warning is not None,
            )
        )
        await db.commit()
        return warning
    except Exception:
        await db.rollback()
        return None


async def build_provenance(db: AsyncSession, batch: Batch, *, scan_warning: str | None = None) -> ProvenanceOut:
    """Everything about a batch a public viewer (JSON API or the HTML page)
    is allowed to see. Pulled out of the route so the page route can render
    the identical data instead of re-deriving it with its own queries."""
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

    # Fold in the plot's own origin and growth photos — the registration
    # photo (proof the plot itself exists), whichever planting photo matches
    # this batch's crop, and every progress checkpoint logged for the plot —
    # so a scan tells the full story back to before any batch existed, not
    # just what happened after. progress_photo isn't crop-specific (a plot
    # can intercrop), so it's included unfiltered like plot_photo rather
    # than matched like planting_photo.
    if batch.plot_id is not None:
        origin_photos_result = await db.execute(
            select(Event)
            .where(
                Event.plot_id == batch.plot_id,
                Event.event_type.in_(["plot_photo", "planting_photo", "progress_photo"]),
            )
            .order_by(Event.occurred_at)
        )
        for e in origin_photos_result.scalars().all():
            if e.event_type == "planting_photo" and str(e.payload.get("crop", "")).lower() != batch.crop.lower():
                continue
            timeline.append(
                ProvenanceEvent(
                    batch_code=None,
                    event_type=e.event_type,
                    occurred_at=e.occurred_at,
                    payload=_sanitize_payload(e.payload),
                )
            )
        timeline.sort(key=lambda e: e.occurred_at)

    plot = await db.get(Plot, batch.plot_id) if batch.plot_id else None
    plot_out = (
        ProvenancePlot(district=plot.district, dsd=plot.dsd, gn_division=plot.gn_division, area_ha=float(plot.area_ha) if plot.area_ha is not None else None)
        if plot is not None
        else None
    )

    planted_at = await get_planted_at(db, plot_id=batch.plot_id, before=batch.created_at, crop=batch.crop)

    protocol_out = None
    if batch.protocol_id is not None:
        protocol = await db.get(Protocol, batch.protocol_id)
        if protocol is not None:
            protocol_out = await evaluate_batch_protocol(
                db, protocol=protocol, batch_id=batch.id, planted_at=planted_at
            )

    def to_provenance_batch(b: Batch) -> ProvenanceBatch:
        return ProvenanceBatch(
            code=b.code,
            crop=b.crop,
            created_at=b.created_at,
            parent_codes=[code_by_id.get(pid, str(pid)) for pid in (b.parent_batch_ids or [])],
        )

    return ProvenanceOut(
        batch=to_provenance_batch(batch),
        plot=plot_out,
        protocol=protocol_out,
        planted_at=planted_at,
        timeline=timeline,
        lineage=[to_provenance_batch(a) for a in ancestors],
        scan_warning=scan_warning,
    )


@router.get("/{batch_code}", response_model=ProvenanceOut)
async def get_provenance(
    batch_code: str,
    request: Request,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
    db: AsyncSession = Depends(get_db),
) -> ProvenanceOut:
    batch = await resolve_batch_by_code(db, batch_code)
    if batch is None:
        raise AppError(code="not_found", message="No batch found with that code.", status_code=status.HTTP_404_NOT_FOUND)
    scan_warning = await log_scan(db, batch_id=batch.id, request=request, lat=lat, lon=lon)
    return await build_provenance(db, batch, scan_warning=scan_warning)
