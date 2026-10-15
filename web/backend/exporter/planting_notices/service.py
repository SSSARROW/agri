"""
Service layer for Exporter Planting Notices.
Implements:
- Computed notice state (draft | upcoming | past | cancelled)
- Exporter ownership isolation and verification checks
- Validation: future month (first day of month), standard ownership and matching crop, volume > 0, valid districts
- Cancellation and releasing active bindings
- Aggregating response counts and farmer responses
"""
import uuid
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime, date, timezone
from fastapi import HTTPException
from db.supabase import supabase
from exporter.ads.constants import VALID_CROPS, SRI_LANKA_DISTRICTS
from exporter.farmers.service import get_exporter_profile_id_for_user


def _normalize_target_month(target_month_str: str) -> str:
    """Ensures target month is in YYYY-MM-01 date format."""
    s = target_month_str.strip()
    if len(s) == 7:  # YYYY-MM
        s = f"{s}-01"
    try:
        d = date.fromisoformat(s)
        return d.replace(day=1).isoformat()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid target month format. Use YYYY-MM or YYYY-MM-01.")


def _validate_future_month(target_month_iso: str) -> None:
    """Requires target month to be in the future (at least next month)."""
    target = date.fromisoformat(target_month_iso)
    today = datetime.now(timezone.utc).date()
    # First day of the current month
    current_month_first = today.replace(day=1)
    if target <= current_month_first:
        raise HTTPException(
            status_code=400,
            detail=f"Target month must be in the future (at least next month). Provided: {target_month_iso[:7]}",
        )


