from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.api_route("/health", methods=["GET", "HEAD"])
async def health() -> dict:
    return {"status": "ok"}
