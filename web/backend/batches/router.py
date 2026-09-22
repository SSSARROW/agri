import uuid
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from auth.router import get_current_user
from db.supabase import supabase
from batches.schemas import (
    BatchCreate,
    BatchResponse,
    PaginatedBatchesResponse,
    MergeRequest,
    SplitRequest,
    LineageResponse,
    LineageBatch,
)
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

@router.post("/merge", response_model=BatchResponse)
async def merge_batches(
    body: MergeRequest,
    current_user: dict = Depends(get_current_user)
):
    if not body.parent_batch_ids or len(body.parent_batch_ids) < 2:
        raise HTTPException(status_code=400, detail="Merge requires at least 2 parent batches")

    for p_id in body.parent_batch_ids:
        if not is_valid_uuid(p_id):
            raise HTTPException(status_code=400, detail="Invalid UUID format")

    if not is_valid_uuid(body.plot_id):
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    # Validate plot_id exists
    plot_res = supabase.table("plot").select("id").eq("id", body.plot_id).execute()
    if not plot_res.data:
        raise HTTPException(status_code=400, detail="Plot not found")

    # Check all parent batches exist in db at once
    parents_res = supabase.table("batch").select("id").in_("id", body.parent_batch_ids).execute()
    found_ids = {p["id"] for p in (parents_res.data or [])}

    for p_id in body.parent_batch_ids:
        if p_id not in found_ids:
            raise HTTPException(status_code=404, detail=f"Parent batch {p_id} not found")

    code = generate_batch_code(body.crop)

    new_batch = {
        "id": str(uuid.uuid4()),
        "code": code,
        "crop": body.crop,
        "plot_id": body.plot_id,
        "parent_batch_ids": body.parent_batch_ids,
        "protocol_id": None,
        "commitment_id": None,
    }

    res = supabase.table("batch").insert(new_batch).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create merged batch record")

    return sanitize_batch(res.data[0])

@router.get("/{batch_id}", response_model=BatchResponse)
async def get_batch(
    batch_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not is_valid_uuid(batch_id):
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    res = supabase.table("batch").select("*").eq("id", batch_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Batch not found")

    return sanitize_batch(res.data[0])

@router.post("/{batch_id}/split", response_model=List[BatchResponse])
async def split_batch(
    batch_id: str,
    body: SplitRequest,
    current_user: dict = Depends(get_current_user)
):
    if not is_valid_uuid(batch_id):
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    if not body.pieces or len(body.pieces) < 2:
        raise HTTPException(status_code=400, detail="Split requires at least 2 pieces")

    existing = supabase.table("batch").select("*").eq("id", batch_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Batch not found")

    parent_batch = existing.data[0]

    new_batches = []
    used_codes = set()

    for piece in body.pieces:
        code = generate_batch_code(piece.crop)
        while code in used_codes:
            # Force increment sequence if code collision happens in same split batch
            crop_prefix = code.split("-")[0]
            from batches.code_gen import encode_seq, compute_sig_suffix, decode_seq
            seq = decode_seq(code.split("-")[1]) + 1
            code = f"{crop_prefix}-{encode_seq(seq)}-{compute_sig_suffix(crop_prefix, seq)}"

        used_codes.add(code)
        new_batch = {
            "id": str(uuid.uuid4()),
            "code": code,
            "crop": piece.crop,
            "plot_id": parent_batch["plot_id"],
            "parent_batch_ids": [batch_id],
            "protocol_id": parent_batch.get("protocol_id"),
            "commitment_id": parent_batch.get("commitment_id"),
        }
        new_batches.append(new_batch)


    res = supabase.table("batch").insert(new_batches).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create split batch records")

    return [sanitize_batch(b) for b in res.data]

@router.get("/{batch_id}/lineage", response_model=LineageResponse)
async def get_batch_lineage(
    batch_id: str,
    current_user: dict = Depends(get_current_user)
):
    if not is_valid_uuid(batch_id):
        raise HTTPException(status_code=400, detail="Invalid UUID format")

    # 1. Validate batch_id exists
    existing = supabase.table("batch").select("id").eq("id", batch_id).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Batch not found")

    # 2. Call get_batch_ancestors RPC
    ancestors_rpc = supabase.rpc("get_batch_ancestors", {"start_id": batch_id}).execute()
    ancestors_raw = ancestors_rpc.data or []

    # 3. Call get_batch_descendants RPC
    descendants_rpc = supabase.rpc("get_batch_descendants", {"start_id": batch_id}).execute()
    descendants_raw = descendants_rpc.data or []

    # Filter out queried batch itself if returned by RPC
    ancestors_raw = [a for a in ancestors_raw if a.get("id") != batch_id]
    descendants_raw = [d for d in descendants_raw if d.get("id") != batch_id]

    all_ids = set()
    for a in ancestors_raw:
        all_ids.add(a["id"])
    for d in descendants_raw:
        all_ids.add(d["id"])

    # Map details if any ancestor/descendant exist
    batch_details_map = {}
    if all_ids:
        details_res = supabase.table("batch").select("*").in_("id", list(all_ids)).execute()
        for row in (details_res.data or []):
            batch_details_map[row["id"]] = row

    ancestors_list = []
    for item in ancestors_raw:
        b_id = item["id"]
        detail = batch_details_map.get(b_id, {})
        ancestors_list.append({
            "id": b_id,
            "code": detail.get("code", item.get("code", "")),
            "crop": detail.get("crop", item.get("crop", "")),
            "depth": item.get("depth", 0),
            "parent_batch_ids": detail.get("parent_batch_ids") or item.get("parent_batch_ids") or []
        })

    descendants_list = []
    for item in descendants_raw:
        b_id = item["id"]
        detail = batch_details_map.get(b_id, {})
        descendants_list.append({
            "id": b_id,
            "code": detail.get("code", item.get("code", "")),
            "crop": detail.get("crop", item.get("crop", "")),
            "depth": item.get("depth", 0),
            "parent_batch_ids": detail.get("parent_batch_ids") or item.get("parent_batch_ids") or []
        })

    return {
        "batch_id": batch_id,
        "ancestors": ancestors_list,
        "descendants": descendants_list,
        "total_ancestors": len(ancestors_list),
        "total_descendants": len(descendants_list)
    }