def _validate_standard_version(standard_version_id: str, exporter_profile_id: str, crop: str) -> dict:
    """Validates that standard version is published, owned by exporter, and matches crop."""
    res = (
        supabase.table("quality_standard_versions")
        .select("id, standard_id, version_number, name, status, standards:quality_standards!standard_id(exporter_profile_id, crop, is_archived)")
        .eq("id", standard_version_id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=400, detail="Linked quality standard version not found.")

    v = res.data
    std = v.get("standards") or {}
    if str(std.get("exporter_profile_id")) != exporter_profile_id:
        raise HTTPException(status_code=400, detail="Quality standard does not belong to your company.")
    if (std.get("crop") or "").lower() != crop.lower():
        raise HTTPException(status_code=400, detail=f"Quality standard crop does not match notice crop '{crop}'.")
    if std.get("is_archived"):
        raise HTTPException(status_code=400, detail="Cannot link to an archived quality standard.")
    if v.get("status") != "published":
        raise HTTPException(status_code=400, detail="Linked quality standard version must be published.")

    return v


def _validate_districts(districts: List[str]) -> List[str]:
    cleaned = []
    for d in districts:
        d_clean = d.strip()
        if d_clean not in SRI_LANKA_DISTRICTS:
            raise HTTPException(status_code=400, detail=f"Invalid district '{d_clean}'.")
        if d_clean not in cleaned:
            cleaned.append(d_clean)
    return cleaned


def compute_notice_state(status: str, target_month_iso: str) -> str:
    """Computes notice state: draft | upcoming | past | cancelled."""
    if status == "draft":
        return "draft"
    if status == "cancelled":
        return "cancelled"

    target_date = date.fromisoformat(target_month_iso)
    today = datetime.now(timezone.utc).date()
    if today < target_date:
        return "upcoming"
    return "past"


def get_owned_notice(notice_id: str, exporter_profile_id: str) -> dict:
    """Returns notice row if owned by exporter, otherwise 404."""
    res = (
        supabase.table("planting_notices")
        .select("*")
        .eq("id", notice_id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Planting notice not found.")
    notice = res.data
    if str(notice["exporter_profile_id"]) != exporter_profile_id:
        raise HTTPException(status_code=404, detail="Planting notice not found.")
    return notice


def create_draft_notice(exporter_profile_id: str, data: dict) -> dict:
    crop = data["crop"].lower()
    if crop not in VALID_CROPS:
        raise HTTPException(status_code=400, detail=f"Invalid crop '{crop}'.")

    target_month = _normalize_target_month(data["target_month"])
    # Validate future month even for drafts as a best-effort, or at publish
    _validate_future_month(target_month)

    _validate_standard_version(data["standard_version_id"], exporter_profile_id, crop)
    districts = _validate_districts(data.get("eligible_districts") or [])

    title = data["title"]
    message = data["message"]
    if not title.get("en") or not title["en"].strip():
        raise HTTPException(status_code=400, detail="English title is required.")
    if not message.get("en") or not message["en"].strip():
        raise HTTPException(status_code=400, detail="English message is required.")

    row = {
        "exporter_profile_id": exporter_profile_id,
        "crop": crop,
        "status": "draft",
        "standard_version_id": data["standard_version_id"],
        "target_month": target_month,
        "volume_needed_kg": float(data["volume_needed_kg"]),
        "eligible_districts": districts,
        "title": title,
        "message": message,
    }
    ins = supabase.table("planting_notices").insert(row).execute()
    if not ins.data:
        raise HTTPException(status_code=500, detail="Failed to create planting notice.")
    return ins.data[0]


def update_draft_notice(notice_id: str, exporter_profile_id: str, data: dict) -> dict:
    notice = get_owned_notice(notice_id, exporter_profile_id)
    if notice["status"] != "draft":
        raise HTTPException(status_code=400, detail="Only draft planting notices can be edited.")

    updates = {}
    crop = data.get("crop", notice["crop"]).lower()
    if crop not in VALID_CROPS:
        raise HTTPException(status_code=400, detail=f"Invalid crop '{crop}'.")
    updates["crop"] = crop

    if "standard_version_id" in data and data["standard_version_id"]:
        _validate_standard_version(data["standard_version_id"], exporter_profile_id, crop)
        updates["standard_version_id"] = data["standard_version_id"]

    if "target_month" in data and data["target_month"]:
        tm = _normalize_target_month(data["target_month"])
        _validate_future_month(tm)
        updates["target_month"] = tm

    if "volume_needed_kg" in data and data["volume_needed_kg"] is not None:
        updates["volume_needed_kg"] = float(data["volume_needed_kg"])

    if "eligible_districts" in data and data["eligible_districts"] is not None:
        updates["eligible_districts"] = _validate_districts(data["eligible_districts"])

    if "title" in data and data["title"]:
        if not data["title"].get("en") or not data["title"]["en"].strip():
            raise HTTPException(status_code=400, detail="English title is required.")
        updates["title"] = data["title"]

    if "message" in data and data["message"]:
        if not data["message"].get("en") or not data["message"]["en"].strip():
            raise HTTPException(status_code=400, detail="English message is required.")
        updates["message"] = data["message"]

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    upd = supabase.table("planting_notices").update(updates).eq("id", notice_id).execute()
    return upd.data[0]


def publish_notice(notice_id: str, exporter_profile_id: str) -> dict:
    """Validates and transitions notice draft -> published."""
    notice = get_owned_notice(notice_id, exporter_profile_id)
    if notice["status"] != "draft":
        raise HTTPException(status_code=400, detail=f"Only draft notices can be published. Current status: '{notice['status']}'.")

    # Full validation
    _validate_future_month(notice["target_month"])
    _validate_standard_version(notice["standard_version_id"], exporter_profile_id, notice["crop"])
    if not notice["title"].get("en") or not notice["message"].get("en"):
        raise HTTPException(status_code=400, detail="English title and message are required for publication.")

    now_iso = datetime.now(timezone.utc).isoformat()
    upd = (
        supabase.table("planting_notices")
        .update({
            "status": "published",
            "published_at": now_iso,
            "updated_at": now_iso,
        })
        .eq("id", notice_id)
        .execute()
    )
    return upd.data[0]


def cancel_notice(notice_id: str, exporter_profile_id: str, reason: Optional[str]) -> dict:
    """Cancels a published notice and releases its active bindings."""
    notice = get_owned_notice(notice_id, exporter_profile_id)
    if notice["status"] != "published":
        raise HTTPException(status_code=400, detail=f"Only published notices can be cancelled. Current status: '{notice['status']}'.")

    now_iso = datetime.now(timezone.utc).isoformat()
    # 1. Update notice status
    upd = (
        supabase.table("planting_notices")
        .update({
            "status": "cancelled",
            "cancelled_at": now_iso,
            "cancelled_reason": reason.strip() if reason else None,
            "updated_at": now_iso,
        })
        .eq("id", notice_id)
        .execute()
    )

    # 2. Release active bindings
    supabase.table("planting_bindings").update({
        "status": "released",
        "released_at": now_iso,
    }).eq("notice_id", notice_id).eq("status", "active").execute()

    return upd.data[0]


def duplicate_notice(notice_id: str, exporter_profile_id: str) -> dict:
    """Creates a new draft copy of a notice."""
    orig = get_owned_notice(notice_id, exporter_profile_id)
    # Default target month to next month if original has passed
    target_month = orig["target_month"]
    try:
        _validate_future_month(target_month)
    except HTTPException:
        today = datetime.now(timezone.utc).date()
        next_month = (today.month % 12) + 1
        next_year = today.year + (1 if today.month == 12 else 0)
        target_month = date(next_year, next_month, 1).isoformat()

    row = {
        "exporter_profile_id": exporter_profile_id,
        "crop": orig["crop"],
        "status": "draft",
        "standard_version_id": orig["standard_version_id"],
        "target_month": target_month,
        "volume_needed_kg": float(orig["volume_needed_kg"]),
        "eligible_districts": orig.get("eligible_districts") or [],
        "title": orig["title"],
        "message": orig["message"],
    }
    ins = supabase.table("planting_notices").insert(row).execute()
    return ins.data[0]


def list_notices(
    exporter_profile_id: str,
    crop: Optional[str] = None,
    state: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    q = supabase.table("planting_notices").select(
        "*, standards:quality_standard_versions!standard_version_id(name, version_number)"
    ).eq("exporter_profile_id", exporter_profile_id)

    if crop and crop.strip() and crop != "all":
        q = q.eq("crop", crop.strip().lower())

    res = q.order("created_at", desc=True).execute()
    all_notices = res.data or []
    if not all_notices:
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 1}

    notice_ids = [n["id"] for n in all_notices]

    # Batch fetch responses to aggregate counts
    resp_res = (
        supabase.table("planting_notice_responses")
        .select("notice_id, response, expected_volume_kg")
        .in_("notice_id", notice_ids)
        .execute()
    )
    responses_by_notice: Dict[str, list] = {}
    for r in (resp_res.data or []):
        responses_by_notice.setdefault(r["notice_id"], []).append(r)

    # Fetch approved farmers count for this exporter
    links_res = (
        supabase.table("farmer_exporter_links")
        .select("farmer_id, farmer:users!farmer_id(district)")
        .eq("exporter_profile_id", exporter_profile_id)
        .eq("status", "approved")
        .execute()
    )
    approved_farmers = links_res.data or []

    enriched = []
    for n in all_notices:
        nid = n["id"]
        comp_state = compute_notice_state(n["status"], n["target_month"])
        if state and state.strip() and state != "all" and comp_state != state.strip().lower():
            continue

        std = n.get("standards") or {}
        n_responses = responses_by_notice.get(nid, [])

        ready_count = len([r for r in n_responses if r["response"] == "ready"])
        cannot_count = len([r for r in n_responses if r["response"] == "cannot"])
        expected_vol = sum(float(r["expected_volume_kg"] or 0) for r in n_responses if r["response"] == "ready")

        # Eligible farmers filtering
        eligible_districts = set(n.get("eligible_districts") or [])
        if eligible_districts:
            eligible_f = [
                f for f in approved_farmers
                if (f.get("farmer") or {}).get("district") in eligible_districts
            ]
        else:
            eligible_f = approved_farmers

        eligible_total = len(eligible_f)
        no_reply_count = max(0, eligible_total - (ready_count + cannot_count))

        vol_needed = float(n["volume_needed_kg"])
        vol_pct = (expected_vol / vol_needed * 100.0) if vol_needed > 0 else 0.0

        enriched.append({
            "id": nid,
            "exporter_profile_id": n["exporter_profile_id"],
            "crop": n["crop"],
            "status": n["status"],
            "computed_state": comp_state,
            "standard_version_id": n["standard_version_id"],
            "standard_name": std.get("name"),
            "standard_version_number": std.get("version_number"),
            "target_month": n["target_month"],
            "volume_needed_kg": vol_needed,
            "total_expected_volume_kg": round(expected_vol, 2),
            "volume_percentage": round(vol_pct, 1),
            "eligible_districts": n.get("eligible_districts") or [],
            "title": n["title"],
            "created_at": n["created_at"],
            "published_at": n.get("published_at"),
            "cancelled_at": n.get("cancelled_at"),
            "counts": {
                "ready": ready_count,
                "cannot": cannot_count,
                "no_reply": no_reply_count,
                "eligible_total": eligible_total,
            },
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


def get_notice_detail(notice_id: str, exporter_profile_id: str) -> dict:
    notice = get_owned_notice(notice_id, exporter_profile_id)
    comp_state = compute_notice_state(notice["status"], notice["target_month"])

    # Standard summary
    std_res = (
        supabase.table("quality_standard_versions")
        .select("name, version_number")
        .eq("id", notice["standard_version_id"])
        .maybe_single()
        .execute()
    )
    std = std_res.data or {}

    # Responses counts
    resp_res = (
        supabase.table("planting_notice_responses")
        .select("response, expected_volume_kg")
        .eq("notice_id", notice_id)
        .execute()
    )
    responses = resp_res.data or []
    ready_count = len([r for r in responses if r["response"] == "ready"])
    cannot_count = len([r for r in responses if r["response"] == "cannot"])
    expected_vol = sum(float(r["expected_volume_kg"] or 0) for r in responses if r["response"] == "ready")

    # Approved farmers count
    links_res = (
        supabase.table("farmer_exporter_links")
        .select("farmer_id, farmer:users!farmer_id(district)")
        .eq("exporter_profile_id", exporter_profile_id)
        .eq("status", "approved")
        .execute()
    )
    approved = links_res.data or []
    eligible_districts = set(notice.get("eligible_districts") or [])
    if eligible_districts:
        eligible_approved = [
            f for f in approved if (f.get("farmer") or {}).get("district") in eligible_districts
        ]
    else:
        eligible_approved = approved

    eligible_total = len(eligible_approved)
    no_reply_count = max(0, eligible_total - (ready_count + cannot_count))

    vol_needed = float(notice["volume_needed_kg"])
    vol_pct = (expected_vol / vol_needed * 100.0) if vol_needed > 0 else 0.0

    return {
        "id": notice["id"],
        "exporter_profile_id": notice["exporter_profile_id"],
        "crop": notice["crop"],
        "status": notice["status"],
        "computed_state": comp_state,
        "standard_version_id": notice["standard_version_id"],
        "standard_name": std.get("name"),
        "standard_version_number": std.get("version_number"),
        "target_month": notice["target_month"],
        "volume_needed_kg": vol_needed,
        "eligible_districts": notice.get("eligible_districts") or [],
        "title": notice["title"],
        "message": notice["message"],
        "published_at": notice.get("published_at"),
        "cancelled_at": notice.get("cancelled_at"),
        "cancelled_reason": notice.get("cancelled_reason"),
        "created_at": notice["created_at"],
        "updated_at": notice["updated_at"],
        "counts": {
            "ready": ready_count,
            "cannot": cannot_count,
            "no_reply": no_reply_count,
            "eligible_total": eligible_total,
        },
        "total_expected_volume_kg": round(expected_vol, 2),
        "volume_percentage": round(vol_pct, 1),
    }


def get_notice_responses(
    notice_id: str,
    exporter_profile_id: str,
    response_filter: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """Returns responses breakdown and per-farmer list for approved farmers."""
    notice = get_owned_notice(notice_id, exporter_profile_id)
    vol_needed = float(notice["volume_needed_kg"])

    # 1. Fetch all approved farmer links for this exporter
    links_res = (
        supabase.table("farmer_exporter_links")
        .select("farmer_id, farmer:users!farmer_id(id, name, phone, district)")
        .eq("exporter_profile_id", exporter_profile_id)
        .eq("status", "approved")
        .execute()
    )
    approved_links = links_res.data or []

    # Filter by eligible districts if restricted
    eligible_districts = set(notice.get("eligible_districts") or [])
    eligible_farmers_map = {}
    for link in approved_links:
        farmer = link.get("farmer") or {}
        fid = str(farmer.get("id"))
        f_dist = farmer.get("district")
        if eligible_districts and f_dist not in eligible_districts:
            continue
        eligible_farmers_map[fid] = farmer

    eligible_total = len(eligible_farmers_map)

    # 2. Fetch responses for this notice
    resp_res = (
        supabase.table("planting_notice_responses")
        .select("id, farmer_id, response, expected_volume_kg, plot_id, responded_at, plot:plot!plot_id(name, area_ha)")
        .eq("notice_id", notice_id)
        .execute()
    )
    responses_list = resp_res.data or []
    responses_by_farmer = {str(r["farmer_id"]): r for r in responses_list}

    # 3. Compute counts
    ready_count = 0
    cannot_count = 0
    total_expected_vol = 0.0

    for fid in eligible_farmers_map:
        r = responses_by_farmer.get(fid)
        if r:
            if r["response"] == "ready":
                ready_count += 1
                total_expected_vol += float(r.get("expected_volume_kg") or 0)
            elif r["response"] == "cannot":
                cannot_count += 1

    no_reply_count = max(0, eligible_total - (ready_count + cannot_count))
    vol_pct = (total_expected_vol / vol_needed * 100.0) if vol_needed > 0 else 0.0

    # 4. Build per-farmer row list
    farmer_rows = []
    search_term = (search or "").strip().lower()

    for fid, farmer in eligible_farmers_map.items():
        fname = farmer.get("name") or "Farmer"
        if search_term and search_term not in fname.lower():
            continue

        resp_row = responses_by_farmer.get(fid)
        plot_obj = (resp_row.get("plot") if resp_row else None) or {}

        resp_status = resp_row["response"] if resp_row else "no_reply"
        if response_filter and response_filter != "all" and resp_status != response_filter:
            continue

        farmer_rows.append({
            "farmer_id": fid,
            "farmer_name": fname,
            "district": farmer.get("district"),
            "phone": farmer.get("phone"),  # Included because farmer is approved
            "response": resp_status,
            "expected_volume_kg": float(resp_row["expected_volume_kg"]) if (resp_row and resp_row.get("expected_volume_kg")) else None,
            "plot_id": resp_row.get("plot_id") if resp_row else None,
            "plot_name": plot_obj.get("name") or ("Selected Plot" if resp_row and resp_row.get("plot_id") else None),
            "plot_area_ha": float(plot_obj.get("area_ha")) if plot_obj.get("area_ha") is not None else None,
            "responded_at": resp_row.get("responded_at") if resp_row else None,
        })

    # Sort: Ready first, then Cannot, then No Reply
    order_map = {"ready": 0, "cannot": 1, "no_reply": 2}
    farmer_rows.sort(key=lambda x: (order_map.get(x["response"], 3), x["farmer_name"]))

    total = len(farmer_rows)
    total_pages = max(1, (total + page_size - 1) // page_size)
    start = (page - 1) * page_size

    return {
        "notice_id": notice_id,
        "volume_needed_kg": vol_needed,
        "total_expected_volume_kg": round(total_expected_vol, 2),
        "volume_percentage": round(vol_pct, 1),
        "counts": {
            "ready": ready_count,
            "cannot": cannot_count,
            "no_reply": no_reply_count,
            "eligible_total": eligible_total,
        },
        "items": farmer_rows[start:start + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }
