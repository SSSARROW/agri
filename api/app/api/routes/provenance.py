import hashlib
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.core.geo import haversine_distance_m
from app.core.tier_evaluation import evaluate_batch_protocol, get_planted_at
from app.db.models import Batch, Event, Plot, Protocol, Scan
from app.db.session import get_db
from app.schemas.provenance import (
    ProvenanceBatch,
    ProvenanceEvent,
    ProvenanceExporter,
    ProvenanceExporterStandard,
    ProvenanceOut,
    ProvenancePlot,
    ProvenanceSummary,
)

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


_STEP_ORDER = ["collect", "weigh", "process", "grade", "pack", "collector_attestation"]


def _latest_value(timeline: list[ProvenanceEvent], batch_code: str, event_type: str, key: str):
    """Newest non-empty payload[key] of an event type on one batch (timeline is oldest-first)."""
    for e in reversed(timeline):
        if e.event_type == event_type and e.batch_code == batch_code and e.payload.get(key) not in (None, ""):
            return e.payload[key]
    return None


def _as_float(v) -> float | None:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


async def _exporter_context(db: AsyncSession, owner_ids: list, crop: str):
    """The exporter(s) the growers follow, and how far each grower is through that
    exporter's own standard (stages the exporter has approved proof for).

    Reads the account service's tables, which share this database. Best-effort:
    a missing table or an unlinked grower just means there is nothing to show."""
    if not owner_ids:
        return [], []
    try:
        rows = (
            await db.execute(
                text(
                    """
                    SELECT DISTINCT ep.id, ep.company_name, ep.description, ep.logo_url, ep.certifications, l.farmer_id
                    FROM farmer_exporter_links l
                    JOIN exporter_profiles ep ON ep.id = l.exporter_profile_id
                    WHERE l.status = 'approved' AND l.farmer_id = ANY(CAST(:owners AS uuid[]))
                    """
                ),
                {"owners": [str(o) for o in owner_ids]},
            )
        ).all()
    except Exception:
        await db.rollback()
        return [], []

    exporters: dict[str, ProvenanceExporter] = {}
    standards: list[ProvenanceExporterStandard] = []
    for r in rows:
        exporters.setdefault(
            str(r.id),
            ProvenanceExporter(
                company_name=r.company_name,
                description=r.description,
                logo_url=r.logo_url,
                certifications=list(r.certifications or []),
            ),
        )
        try:
            std = (
                await db.execute(
                    text(
                        """
                        SELECT qv.id AS version_id, qv.name, qv.version_number,
                               (SELECT count(*) FROM quality_standard_stages st WHERE st.version_id = qv.id) AS total
                        FROM quality_standards qs
                        JOIN LATERAL (
                            SELECT * FROM quality_standard_versions v
                            WHERE v.standard_id = qs.id AND v.status = 'published'
                            ORDER BY v.version_number DESC LIMIT 1
                        ) qv ON true
                        WHERE qs.exporter_profile_id = :eid AND lower(qs.crop) = lower(:crop) AND NOT qs.is_archived
                        LIMIT 1
                        """
                    ),
                    {"eid": str(r.id), "crop": crop},
                )
            ).first()
            if std is None:
                continue
            approved = (
                await db.execute(
                    text(
                        """
                        SELECT count(DISTINCT s.stage_id) FROM stage_proof_submissions s
                        JOIN quality_standard_stages st ON st.id = s.stage_id
                        WHERE s.farmer_id = :fid AND s.exporter_profile_id = :eid
                          AND s.status = 'approved' AND st.version_id = :vid
                        """
                    ),
                    {"fid": str(r.farmer_id), "eid": str(r.id), "vid": str(std.version_id)},
                )
            ).scalar_one()
            standards.append(
                ProvenanceExporterStandard(
                    exporter=r.company_name,
                    name=std.name,
                    version=std.version_number,
                    stages_total=int(std.total),
                    stages_approved=int(approved),
                )
            )
        except Exception:
            await db.rollback()
    # One line per exporter standard: a merged batch has several growers on the same standard.
    merged: dict[tuple, ProvenanceExporterStandard] = {}
    for st in standards:
        k = (st.exporter, st.name, st.version)
        if k in merged:
            m = merged[k]
            m.stages_total += st.stages_total
            m.stages_approved += st.stages_approved
            m.growers += 1
        else:
            merged[k] = st
    return list(exporters.values()), list(merged.values())


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

    plot_by_id: dict = {}
    for b in all_batches:
        if b.plot_id is not None and b.plot_id not in plot_by_id:
            plot_by_id[b.plot_id] = await db.get(Plot, b.plot_id)
    owner_ids = sorted({pl.owner_user_id for pl in plot_by_id.values() if pl is not None and pl.owner_user_id is not None}, key=str)

    def own_weight(b: Batch) -> float | None:
        return _as_float(_latest_value(timeline, b.code, "weigh", "weight_kg"))

    def to_provenance_batch(b: Batch) -> ProvenanceBatch:
        pl = plot_by_id.get(b.plot_id) if b.plot_id else None
        return ProvenanceBatch(
            code=b.code,
            crop=b.crop,
            created_at=b.created_at,
            parent_codes=[code_by_id.get(pid, str(pid)) for pid in (b.parent_batch_ids or [])],
            weight_kg=own_weight(b),
            district=pl.district if pl is not None else None,
        )

    # --- the rest of the story: weights, grade, condition, exporter, standard progress ---
    weight = own_weight(batch)
    weight_source = "batch" if weight is not None else None
    if weight is None and batch.parent_batch_ids:
        parent_weights = [own_weight(a) for a in ancestors if a.id in set(batch.parent_batch_ids)]
        known = [w for w in parent_weights if w is not None]
        if known:
            weight, weight_source = round(sum(known), 2), "sum_of_parents"

    grade = _latest_value(timeline, batch.code, "grade", "grade")
    if grade is None:
        grades = {str(_latest_value(timeline, a.code, "grade", "grade")) for a in ancestors} - {"None"}
        grade = next(iter(grades)) if len(grades) == 1 else None
    packages = _latest_value(timeline, batch.code, "pack", "packages")
    attest = next((e for e in reversed(timeline) if e.event_type == "collector_attestation"), None)

    done_types = {e.event_type for e in timeline if e.batch_code is not None}
    steps_done = [t for t in _STEP_ORDER if t in done_types]
    harvested_at = batch.created_at
    scan_count = (await db.execute(select(func.count()).select_from(Scan).where(Scan.batch_id == batch.id))).scalar_one()
    exporters, exporter_standards = await _exporter_context(db, owner_ids, batch.crop)

    plot_crops: list[str] = []
    if plot is not None and batch.plot_id is not None:
        planted_rows = (
            await db.execute(select(Event.payload).where(Event.plot_id == batch.plot_id, Event.event_type == "planted"))
        ).scalars().all()
        plot_crops = sorted({str(p.get("crop")).strip() for p in planted_rows if p.get("crop")})
        plot_out = ProvenancePlot(
            district=plot.district,
            dsd=plot.dsd,
            gn_division=plot.gn_division,
            area_ha=float(plot.area_ha) if plot.area_ha is not None else None,
            plot_type=plot.plot_type,
            boundary_source=plot.boundary_source,
            registered_at=plot.created_at,
            crops=plot_crops,
        )

    summary = ProvenanceSummary(
        weight_kg=weight,
        weight_source=weight_source,
        grade=str(grade) if grade is not None else None,
        packages=int(packages) if packages is not None and str(packages).isdigit() else None,
        condition=attest.payload.get("condition") if attest else None,
        condition_note=attest.payload.get("note") if attest else None,
        steps_done=steps_done,
        planted_at=planted_at,
        harvested_at=harvested_at,
        days_to_harvest=(harvested_at - planted_at).days if planted_at is not None else None,
        first_event_at=timeline[0].occurred_at if timeline else None,
        last_event_at=timeline[-1].occurred_at if timeline else None,
        event_count=len(timeline),
        photo_count=sum(1 for e in timeline if e.payload.get("photo_url")),
        growers=len(owner_ids),
        scan_count=int(scan_count),
    )

    return ProvenanceOut(
        batch=to_provenance_batch(batch),
        plot=plot_out,
        protocol=protocol_out,
        planted_at=planted_at,
        timeline=timeline,
        lineage=[to_provenance_batch(a) for a in ancestors],
        scan_warning=scan_warning,
        exporters=exporters,
        exporter_standards=exporter_standards,
        summary=summary,
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
