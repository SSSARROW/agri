import uuid
from collections import defaultdict

from fastapi import APIRouter, Depends
from geoalchemy2.shape import to_shape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user, require_role
from app.core.errors import AppError
from app.core.geo import make_polygon_from_points, make_square_polygon
from app.db.models import Event, Plot
from app.db.session import get_db
from app.schemas.plot import PlotCreate, PlotOut, PlotPlantingOut, PlotRename

router = APIRouter(prefix="/plots", tags=["plots"])


def to_plot_out(plot: Plot, *, plantings: list[PlotPlantingOut] | None = None) -> PlotOut:
    point = to_shape(plot.geometry).centroid
    return PlotOut(
        id=plot.id,
        owner_user_id=plot.owner_user_id,
        center_lat=point.y,
        center_lon=point.x,
        area_ha=float(plot.area_ha) if plot.area_ha is not None else None,
        boundary_source=plot.boundary_source,
        plot_type=plot.plot_type,
        name=plot.name,
        district=plot.district,
        dsd=plot.dsd,
        gn_division=plot.gn_division,
        plantings=plantings or [],
        created_at=plot.created_at,
    )


async def _latest_plantings(
    db: AsyncSession, plot_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[PlotPlantingOut]]:
    """Every crop currently recorded as planted on each plot — a plot can
    grow more than one crop at once (intercropping), so this keeps the most
    recent planting per (plot, crop) rather than collapsing to a single
    value per plot. Used so the plot card can show every live commitment,
    and so batch registration can warn if the farmer picks a different
    standard than the one they committed to for that crop at planting."""
    if not plot_ids:
        return {}
    stmt = (
        select(Event.plot_id, Event.payload, Event.occurred_at)
        .where(Event.plot_id.in_(plot_ids), Event.event_type == "planted")
        .order_by(Event.plot_id, Event.occurred_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    seen: set[tuple[uuid.UUID, str]] = set()
    result: dict[uuid.UUID, list[PlotPlantingOut]] = defaultdict(list)
    for row in rows:
        crop = row.payload.get("crop")
        if not crop:
            continue
        key = (row.plot_id, crop.lower())
        if key in seen:
            continue
        seen.add(key)
        raw_protocol_id = row.payload.get("protocol_id")
        area = row.payload.get("area_ha")
        result[row.plot_id].append(
            PlotPlantingOut(
                crop=crop,
                planted_at=row.occurred_at,
                area_ha=float(area) if isinstance(area, (int, float)) and area > 0 else None,
                protocol_id=uuid.UUID(raw_protocol_id) if raw_protocol_id else None,
                protocol_name=row.payload.get("protocol_name"),
            )
        )
    return result


@router.get("/me", response_model=list[PlotOut])
async def list_my_plots(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PlotOut]:
    result = await db.execute(select(Plot).where(Plot.owner_user_id == current_user.id))
    plots = result.scalars().all()
    plantings = await _latest_plantings(db, [p.id for p in plots])
    return [to_plot_out(p, plantings=plantings.get(p.id)) for p in plots]


@router.get("", response_model=list[PlotOut])
async def list_all_plots(
    _: CurrentUser = Depends(require_role("admin", "exporter")),
    db: AsyncSession = Depends(get_db),
) -> list[PlotOut]:
    """Unscoped — for the admin/exporter map view (dev2). Every farmer's
    plot, not just the caller's own."""
    result = await db.execute(select(Plot))
    plots = result.scalars().all()
    plantings = await _latest_plantings(db, [p.id for p in plots])
    return [to_plot_out(p, plantings=plantings.get(p.id)) for p in plots]


# Smallest area a captured boundary can have. Walked pins carry GPS jitter of a
# few metres, so anything under 50 m² is indistinguishable from standing still;
# traced corners are deliberate taps on imagery with no jitter, so a small
# space (a rooftop bed, a greenhouse) is legitimate down to 5 m².
_MIN_AREA_HA = {"walked": 0.005, "traced": 0.0005}


@router.post("", response_model=PlotOut, status_code=201)
async def create_plot(
    body: PlotCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PlotOut:
    if body.boundary_points is not None:
        geometry, area_ha = make_polygon_from_points([(p.lat, p.lon) for p in body.boundary_points])
        boundary_source = body.boundary_source
        # Corner pins dropped without actually walking between them (or a GPS
        # stuck on one fix) collapse to a zero-area polygon that would
        # otherwise be stored as a real 0.000 ha plot.
        if area_ha < _MIN_AREA_HA[boundary_source]:
            raise AppError(
                code="boundary_too_small",
                message="The walked boundary is too small to be a plot. Walk to each corner of the plot before dropping its pin.",
                status_code=422,
            )
    else:
        geometry, area_ha = make_square_polygon(body.center_lat, body.center_lon, body.side_m)
        boundary_source = "estimated_square"

    plot = Plot(
        id=uuid.uuid4(),
        owner_user_id=current_user.id,
        geometry=geometry,
        area_ha=area_ha,
        boundary_source=boundary_source,
        plot_type=body.plot_type,
        name=(body.name or "").strip() or None,
        district=body.district,
        dsd=body.dsd,
        gn_division=body.gn_division,
    )
    db.add(plot)
    await db.commit()
    await db.refresh(plot)
    return to_plot_out(plot)


@router.patch("/{plot_id}", response_model=PlotOut)
async def rename_plot(
    plot_id: uuid.UUID,
    body: PlotRename,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PlotOut:
    """Only the label is editable — the boundary and area are evidence, so
    changing them after the fact isn't something a rename endpoint should
    allow. Someone else's plot reads as not found."""
    plot = await db.get(Plot, plot_id)
    if plot is None or plot.owner_user_id != current_user.id:
        raise AppError(code="not_found", message="Plot not found.", status_code=404)
    plot.name = (body.name or "").strip() or None
    await db.commit()
    await db.refresh(plot)
    plantings = (await _latest_plantings(db, [plot.id])).get(plot.id)
    return to_plot_out(plot, plantings=plantings)
