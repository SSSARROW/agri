from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.db.models import Batch, Event, Plot
from app.db.session import get_db
from app.schemas.batch import BatchOut

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
