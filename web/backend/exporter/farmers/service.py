import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from fastapi import HTTPException
from db.supabase import supabase

def get_exporter_profile_id_for_user(user_id: str) -> str:
    """Find or create exporter_profiles row for user_id and return its id."""
    res = (
        supabase.table("exporter_profiles")
        .select("id")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if res and getattr(res, "data", None):
        return res.data["id"]

    # Seed profile if absent (matching exporter/router.py behavior)
    u_res = supabase.table("users").select("*").eq("id", user_id).maybe_single().execute()
    if not u_res or not getattr(u_res, "data", None):
        raise HTTPException(status_code=404, detail="Exporter user not found")
    user_row = u_res.data
    new_profile = {
        "user_id": user_row["id"],
        "company_name": user_row.get("business_name") or "",
        "business_reg_no": user_row.get("business_reg_no") or "",
        "export_licence_no": user_row.get("export_license_no"),
        "contact_person": user_row.get("name"),
        "phone": user_row.get("phone"),
        "email": user_row.get("email"),
        "status": "pending",
    }
    create_res = supabase.table("exporter_profiles").insert(new_profile).execute()
    if not create_res.data:
        raise HTTPException(status_code=500, detail="Failed to initialize exporter profile")
    return create_res.data[0]["id"]


def _get_farmer_plots_and_crops(farmer_ids: List[str]) -> Tuple[Dict[str, List[dict]], Dict[str, List[str]]]:
    """
    Given a list of farmer user IDs, batch-fetches their plots and computes
    distinct crops from batches and planting events.
    Returns:
        plots_by_farmer: {farmer_id: [plot_dict, ...]}
        crops_by_farmer: {farmer_id: [crop_str, ...]}
    """
    if not farmer_ids:
        return {}, {}

    # 1. Fetch plots for these farmers
    try:
        plots_res = (
            supabase.table("plot")
            .select("id, owner_user_id, name, area_ha, district, dsd, gn_division, plot_type, boundary_source, created_at")
            .in_("owner_user_id", farmer_ids)
            .execute()
        )
        plots = plots_res.data or []
    except Exception:
        plots = []

    plots_by_farmer: Dict[str, List[dict]] = {fid: [] for fid in farmer_ids}
    plot_to_farmer: Dict[str, str] = {}
    plot_ids: List[str] = []

    for p in plots:
        fid = str(p.get("owner_user_id"))
        pid = str(p.get("id"))
        plots_by_farmer.setdefault(fid, []).append(p)
        plot_to_farmer[pid] = fid
        plot_ids.append(pid)

    crops_by_farmer: Dict[str, set] = {fid: set() for fid in farmer_ids}

    # 2. Fetch crops from batches linked to these plots
    if plot_ids:
        try:
            batch_res = (
                supabase.table("batch")
                .select("plot_id, crop")
                .in_("plot_id", plot_ids)
                .execute()
            )
            for b in batch_res.data or []:
                crop = (b.get("crop") or "").strip()
                pid = str(b.get("plot_id"))
                if crop and pid in plot_to_farmer:
                    fid = plot_to_farmer[pid]
                    crops_by_farmer[fid].add(crop)
        except Exception:
            pass

        # 3. Fetch crops from planting events linked to these plots
        try:
            event_res = (
                supabase.table("event")
                .select("plot_id, payload")
                .eq("event_type", "planted")
                .in_("plot_id", plot_ids)
                .execute()
            )
            for ev in event_res.data or []:
                payload = ev.get("payload") or {}
                crop = (payload.get("crop") or "").strip()
                pid = str(ev.get("plot_id"))
                if crop and pid in plot_to_farmer:
                    fid = plot_to_farmer[pid]
                    crops_by_farmer[fid].add(crop)
        except Exception:
            pass

    sorted_crops_by_farmer = {
        fid: sorted(list(crops_set))
        for fid, crops_set in crops_by_farmer.items()
    }
    return plots_by_farmer, sorted_crops_by_farmer


def list_exporter_farmer_links(
    exporter_profile_id: str,
    status: Optional[str] = "requested",
    district: Optional[str] = None,
    crop: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    """
    Lists farmer links for this exporter with filtering and pagination.
    Default status: 'requested'.
    Phone numbers are included ONLY for 'approved' status.
    """
    # 1. Fetch pending count for UI badge (all requested links for this exporter)
    try:
        pending_res = (
            supabase.table("farmer_exporter_links")
            .select("id", count="exact")
            .eq("exporter_profile_id", exporter_profile_id)
            .eq("status", "requested")
            .execute()
        )
        pending_count = pending_res.count if pending_res.count is not None else len(pending_res.data or [])
    except Exception:
        pending_count = 0

    # 2. Query links for this exporter
    query = (
        supabase.table("farmer_exporter_links")
        .select("*")
        .eq("exporter_profile_id", exporter_profile_id)
    )

    if status and status.strip() and status != "all":
        query = query.eq("status", status.strip())

    links_res = query.order("requested_at", desc=True).execute()
    all_links = links_res.data or []

    if not all_links:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 1,
            "pending_count": pending_count,
        }

    # 3. Batch-fetch farmer users
    farmer_ids = list({str(l["farmer_id"]) for l in all_links})
    users_res = (
        supabase.table("users")
        .select("id, name, phone, district, dsd, gn_division, farm_address, farm_size_ha")
        .in_("id", farmer_ids)
        .execute()
    )
    users_map = {str(u["id"]): u for u in (users_res.data or [])}

    # 4. Batch-fetch plots and crops
    plots_by_farmer, crops_by_farmer = _get_farmer_plots_and_crops(farmer_ids)

    # 5. Build enriched items and apply filters (search, district, crop)
    enriched_items = []
    for link in all_links:
        fid = str(link["farmer_id"])
        user = users_map.get(fid)
        if not user:
            continue

        f_district = (user.get("district") or "").strip()
        f_name = (user.get("name") or "").strip()
        f_crops = crops_by_farmer.get(fid, [])
        f_plots = plots_by_farmer.get(fid, [])

        # Filter by search (farmer name)
        if search and search.strip():
            term = search.strip().lower()
            if term not in f_name.lower():
                continue

        # Filter by district
        if district and district.strip():
            target_dist = district.strip().lower()
            if target_dist not in f_district.lower():
                # Also check plot districts
                plot_districts = [(p.get("district") or "").lower() for p in f_plots]
                if not any(target_dist in pd for pd in plot_districts):
                    continue

        # Filter by crop
        if crop and crop.strip():
            target_crop = crop.strip().lower()
            if not any(target_crop in c.lower() for c in f_crops):
                continue

        # Phone is included ONLY if status == 'approved'
        is_approved = link.get("status") == "approved"
        phone_val = user.get("phone") if is_approved else None

        total_area = sum(float(p.get("area_ha") or 0.0) for p in f_plots)

        farmer_summary = {
            "id": fid,
            "name": f_name,
            "district": user.get("district"),
            "dsd": user.get("dsd"),
            "gn_division": user.get("gn_division"),
            "farm_address": user.get("farm_address"),
            "farm_size_ha": float(user["farm_size_ha"]) if user.get("farm_size_ha") is not None else None,
            "phone": phone_val,
            "crops": f_crops,
            "total_plots": len(f_plots),
            "total_plot_area_ha": round(total_area, 4),
        }

        enriched_items.append({
            "id": link["id"],
            "farmer_id": fid,
            "exporter_profile_id": link["exporter_profile_id"],
            "status": link["status"],
            "requested_at": link["requested_at"],
            "decided_at": link.get("decided_at"),
            "decision_reason": link.get("decision_reason"),
            "farmer": farmer_summary,
        })

    total = len(enriched_items)
    total_pages = max(1, (total + page_size - 1) // page_size)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paged_items = enriched_items[start_idx:end_idx]

    return {
        "items": paged_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "pending_count": pending_count,
    }


def get_farmer_link_detail(link_id: str, exporter_profile_id: str) -> dict:
    """
    Returns single farmer link detail with full farmer info, plots, and crops.
    404 if link does not exist or belongs to another exporter.
    Phone is included ONLY if status == 'approved'.
    """
    res = (
        supabase.table("farmer_exporter_links")
        .select("*")
        .eq("id", link_id)
        .maybe_single()
        .execute()
    )
    if not res or not getattr(res, "data", None):
        raise HTTPException(status_code=404, detail="Farmer link not found")

    link = res.data
    if str(link.get("exporter_profile_id")) != exporter_profile_id:
        raise HTTPException(status_code=404, detail="Farmer link not found")

    fid = str(link["farmer_id"])
    u_res = (
        supabase.table("users")
        .select("id, name, phone, district, dsd, gn_division, farm_address, farm_size_ha")
        .eq("id", fid)
        .maybe_single()
        .execute()
    )
    if not u_res or not getattr(u_res, "data", None):
        raise HTTPException(status_code=404, detail="Farmer record not found")
    user = u_res.data

    plots_by_farmer, crops_by_farmer = _get_farmer_plots_and_crops([fid])
    f_plots = plots_by_farmer.get(fid, [])
    f_crops = crops_by_farmer.get(fid, [])

    is_approved = link.get("status") == "approved"
    phone_val = user.get("phone") if is_approved else None

    total_area = sum(float(p.get("area_ha") or 0.0) for p in f_plots)

    farmer_summary = {
        "id": fid,
        "name": user.get("name") or "",
        "district": user.get("district"),
        "dsd": user.get("dsd"),
        "gn_division": user.get("gn_division"),
        "farm_address": user.get("farm_address"),
        "farm_size_ha": float(user["farm_size_ha"]) if user.get("farm_size_ha") is not None else None,
        "phone": phone_val,
        "crops": f_crops,
        "total_plots": len(f_plots),
        "total_plot_area_ha": round(total_area, 4),
    }

    plot_summaries = [
        {
            "id": str(p["id"]),
            "name": p.get("name"),
            "area_ha": float(p["area_ha"]) if p.get("area_ha") is not None else None,
            "district": p.get("district"),
            "dsd": p.get("dsd"),
            "gn_division": p.get("gn_division"),
            "plot_type": p.get("plot_type"),
            "boundary_source": p.get("boundary_source"),
        }
        for p in f_plots
    ]

    return {
        "id": link["id"],
        "farmer_id": fid,
        "exporter_profile_id": link["exporter_profile_id"],
        "status": link["status"],
        "requested_at": link["requested_at"],
        "decided_at": link.get("decided_at"),
        "decision_reason": link.get("decision_reason"),
        "farmer": farmer_summary,
        "plots": plot_summaries,
    }


def approve_farmer_link(link_id: str, exporter_profile_id: str) -> dict:
    """
    Transitions link from 'requested' -> 'approved'.
    Sets decided_at = now().
    409 Conflict if farmer already has another active link.
    """
    detail = get_farmer_link_detail(link_id, exporter_profile_id)
    current_status = detail.get("status")

    if current_status != "requested":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve a link with status '{current_status}'. Only 'requested' links can be approved."
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        update_res = (
            supabase.table("farmer_exporter_links")
            .update({
                "status": "approved",
                "decided_at": now_iso,
                "decision_reason": None,
            })
            .eq("id", link_id)
            .eq("exporter_profile_id", exporter_profile_id)
            .execute()
        )
    except Exception as exc:
        err_msg = str(exc)
        if "idx_farmer_exporter_links_active_farmer" in err_msg or "unique" in err_msg.lower() or "23505" in err_msg:
            raise HTTPException(
                status_code=409,
                detail="Conflict: This farmer already has an active link with an exporter."
            )
        raise HTTPException(status_code=500, detail=f"Failed to approve link: {err_msg}")

    if not update_res.data:
        raise HTTPException(status_code=500, detail="Failed to update farmer link to approved")

    return get_farmer_link_detail(link_id, exporter_profile_id)


def decline_farmer_link(link_id: str, exporter_profile_id: str, reason: Optional[str] = None) -> dict:
    """
    Transitions link from 'requested' -> 'declined'.
    Sets decided_at = now() and optional decision_reason.
    """
    detail = get_farmer_link_detail(link_id, exporter_profile_id)
    current_status = detail.get("status")

    if current_status != "requested":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot decline a link with status '{current_status}'. Only 'requested' links can be declined."
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    update_res = (
        supabase.table("farmer_exporter_links")
        .update({
            "status": "declined",
            "decided_at": now_iso,
            "decision_reason": reason,
        })
        .eq("id", link_id)
        .eq("exporter_profile_id", exporter_profile_id)
        .execute()
    )
    if not update_res.data:
        raise HTTPException(status_code=500, detail="Failed to update farmer link to declined")

    return get_farmer_link_detail(link_id, exporter_profile_id)


def remove_farmer_link(link_id: str, exporter_profile_id: str, reason: Optional[str] = None) -> dict:
    """
    Transitions link from 'approved' -> 'removed'.
    Sets decided_at = now() and optional decision_reason.
    """
    detail = get_farmer_link_detail(link_id, exporter_profile_id)
    current_status = detail.get("status")

    if current_status != "approved":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot remove a link with status '{current_status}'. Only 'approved' links can be removed."
        )

    now_iso = datetime.now(timezone.utc).isoformat()
    update_res = (
        supabase.table("farmer_exporter_links")
        .update({
            "status": "removed",
            "decided_at": now_iso,
            "decision_reason": reason,
        })
        .eq("id", link_id)
        .eq("exporter_profile_id", exporter_profile_id)
        .execute()
    )
    if not update_res.data:
        raise HTTPException(status_code=500, detail="Failed to update farmer link to removed")

    return get_farmer_link_detail(link_id, exporter_profile_id)
