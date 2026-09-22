import uuid

from fastapi import APIRouter, Depends
from geoalchemy2.shape import to_shape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user, require_role
from app.core.geo import make_polygon_from_points, make_square_polygon
from app.db.models import Plot
from app.db.session import get_db
from app.schemas.plot import PlotCreate, PlotOut

router = APIRouter(prefix="/plots", tags=["plots"])


def to_plot_out(plot: Plot) -> PlotOut:
    point = to_shape(plot.geometry).centroid
    return PlotOut(
        id=plot.id,
        owner_user_id=plot.owner_user_id,
        center_lat=point.y,
        center_lon=point.x,
        area_ha=float(plot.area_ha) if plot.area_ha is not None else None,
        boundary_source=plot.boundary_source,
        district=plot.district,
        dsd=plot.dsd,
        gn_division=plot.gn_division,
        created_at=plot.created_at,
    )


@router.get("/me", response_model=list[PlotOut])
async def list_my_plots(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PlotOut]:
    result = await db.execute(select(Plot).where(Plot.owner_user_id == current_user.id))
    return [to_plot_out(p) for p in result.scalars().all()]


@router.get("", response_model=list[PlotOut])
async def list_all_plots(
    _: CurrentUser = Depends(require_role("admin", "exporter")),
    db: AsyncSession = Depends(get_db),
) -> list[PlotOut]:
    """Unscoped — for the admin/exporter map view (dev2). Every farmer's
    plot, not just the caller's own."""
    result = await db.execute(select(Plot))
    return [to_plot_out(p) for p in result.scalars().all()]


@router.post("", response_model=PlotOut, status_code=201)
async def create_plot(
    body: PlotCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PlotOut:
    if body.boundary_points is not None:
        geometry, area_ha = make_polygon_from_points([(p.lat, p.lon) for p in body.boundary_points])
        boundary_source = "walked"
    else:
        geometry, area_ha = make_square_polygon(body.center_lat, body.center_lon, body.side_m)
        boundary_source = "estimated_square"

    plot = Plot(
        id=uuid.uuid4(),
        owner_user_id=current_user.id,
        geometry=geometry,
        area_ha=area_ha,
        boundary_source=boundary_source,
        district=body.district,
        dsd=body.dsd,
        gn_division=body.gn_division,
    )
    db.add(plot)
    await db.commit()
    await db.refresh(plot)
    return to_plot_out(plot)
