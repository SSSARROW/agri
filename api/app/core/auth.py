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
