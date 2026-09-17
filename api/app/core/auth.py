import uuid

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import get_settings
from app.core.errors import AppError

bearer = HTTPBearer()


class CurrentUser:
    def __init__(self, id: uuid.UUID, role: str, email: str | None):
        self.id = id
        self.role = role
        self.email = email


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> CurrentUser:
    settings = get_settings()
    try:
        payload = jwt.decode(creds.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise AppError(code="unauthorized", message="Invalid or expired token.", status_code=401) from exc
    return CurrentUser(id=user_id, role=payload.get("role", ""), email=payload.get("email"))


def require_role(*roles: str):
    """Dependency factory for endpoints restricted to specific roles (e.g.
    the admin/exporter map and user-management views) — layered on top of
    get_current_user rather than duplicating the token decode."""

    async def _check(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current_user.role not in roles:
            raise AppError(
                code="forbidden",
                message="You do not have permission to access this resource.",
                status_code=403,
            )
        return current_user

    return _check
