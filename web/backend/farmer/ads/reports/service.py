"""
Farmer ad report service.
Rules:
- Only for live ads (published, not closed, not expired).
- One report per farmer per ad — 409 on duplicate.
- Reporting NEVER changes the ad status automatically.
"""
from datetime import datetime, timezone
from fastapi import HTTPException
from db.supabase import supabase


def _require_live_ad(ad_id: str) -> str:
    """
    Validates the ad is live (not closed, has published non-expired version).
    Returns the current published version id.
    """
    ad_res = (
        supabase.table("ads")
        .select("id, status")
        .eq("id", ad_id)
        .maybe_single()
        .execute()
    )
    if not ad_res or not ad_res.data:
        raise HTTPException(status_code=404, detail="Advertisement not found.")
    if ad_res.data.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Cannot report a closed advertisement.")

    ver_res = (
        supabase.table("ad_versions")
        .select("id, expires_at")
        .eq("ad_id", ad_id)
        .eq("status", "published")
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if not ver_res or not ver_res.data:
        raise HTTPException(status_code=400, detail="Advertisement has no live version.")

    ver = ver_res.data[0]
    try:
        exp_str = ver.get("expires_at")
        if exp_str:
            exp_dt = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp_dt:
                raise HTTPException(status_code=400, detail="Cannot report an expired advertisement.")
    except HTTPException:
        raise
    except Exception:
        pass  # parse failure is non-fatal; let it through

    return ver["id"]


def submit_report(ad_id: str, farmer_id: str, reason: str, details: str | None) -> dict:
    """Submits a farmer's report for a live ad."""
    ad_version_id = _require_live_ad(ad_id)

    # Duplicate check
    dup = (
        supabase.table("ad_reports")
        .select("id")
        .eq("ad_id", ad_id)
        .eq("farmer_id", farmer_id)
        .maybe_single()
        .execute()
    )
    if dup and dup.data:
        raise HTTPException(
            status_code=409,
            detail="You have already submitted a report for this advertisement.",
        )

    payload = {
        "ad_id": ad_id,
        "ad_version_id": ad_version_id,
        "farmer_id": farmer_id,
        "reason": reason,
        "details": details,
        "status": "open",
    }
    try:
        ins = supabase.table("ad_reports").insert(payload).execute()
    except Exception as exc:
        msg = str(exc)
        if "unique" in msg.lower():
            raise HTTPException(
                status_code=409,
                detail="You have already submitted a report for this advertisement.",
            )
        raise HTTPException(status_code=500, detail=f"Failed to submit report: {msg}")

    if not ins.data:
        raise HTTPException(status_code=500, detail="Failed to save report.")

    row = ins.data[0]
    return {
        "report_id": row["id"],
        "ad_id": ad_id,
        "farmer_id": farmer_id,
        "reason": reason,
        "details": details,
        "status": "open",
        "created_at": row["created_at"],
        "message": "Report submitted. Our team will review it shortly.",
    }
