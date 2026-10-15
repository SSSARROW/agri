"""
Exporter ad stats service.
Aggregates data from ad_views and ad_acceptances for a single ad.
Ownership check: 404 if ad does not belong to the exporter's profile.
Accessible to unverified exporters (read-only).
"""
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from db.supabase import supabase
from exporter.ads.service import compute_ad_status


def _get_owned_ad(ad_id: str, exporter_profile_id: str) -> tuple[dict, dict]:
    """
    Returns (ad_row, latest_version_row) or raises 404.
    Checks ownership. Does NOT require verified status.
    """
    ad_res = (
        supabase.table("ads")
        .select("id, exporter_profile_id, crop, status, closed_at, closed_reason")
        .eq("id", ad_id)
        .maybe_single()
        .execute()
    )
    if not ad_res or not ad_res.data:
        raise HTTPException(status_code=404, detail="Advertisement not found.")
    ad = ad_res.data
    if str(ad["exporter_profile_id"]) != exporter_profile_id:
        raise HTTPException(status_code=404, detail="Advertisement not found.")

    # Fetch all versions to compute status, then get the latest published
    vers_res = (
        supabase.table("ad_versions")
        .select("id, version_number, status, quantity_kg, expires_at")
        .eq("ad_id", ad_id)
        .order("version_number", desc=True)
        .execute()
    )
    versions = vers_res.data or []
    computed = compute_ad_status(ad, versions)

    # Latest published version (or latest any version as fallback)
    pub_versions = [v for v in versions if v.get("status") == "published"]
    live_ver = pub_versions[0] if pub_versions else (versions[0] if versions else {})

    ad["computed_status"] = computed
    return ad, live_ver


def get_ad_stats(
    ad_id: str,
    exporter_profile_id: str,
    days: Optional[int] = None,
) -> dict:
    ad, live_ver = _get_owned_ad(ad_id, exporter_profile_id)
    target_qty = float(live_ver.get("quantity_kg") or 0.0)

    # ── Views ──────────────────────────────────────────────────────────────
    views_res = (
        supabase.table("ad_views")
        .select("id, farmer_id, view_date")
        .eq("ad_id", ad_id)
        .execute()
    )
    all_views = views_res.data or []
    total_views = len(all_views)
    unique_viewers = len({v["farmer_id"] for v in all_views})

    # views-per-day series
    views_per_day = None
    if days and days > 0:
        series_map: dict[str, int] = {}
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()
        for v in all_views:
            d = v.get("view_date", "")
            if d >= cutoff:
                series_map[d] = series_map.get(d, 0) + 1
        views_per_day = [{"date": d, "views": c} for d, c in sorted(series_map.items())]

    # ── Accepts ────────────────────────────────────────────────────────────
    acc_res = (
        supabase.table("ad_acceptances")
        .select("id, farmer_id, supply_quantity_kg, link_id, withdrawn_at")
        .eq("ad_id", ad_id)
        .execute()
    )
    all_acc = acc_res.data or []

    link_ids = list({a["link_id"] for a in all_acc if a.get("link_id")})
    links_map: dict[str, str] = {}
    if link_ids:
        lnk_res = (
            supabase.table("farmer_exporter_links")
            .select("id, status")
            .in_("id", link_ids)
            .execute()
        )
        links_map = {l["id"]: l["status"] for l in (lnk_res.data or [])}

    total_acc = len(all_acc)
    pending_acc = 0
    approved_acc = 0
    declined_acc = 0
    withdrawn_acc = 0
    approved_qty = 0.0
    pending_qty = 0.0
    accepted_farmer_ids: set[str] = set()

    for a in all_acc:
        fid = a["farmer_id"]
        supply = float(a.get("supply_quantity_kg") or 0.0)
        if a.get("withdrawn_at"):
            withdrawn_acc += 1
            continue
        accepted_farmer_ids.add(fid)
        lnk_status = links_map.get(a.get("link_id", ""), "requested")
        if lnk_status == "requested":
            pending_acc += 1
            pending_qty += supply
        elif lnk_status == "approved":
            approved_acc += 1
            approved_qty += supply
        elif lnk_status in ("declined", "removed"):
            declined_acc += 1

    # view-to-accept rate: % of unique viewers who also have a non-withdrawn acceptance
    if unique_viewers > 0:
        viewer_ids = {v["farmer_id"] for v in all_views}
        view_to_accept = len(viewer_ids & accepted_farmer_ids) / unique_viewers * 100.0
    else:
        view_to_accept = 0.0

    filled_pct = (approved_qty / target_qty * 100.0) if target_qty > 0 else 0.0

    result = {
        "ad_id": ad_id,
        "computed_status": ad["computed_status"],
        "total_views": total_views,
        "unique_viewers": unique_viewers,
        "accepts": {
            "total": total_acc,
            "pending": pending_acc,
            "approved": approved_acc,
            "declined": declined_acc,
            "withdrawn": withdrawn_acc,
        },
        "view_to_accept_rate": round(view_to_accept, 2),
        "target_quantity_kg": target_qty,
        "approved_quantity_kg": approved_qty,
        "pending_quantity_kg": pending_qty,
        "filled_percentage": round(filled_pct, 2),
        "pending_count": pending_acc,
    }
    if views_per_day is not None:
        result["views_per_day"] = views_per_day
    return result
