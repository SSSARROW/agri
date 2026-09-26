import uuid

from fastapi import APIRouter, Depends
from geoalchemy2.shape import to_shape
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import CurrentUser, get_current_user, require_role
from app.core.errors import AppError
from app.core.geo import make_polygon_from_points, make_square_polygon
from app.db.models import Event, Plot
from app.db.session import get_db
from app.schemas.plot import PlotCreate, PlotOut, PlotRename

router = APIRouter(prefix="/plots", tags=["plots"])


def to_plot_out(
    plot: Plot,
    *,
    committed_protocol_id: uuid.UUID | None = None,
    committed_protocol_name: str | None = None,
) -> PlotOut:
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
        committed_protocol_id=committed_protocol_id,
        committed_protocol_name=committed_protocol_name,
        created_at=plot.created_at,
    )


async def _latest_planting_commitments(
    db: AsyncSession, plot_ids: list[uuid.UUID]
) -> dict[uuid.UUID, tuple[uuid.UUID | None, str | None]]:
    """Which protocol (if any) a farmer confirmed adherence to when they
    recorded planting on each plot — self-reported at planting time (see
    farm_page.dart's checklist), not independently verified. Used so batch
    registration can warn if the farmer picks a different standard than the
    one they committed to at planting."""
    if not plot_ids:
        return {}
    stmt = (
        select(Event.plot_id, Event.payload)
        .where(Event.plot_id.in_(plot_ids), Event.event_type == "planted")
        .distinct(Event.plot_id)
        .order_by(Event.plot_id, Event.occurred_at.desc())
    )
    rows = (await db.execute(stmt)).all()
    result: dict[uuid.UUID, tuple[uuid.UUID | None, str | None]] = {}
    for row in rows:
        raw_id = row.payload.get("protocol_id")
        result[row.plot_id] = (uuid.UUID(raw_id) if raw_id else None, row.payload.get("protocol_name"))
    return result


@router.get("/me", response_model=list[PlotOut])
async def list_my_plots(
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PlotOut]:
    result = await db.execute(select(Plot).where(Plot.owner_user_id == current_user.id))
    plots = result.scalars().all()
    commitments = await _latest_planting_commitments(db, [p.id for p in plots])
    return [
        to_plot_out(
            p,
            committed_protocol_id=commitments.get(p.id, (None, None))[0],
            committed_protocol_name=commitments.get(p.id, (None, None))[1],
        )
        for p in plots
    ]


@router.get("", response_model=list[PlotOut])
async def list_all_plots(
    _: CurrentUser = Depends(require_role("admin", "exporter")),
    db: AsyncSession = Depends(get_db),
) -> list[PlotOut]:
    """Unscoped — for the admin/exporter map view (dev2). Every farmer's
    plot, not just the caller's own."""
    result = await db.execute(select(Plot))
    plots = result.scalars().all()
    commitments = await _latest_planting_commitments(db, [p.id for p in plots])
    return [
        to_plot_out(
            p,
            committed_protocol_id=commitments.get(p.id, (None, None))[0],
            committed_protocol_name=commitments.get(p.id, (None, None))[1],
        )
        for p in plots
    ]


_MIN_WALKED_AREA_HA = 0.005  # 50 m²


@router.post("", response_model=PlotOut, status_code=201)
async def create_plot(
    body: PlotCreate,
    current_user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PlotOut:
    if body.boundary_points is not None:
        geometry, area_ha = make_polygon_from_points([(p.lat, p.lon) for p in body.boundary_points])
        boundary_source = "walked"
        # Corner pins dropped without actually walking between them (or a GPS
        # stuck on one fix) collapse to a zero-area polygon that would
        # otherwise be stored as a real 0.000 ha plot.
        if area_ha < _MIN_WALKED_AREA_HA:
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
    commitment = (await _latest_planting_commitments(db, [plot.id])).get(plot.id, (None, None))
    return to_plot_out(plot, committed_protocol_id=commitment[0], committed_protocol_name=commitment[1])
