from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional
from auth.router import get_current_user
from db.supabase import supabase
from actors.schemas import ActorResponse, ActorUpdate, PaginatedActorsResponse

router = APIRouter(prefix="/actors", tags=["actors"])

def sanitize_actor(actor: dict) -> dict:
    actor_copy = actor.copy()
    actor_copy.pop("password_hash", None)
    actor_copy.pop("nic_hash", None)
    actor_copy.pop("nic_salt", None)
    if "is_active" not in actor_copy or actor_copy["is_active"] is None:
        actor_copy["is_active"] = True
    return actor_copy

@router.get("", response_model=PaginatedActorsResponse)
async def list_actors(
    search: Optional[str] = Query(None, description="Search by name or phone number"),
    role: Optional[str] = Query(None, description="Filter by role: farmer, exporter, admin"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    query = supabase.table("users").select("*", count="exact")

    if role and role.strip() and role != "all":
        query = query.eq("role", role.strip())

    if search and search.strip():
        term = search.strip()
        # Supabase postgrest ilike search across name and phone
        query = query.or_(f"name.ilike.%{term}%,phone.ilike.%{term}%,email.ilike.%{term}%")

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size - 1

    res = query.range(start_idx, end_idx).order("created_at", desc=True).execute()

    total_count = res.count if res.count is not None else len(res.data or [])
    items = [sanitize_actor(u) for u in (res.data or [])]
    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@router.get("/{actor_id}", response_model=ActorResponse)
async def get_actor(
    actor_id: str,
    current_user: dict = Depends(get_current_user)
):
    res = supabase.table("users").select("*").eq("id", actor_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Actor not found")
    return sanitize_actor(res.data[0])

@router.patch("/{actor_id}", response_model=ActorResponse)
async def update_actor(
    actor_id: str,
    body: ActorUpdate,
    current_user: dict = Depends(get_current_user)
):
    # Only admin is allowed to update active status
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can update actor active status")

    existing = supabase.table("users").select("*").eq("id", actor_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Actor not found")

    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        return sanitize_actor(existing.data[0])

    res = supabase.table("users").update(update_data).eq("id", actor_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update actor")

    return sanitize_actor(res.data[0])
