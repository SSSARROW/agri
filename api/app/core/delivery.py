"""What has actually been delivered against a buyer commitment (B-52).

A batch matched to a commitment gets weighed more than once — the farmer,
then the collector who picks it up — and once collectors merge several
farmers' batches, the merged batch carries the same leaf again. Counting
every weigh event (as the old draw-down did) counts that leaf two or three
times, so delivered volume here is each batch's latest weight, excluding
any batch whose merged successor has been weighed.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Batch, Event


@dataclass(frozen=True)
class DeliveredBatch:
    batch: Batch
    weight_kg: float
    weighed_at: datetime


async def delivered_batches(db: AsyncSession, commitment_id: uuid.UUID) -> list[DeliveredBatch]:
    batches = (await db.execute(select(Batch).where(Batch.commitment_id == commitment_id))).scalars().all()
    if not batches:
        return []

    # A batch is superseded once a batch merged from it has a weight of its
    # own — before that, the parent's weight is the only record of the leaf.
    merged_children = (await db.execute(select(Batch).where(Batch.parent_batch_ids.is_not(None)))).scalars().all()
    weighed_children = set(
        (
            await db.execute(
                select(Event.batch_id).where(
                    Event.event_type == "weigh", Event.batch_id.in_([c.id for c in merged_children])
                )
            )
        ).scalars()
    )
    merged_away: set[uuid.UUID] = set()
    for child in merged_children:
        if child.id in weighed_children:
            merged_away.update(child.parent_batch_ids)

    weigh_events = (
        await db.execute(
            select(Event)
            .where(Event.batch_id.in_([b.id for b in batches]), Event.event_type == "weigh")
            .order_by(Event.occurred_at)
        )
    ).scalars().all()
    latest: dict[uuid.UUID, Event] = {}
    for e in weigh_events:  # ordered, so the last one seen per batch is the latest
        try:
            float(e.payload["weight_kg"])
        except (KeyError, TypeError, ValueError):
            continue
        latest[e.batch_id] = e

    return [
        DeliveredBatch(batch=b, weight_kg=float(latest[b.id].payload["weight_kg"]), weighed_at=latest[b.id].occurred_at)
        for b in batches
        if b.id in latest and b.id not in merged_away
    ]


async def delivered_kg(db: AsyncSession, commitment_id: uuid.UUID) -> float:
    return sum(d.weight_kg for d in await delivered_batches(db, commitment_id))
