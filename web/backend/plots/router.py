import uuid
import math
import json
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query
from auth.router import get_current_user
from db.supabase import supabase
from plots.schemas import PlotCreate, PlotUpdate, PlotResponse, PaginatedPlotsResponse

router = APIRouter(prefix="/plots", tags=["plots"])

def coords_to_3857(lon: float, lat: float):
    x = lon * 20037508.34 / 180.0
    lat = max(min(lat, 89.9), -89.9)
    y = math.log(math.tan((90.0 + lat) * math.pi / 360.0)) / (math.pi / 180.0)
    y = y * 20037508.34 / 180.0
    return x, y

def calculate_area_ha(geometry: dict) -> float:
    """
    Calculates area in hectares server-side using Web Mercator (EPSG:3857) projection,
    equivalent to PostGIS ST_Area(ST_Transform(ST_GeomFromGeoJSON(geometry), 3857)) / 10000.
    """
    if not isinstance(geometry, dict):
        return 0.0
    coords = geometry.get("coordinates", [])
    if not coords or not isinstance(coords, list) or len(coords) == 0:
        return 0.0
    
    geom_type = geometry.get("type")
    if geom_type == "Polygon":
        ring = coords[0]
    elif geom_type == "MultiPolygon":
        ring = coords[0][0]
    else:
        ring = coords
    
    if not ring or len(ring) < 3:
        return 0.0
    
    pts = [coords_to_3857(pt[0], pt[1]) for pt in ring if isinstance(pt, (list, tuple)) and len(pt) >= 2]
    n = len(pts)
    if n < 3:
        return 0.0
    
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += pts[i][0] * pts[j][1]
        area -= pts[j][0] * pts[i][1]
    
    area_m2 = abs(area) / 2.0
    area_ha = area_m2 / 10000.0
    return round(area_ha, 4)

def sanitize_plot(plot: dict) -> dict:
    plot_copy = plot.copy()

    geom = plot_copy.get("geometry")
    if isinstance(geom, str):
        try:
            plot_copy["geometry"] = json.loads(geom)
        except Exception:
            pass

    if plot_copy.get("area_ha") is None:
        plot_copy["area_ha"] = 0.0
    else:
        plot_copy["area_ha"] = float(plot_copy["area_ha"])

    return plot_copy

@router.post("", response_model=PlotResponse)
async def create_plot(
    body: PlotCreate,
    current_user: dict = Depends(get_current_user)
):
    # TODO: replace with ST_Contains reverse lookup against admin_boundary table once boundary data is loaded

    # Calculate area_ha server-side (never accept from client)
    area_ha = calculate_area_ha(body.geometry)

    new_plot = {
        "id": str(uuid.uuid4()),
        "owner_user_id": body.owner_user_id,
        "geometry": body.geometry,
        "area_ha": area_ha,
        "district": body.district,
        "dsd": body.dsd,
        "gn_division": body.gn_division,
    }

    res = supabase.table("plot").insert(new_plot).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create plot record")

    return sanitize_plot(res.data[0])

@router.get("", response_model=PaginatedPlotsResponse)
async def list_plots(
    owner_user_id: Optional[str] = Query(None, description="Filter by owner user ID"),
    district: Optional[str] = Query(None, description="Filter by district"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    query = supabase.table("plot").select("*", count="exact")

    if owner_user_id and owner_user_id.strip():
        query = query.eq("owner_user_id", owner_user_id.strip())

    if district and district.strip():
        query = query.eq("district", district.strip())

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size - 1

    res = query.range(start_idx, end_idx).order("created_at", desc=True).execute()

    total_count = res.count if res.count is not None else len(res.data or [])
    items = [sanitize_plot(p) for p in (res.data or [])]
    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@router.get("/{plot_id}", response_model=PlotResponse)
async def get_plot(
    plot_id: str,
    current_user: dict = Depends(get_current_user)
):
    res = supabase.table("plot").select("*").eq("id", plot_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Plot not found")
    return sanitize_plot(res.data[0])

@router.patch("/{plot_id}", response_model=PlotResponse)
async def update_plot(
    plot_id: str,
    body: PlotUpdate,
    current_user: dict = Depends(get_current_user)
):
    existing = supabase.table("plot").select("*").eq("id", plot_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Plot not found")

    plot_data = existing.data[0]

    user_id = current_user.get("sub") or current_user.get("id")
    user_role = current_user.get("role")

    if user_id != plot_data.get("owner_user_id") and user_role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to update this plot")

    update_data = body.model_dump(exclude_unset=True)

    # Ensure geometry and area_ha cannot be updated
    update_data.pop("geometry", None)
    update_data.pop("area_ha", None)
    update_data.pop("id", None)
    update_data.pop("owner_user_id", None)

    if not update_data:
        return sanitize_plot(plot_data)

    res = supabase.table("plot").update(update_data).eq("id", plot_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update plot")

    return sanitize_plot(res.data[0])
