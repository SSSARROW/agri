from typing import Optional, List, Dict
from datetime import datetime, timezone
from fastapi import HTTPException
from db.supabase import supabase


def _get_approved_link(farmer_id: str) -> Optional[dict]:
    res = (
        supabase.table("farmer_exporter_links")
        .select("id, exporter_profile_id, status")
        .eq("farmer_id", farmer_id)
        .eq("status", "approved")
        .limit(1)
        .execute()
    )
    rows = res.data or []
    return rows[0] if rows else None


def get_farmer_standards_view(farmer_id: str) -> dict:
    """
    The farmer's "what do I need to do" view: every published standard
    belonging to their approved exporter, each stage annotated with the
    farmer's latest submission status for it.
    """
    link = _get_approved_link(farmer_id)
    if not link:
        return {"has_approved_exporter": False, "exporter_company_name": None, "standards": []}

    exporter_profile_id = link["exporter_profile_id"]
    link_id = link["id"]

    exp_res = (
        supabase.table("exporter_profiles")
        .select("company_name")
        .eq("id", exporter_profile_id)
        .maybe_single()
        .execute()
    )
    exporter_name = (exp_res.data or {}).get("company_name") if exp_res else None

    standards_res = (
        supabase.table("quality_standards")
        .select("id, crop")
        .eq("exporter_profile_id", exporter_profile_id)
        .eq("is_archived", False)
        .execute()
    )
    standards = standards_res.data or []
    if not standards:
        return {
            "has_approved_exporter": True,
            "exporter_company_name": exporter_name,
            "standards": [],
        }

    standard_ids = [s["id"] for s in standards]
    versions_res = (
        supabase.table("quality_standard_versions")
        .select("id, standard_id, version_number, name, status")
        .in_("standard_id", standard_ids)
        .eq("status", "published")
        .execute()
    )
    # A standard can be re-versioned; only its latest published version is
    # "the" standard a farmer follows right now.
    latest_version_by_standard: Dict[str, dict] = {}
    for v in versions_res.data or []:
        sid = v["standard_id"]
        if sid not in latest_version_by_standard or v["version_number"] > latest_version_by_standard[sid]["version_number"]:
            latest_version_by_standard[sid] = v

    if not latest_version_by_standard:
        return {
            "has_approved_exporter": True,
            "exporter_company_name": exporter_name,
            "standards": [],
        }

    version_ids = [v["id"] for v in latest_version_by_standard.values()]
    stages_res = (
        supabase.table("quality_standard_stages")
        .select("*")
        .in_("version_id", version_ids)
        .order("position")
        .execute()
    )
    stages = stages_res.data or []
    stage_ids = [s["id"] for s in stages]

    # Latest submission per stage for this farmer's relationship.
    latest_submission_by_stage: Dict[str, dict] = {}
    if stage_ids:
        subs_res = (
            supabase.table("stage_proof_submissions")
            .select("id, stage_id, status, submitted_at, reopened_at")
            .eq("link_id", link_id)
            .in_("stage_id", stage_ids)
            .order("submitted_at", desc=True)
            .execute()
        )
        for row in subs_res.data or []:
            sid = row["stage_id"]
            if sid not in latest_submission_by_stage:
                latest_submission_by_stage[sid] = row

    stages_by_version: Dict[str, List[dict]] = {}
    for s in stages:
        stages_by_version.setdefault(s["version_id"], []).append(s)

    standards_out = []
    crop_by_id = {s["id"]: s["crop"] for s in standards}
    for standard_id, version in latest_version_by_standard.items():
        version_stages = stages_by_version.get(version["id"], [])
        stage_items = []
        for stage in version_stages:
            latest_sub = latest_submission_by_stage.get(stage["id"])
            submission_status = latest_sub["status"] if latest_sub else None
            can_resubmit = True
            if latest_sub and latest_sub["status"] == "rejected":
                can_resubmit = latest_sub.get("reopened_at") is not None
            elif latest_sub and latest_sub["status"] == "pending":
                can_resubmit = False
            stage_items.append({
                "stage_id": stage["id"],
                "position": stage["position"],
                "name": stage["name"],
                "timing_type": stage["timing_type"],
                "start_offset_days": stage["start_offset_days"],
                "instructions": stage.get("instructions") or {"en": ""},
                "dos": stage.get("dos") or {"en": []},
                "donts": stage.get("donts") or {"en": []},
                "allowed_inputs": stage.get("allowed_inputs") or [],
                "required_proof": stage.get("required_proof") or {"photo_count": 0, "photo_descriptions": [], "quick_fields": []},
                "submission_status": submission_status,
                "submission_id": latest_sub["id"] if latest_sub else None,
                "can_resubmit": can_resubmit,
            })
        standards_out.append({
            "standard_id": standard_id,
            "crop": crop_by_id.get(standard_id, ""),
            "standard_name": version["name"],
            "version_number": version["version_number"],
            "stages": stage_items,
        })

    return {
        "has_approved_exporter": True,
        "exporter_company_name": exporter_name,
        "standards": standards_out,
    }


