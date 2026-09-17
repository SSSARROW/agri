from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, require_role
from app.db.session import get_db
from app.schemas.user import UserOut

router = APIRouter(prefix="/users", tags=["users"])

# public.users belongs to the auth team (web/backend), not this service —
# raw SQL against known columns, same pattern as seed.py, rather than an
# ORM model we'd have to keep in lockstep with their schema. Never select
# password_hash / nic_hash / nic_salt here.
_SELECT_COLUMNS = "id, email, name, phone, role, district, dsd, gn_division, business_name"


@router.get("", response_model=list[UserOut])
async def list_users(
    role: str | None = Query(default=None),
    _: CurrentUser = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
) -> list[UserOut]:
    if role is not None:
        rows = await db.execute(text(f"SELECT {_SELECT_COLUMNS} FROM users WHERE role = :role"), {"role": role})
    else:
        rows = await db.execute(text(f"SELECT {_SELECT_COLUMNS} FROM users"))
    return [UserOut(**row._mapping) for row in rows]
