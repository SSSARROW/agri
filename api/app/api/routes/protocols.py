import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.db.models import Protocol, ProtocolStage
from app.db.session import get_db
from app.schemas.protocol import ProtocolOut, ProtocolStageOut, ProtocolSummary

router = APIRouter(prefix="/protocols", tags=["protocols"])

# Public on purpose: a farmer needs to see instructions before they've logged
# in to anything protocol-specific, and a consumer should be able to look up
# what a tier actually requires from the provenance page too.


@router.get("", response_model=list[ProtocolSummary])
async def list_protocols(
    crop: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[Protocol]:
    stmt = select(Protocol).where(Protocol.is_active.is_(True))
    if crop is not None:
        stmt = stmt.where(Protocol.crop == crop)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/{protocol_id}", response_model=ProtocolOut)
async def get_protocol(protocol_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> ProtocolOut:
    protocol = await db.get(Protocol, protocol_id)
    if protocol is None:
        raise AppError(code="not_found", message="Protocol not found.", status_code=status.HTTP_404_NOT_FOUND)
    stages = (
        (await db.execute(select(ProtocolStage).where(ProtocolStage.protocol_id == protocol_id).order_by(ProtocolStage.sequence)))
        .scalars()
        .all()
    )
    return ProtocolOut(
        id=protocol.id,
        crop=protocol.crop,
        tier=protocol.tier,
        name=protocol.name,
        version=protocol.version,
        source=protocol.source,
        stages=[ProtocolStageOut.model_validate(s) for s in stages],
    )
