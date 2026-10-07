import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user, require_role
from app.core.codegen import generate_batch_code
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.tier_evaluation import evaluate_batch_protocol, get_planted_at
from app.db.models import Batch, Commitment, Event, Plot, Protocol
from app.db.session import get_db
from app.schemas.batch import BatchCreate, BatchMergeCreate, BatchOut, MatchedCommitmentOut
from app.schemas.tier_evaluation import ProtocolEvaluationOut

router = APIRouter(prefix="/batches", tags=["batches"])


async def _to_batch_out(db: AsyncSession, batch: Batch) -> BatchOut:
    protocol_name = None
    if batch.protocol_id is not None:
        protocol = await db.get(Protocol, batch.protocol_id)
        protocol_name = protocol.name if protocol is not None else None

    commitment_out = None
    if batch.commitment_id is not None:
        commitment = await db.get(Commitment, batch.commitment_id)
        if commitment is not None:
            commitment_out = MatchedCommitmentOut(
                id=commitment.id,
                crop=commitment.crop,
                volume_kg=float(commitment.volume_kg),
                remaining_kg=float(commitment.remaining_kg),
                delivery_window_start=commitment.delivery_window_start,
                delivery_window_end=commitment.delivery_window_end,
                indicative_price_lkr_per_kg=(
                    float(commitment.indicative_price_lkr_per_kg)
                    if commitment.indicative_price_lkr_per_kg is not None
                    else None
                ),
            )

    latest_stmt = (
        select(Event.event_type, Event.occurred_at)
        .where(Event.batch_id == batch.id)
        .order_by(Event.occurred_at.desc())
        .limit(1)
    )
    latest = (await db.execute(latest_stmt)).first()

    return BatchOut(
        id=batch.id,
        code=batch.code,
        crop=batch.crop,
        plot_id=batch.plot_id,
        protocol_id=batch.protocol_id,
        protocol_name=protocol_name,
        commitment_id=batch.commitment_id,
        commitment=commitment_out,
        created_at=batch.created_at,
        latest_status=latest.event_type if latest else "registered",
        latest_occurred_at=latest.occurred_at if latest else None,
    )


