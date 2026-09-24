from pathlib import Path

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.provenance import build_provenance, log_scan, resolve_batch_by_code
from app.db.session import get_db

# Short, unprefixed path on purpose — this is what a QR code encodes (see
# batch_qr_dialog.dart), and a consumer's generic camera app needs a plain
# URL it can open directly, not something buried under /api/v1/provenance.
router = APIRouter(prefix="/p", tags=["provenance-page"])

_templates = Jinja2Templates(directory=str(Path(__file__).resolve().parents[2] / "templates"))


@router.get("/{batch_code}", response_class=HTMLResponse)
async def get_provenance_page(
    batch_code: str,
    request: Request,
    lat: float | None = Query(default=None, ge=-90, le=90),
    lon: float | None = Query(default=None, ge=-180, le=180),
    db: AsyncSession = Depends(get_db),
) -> HTMLResponse:
    """The consumer-facing page (P-01): server-rendered, no JavaScript, so it
    works on a cheap phone over a weak connection with a generic QR scanner.
    Renders the exact same data the JSON API returns — see provenance.py."""
    batch = await resolve_batch_by_code(db, batch_code)
    if batch is None:
        return _templates.TemplateResponse(
            request, "provenance_not_found.html", {"code": batch_code}, status_code=404
        )

    scan_warning = await log_scan(db, batch_id=batch.id, request=request, lat=lat, lon=lon)
    result = await build_provenance(db, batch, scan_warning=scan_warning)
    return _templates.TemplateResponse(request, "provenance.html", {"p": result})
