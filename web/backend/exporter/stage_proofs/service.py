import math
from datetime import datetime, timezone
from typing import Optional, Dict
from fastapi import HTTPException
from db.supabase import supabase


def _enrich(rows: list[dict]) -> list[dict]:
    if not rows:
        return []
    farmer_ids = list({r["farmer_id"] for r in rows})
    stage_ids = list({r["stage_id"] for r in rows})
    plot_ids = list({r["plot_id"] for r in rows if r.get("plot_id")})

    users_res = supabase.table("users").select("id, name").in_("id", farmer_ids).execute()
    names_by_farmer: Dict[str, str] = {str(u["id"]): u.get("name") or "Farmer" for u in (users_res.data or [])}

    stages_res = supabase.table("quality_standard_stages").select("id, name").in_("id", stage_ids).execute()
    names_by_stage: Dict[str, str] = {s["id"]: s["name"] for s in (stages_res.data or [])}

    names_by_plot: Dict[str, str] = {}
    if plot_ids:
        try:
            plots_res = supabase.table("plot").select("id, name").in_("id", plot_ids).execute()
            names_by_plot = {str(p["id"]): (p.get("name") or "Plot") for p in (plots_res.data or [])}
        except Exception:
            pass

    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "link_id": r["link_id"],
            "farmer_id": r["farmer_id"],
            "farmer_name": names_by_farmer.get(str(r["farmer_id"]), "Farmer"),
            "stage_id": r["stage_id"],
            "stage_name": names_by_stage.get(r["stage_id"], ""),
            "plot_name": names_by_plot.get(str(r["plot_id"])) if r.get("plot_id") else None,
            "photo_count": len(r.get("photo_urls") or []),
            "status": r["status"],
            "submitted_at": r["submitted_at"],
            "needs_attention": r["status"] == "rejected" and not r.get("reopened_at"),
        })
    return out


def list_submissions(exporter_profile_id: str, status: Optional[str], page: int, page_size: int) -> dict:
    query = (
        supabase.table("stage_proof_submissions")
        .select("*", count="exact")
        .eq("exporter_profile_id", exporter_profile_id)
    )
    if status:
        query = query.eq("status", status)
    query = query.order("submitted_at", desc=True)

    pending_res = (
        supabase.table("stage_proof_submissions")
        .select("id", count="exact")
        .eq("exporter_profile_id", exporter_profile_id)
        .eq("status", "pending")
        .execute()
    )
    pending_count = pending_res.count or 0

    start = (page - 1) * page_size
    end = start + page_size - 1
    res = query.range(start, end).execute()
    total = res.count or 0

    return {
        "items": _enrich(res.data or []),
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, math.ceil(total / page_size)),
        "pending_count": pending_count,
    }


def _get_owned_submission(submission_id: str, exporter_profile_id: str) -> dict:
    res = (
        supabase.table("stage_proof_submissions")
        .select("*")
        .eq("id", submission_id)
        .maybe_single()
        .execute()
    )
    if not res or not getattr(res, "data", None):
        raise HTTPException(status_code=404, detail="Submission not found.")
    row = res.data
    if row["exporter_profile_id"] != exporter_profile_id:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return row


def get_submission_detail(submission_id: str, exporter_profile_id: str) -> dict:
    row = _get_owned_submission(submission_id, exporter_profile_id)

    stage_res = (
        supabase.table("quality_standard_stages")
        .select("id, name, instructions")
        .eq("id", row["stage_id"])
        .maybe_single()
        .execute()
    )
    stage = stage_res.data if stage_res else {}

    user_res = supabase.table("users").select("name").eq("id", row["farmer_id"]).maybe_single().execute()
    farmer_name = (user_res.data or {}).get("name", "Farmer") if user_res else "Farmer"

    plot_name = None
    if row.get("plot_id"):
        try:
            plot_res = supabase.table("plot").select("name").eq("id", row["plot_id"]).maybe_single().execute()
            plot_name = (plot_res.data or {}).get("name") if plot_res else None
        except Exception:
            pass

    return {
        "id": row["id"],
        "link_id": row["link_id"],
        "farmer_id": row["farmer_id"],
        "farmer_name": farmer_name,
        "stage_id": row["stage_id"],
        "stage_name": (stage or {}).get("name", ""),
        "stage_instructions": (stage or {}).get("instructions") or {"en": ""},
        "plot_name": plot_name,
        "photo_urls": row.get("photo_urls") or [],
        "quick_field_answers": row.get("quick_field_answers") or {},
        "note": row.get("note"),
        "status": row["status"],
        "submitted_at": row["submitted_at"],
        "reviewed_at": row.get("reviewed_at"),
        "review_notes": row.get("review_notes"),
        "reopened_at": row.get("reopened_at"),
    }


def approve_submission(submission_id: str, exporter_profile_id: str, notes: Optional[str]) -> dict:
    row = _get_owned_submission(submission_id, exporter_profile_id)
    if row["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only a pending submission can be approved.")
    update_res = (
        supabase.table("stage_proof_submissions")
        .update({
            "status": "approved",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "review_notes": notes,
        })
        .eq("id", submission_id)
        .execute()
    )
    if not update_res.data:
        raise HTTPException(status_code=500, detail="Failed to approve submission.")
    return get_submission_detail(submission_id, exporter_profile_id)


def reject_submission(submission_id: str, exporter_profile_id: str, notes: Optional[str]) -> dict:
    row = _get_owned_submission(submission_id, exporter_profile_id)
    if row["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only a pending submission can be rejected.")
    if not notes or not notes.strip():
        raise HTTPException(status_code=422, detail="A reason is required when rejecting a submission.")
    update_res = (
        supabase.table("stage_proof_submissions")
        .update({
            "status": "rejected",
            "reviewed_at": datetime.now(timezone.utc).isoformat(),
            "review_notes": notes,
        })
        .eq("id", submission_id)
        .execute()
    )
    if not update_res.data:
        raise HTTPException(status_code=500, detail="Failed to reject submission.")
    return get_submission_detail(submission_id, exporter_profile_id)


def reopen_submission(submission_id: str, exporter_profile_id: str) -> dict:
    row = _get_owned_submission(submission_id, exporter_profile_id)
    if row["status"] != "rejected":
        raise HTTPException(status_code=400, detail="Only a rejected submission can be reopened.")
    update_res = (
        supabase.table("stage_proof_submissions")
        .update({"reopened_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", submission_id)
        .execute()
    )
    if not update_res.data:
        raise HTTPException(status_code=500, detail="Failed to reopen submission.")
    return get_submission_detail(submission_id, exporter_profile_id)
