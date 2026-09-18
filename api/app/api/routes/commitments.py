from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, require_role
from app.core.errors import AppError
from app.db.models import Commitment, Protocol
from app.db.session import get_db
from app.schemas.commitment import CommitmentCreate, CommitmentOut

router = APIRouter(prefix="/commitments", tags=["commitments"])


@router.get("", response_model=list[CommitmentOut])
async def list_open_commitments(
    crop: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[Commitment]:
    """Public — this is the farmer-facing 'who wants to buy what' view
    (B-50 / the connect-farmers-with-buyers ask). Only shows commitments
    with volume left to fill."""
    stmt = select(Commitment).where(Commitment.remaining_kg > 0)
    if crop is not None:
        stmt = stmt.where(Commitment.crop == crop)
    return list((await db.execute(stmt)).scalars().all())


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
