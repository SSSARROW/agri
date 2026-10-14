from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone
from fastapi import HTTPException

from db.supabase import supabase
from exporter.farmers.service import (
    approve_farmer_link,
    decline_farmer_link,
    _get_farmer_plots_and_crops,
)


def _get_ad_and_target_qty(ad_id: str, exporter_profile_id: str) -> Tuple[dict, dict]:
    """
    Validates ad ownership and fetches latest published version.
    """
    ad_res = (
        supabase.table("ads")
        .select("id, exporter_profile_id, crop, status")
        .eq("id", ad_id)
        .maybe_single()
        .execute()
    )
    if not ad_res or not ad_res.data:
        raise HTTPException(status_code=404, detail="Advertisement not found.")

    ad = ad_res.data
    if str(ad["exporter_profile_id"]) != exporter_profile_id:
        raise HTTPException(status_code=404, detail="Advertisement not found.")

    ver_res = (
        supabase.table("ad_versions")
        .select("id, version_number, quantity_kg, title")
        .eq("ad_id", ad_id)
        .eq("status", "published")
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if not ver_res or not ver_res.data:
        # Fallback to any version
        any_ver_res = (
            supabase.table("ad_versions")
            .select("id, version_number, quantity_kg, title")
            .eq("ad_id", ad_id)
            .order("version_number", desc=True)
            .limit(1)
            .execute()
        )
        ver = any_ver_res.data[0] if (any_ver_res and any_ver_res.data) else {}
    else:
        ver = ver_res.data[0]

    return ad, ver


def list_ad_applicants(
    ad_id: str,
    exporter_profile_id: str,
    status: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    """
    Lists applicants for an exporter's buy request advertisement.
    Returns metrics and farmer applicant details.
    Phone is revealed only when derived_status == 'approved'.
    """
    # 1. Verify ad ownership and target quantity
    ad, ver = _get_ad_and_target_qty(ad_id, exporter_profile_id)
    target_qty = float(ver.get("quantity_kg") or 0.0)

    # 2. Fetch all acceptances for this ad
    acc_res = (
        supabase.table("ad_acceptances")
        .select("*")
        .eq("ad_id", ad_id)
        .order("accepted_at", desc=True)
        .execute()
    )
    all_acceptances = acc_res.data or []

    if not all_acceptances:
        return {
            "ad_id": ad_id,
            "crop": ad["crop"],
            "ad_title": ver.get("title") or {},
            "target_quantity_kg": target_qty,
            "approved_quantity_kg": 0.0,
            "pending_quantity_kg": 0.0,
            "remaining_quantity_kg": target_qty,
            "is_filled": False,
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 1,
        }

    farmer_ids = list({a["farmer_id"] for a in all_acceptances})
    link_ids = list({a["link_id"] for a in all_acceptances if a.get("link_id")})
    ver_ids = list({a["ad_version_id"] for a in all_acceptances if a.get("ad_version_id")})

    # 3. Batch-fetch farmer users (name, phone, district, dsd, gn_division, farm_size_ha)
    users_res = (
        supabase.table("users")
        .select("id, name, phone, district, dsd, gn_division, farm_size_ha")
        .in_("id", farmer_ids)
        .execute()
    )
    users_map = {u["id"]: u for u in (users_res.data or [])}

    # 4. Batch-fetch plots and crops
    plots_by_farmer, crops_by_farmer = _get_farmer_plots_and_crops(farmer_ids)

    # 5. Batch-fetch links
    links_res = (
        supabase.table("farmer_exporter_links")
        .select("id, status, decision_reason")
        .in_("id", link_ids)
        .execute()
    )
    links_map = {l["id"]: l for l in (links_res.data or [])}

    # 6. Batch-fetch version numbers
    vers_res = (
        supabase.table("ad_versions")
        .select("id, version_number")
        .in_("id", ver_ids)
        .execute()
    )
    vers_map = {v["id"]: v.get("version_number", 1) for v in (vers_res.data or [])}

    # 7. Compute metric sums across all non-withdrawn acceptances
    approved_qty = 0.0
    pending_qty = 0.0

    enriched_items = []
    for a in all_acceptances:
        fid = a["farmer_id"]
        user = users_map.get(fid) or {}
        link = links_map.get(a["link_id"]) or {}
        link_status = link.get("status") or "requested"
        supply_kg = float(a.get("supply_quantity_kg") or 0.0)

        # Derived status
        if a.get("withdrawn_at"):
            derived_status = "withdrawn"
        elif link_status == "requested":
            derived_status = "pending"
            pending_qty += supply_kg
        elif link_status == "approved":
            derived_status = "approved"
            approved_qty += supply_kg
        elif link_status == "declined":
            derived_status = "declined"
        elif link_status == "removed":
            derived_status = "removed"
        else:
            derived_status = link_status

        # Filter by search (farmer name)
        farmer_name = user.get("name") or "Farmer"
        if search and search.strip():
            if search.strip().lower() not in farmer_name.lower():
                continue

        # Filter by status
        if status and status.strip() and status.lower() != "all":
            if derived_status != status.strip().lower():
                continue

        # Prepare plots summary
        f_plots = plots_by_farmer.get(fid, [])
        f_crops = crops_by_farmer.get(fid, [])
        plot_summaries = [
            {
                "id": str(p["id"]),
                "name": p.get("name") or "Plot",
                "area_ha": p.get("area_ha"),
                "district": p.get("district"),
                "crops": list(f_crops),
            }
            for p in f_plots
        ]

        # Phone privacy: included ONLY if derived_status == 'approved'
        phone_val = user.get("phone") if derived_status == "approved" else None

        enriched_items.append({
            "acceptance_id": a["id"],
            "farmer_id": fid,
            "farmer_name": farmer_name,
            "farmer_district": user.get("district"),
            "dsd": user.get("dsd"),
            "gn_division": user.get("gn_division"),
            "farm_size_ha": user.get("farm_size_ha"),
            "plots": plot_summaries,
            "supply_quantity_kg": supply_kg,
            "accepted_at": a["accepted_at"],
            "withdrawn_at": a.get("withdrawn_at"),
            "derived_status": derived_status,
            "link_status": link_status,
            "ad_version_number": vers_map.get(a["ad_version_id"], 1),
            "terms_hash": a.get("terms_hash") or "",
            "phone": phone_val,
        })

    remaining_qty = max(0.0, target_qty - approved_qty)
    is_filled = approved_qty >= target_qty

    total = len(enriched_items)
    total_pages = max(1, (total + page_size - 1) // page_size)
    start_idx = (page - 1) * page_size
    paged_items = enriched_items[start_idx : start_idx + page_size]

    return {
        "ad_id": ad_id,
        "crop": ad["crop"],
        "ad_title": ver.get("title") or {},
        "target_quantity_kg": target_qty,
        "approved_quantity_kg": approved_qty,
        "pending_quantity_kg": pending_qty,
        "remaining_quantity_kg": remaining_qty,
        "is_filled": is_filled,
        "items": paged_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


def approve_ad_applicant(
    ad_id: str,
    acceptance_id: str,
    exporter_profile_id: str,
) -> dict:
    """
    Approves an applicant for a buy request ad:
    1. Validates ad ownership and applicant status (must be pending).
    2. Over-allocation check: approved + supply <= target_quantity.
    3. Delegates to Step 4's approve_farmer_link.
    4. Evaluates if ad is now filled; if filled, lazily sets ads.status = 'closed' with 'filled'.
    """
    # 1. Validate ad ownership
    ad, ver = _get_ad_and_target_qty(ad_id, exporter_profile_id)
    target_qty = float(ver.get("quantity_kg") or 0.0)

    # 2. Fetch acceptance
    acc_res = (
        supabase.table("ad_acceptances")
        .select("*")
        .eq("id", acceptance_id)
        .eq("ad_id", ad_id)
        .maybe_single()
        .execute()
    )
    if not acc_res or not acc_res.data:
        raise HTTPException(status_code=404, detail="Applicant acceptance record not found.")

    acc = acc_res.data
    if acc.get("withdrawn_at"):
        raise HTTPException(status_code=400, detail="Cannot approve: Applicant has withdrawn their acceptance.")

    link_id = acc["link_id"]

    # 3. Check link status
    link_res = (
        supabase.table("farmer_exporter_links")
        .select("id, status")
        .eq("id", link_id)
        .maybe_single()
        .execute()
    )
    link = link_res.data if link_res else {}
    if link.get("status") != "requested":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve an applicant with link status '{link.get('status')}'. Only pending applicants can be approved.",
        )

    supply_kg = float(acc.get("supply_quantity_kg") or 0.0)

    # 4. Over-allocation check
    current_approved_qty = 0.0
    all_acc = (
        supabase.table("ad_acceptances")
        .select("supply_quantity_kg, link_id, withdrawn_at")
        .eq("ad_id", ad_id)
        .is_("withdrawn_at", "null")
        .execute()
    ).data or []

    if all_acc:
        l_ids = list({a["link_id"] for a in all_acc if a.get("link_id")})
        links_data = (
            supabase.table("farmer_exporter_links")
            .select("id, status")
            .in_("id", l_ids)
            .execute()
        ).data or []
        approved_l_ids = {l["id"] for l in links_data if l.get("status") == "approved"}
        current_approved_qty = sum(
            float(a.get("supply_quantity_kg") or 0.0)
            for a in all_acc
            if a.get("link_id") in approved_l_ids
        )

    new_total = current_approved_qty + supply_kg
    if target_qty > 0 and new_total > target_qty:
        remaining_cap = max(0.0, target_qty - current_approved_qty)
        raise HTTPException(
            status_code=400,
            detail=f"Over-allocation: Approving this applicant ({supply_kg} kg) would cause total approved quantity ({new_total} kg) to exceed target quantity ({target_qty} kg). Remaining capacity is {remaining_cap} kg.",
        )

    # 5. Delegate to Step 4 approve_farmer_link
    approved_link = approve_farmer_link(link_id=link_id, exporter_profile_id=exporter_profile_id)

    # 6. Check if ad is now filled -> lazy persist ads.status = 'closed'
    if target_qty > 0 and new_total >= target_qty:
        now_iso = datetime.now(timezone.utc).isoformat()
        supabase.table("ads").update({
            "status": "closed",
            "closed_reason": "filled",
            "closed_at": now_iso,
        }).eq("id", ad_id).execute()

    return {
        "success": True,
        "message": "Applicant approved successfully.",
        "acceptance_id": acceptance_id,
        "derived_status": "approved",
        "new_approved_quantity_kg": new_total,
        "is_filled": target_qty > 0 and new_total >= target_qty,
    }


def decline_ad_applicant(
    ad_id: str,
    acceptance_id: str,
    exporter_profile_id: str,
    reason: Optional[str] = None,
) -> dict:
    """
    Declines an applicant for a buy request ad:
    1. Validates ad ownership and applicant status (must be pending).
    2. Delegates to Step 4's decline_farmer_link.
    """
    # 1. Validate ad ownership
    ad, _ = _get_ad_and_target_qty(ad_id, exporter_profile_id)

    # 2. Fetch acceptance
    acc_res = (
        supabase.table("ad_acceptances")
        .select("*")
        .eq("id", acceptance_id)
        .eq("ad_id", ad_id)
        .maybe_single()
        .execute()
    )
    if not acc_res or not acc_res.data:
        raise HTTPException(status_code=404, detail="Applicant acceptance record not found.")

    acc = acc_res.data
    if acc.get("withdrawn_at"):
        raise HTTPException(status_code=400, detail="Cannot decline: Applicant has already withdrawn.")

    link_id = acc["link_id"]

    # 3. Check link status
    link_res = (
        supabase.table("farmer_exporter_links")
        .select("id, status")
        .eq("id", link_id)
        .maybe_single()
        .execute()
    )
    link = link_res.data if link_res else {}
    if link.get("status") != "requested":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot decline an applicant with link status '{link.get('status')}'. Only pending applicants can be declined.",
        )

    # 4. Delegate to Step 4 decline_farmer_link
    declined_link = decline_farmer_link(
        link_id=link_id,
        exporter_profile_id=exporter_profile_id,
        reason=reason,
    )

    return {
        "success": True,
        "message": "Applicant declined successfully.",
        "acceptance_id": acceptance_id,
        "derived_status": "declined",
        "decision_reason": reason,
    }
