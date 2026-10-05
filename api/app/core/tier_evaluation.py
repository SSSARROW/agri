import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Event, Protocol, ProtocolStage
from app.schemas.tier_evaluation import ProtocolEvaluationOut, StageEvaluationOut

# Every event type that gets recorded on the plot, not the batch — 'planted'
# is the only one today (see farm_page.dart / seed.py), but new plot-level
# stages shouldn't need a code change here to be evaluated correctly.
_PLOT_LEVEL_EVENT_TYPES = {"planted"}


async def get_planted_at(
    db: AsyncSession, *, plot_id: uuid.UUID | None, before: datetime, crop: str | None = None
) -> datetime | None:
    """Best-effort match: the plot's most recent 'planted' event at or before
    `before` (a batch's created_at, typically). A plot can be replanted, and
    a batch is presumed to come from whatever planting preceded it — there's
    no direct planting-to-batch link in this build (see farm_page.dart).

    A plot can also grow more than one crop at once (intercropping), so this
    filters on `crop` when given rather than just taking the plot's single
    most recent planting — otherwise a cinnamon batch could get anchored to
    a tea planting recorded later on the same plot. Pass crop=None only for
    genuinely plot-level, crop-agnostic uses (the progress-photo schedule)."""
    if plot_id is None:
        return None
    stmt = (
        select(Event.occurred_at, Event.payload)
        .where(Event.plot_id == plot_id, Event.event_type == "planted", Event.occurred_at <= before)
        .order_by(Event.occurred_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    if crop is None:
        return rows[0].occurred_at if rows else None
    crop_lower = crop.lower()
    for row in rows:
        if str(row.payload.get("crop", "")).lower() == crop_lower:
            return row.occurred_at
    return None


async def evaluate_batch_protocol(
    db: AsyncSession,
    *,
    protocol: Protocol,
    batch_id: uuid.UUID,
    planted_at: datetime | None,
) -> ProtocolEvaluationOut:
    """The single source of truth for 'is this batch actually meeting the
    quality standard it claims to' (B-33) — and, by computing each stage's
    due date from planted_at, doubles as the staged-instructions schedule
    (B-32) a farmer sees for their own batch. Same computation, two views.
    """
    stages = (
        (
            await db.execute(
                select(ProtocolStage).where(ProtocolStage.protocol_id == protocol.id).order_by(ProtocolStage.sequence)
            )
        )
        .scalars()
        .all()
    )
    batch_event_types = set(
        (await db.execute(select(Event.event_type).where(Event.batch_id == batch_id))).scalars().all()
    )
    now = datetime.now(timezone.utc)

    stage_evaluations: list[StageEvaluationOut] = []
    required_total = 0
    required_satisfied = 0

    for stage in stages:
        due_date = (
            planted_at + timedelta(days=stage.day_offset)
            if planted_at is not None and stage.day_offset is not None
            else None
        )

        if not stage.required_event_types:
            satisfied = None
            status = "standing"
        else:
            required_total += 1
            required = set(stage.required_event_types)
            if required & _PLOT_LEVEL_EVENT_TYPES:
                # planted_at is itself derived from the plot's planted event
                # existing (see provenance.py) — its presence already proves
                # the requirement, no separate lookup needed.
                satisfied = planted_at is not None
            else:
                satisfied = bool(required & batch_event_types)

            if satisfied:
                required_satisfied += 1
                status = "done"
            elif due_date is not None and due_date < now:
                status = "overdue"
            elif due_date is not None:
                status = "upcoming"
            else:
                status = "pending"

        stage_evaluations.append(
            StageEvaluationOut(
                sequence=stage.sequence,
                title=stage.title,
                instructions=stage.instructions,
                day_offset=stage.day_offset,
                due_date=due_date,
                required_event_types=stage.required_event_types,
                satisfied=satisfied,
                status=status,
            )
        )

    return ProtocolEvaluationOut(
        protocol_id=protocol.id,
        protocol_name=protocol.name,
        protocol_tier=protocol.tier,
        protocol_source=protocol.source,
        stages=stage_evaluations,
        required_total=required_total,
        required_satisfied=required_satisfied,
        tier_achieved=required_total > 0 and required_satisfied == required_total,
    )
