import csv
import io
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import bindparam, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.allocation import allocate, expected_volume_kg
from app.core.auth import CurrentUser, require_role
from app.core.delivery import delivered_batches
from app.core.errors import AppError
from app.core.tier_evaluation import evaluate_batch_protocol, get_planted_at
from app.core.verification import load_facts, run_rules
from app.db.models import Commitment, Event, Plot, Protocol
from app.db.session import get_db
from app.schemas.commitment import (
    AllocationEntry,
    AllocationProposalOut,
    CommitmentCreate,
    CommitmentOut,
    DeliveredBatchOut,
    MyCommitmentOut,
    ReconciliationOut,
)

router = APIRouter(prefix="/commitments", tags=["commitments"])


@router.get("", response_model=list[CommitmentOut])
async def list_open_commitments(
    crop: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[CommitmentOut]:
    """Public — this is the farmer-facing 'who wants to buy what' view
    (B-50 / the connect-farmers-with-buyers ask). Only shows commitments
    with volume left to fill."""
    stmt = select(Commitment).where(Commitment.remaining_kg > 0)
    if crop is not None:
        stmt = stmt.where(Commitment.crop == crop)
    commitments = (await db.execute(stmt)).scalars().all()

    protocol_ids = {c.protocol_id for c in commitments if c.protocol_id is not None}
    protocol_names = {}
    if protocol_ids:
        rows = (await db.execute(select(Protocol.id, Protocol.name).where(Protocol.id.in_(protocol_ids)))).all()
        protocol_names = {row.id: row.name for row in rows}

    return [
        CommitmentOut.model_validate(c, from_attributes=True).model_copy(
            update={"protocol_name": protocol_names.get(c.protocol_id)}
        )
        for c in commitments
    ]


@router.post("", response_model=CommitmentOut, status_code=status.HTTP_201_CREATED)
async def create_commitment(
    body: CommitmentCreate,
    current_user: CurrentUser = Depends(require_role("exporter", "admin")),
    db: AsyncSession = Depends(get_db),
) -> Commitment:
    if body.protocol_id is not None:
        protocol = await db.get(Protocol, body.protocol_id)
        if protocol is None:
            raise AppError(code="not_found", message="Protocol not found.", status_code=status.HTTP_404_NOT_FOUND)
        if protocol.crop != body.crop:
            raise AppError(
                code="invalid_payload",
                message="protocol_id does not match crop.",
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

    commitment = Commitment(
        buyer_user_id=current_user.id,
        crop=body.crop,
        protocol_id=body.protocol_id,
        volume_kg=body.volume_kg,
        remaining_kg=body.volume_kg,
        delivery_window_start=body.delivery_window_start,
        delivery_window_end=body.delivery_window_end,
        indicative_price_lkr_per_kg=body.indicative_price_lkr_per_kg,
    )
    db.add(commitment)
    await db.commit()
    await db.refresh(commitment)
    return commitment


def _status(commitment: Commitment, delivered: float, now: datetime) -> str:
    volume = float(commitment.volume_kg)
    if delivered > volume:
        return "overdelivered"
    if delivered >= volume:
        return "filled"
    return "shortfall" if now > commitment.delivery_window_end else "open"


async def _owned_commitment(db: AsyncSession, commitment_id: uuid.UUID, user: CurrentUser) -> Commitment:
    commitment = await db.get(Commitment, commitment_id)
    # Not-found rather than forbidden for someone else's commitment, so a
    # buyer can't probe which ids exist.
    if commitment is None or (user.role != "admin" and commitment.buyer_user_id != user.id):
        raise AppError(code="not_found", message="Commitment not found.", status_code=status.HTTP_404_NOT_FOUND)
    return commitment


@router.get("/me", response_model=list[MyCommitmentOut])
async def list_my_commitments(
    current_user: CurrentUser = Depends(require_role("exporter", "admin")),
    db: AsyncSession = Depends(get_db),
) -> list[MyCommitmentOut]:
    """A buyer's own commitments with how much has actually been delivered
    against each — the buyer-portal landing view (W-50)."""
    rows = (
        (
            await db.execute(
                select(Commitment).where(Commitment.buyer_user_id == current_user.id).order_by(Commitment.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    now = datetime.now(timezone.utc)
    out = []
    for c in rows:
        delivered = sum(d.weight_kg for d in await delivered_batches(db, c.id))
        out.append(
            MyCommitmentOut(
                **CommitmentOut.model_validate(c, from_attributes=True).model_dump(),
                delivered_kg=delivered,
                status=_status(c, delivered, now),
            )
        )
    return out


async def _reconcile(db: AsyncSession, commitment: Commitment) -> ReconciliationOut:
    delivered = await delivered_batches(db, commitment.id)
    total = sum(d.weight_kg for d in delivered)
    volume = float(commitment.volume_kg)

    batches_out = []
    for d in sorted(delivered, key=lambda d: d.weighed_at):
        protocol_name = None
        tier_verified = None
        if d.batch.protocol_id is not None:
            protocol = await db.get(Protocol, d.batch.protocol_id)
            if protocol is not None:
                protocol_name = protocol.name
                planted_at = await get_planted_at(db, plot_id=d.batch.plot_id, before=d.batch.created_at)
                evaluation = await evaluate_batch_protocol(
                    db, protocol=protocol, batch_id=d.batch.id, planted_at=planted_at
                )
                tier_verified = evaluation.tier_achieved
        batches_out.append(
            DeliveredBatchOut(
                batch_code=d.batch.code,
                weight_kg=d.weight_kg,
                weighed_at=d.weighed_at,
                within_window=commitment.delivery_window_start <= d.weighed_at <= commitment.delivery_window_end,
                protocol_name=protocol_name,
                tier_verified=tier_verified,
                provenance_path=f"/p/{d.batch.code}",
            )
        )
    return ReconciliationOut(
        commitment_id=commitment.id,
        crop=commitment.crop,
        volume_kg=volume,
        delivered_kg=total,
        shortfall_kg=max(0.0, volume - total),
        surplus_kg=max(0.0, total - volume),
        status=_status(commitment, total, datetime.now(timezone.utc)),
        batches=batches_out,
    )


@router.get("/{commitment_id}/reconciliation", response_model=ReconciliationOut)
async def commitment_reconciliation(
    commitment_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role("exporter", "admin")),
    db: AsyncSession = Depends(get_db),
) -> ReconciliationOut:
    """Delivered batches against the commitment, with shortfall or surplus
    (B-52)."""
    return await _reconcile(db, await _owned_commitment(db, commitment_id, current_user))


@router.get("/{commitment_id}/export.csv")
async def export_commitment_csv(
    commitment_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role("exporter", "admin")),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """An audit-ready record of a shipment (W-50): every delivered batch with
    its weight, whether it arrived in the delivery window, whether its quality
    standard is verified, and how many verification flags (B-23) it carries.
    CSV rather than PDF — opens anywhere and diffs cleanly."""
    commitment = await _owned_commitment(db, commitment_id, current_user)
    reconciliation = await _reconcile(db, commitment)
    flags: dict[str, int] = defaultdict(int)
    for f in run_rules(await load_facts(db)):
        if f.batch_code is not None:
            flags[f.batch_code] += 1

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "batch_code",
            "crop",
            "weight_kg",
            "weighed_at",
            "within_delivery_window",
            "protocol",
            "tier_verified",
            "verification_flags",
            "provenance_path",
        ]
    )
    for b in reconciliation.batches:
        writer.writerow(
            [
                b.batch_code,
                commitment.crop,
                f"{b.weight_kg:g}",
                b.weighed_at.isoformat(),
                "yes" if b.within_window else "no",
                b.protocol_name or "",
                "" if b.tier_verified is None else ("yes" if b.tier_verified else "no"),
                flags.get(b.batch_code, 0),
                b.provenance_path,
            ]
        )
    writer.writerow([])
    writer.writerow(["commitment_volume_kg", f"{reconciliation.volume_kg:g}"])
    writer.writerow(["delivered_kg", f"{reconciliation.delivered_kg:g}"])
    writer.writerow(["shortfall_kg", f"{reconciliation.shortfall_kg:g}"])
    writer.writerow(["surplus_kg", f"{reconciliation.surplus_kg:g}"])
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="commitment-{commitment.id}.csv"'},
    )


@router.get("/{commitment_id}/allocation-proposal", response_model=AllocationProposalOut)
async def allocation_proposal(
    commitment_id: uuid.UUID,
    current_user: CurrentUser = Depends(require_role("exporter", "admin")),
    db: AsyncSession = Depends(get_db),
) -> AllocationProposalOut:
    """Who could supply this commitment and how much to ask of each (B-51).
    A proposal only — nothing is stored or sent to anyone. Eligible plots are
    ones the farmer recorded as planted with this crop (and this protocol,
    if the commitment names one); each farmer's capacity is their eligible
    area times a provisional expected yield over the delivery window."""
    commitment = await _owned_commitment(db, commitment_id, current_user)
    window_days = max(1.0, (commitment.delivery_window_end - commitment.delivery_window_start).total_seconds() / 86400)

    latest_planted = (
        await db.execute(
            select(Event.plot_id, Event.payload)
            .where(Event.event_type == "planted", Event.plot_id.is_not(None))
            .distinct(Event.plot_id)
            .order_by(Event.plot_id, Event.occurred_at.desc())
        )
    ).all()
    eligible: set[uuid.UUID] = set()
    for plot_id, payload in latest_planted:
        if str(payload.get("crop", "")).lower() != commitment.crop.lower():
            continue
        if commitment.protocol_id is not None and payload.get("protocol_id") != str(commitment.protocol_id):
            continue
        eligible.add(plot_id)

    capacities: dict[uuid.UUID, float] = defaultdict(float)
    if eligible:
        for plot in (await db.execute(select(Plot).where(Plot.id.in_(eligible)))).scalars().all():
            if plot.owner_user_id is None or not plot.area_ha:
                continue
            volume = expected_volume_kg(commitment.crop, float(plot.area_ha), window_days)
            if volume is None:
                raise AppError(
                    code="invalid_payload",
                    message=f"No expected-yield figure for {commitment.crop} yet, so it can't be allocated.",
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                )
            capacities[plot.owner_user_id] += volume

    allocations, unallocated = allocate(float(commitment.volume_kg), dict(capacities))

    names = {}
    if allocations:
        rows = await db.execute(
            text("SELECT id, name FROM users WHERE id IN :ids").bindparams(bindparam("ids", expanding=True)),
            {"ids": [str(f) for f in allocations]},
        )
        names = {row.id: row.name for row in rows}

    entries = sorted(
        (
            AllocationEntry(
                farmer_user_id=farmer,
                farmer_name=names.get(farmer),
                capacity_kg=round(capacities[farmer], 2),
                allocated_kg=round(kg, 2),
            )
            for farmer, kg in allocations.items()
        ),
        key=lambda e: -e.allocated_kg,
    )
    return AllocationProposalOut(
        commitment_id=commitment.id,
        volume_kg=float(commitment.volume_kg),
        allocated_kg=round(sum(e.allocated_kg for e in entries), 2),
        unallocated_kg=round(unallocated, 2),
        entries=entries,
    )
