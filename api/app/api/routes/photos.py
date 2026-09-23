import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Form, UploadFile, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.errors import AppError
from app.core.storage import upload_photo
from app.db.models import Event, Plot
from app.db.session import get_db
from app.schemas.event import EventOut

router = APIRouter(prefix="/photos", tags=["photos"])

# A geotagged, timestamped field photo — the closest thing to independently
# checkable evidence this build has for "did this actually happen here"
# without a human inspector. Still self-reported (a photo can be staged),
# but harder to fake than a checkbox. Two contexts: proof of the plot itself
# at registration, and periodic growing-cycle updates afterward.
ALLOWED_EVENT_TYPES = {"plot_photo", "progress_photo"}
ALLOWED_CONTENT_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_PHOTO_BYTES = 10 * 1024 * 1024


@router.post("", response_model=EventOut, status_code=status.HTTP_201_CREATED)
async def upload_field_photo(
    file: UploadFile,
    plot_id: uuid.UUID = Form(...),
    event_type: str = Form(...),
    event_id: uuid.UUID = Form(default_factory=uuid.uuid4),
    caption: str | None = Form(None),
    occurred_at: datetime | None = Form(None),
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Event:
    if event_type not in ALLOWED_EVENT_TYPES:
        raise AppError(
            code="invalid_payload",
            message=f"event_type must be one of {sorted(ALLOWED_EVENT_TYPES)}.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    # event_id is client-generated for the same offline-retry idempotency as
    # regular events (B-13) — checked before uploading anything, so a retried
    # sync after a dropped connection never re-uploads the same photo.
    existing = await db.get(Event, event_id)
    if existing is not None:
        return existing

    plot = await db.get(Plot, plot_id)
    if plot is None:
        raise AppError(code="not_found", message="Plot not found.", status_code=status.HTTP_404_NOT_FOUND)
    if plot.owner_user_id != current_user.id:
        raise AppError(
            code="forbidden", message="You do not own this plot.", status_code=status.HTTP_403_FORBIDDEN
        )

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise AppError(
            code="invalid_payload",
            message="Photo must be JPEG, PNG or WebP.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    content = await file.read()
    if len(content) > MAX_PHOTO_BYTES:
        raise AppError(
            code="invalid_payload",
            message="Photo exceeds the 10MB limit.",
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )

    photo_url = upload_photo(content, file.content_type, ALLOWED_CONTENT_TYPES[file.content_type])

    payload: dict = {"photo_url": photo_url}
    if caption:
        payload["caption"] = caption

    stmt = (
        pg_insert(Event)
        .values(
            id=event_id,
            event_type=event_type,
            user_id=current_user.id,
            plot_id=plot_id,
            payload=payload,
            occurred_at=occurred_at or datetime.now(timezone.utc),
        )
        .on_conflict_do_nothing(index_elements=["id"])
    )
    await db.execute(stmt)
    await db.commit()
    return await db.get(Event, event_id)


@router.get("", response_model=list[EventOut])
async def list_plot_photos(
    plot_id: uuid.UUID,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Event]:
    plot = await db.get(Plot, plot_id)
    if plot is None:
        raise AppError(code="not_found", message="Plot not found.", status_code=status.HTTP_404_NOT_FOUND)
    if plot.owner_user_id != current_user.id:
        raise AppError(
            code="forbidden", message="You do not own this plot.", status_code=status.HTTP_403_FORBIDDEN
        )
    stmt = (
        select(Event)
        .where(Event.plot_id == plot_id, Event.event_type.in_(ALLOWED_EVENT_TYPES))
        .order_by(Event.occurred_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())
