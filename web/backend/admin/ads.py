"""
Admin Ad Moderation API — prefix: /api/admin/ads
Admin role only.
Handles: list, detail, takedown, restore, reports management.
Feature flag: ENABLE_AD_MODERATION (default true).
"""
import os
from typing import Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field

from core.security import decode_token
from db.supabase import supabase
from exporter.ads.service import compute_ad_status

router = APIRouter(prefix="/api/admin/ads", tags=["admin-ads"])
bearer = HTTPBearer()

ENABLE_AD_MODERATION = os.getenv("ENABLE_AD_MODERATION", "true").lower() == "true"


# ── Auth dependency ────────────────────────────────────────────────────────

async def get_current_admin(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    if not ENABLE_AD_MODERATION:
        raise HTTPException(status_code=404, detail="Ad moderation module disabled.")
    try:
        payload = decode_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin privilege required.")
    return payload


# ── Request schemas ────────────────────────────────────────────────────────

class TakedownRequest(BaseModel):
    reason: str = Field(..., min_length=1, description="Reason is required.")


class ReviewRequest(BaseModel):
    note: Optional[str] = None


# ── Helpers ────────────────────────────────────────────────────────────────

def _parse_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _compute_admin_state(ad: dict, versions: list) -> str:
    """
    Extends compute_ad_status with 'taken_down' and 'filled'.
    """
    raw = ad.get("status")
    if raw == "closed":
        cr = ad.get("closed_reason") or ""
        if cr.startswith("taken_down:"):
            return "taken_down"
        return "closed"
    pub = [v for v in versions if v.get("status") == "published"]
    if not pub:
        return "draft"
    latest = sorted(pub, key=lambda v: v.get("version_number", 0), reverse=True)[0]
    exp_dt = _parse_dt(latest.get("expires_at"))
    if exp_dt and datetime.now(timezone.utc) > exp_dt:
        return "expired"
    # filled check (lightweight — use approved qty vs target)
    return "live"


def _sanitize_user(u: Optional[dict]) -> Optional[dict]:
    if not u:
        return None
    for k in ("password_hash", "nic_hash", "nic_salt", "nic"):
        u.pop(k, None)
    return u


# ── GET /api/admin/ads ─────────────────────────────────────────────────────

@router.get("")
async def list_admin_ads(
    state: Optional[str] = Query(None, description="live|closed|taken_down|expired|filled|draft"),
    has_open_reports: Optional[bool] = Query(None),
    crop: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search exporter company or ad title"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_admin: dict = Depends(get_current_admin),
):
    """
    Paginated list of all ads across all exporters with state, open-report count, totals.
    """
    # 1. Fetch all ads (with exporter profile)
    q = supabase.table("ads").select(
        "id, exporter_profile_id, crop, status, closed_reason, closed_at, created_at, updated_at,"
        "exporter_profiles!exporter_profile_id(id, company_name, status)"
    )
    if crop:
        q = q.eq("crop", crop.strip().lower())

    ads_res = q.order("created_at", desc=True).execute()
    raw_ads = ads_res.data or []
    if not raw_ads:
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 1}

    ad_ids = [a["id"] for a in raw_ads]

    # 2. Batch-fetch latest versions
    vers_res = (
        supabase.table("ad_versions")
        .select("ad_id, id, version_number, status, title, quantity_kg, expires_at")
        .in_("ad_id", ad_ids)
        .order("version_number", desc=True)
        .execute()
    )
    vers_by_ad: dict[str, list] = {}
    for v in (vers_res.data or []):
        vers_by_ad.setdefault(v["ad_id"], []).append(v)

    # 3. Batch-fetch open report counts
    reports_res = (
        supabase.table("ad_reports")
        .select("ad_id")
        .in_("ad_id", ad_ids)
        .eq("status", "open")
        .execute()
    )
    open_reports_count: dict[str, int] = {}
    for r in (reports_res.data or []):
        open_reports_count[r["ad_id"]] = open_reports_count.get(r["ad_id"], 0) + 1

    # 4. Batch-fetch view counts
    views_res = (
        supabase.table("ad_views")
        .select("ad_id")
        .in_("ad_id", ad_ids)
        .execute()
    )
    view_counts: dict[str, int] = {}
    for v in (views_res.data or []):
        view_counts[v["ad_id"]] = view_counts.get(v["ad_id"], 0) + 1

    # 5. Batch-fetch accept counts
    acc_res = (
        supabase.table("ad_acceptances")
        .select("ad_id")
        .in_("ad_id", ad_ids)
        .execute()
    )
    acc_counts: dict[str, int] = {}
    for a in (acc_res.data or []):
        acc_counts[a["ad_id"]] = acc_counts.get(a["ad_id"], 0) + 1

    # 6. Build enriched list
    enriched = []
    search_lower = (search or "").strip().lower()

    for ad in raw_ads:
        aid = ad["id"]
        versions = vers_by_ad.get(aid, [])
        admin_state = _compute_admin_state(ad, versions)

        # State filter
        if state and state != "all" and admin_state != state:
            continue

        # has_open_reports filter
        n_open = open_reports_count.get(aid, 0)
        if has_open_reports is True and n_open == 0:
            continue
        if has_open_reports is False and n_open > 0:
            continue

        # Compute latest version info
        top_ver = versions[0] if versions else {}
        title_en = (top_ver.get("title") or {}).get("en", "")
        exporter = ad.get("exporter_profiles") or {}
        company = exporter.get("company_name", "")

        # Search filter
        if search_lower:
            if search_lower not in company.lower() and search_lower not in title_en.lower():
                continue

        enriched.append({
            "id": aid,
            "crop": ad["crop"],
            "status": ad["status"],
            "admin_state": admin_state,
            "closed_reason": ad.get("closed_reason"),
            "created_at": ad["created_at"],
            "title": top_ver.get("title") or {},
            "version_number": top_ver.get("version_number"),
            "expires_at": top_ver.get("expires_at"),
            "exporter_profile_id": ad["exporter_profile_id"],
            "exporter_company": company,
            "open_report_count": n_open,
            "total_views": view_counts.get(aid, 0),
            "total_accepts": acc_counts.get(aid, 0),
        })

    total = len(enriched)
    total_pages = max(1, (total + page_size - 1) // page_size)
    start = (page - 1) * page_size
    return {
        "items": enriched[start:start + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


# ── GET /api/admin/ads/reports ─────────────────────────────────────────────
# NOTE: must be registered before /{id} to avoid route conflict

@router.get("/reports")
async def list_admin_reports(
    status: Optional[str] = Query("open", description="open|reviewed|dismissed|all"),
    ad_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_admin: dict = Depends(get_current_admin),
):
    """List all farmer reports, optionally filtered by status or ad."""
    q = (
        supabase.table("ad_reports")
        .select(
            "*, ads!ad_id(crop, exporter_profile_id, exporter_profiles!exporter_profile_id(company_name)),"
            "farmer:users!farmer_id(id, name, district)"
        )
    )
    if status and status != "all":
        q = q.eq("status", status)
    if ad_id:
        q = q.eq("ad_id", ad_id)

    q = q.order("created_at", desc=True)
    start = (page - 1) * page_size
    end = start + page_size - 1
    res = q.range(start, end).execute()
    rows = res.data or []

    # Sanitize farmer NIC (belt-and-suspenders)
    for r in rows:
        farmer = r.get("farmer") or {}
        _sanitize_user(farmer)

    return {"items": rows, "total": len(rows), "page": page, "page_size": page_size}


# ── GET /api/admin/ads/{id} ────────────────────────────────────────────────

@router.get("/{id}")
async def get_admin_ad_detail(
    id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Full ad detail: live version, exporter summary, stats, reports, moderation history.
    Never returns exporter passwords or farmer NIC.
    """
    ad_res = (
        supabase.table("ads")
        .select(
            "*, exporter_profiles!exporter_profile_id("
            "  id, company_name, status, email, phone, contact_person,"
            "  certifications, districts_served, crops_bought"
            ")"
        )
        .eq("id", id)
        .maybe_single()
        .execute()
    )
    if not ad_res or not ad_res.data:
        raise HTTPException(status_code=404, detail="Advertisement not found.")

    ad = ad_res.data

    # Fetch all versions
    vers_res = (
        supabase.table("ad_versions")
        .select("*")
        .eq("ad_id", id)
        .order("version_number", desc=True)
        .execute()
    )
    versions = vers_res.data or []
    admin_state = _compute_admin_state(ad, versions)

    # Latest published version
    pub = [v for v in versions if v.get("status") == "published"]
    live_ver = pub[0] if pub else (versions[0] if versions else None)

    # Reports
    rpt_res = (
        supabase.table("ad_reports")
        .select("*, farmer:users!farmer_id(id, name, district)")
        .eq("ad_id", id)
        .order("created_at", desc=True)
        .execute()
    )
    reports = rpt_res.data or []
    for r in reports:
        _sanitize_user(r.get("farmer"))

    # Moderation log
    mod_res = (
        supabase.table("ad_moderation_log")
        .select("*, admin_user:users!admin_user_id(id, name, email)")
        .eq("ad_id", id)
        .order("created_at", desc=True)
        .execute()
    )
    mod_log = mod_res.data or []
    for m in mod_log:
        _sanitize_user(m.get("admin_user"))

    # Views & accepts summary
    view_res = supabase.table("ad_views").select("farmer_id").eq("ad_id", id).execute()
    all_views = view_res.data or []
    total_views = len(all_views)
    unique_viewers = len({v["farmer_id"] for v in all_views})

    acc_res = supabase.table("ad_acceptances").select("id, withdrawn_at").eq("ad_id", id).execute()
    all_acc = acc_res.data or []
    total_acc = len(all_acc)
    active_acc = len([a for a in all_acc if not a.get("withdrawn_at")])

    exporter = ad.pop("exporter_profiles", None) or {}

    return {
        "id": id,
        "crop": ad["crop"],
        "status": ad["status"],
        "admin_state": admin_state,
        "closed_reason": ad.get("closed_reason"),
        "closed_at": ad.get("closed_at"),
        "created_at": ad["created_at"],
        "updated_at": ad["updated_at"],
        "live_version": live_ver,
        "all_versions": versions,
        "exporter": exporter,
        "stats": {
            "total_views": total_views,
            "unique_viewers": unique_viewers,
            "total_accepts": total_acc,
            "active_accepts": active_acc,
        },
        "reports": reports,
        "moderation_log": mod_log,
    }


# ── POST /api/admin/ads/{id}/takedown ────────────────────────────────────────

@router.post("/{id}/takedown")
async def takedown_ad(
    id: str,
    body: TakedownRequest,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Takedown a published ad.
    - Sets ads.status = 'closed' and closed_reason = 'taken_down: <reason>'.
    - Writes a moderation log row.
    - Marks all open reports for this ad as 'reviewed'.
    - Does NOT touch acceptances or approved links.
    All three writes happen in sequence; if any fails the next one is not attempted
    (Supabase JS SDK does not expose multi-statement transactions over REST).
    """
    reason = body.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Takedown reason cannot be empty.")

    ad_res = supabase.table("ads").select("id, status").eq("id", id).maybe_single().execute()
    if not ad_res or not ad_res.data:
        raise HTTPException(status_code=404, detail="Advertisement not found.")
    ad = ad_res.data

    if ad["status"] != "published":
        raise HTTPException(
            status_code=400,
            detail=f"Takedown is only allowed for published ads. Current status: '{ad['status']}'.",
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    admin_id = current_admin["sub"]

    # 1. Close the ad
    upd = (
        supabase.table("ads")
        .update({
            "status": "closed",
            "closed_at": now_iso,
            "closed_reason": f"taken_down: {reason}",
        })
        .eq("id", id)
        .execute()
    )
    if not upd.data:
        raise HTTPException(status_code=500, detail="Failed to close advertisement.")

    # 2. Log the action
    supabase.table("ad_moderation_log").insert({
        "ad_id": id,
        "admin_user_id": admin_id,
        "action": "takedown",
        "reason": reason,
    }).execute()

    # 3. Mark open reports as reviewed
    supabase.table("ad_reports").update({
        "status": "reviewed",
        "reviewed_by": admin_id,
        "reviewed_at": now_iso,
    }).eq("ad_id", id).eq("status", "open").execute()

    return {"status": "ok", "message": "Advertisement taken down.", "ad_id": id, "reason": reason}


# ── POST /api/admin/ads/{id}/restore ─────────────────────────────────────────

@router.post("/{id}/restore")
async def restore_ad(
    id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """
    Restore a taken-down ad.
    Allowed only if:
    1. The latest moderation log action for this ad is 'takedown' (not a regular exporter close).
    2. The live published version has not expired.
    Sets status back to 'published' and clears closed_at/closed_reason.
    """
    ad_res = supabase.table("ads").select("id, status, closed_reason").eq("id", id).maybe_single().execute()
    if not ad_res or not ad_res.data:
        raise HTTPException(status_code=404, detail="Advertisement not found.")
    ad = ad_res.data

    if ad["status"] != "closed":
        raise HTTPException(status_code=400, detail="Advertisement is not closed.")

    cr = ad.get("closed_reason") or ""
    if not cr.startswith("taken_down:"):
        raise HTTPException(
            status_code=400,
            detail="This advertisement was closed by the exporter, not by an admin takedown. It cannot be restored.",
        )

    # Verify via moderation log
    log_res = (
        supabase.table("ad_moderation_log")
        .select("action")
        .eq("ad_id", id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    log_entries = log_res.data or []
    if not log_entries or log_entries[0].get("action") != "takedown":
        raise HTTPException(status_code=400, detail="No takedown record found for this advertisement.")

    # Check expiry of the live version
    ver_res = (
        supabase.table("ad_versions")
        .select("expires_at")
        .eq("ad_id", id)
        .eq("status", "published")
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if not ver_res or not ver_res.data:
        raise HTTPException(status_code=400, detail="No published version to restore to.")

    live_ver = ver_res.data[0]
    exp_str = live_ver.get("expires_at")
    if exp_str:
        try:
            exp_dt = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
            if exp_dt.tzinfo is None:
                exp_dt = exp_dt.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > exp_dt:
                raise HTTPException(
                    status_code=400,
                    detail="The published version has expired. The ad cannot be restored.",
                )
        except HTTPException:
            raise
        except Exception:
            pass

    # Restore
    upd = (
        supabase.table("ads")
        .update({"status": "published", "closed_at": None, "closed_reason": None})
        .eq("id", id)
        .execute()
    )
    if not upd.data:
        raise HTTPException(status_code=500, detail="Failed to restore advertisement.")

    # Log
    supabase.table("ad_moderation_log").insert({
        "ad_id": id,
        "admin_user_id": current_admin["sub"],
        "action": "restore",
        "reason": None,
    }).execute()

    return {"status": "ok", "message": "Advertisement restored to published.", "ad_id": id}


# ── POST /api/admin/ads/reports/{id}/dismiss ──────────────────────────────────

@router.post("/reports/{report_id}/dismiss")
async def dismiss_report(
    report_id: str,
    current_admin: dict = Depends(get_current_admin),
):
    """Mark a report as dismissed."""
    now_iso = datetime.now(timezone.utc).isoformat()
    upd = (
        supabase.table("ad_reports")
        .update({"status": "dismissed", "reviewed_by": current_admin["sub"], "reviewed_at": now_iso})
        .eq("id", report_id)
        .execute()
    )
    if not upd.data:
        raise HTTPException(status_code=404, detail="Report not found.")
    return {"status": "ok", "report_id": report_id, "new_status": "dismissed"}


# ── POST /api/admin/ads/reports/{id}/review ───────────────────────────────────

@router.post("/reports/{report_id}/review")
async def review_report(
    report_id: str,
    body: ReviewRequest = ReviewRequest(),
    current_admin: dict = Depends(get_current_admin),
):
    """Mark a report as reviewed (acknowledged, no action taken)."""
    now_iso = datetime.now(timezone.utc).isoformat()
    upd = (
        supabase.table("ad_reports")
        .update({"status": "reviewed", "reviewed_by": current_admin["sub"], "reviewed_at": now_iso})
        .eq("id", report_id)
        .execute()
    )
    if not upd.data:
        raise HTTPException(status_code=404, detail="Report not found.")
    return {"status": "ok", "report_id": report_id, "new_status": "reviewed"}
