import uuid
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from auth.router import get_current_user
from db.supabase import supabase
from batches.schemas import BatchCreate, BatchResponse, PaginatedBatchesResponse
from batches.code_gen import generate_batch_code, validate_batch_code

router = APIRouter(prefix="/batches", tags=["batches"])

def sanitize_batch(batch: dict) -> dict:
    batch_copy = batch.copy()

    if batch_copy.get("parent_batch_ids") is None:
        batch_copy["parent_batch_ids"] = []
    elif not isinstance(batch_copy["parent_batch_ids"], list):
        batch_copy["parent_batch_ids"] = list(batch_copy["parent_batch_ids"])

    if "protocol_id" not in batch_copy:
        batch_copy["protocol_id"] = None

    if "commitment_id" not in batch_copy:
        batch_copy["commitment_id"] = None

    return batch_copy

def is_valid_uuid(val: str) -> bool:
    if not val:
        return False
    try:
        uuid.UUID(str(val))
        return True
    except Exception:
        return False

@router.post("", response_model=BatchResponse)
async def create_batch(
    body: BatchCreate,
    current_user: dict = Depends(get_current_user)
):
    if not is_valid_uuid(body.plot_id):
        raise HTTPException(status_code=400, detail="Invalid plot_id format: must be a valid UUID")

    # Validate plot_id exists in plot table
    plot_res = supabase.table("plot").select("id").eq("id", body.plot_id).execute()
    if not plot_res.data:
        raise HTTPException(status_code=400, detail="Plot not found")

    code = generate_batch_code(body.crop)

    protocol_id = body.protocol_id if is_valid_uuid(body.protocol_id) else None
    commitment_id = body.commitment_id if is_valid_uuid(body.commitment_id) else None

    new_batch = {
        "id": str(uuid.uuid4()),
        "code": code,
        "crop": body.crop,
        "plot_id": body.plot_id,
        "parent_batch_ids": body.parent_batch_ids or [],
        "protocol_id": protocol_id,
        "commitment_id": commitment_id,
    }

    res = supabase.table("batch").insert(new_batch).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create batch record")

    return sanitize_batch(res.data[0])

@router.get("", response_model=PaginatedBatchesResponse)
async def list_batches(
    plot_id: Optional[str] = Query(None, description="Filter by plot ID"),
    crop: Optional[str] = Query(None, description="Filter by crop"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    query = supabase.table("batch").select("*", count="exact")

    if plot_id and plot_id.strip():
        query = query.eq("plot_id", plot_id.strip())

    if crop and crop.strip():
        query = query.eq("crop", crop.strip())

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size - 1

    res = query.range(start_idx, end_idx).order("created_at", desc=True).execute()

    total_count = res.count if res.count is not None else len(res.data or [])
    items = [sanitize_batch(b) for b in (res.data or [])]
    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }

@router.get("/code/{code}", response_model=BatchResponse)
async def get_batch_by_code(code: str):
    if not validate_batch_code(code):
        raise HTTPException(status_code=400, detail="Invalid batch code signature")

    res = supabase.table("batch").select("*").eq("code", code).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Batch not found")

    return sanitize_batch(res.data[0])

@router.get("/{batch_id}", response_model=BatchResponse)
async def get_batch(
    batch_id: str,
    current_user: dict = Depends(get_current_user)
):
    res = supabase.table("batch").select("*").eq("id", batch_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Batch not found")

    return sanitize_batch(res.data[0])