def submit_stage_proof(farmer_id: str, stage_id: str, data: dict) -> dict:
    link = _get_approved_link(farmer_id)
    if not link:
        raise HTTPException(status_code=403, detail="You don't have an approved exporter relationship.")
    link_id = link["id"]
    exporter_profile_id = link["exporter_profile_id"]

    # Confirm the stage actually belongs to this exporter's standard (a
    # farmer can't submit proof against someone else's stage).
    stage_res = (
        supabase.table("quality_standard_stages")
        .select("id, name, version_id")
        .eq("id", stage_id)
        .maybe_single()
        .execute()
    )
    if not stage_res or not getattr(stage_res, "data", None):
        raise HTTPException(status_code=404, detail="Stage not found.")
    stage = stage_res.data

    version_res = (
        supabase.table("quality_standard_versions")
        .select("id, standard_id")
        .eq("id", stage["version_id"])
        .maybe_single()
        .execute()
    )
    if not version_res or not getattr(version_res, "data", None):
        raise HTTPException(status_code=404, detail="Standard version not found.")
    standard_res = (
        supabase.table("quality_standards")
        .select("id, exporter_profile_id")
        .eq("id", version_res.data["standard_id"])
        .maybe_single()
        .execute()
    )
    if not standard_res or not getattr(standard_res, "data", None) or standard_res.data["exporter_profile_id"] != exporter_profile_id:
        raise HTTPException(status_code=403, detail="This stage does not belong to your exporter's standard.")

    # Block: a pending submission already exists (unique index would also
    # catch this, but check first for a clean error message).
    existing_res = (
        supabase.table("stage_proof_submissions")
        .select("id, status, reopened_at")
        .eq("link_id", link_id)
        .eq("stage_id", stage_id)
        .order("submitted_at", desc=True)
        .limit(1)
        .execute()
    )
    existing = (existing_res.data or [None])[0]
    if existing:
        if existing["status"] == "pending":
            raise HTTPException(status_code=409, detail="You already have a submission awaiting review for this stage.")
        if existing["status"] == "rejected" and not existing.get("reopened_at"):
            raise HTTPException(
                status_code=403,
                detail="This stage was rejected. Ask your exporter to reopen it before submitting again.",
            )

    row = {
        "link_id": link_id,
        "farmer_id": farmer_id,
        "exporter_profile_id": exporter_profile_id,
        "stage_id": stage_id,
        "plot_id": data.get("plot_id"),
        "photo_urls": data["photo_urls"],
        "quick_field_answers": data.get("quick_field_answers") or {},
        "note": data.get("note"),
        "status": "pending",
    }
    insert_res = supabase.table("stage_proof_submissions").insert(row).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to submit proof.")
    created = insert_res.data[0]
    return _to_submission_out(created, stage["name"])


def list_my_submissions(farmer_id: str) -> dict:
    res = (
        supabase.table("stage_proof_submissions")
        .select("*")
        .eq("farmer_id", farmer_id)
        .order("submitted_at", desc=True)
        .execute()
    )
    rows = res.data or []
    stage_ids = list({r["stage_id"] for r in rows})
    stage_names: Dict[str, str] = {}
    if stage_ids:
        stages_res = (
            supabase.table("quality_standard_stages")
            .select("id, name")
            .in_("id", stage_ids)
            .execute()
        )
        stage_names = {s["id"]: s["name"] for s in (stages_res.data or [])}
    items = [_to_submission_out(r, stage_names.get(r["stage_id"], "")) for r in rows]
    return {"items": items, "total": len(items)}


def _to_submission_out(row: dict, stage_name: str) -> dict:
    return {
        "id": row["id"],
        "link_id": row["link_id"],
        "stage_id": row["stage_id"],
        "stage_name": stage_name,
        "photo_urls": row.get("photo_urls") or [],
        "quick_field_answers": row.get("quick_field_answers") or {},
        "note": row.get("note"),
        "status": row["status"],
        "submitted_at": row["submitted_at"],
        "reviewed_at": row.get("reviewed_at"),
        "review_notes": row.get("review_notes"),
    }