async def _assign_unique_code(db: AsyncSession, batch: Batch, secret: str) -> None:
    """Codes are random (see codegen.py) — a collision is astronomically
    unlikely but the unique constraint plus a short retry loop makes the
    rare case safe rather than a 500."""
    for _ in range(5):
        batch.code = generate_batch_code(secret)
        db.add(batch)
        try:
            await db.commit()
            return
        except IntegrityError:
            await db.rollback()
    raise AppError(
        code="internal_error",
        message="Could not generate a unique batch code — try again.",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


async def _match_open_commitment(db: AsyncSession, crop: str, protocol_id: uuid.UUID | None) -> Commitment | None:
    """First-come matching for the 'one buyer' MVP (B-50): any open
    commitment for the same crop, preferring one that names this exact
    protocol, otherwise one that doesn't care which protocol. A real
    marketplace would let farmers choose among several — not needed yet."""
    stmt = select(Commitment).where(Commitment.crop == crop, Commitment.remaining_kg > 0)
    candidates = (await db.execute(stmt)).scalars().all()
    if not candidates:
        return None
    exact = [c for c in candidates if c.protocol_id == protocol_id and protocol_id is not None]
    if exact:
        return exact[0]
    open_ended = [c for c in candidates if c.protocol_id is None]
    return open_ended[0] if open_ended else None


@router.get("/me", response_model=list[BatchOut])
async def list_my_batches(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BatchOut]:
    my_plot_ids = select(Plot.id).where(Plot.owner_user_id == current_user.id)
    batches = (await db.execute(select(Batch).where(Batch.plot_id.in_(my_plot_ids)))).scalars().all()
    if not batches:
        return []

    batch_ids = [b.id for b in batches]
    # DISTINCT ON picks one row per batch_id — the most recent by occurred_at,
    # since that's the ordering column listed right after it.
    latest_stmt = (
        select(Event.batch_id, Event.event_type, Event.occurred_at)
        .where(Event.batch_id.in_(batch_ids))
        .distinct(Event.batch_id)
        .order_by(Event.batch_id, Event.occurred_at.desc())
    )
    latest_by_batch = {row.batch_id: row for row in (await db.execute(latest_stmt)).all()}

    protocol_ids = {b.protocol_id for b in batches if b.protocol_id is not None}
    protocol_names = {}
    if protocol_ids:
        protocol_rows = (await db.execute(select(Protocol.id, Protocol.name).where(Protocol.id.in_(protocol_ids)))).all()
        protocol_names = {row.id: row.name for row in protocol_rows}

    out = []
    for b in batches:
        latest = latest_by_batch.get(b.id)
        out.append(
            BatchOut(
                id=b.id,
                code=b.code,
                crop=b.crop,
                plot_id=b.plot_id,
                protocol_id=b.protocol_id,
                protocol_name=protocol_names.get(b.protocol_id),
                commitment_id=b.commitment_id,
                created_at=b.created_at,
                latest_status=latest.event_type if latest else "registered",
                latest_occurred_at=latest.occurred_at if latest else None,
            )
        )
    out.sort(key=lambda b: b.created_at, reverse=True)
    return out


@router.get("/by-code/{code}", response_model=BatchOut)
async def get_batch_by_code(
    code: str,
    _: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BatchOut:
    """Resolves a scanned QR code to a batch — any logged-in user, not just
    the plot's owner, since a collector/processor recording the next
    pipeline stage on someone else's batch isn't a role this build tracks
    separately yet (see events.py's pipeline-stage endpoint)."""
    normalized = code.strip().upper()
    batch = (await db.execute(select(Batch).where(Batch.code == normalized))).scalar_one_or_none()
    if batch is None:
        raise AppError(code="not_found", message="No batch found with that code.", status_code=status.HTTP_404_NOT_FOUND)
    return await _to_batch_out(db, batch)


@router.get("/{batch_id}/schedule", response_model=ProtocolEvaluationOut)
async def get_batch_schedule(
    batch_id: uuid.UUID,
    _: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProtocolEvaluationOut:
    """The staged view of a batch's quality standard (B-32/B-33): which
    stages are done, which are due or overdue by day-offset-from-planting,
    and whether the batch currently satisfies the protocol it claims. Same
    computation the public provenance page shows a consumer — this is just
    the farmer's own view of it, keyed by batch id instead of code."""
    batch = await db.get(Batch, batch_id)
    if batch is None:
        raise AppError(code="not_found", message="Batch not found.", status_code=status.HTTP_404_NOT_FOUND)
    if batch.protocol_id is None:
        raise AppError(
            code="no_protocol",
            message="This batch wasn't registered against a quality standard.",
            status_code=status.HTTP_404_NOT_FOUND,
        )
    protocol = await db.get(Protocol, batch.protocol_id)
    if protocol is None:
        raise AppError(code="not_found", message="Protocol not found.", status_code=status.HTTP_404_NOT_FOUND)

    planted_at = await get_planted_at(db, plot_id=batch.plot_id, before=batch.created_at, crop=batch.crop)
    return await evaluate_batch_protocol(db, protocol=protocol, batch_id=batch.id, planted_at=planted_at)


@router.post("", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
async def create_batch(
    body: BatchCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BatchOut:
    plot = await db.get(Plot, body.plot_id)
    if plot is None:
        raise AppError(code="not_found", message="Plot not found.", status_code=status.HTTP_404_NOT_FOUND)
    if plot.owner_user_id != current_user.id:
        raise AppError(
            code="forbidden",
            message="You do not own this plot.",
            status_code=status.HTTP_403_FORBIDDEN,
        )

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

    commitment = await _match_open_commitment(db, body.crop, body.protocol_id)

    settings = get_settings()
    batch = Batch(
        id=uuid.uuid4(),
        crop=body.crop,
        plot_id=plot.id,
        protocol_id=body.protocol_id,
        commitment_id=commitment.id if commitment else None,
        code="",
    )
    await _assign_unique_code(db, batch, settings.batch_code_secret)

    await db.refresh(batch)
    return await _to_batch_out(db, batch)


@router.post("/merge", response_model=BatchOut, status_code=status.HTTP_201_CREATED)
async def merge_batches(
    body: BatchMergeCreate,
    current_user: CurrentUser = Depends(require_role("collector", "admin")),
    db: AsyncSession = Depends(get_db),
) -> BatchOut:
    """A collector combining leaf from several farmers' own batches into one
    at the collection point (B-14 lineage, put to use) — a single
    smallholder's harvest is rarely enough to ship on its own. Each parent
    batch keeps its full independent history; this just adds a new batch
    downstream of all of them, the way a real collection point works."""
    if len(body.parent_batch_ids) < 2:
        raise AppError(
            code="invalid_payload",
            message="A merge needs at least two parent batches.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )
    if len(set(body.parent_batch_ids)) != len(body.parent_batch_ids):
        raise AppError(
            code="invalid_payload",
            message="Duplicate batch in parent_batch_ids.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    parents = []
    for parent_id in body.parent_batch_ids:
        parent = await db.get(Batch, parent_id)
        if parent is None:
            raise AppError(
                code="not_found",
                message=f"Batch {parent_id} not found.",
                status_code=status.HTTP_404_NOT_FOUND,
            )
        parents.append(parent)

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

    commitment = await _match_open_commitment(db, body.crop, body.protocol_id)

    settings = get_settings()
    batch = Batch(
        id=uuid.uuid4(),
        crop=body.crop,
        plot_id=None,
        parent_batch_ids=[p.id for p in parents],
        protocol_id=body.protocol_id,
        commitment_id=commitment.id if commitment else None,
        code="",
    )
    await _assign_unique_code(db, batch, settings.batch_code_secret)

    await db.refresh(batch)
    return await _to_batch_out(db, batch)
