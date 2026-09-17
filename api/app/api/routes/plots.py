import uuid

from fastapi import APIRouter, Depends
from geoalchemy2.shape import to_shape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user
from app.core.geo import make_square_polygon
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


@router.post("", response_model=PlotOut, status_code=201)
async def create_plot(
    body: PlotCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PlotOut:
    geometry, area_ha = make_square_polygon(body.center_lat, body.center_lon, body.side_m)
    plot = Plot(
        id=uuid.uuid4(),
        owner_user_id=current_user.id,
        geometry=geometry,
        area_ha=area_ha,
        district=body.district,
        dsd=body.dsd,
        gn_division=body.gn_division,
    )
    db.add(plot)
    await db.commit()
    await db.refresh(plot)
    return to_plot_out(plot)
