from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from core.security import decode_token

bearer = HTTPBearer()

async def get_current_farmer(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    """Decode JWT and verify role is farmer."""
    try:
        payload = decode_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if payload.get("role") != "farmer":
        raise HTTPException(
            status_code=403,
            detail="Access restricted to farmer accounts",
        )
    return payload
