import uuid

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, require_role
from app.core.errors import AppError
from app.core.logging import get_logger
from app.db.models import Batch, Commitment, Event
from app.db.session import get_db
from app.schemas.event import EventCreate, EventOut

router = APIRouter(prefix="/events", tags=["events"])
logger = get_logger(__name__)

# Per-type payload validation (B-13): each event type is a config-driven
# capture flow (M-05), so this stays a lightweight required-keys check rather
# than a rigid schema per type — new types shouldn't need a code change here.
REQUIRED_PAYLOAD_KEYS: dict[str, set[str]] = {
    "scan": {"code"},
    "planted": {"crop"},
    "weigh": {"weight_kg"},
}


def validate_payload(event_type: str, payload: dict) -> None:
    required = REQUIRED_PAYLOAD_KEYS.get(event_type)
    if required:
        missing = required - payload.keys()
        if missing:
            raise AppError(
                code="invalid_payload",
                message=f"event_type '{event_type}' payload is missing required fields: {sorted(missing)}",
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

    # GPS capture (M-06) is optional best-effort provenance data on any event
    # type, not a fixed field of the schema — but if it's there, it should be
    # a real coordinate rather than garbage from a misbehaving client.
    lat, lon = payload.get("lat"), payload.get("lon")
    if lat is not None and not (isinstance(lat, (int, float)) and -90 <= lat <= 90):
        raise AppError(code="invalid_payload", message="payload.lat must be between -90 and 90.", status_code=422)
    if lon is not None and not (isinstance(lon, (int, float)) and -180 <= lon <= 180):
        raise AppError(code="invalid_payload", message="payload.lon must be between -180 and 180.", status_code=422)


@router.post("", response_model=EventOut)
async def create_event(
    body: EventCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> Event:
    validate_payload(body.event_type, body.payload)

    stmt = (
        pg_insert(Event)
        .values(
            id=body.id,
            event_type=body.event_type,
            user_id=body.user_id,
            batch_id=body.batch_id,
            plot_id=body.plot_id,
            payload=body.payload,
            occurred_at=body.occurred_at,
        )
        .on_conflict_do_nothing(index_elements=["id"])
    )

    try:
        result = await db.execute(stmt)
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise AppError(
            code="invalid_reference",
            message="user_id, batch_id or plot_id does not reference an existing row.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        ) from exc

    created = result.rowcount == 1
    event = await db.get(Event, body.id)
    if event is None:
        # Should be unreachable: either our insert or a prior one landed this row.
        raise AppError(code="internal_error", message="Event write did not persist.", status_code=500)

    if not created:
        logger.info("event_duplicate_ignored", event_id=str(body.id), event_type=body.event_type)

    # Draws down the matched buyer commitment's remaining volume (B-50) as
    # weight actually gets reported — only on first insert, so a re-synced
    # duplicate never double-counts.
    if created and body.event_type == "weigh" and body.batch_id is not None:
        batch = await db.get(Batch, body.batch_id)
        if batch is not None and batch.commitment_id is not None:
            commitment = await db.get(Commitment, batch.commitment_id)
            if commitment is not None:
                weight_kg = body.payload["weight_kg"]
                commitment.remaining_kg = max(0, float(commitment.remaining_kg) - float(weight_kg))
                await db.commit()

    response.status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
    return event


@router.get("", response_model=list[EventOut])
async def list_events(
    batch_id: uuid.UUID = Query(...),
    _: CurrentUser = Depends(require_role("admin", "exporter")),
    db: AsyncSession = Depends(get_db),
) -> list[Event]:
    """Full event history for one batch — the admin/exporter batch detail
    view (dev2). The public equivalent is GET /provenance/{batch_code},
    which also walks lineage and strips location fields."""
    result = await db.execute(select(Event).where(Event.batch_id == batch_id).order_by(Event.occurred_at))
    return list(result.scalars().all())


@router.get("/{event_id}", response_model=EventOut)
async def get_event(event_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> Event:
    event = await db.get(Event, event_id)
    if event is None:
        raise AppError(code="not_found", message="Event not found.", status_code=status.HTTP_404_NOT_FOUND)
    return event
