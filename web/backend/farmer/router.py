from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException

from db.supabase import supabase
from farmer.auth import get_current_farmer
from farmer.schemas import (
    VerifiedExporterPublicItem,
    RequestLinkBody,
    FarmerLinkStatusResponse,
    CurrentLinkResponse,
)

router = APIRouter(prefix="/api/farmer/exporter-link", tags=["farmer-exporter-link"])


@router.get("/exporters", response_model=List[VerifiedExporterPublicItem])
async def list_verified_exporters(
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    Returns verified exporters directory for farmers.
    Excludes contact details (phone, email, registration numbers).
    """
    res = (
        supabase.table("exporter_profiles")
        .select("id, company_name, description, logo_url, districts_served, crops_bought, certifications")
        .eq("status", "verified")
        .order("company_name", desc=False)
        .execute()
    )
    items = []
    for row in (res.data or []):
        items.append({
            "id": row["id"],
            "company_name": row.get("company_name") or "Unnamed Exporter",
            "description": row.get("description"),
            "logo_url": row.get("logo_url"),
            "districts_served": row.get("districts_served") or [],
            "crops_bought": row.get("crops_bought") or [],
            "certifications": row.get("certifications") or [],
        })
    return items


@router.post("/request", response_model=FarmerLinkStatusResponse)
async def request_link(
    body: RequestLinkBody,
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    Request a connection to a verified exporter.
    Fails if the exporter is unverified or if the farmer already has an active link.
    """
    farmer_id = current_farmer["sub"]

    # 1. Verify target exporter exists and is verified
    exp_res = (
        supabase.table("exporter_profiles")
        .select("id, company_name, status")
        .eq("id", body.exporter_profile_id)
        .maybe_single()
        .execute()
    )
    if not exp_res or not getattr(exp_res, "data", None):
        raise HTTPException(status_code=400, detail="Exporter profile not found.")

    exp_data = exp_res.data
    if exp_data.get("status") != "verified":
        raise HTTPException(
            status_code=400,
            detail="Cannot link to an exporter that is not verified."
        )

    # 2. Check for existing active link
    active_check = (
        supabase.table("farmer_exporter_links")
        .select("id, status")
        .eq("farmer_id", farmer_id)
        .in_("status", ["requested", "approved"])
        .execute()
    )
    if active_check.data and len(active_check.data) > 0:
        raise HTTPException(
            status_code=409,
            detail="You already have an active link or pending request with an exporter."
        )

    # 3. Insert link
    new_link = {
        "farmer_id": farmer_id,
        "exporter_profile_id": body.exporter_profile_id,
        "status": "requested",
    }
    try:
        insert_res = supabase.table("farmer_exporter_links").insert(new_link).execute()
    except Exception as exc:
        err_msg = str(exc)
        if "idx_farmer_exporter_links_active_farmer" in err_msg or "unique" in err_msg.lower() or "23505" in err_msg:
            raise HTTPException(
                status_code=409,
                detail="Conflict: You already have an active link or pending request with an exporter."
            )
        raise HTTPException(status_code=500, detail=f"Failed to submit link request: {err_msg}")

    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to create link record.")

    created = insert_res.data[0]
    return {
        "id": created["id"],
        "farmer_id": created["farmer_id"],
        "exporter_profile_id": created["exporter_profile_id"],
        "exporter_company_name": exp_data.get("company_name"),
        "status": created["status"],
        "requested_at": created["requested_at"],
        "decided_at": created.get("decided_at"),
        "decision_reason": created.get("decision_reason"),
    }


@router.get("/current", response_model=CurrentLinkResponse)
async def get_current_link(
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    Get the farmer's current active link ('requested' or 'approved'), if any.
    """
    farmer_id = current_farmer["sub"]
    res = (
        supabase.table("farmer_exporter_links")
        .select("*")
        .eq("farmer_id", farmer_id)
        .in_("status", ["requested", "approved"])
        .order("requested_at", desc=True)
        .limit(1)
        .execute()
    )

    if not res.data:
        return {"has_active_link": False, "link": None}

    link = res.data[0]
    exp_name = None
    try:
        exp_res = (
            supabase.table("exporter_profiles")
            .select("company_name")
            .eq("id", link["exporter_profile_id"])
            .maybe_single()
            .execute()
        )
        if exp_res and getattr(exp_res, "data", None):
            exp_name = exp_res.data.get("company_name")
    except Exception:
        pass

    return {
        "has_active_link": True,
        "link": {
            "id": link["id"],
            "farmer_id": link["farmer_id"],
            "exporter_profile_id": link["exporter_profile_id"],
            "exporter_company_name": exp_name,
            "status": link["status"],
            "requested_at": link["requested_at"],
            "decided_at": link.get("decided_at"),
            "decision_reason": link.get("decision_reason"),
        },
    }


@router.post("/cancel", response_model=FarmerLinkStatusResponse)
async def cancel_requested_link(
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    Cancel a pending ('requested') link request.
    Only requested links can be cancelled by the farmer.
    """
    farmer_id = current_farmer["sub"]

    res = (
        supabase.table("farmer_exporter_links")
        .select("*")
        .eq("farmer_id", farmer_id)
        .eq("status", "requested")
        .order("requested_at", desc=True)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=400,
            detail="No pending requested link found to cancel."
        )

    link = res.data[0]
    update_res = (
        supabase.table("farmer_exporter_links")
        .update({
            "status": "cancelled",
            "decided_at": datetime.now(timezone.utc).isoformat(),
            "decision_reason": "Cancelled by farmer",
        })
        .eq("id", link["id"])
        .execute()
    )
    if not update_res.data:
        raise HTTPException(status_code=500, detail="Failed to cancel request.")

    cancelled = update_res.data[0]
    return {
        "id": cancelled["id"],
        "farmer_id": cancelled["farmer_id"],
        "exporter_profile_id": cancelled["exporter_profile_id"],
        "exporter_company_name": None,
        "status": cancelled["status"],
        "requested_at": cancelled["requested_at"],
        "decided_at": cancelled.get("decided_at"),
        "decision_reason": cancelled.get("decision_reason"),
    }
