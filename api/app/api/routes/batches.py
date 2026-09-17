import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.codegen import generate_batch_code
from app.core.config import get_settings
from app.core.errors import AppError
from app.db.models import Batch, Event, Plot
from app.db.session import get_db
from app.schemas.batch import BatchCreate, BatchOut

router = APIRouter(prefix="/batches", tags=["batches"])


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

    out = []
    for b in batches:
        latest = latest_by_batch.get(b.id)
        out.append(
            BatchOut(
                id=b.id,
                code=b.code,
                crop=b.crop,
                plot_id=b.plot_id,
                created_at=b.created_at,
                latest_status=latest.event_type if latest else "registered",
                latest_occurred_at=latest.occurred_at if latest else None,
            )
        )
    out.sort(key=lambda b: b.created_at, reverse=True)
    return out


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

    settings = get_settings()
    batch = Batch(id=uuid.uuid4(), crop=body.crop, plot_id=plot.id, code="")

    # Codes are random (see codegen.py) — a collision is astronomically
    # unlikely but the unique constraint plus a short retry loop makes the
    # rare case safe rather than a 500.
    for _ in range(5):
        batch.code = generate_batch_code(settings.batch_code_secret)
        db.add(batch)
        try:
            await db.commit()
            break
        except IntegrityError:
            await db.rollback()
    else:
        raise AppError(
            code="internal_error",
            message="Could not generate a unique batch code — try again.",
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    await db.refresh(batch)
    return BatchOut(
        id=batch.id,
        code=batch.code,
        crop=batch.crop,
        plot_id=batch.plot_id,
        created_at=batch.created_at,
        latest_status="registered",
        latest_occurred_at=None,
    )
