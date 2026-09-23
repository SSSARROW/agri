from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user, require_role
from app.core.errors import AppError
from app.db.session import get_db
from app.schemas.user import UserOut

router = APIRouter(prefix="/users", tags=["users"])

# public.users belongs to the auth team (web/backend), not this service —
# raw SQL against known columns, same pattern as seed.py, rather than an
# ORM model we'd have to keep in lockstep with their schema. Never select
# password_hash / nic_hash / nic_salt here.
_SELECT_COLUMNS = "id, email, name, phone, role, district, dsd, gn_division, business_name"


@router.get("/me", response_model=UserOut)
async def get_my_profile(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Any logged-in user's own profile — for the app's Settings screen.
    Unlike list_users below, not admin-only: reading your own row needs no
    special role, just a valid token."""
    row = (
        await db.execute(text(f"SELECT {_SELECT_COLUMNS} FROM users WHERE id = :id"), {"id": str(current_user.id)})
    ).first()
    if row is None:
        raise AppError(code="not_found", message="User not found.", status_code=404)
    return UserOut(**row._mapping)


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
