"""
Admin Exporter Verification API router — prefix: /api/admin/exporters
Admin role only. Handles exporter verification workflow (list, inspect, approve, reject, reopen).
"""
import os
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from core.security import decode_token
from db.supabase import supabase

router = APIRouter(prefix="/api/admin/exporters", tags=["admin-exporters"])
bearer = HTTPBearer()

# Feature flag check helper
ENABLE_ADMIN_EXPORTER_VERIFICATION = os.getenv("ENABLE_ADMIN_EXPORTER_VERIFICATION", "true").lower() == "true"


async def get_current_admin(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    """Ensure feature flag is active and token has admin role."""
    if not ENABLE_ADMIN_EXPORTER_VERIFICATION:
        raise HTTPException(status_code=404, detail="Exporter verification module disabled")

    try:
        payload = decode_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin privilege required",
        )
    return payload


# ── Pydantic Request Schemas ───────────────────────────────────────────────

class RejectRequest(BaseModel):
    reason: str = Field(..., min_length=1, description="Reason for rejection is required")


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("")
@router.get("/")
async def list_exporters(
    status: Optional[str] = Query("pending", pattern="^(pending|verified|rejected|all)$"),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_admin: dict = Depends(get_current_admin),
):
    """
    List exporters with pagination, status filtering, and search.
    Only admin tokens are allowed.
    """
    try:
        # Fetch profile records with user info
        query = supabase.table("exporter_profiles").select("*, users:user_id(id, email, name, phone)", count="exact")
        
        if status and status != "all":
            query = query.eq("status", status)

        if search and search.strip():
            s = f"%{search.strip()}%"
            query = query.or_(f"company_name.ilike.{s},email.ilike.{s},business_reg_no.ilike.{s}")

        start = (page - 1) * page_size
        end = start + page_size - 1
        res = query.order("created_at", desc=True).range(start, end).execute()

        items = res.data or []
        total = res.count or 0
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 1

        # Fetch status counts
        pending_res = supabase.table("exporter_profiles").select("id", count="exact").eq("status", "pending").execute()
        verified_res = supabase.table("exporter_profiles").select("id", count="exact").eq("status", "verified").execute()
        rejected_res = supabase.table("exporter_profiles").select("id", count="exact").eq("status", "rejected").execute()

        # Sanitize any sensitive user fields if present
        for item in items:
            if "users" in item and item["users"]:
                item["users"].pop("password_hash", None)
                item["users"].pop("nic_hash", None)
                item["users"].pop("nic_salt", None)

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "counts": {
                "pending": pending_res.count or 0,
                "verified": verified_res.count or 0,
                "rejected": rejected_res.count or 0,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list exporters: {str(e)}")


@router.get("/{id}")
async def get_exporter_details(
    id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Get full details for a single exporter including verification history log.
    """
    try:
        res = (
            supabase.table("exporter_profiles")
            .select("*, users:user_id(id, email, name, phone, district, dsd, gn_division, created_at)")
            .eq("id", id)
            .maybe_single()
            .execute()
        )

        if not res or not res.data:
            raise HTTPException(status_code=404, detail="Exporter profile not found")

        exporter = res.data
        if "users" in exporter and exporter["users"]:
            exporter["users"].pop("password_hash", None)
            exporter["users"].pop("nic_hash", None)
            exporter["users"].pop("nic_salt", None)

        # Fetch verification log history
        log_res = (
            supabase.table("exporter_verification_log")
            .select("*, admin_user:admin_user_id(email, name)")
            .eq("exporter_profile_id", id)
            .order("created_at", desc=True)
            .execute()
        )

        history = log_res.data or []
        for log_entry in history:
            if "admin_user" in log_entry and log_entry["admin_user"]:
                log_entry["admin_user"].pop("password_hash", None)

        exporter["history"] = history
        return exporter
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve exporter details: {str(e)}")


@router.post("/{id}/approve")
async def approve_exporter(
    id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Approve an exporter (set status=verified, clear rejection_reason, log action).
    """
    admin_id = current_admin["sub"]

    # Fetch current profile state
    res = supabase.table("exporter_profiles").select("*").eq("id", id).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Exporter profile not found")

    profile = res.data
    current_status = profile["status"]

    if current_status == "verified":
        raise HTTPException(status_code=400, detail="Exporter is already verified")

    # Update status & write log
    upd_res = (
        supabase.table("exporter_profiles")
        .update({"status": "verified", "rejection_reason": None})
        .eq("id", id)
        .execute()
    )
    if not upd_res.data:
        raise HTTPException(status_code=500, detail="Failed to update exporter status")

    supabase.table("exporter_verification_log").insert({
        "exporter_profile_id": id,
        "admin_user_id": admin_id,
        "action": "approved",
        "reason": None,
        "previous_status": current_status,
        "new_status": "verified",
    }).execute()

    return {"status": "ok", "message": "Exporter approved successfully", "data": upd_res.data[0]}


@router.post("/{id}/reject")
async def reject_exporter(
    id: str,
    body: RejectRequest,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Reject an exporter (set status=rejected, store reason, log action).
    Requires a non-empty reason.
    """
    admin_id = current_admin["sub"]
    reason = body.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Rejection reason cannot be empty")

    res = supabase.table("exporter_profiles").select("*").eq("id", id).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Exporter profile not found")

    profile = res.data
    current_status = profile["status"]

    if current_status == "rejected":
        raise HTTPException(status_code=400, detail="Exporter is already rejected")

    upd_res = (
        supabase.table("exporter_profiles")
        .update({"status": "rejected", "rejection_reason": reason})
        .eq("id", id)
        .execute()
    )
    if not upd_res.data:
        raise HTTPException(status_code=500, detail="Failed to update exporter status")

    supabase.table("exporter_verification_log").insert({
        "exporter_profile_id": id,
        "admin_user_id": admin_id,
        "action": "rejected",
        "reason": reason,
        "previous_status": current_status,
        "new_status": "rejected",
    }).execute()

    return {"status": "ok", "message": "Exporter rejected successfully", "data": upd_res.data[0]}


@router.post("/{id}/reopen")
async def reopen_exporter(
    id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Reopen an exporter verification (set status back to pending, log action).
    """
    admin_id = current_admin["sub"]

    res = supabase.table("exporter_profiles").select("*").eq("id", id).maybe_single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Exporter profile not found")

    profile = res.data
    current_status = profile["status"]

    if current_status == "pending":
        raise HTTPException(status_code=400, detail="Exporter status is already pending")

    upd_res = (
        supabase.table("exporter_profiles")
        .update({"status": "pending", "rejection_reason": None})
        .eq("id", id)
        .execute()
    )
    if not upd_res.data:
        raise HTTPException(status_code=500, detail="Failed to update exporter status")

    supabase.table("exporter_verification_log").insert({
        "exporter_profile_id": id,
        "admin_user_id": admin_id,
        "action": "reopened",
        "reason": None,
        "previous_status": current_status,
        "new_status": "pending",
    }).execute()

    return {"status": "ok", "message": "Exporter status reopened to pending", "data": upd_res.data[0]}
