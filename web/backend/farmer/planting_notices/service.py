"""
Farmer planting notice service.
Handles:
- Visible notices for farmer (published, target month upcoming, approved exporter link, eligible district)
- Notice detail with exporter public profile and standard stages
- Farmer's own plots
- Atomic respond handler: updates response and active binding with conflict detection
"""
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timezone
from fastapi import HTTPException
from db.supabase import supabase


def _get_farmer_approved_exporter_profiles(farmer_id: str) -> List[str]:
    """Returns exporter_profile_ids where farmer has an approved link."""
    res = (
        supabase.table("farmer_exporter_links")
        .select("exporter_profile_id")
        .eq("farmer_id", farmer_id)
        .eq("status", "approved")
        .execute()
    )
    return [str(r["exporter_profile_id"]) for r in (res.data or [])]


def _get_farmer_district(farmer_id: str) -> str:
    res = (
        supabase.table("users")
        .select("district")
        .eq("id", farmer_id)
        .maybe_single()
        .execute()
    )
    return (res.data or {}).get("district") or ""


def list_farmer_notices(farmer_id: str, page: int = 1, page_size: int = 10) -> dict:
    exporter_profile_ids = _get_farmer_approved_exporter_profiles(farmer_id)
    if not exporter_profile_ids:
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 1}

    farmer_district = _get_farmer_district(farmer_id)
    today = datetime.now(timezone.utc).date()
    today_iso = today.isoformat()

    # Query published notices from approved exporters where target_month is in the future
    res = (
        supabase.table("planting_notices")
        .select(
            "*, exporter_profiles!exporter_profile_id(company_name, logo_url)"
        )
        .in_("exporter_profile_id", exporter_profile_ids)
        .eq("status", "published")
        .gt("target_month", today_iso)
        .order("target_month", desc=False)
        .execute()
    )
    all_notices = res.data or []

    # Fetch farmer's existing replies
    notice_ids = [n["id"] for n in all_notices]
    replies_map = {}
    if notice_ids:
        rep_res = (
            supabase.table("planting_notice_responses")
            .select("notice_id, response, expected_volume_kg, plot_id")
            .eq("farmer_id", farmer_id)
            .in_("notice_id", notice_ids)
            .execute()
        )
        for r in (rep_res.data or []):
            replies_map[r["notice_id"]] = r

    eligible = []
    for n in all_notices:
        # District check: empty list = all districts
        allowed_districts = n.get("eligible_districts") or []
        if allowed_districts and farmer_district not in allowed_districts:
            continue

        exp = n.get("exporter_profiles") or {}
        user_reply = replies_map.get(n["id"])

        eligible.append({
            "id": n["id"],
            "crop": n["crop"],
            "target_month": n["target_month"],
            "volume_needed_kg": float(n["volume_needed_kg"]),
            "title": n["title"],
            "exporter_name": exp.get("company_name") or "Exporter",
            "exporter_logo_url": exp.get("logo_url"),
            "farmer_response": user_reply["response"] if user_reply else None,
            "expected_volume_kg": float(user_reply["expected_volume_kg"]) if (user_reply and user_reply.get("expected_volume_kg")) else None,
            "plot_id": user_reply.get("plot_id") if user_reply else None,
            "published_at": n["published_at"] or n["created_at"],
        })

    total = len(eligible)
    total_pages = max(1, (total + page_size - 1) // page_size)
    start = (page - 1) * page_size
    return {
        "items": eligible[start:start + page_size],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


def get_farmer_notice_detail(notice_id: str, farmer_id: str) -> dict:
    """Returns notice detail with standard stages and farmer reply, or 404."""
    exporter_profile_ids = _get_farmer_approved_exporter_profiles(farmer_id)
    if not exporter_profile_ids:
        raise HTTPException(status_code=404, detail="Planting notice not found.")

    res = (
        supabase.table("planting_notices")
        .select(
            "*, exporter_profiles!exporter_profile_id(company_name, logo_url),"
            "standards:quality_standard_versions!standard_version_id(id, name, version_number)"
        )
        .eq("id", notice_id)
        .eq("status", "published")
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Planting notice not found.")

    notice = res.data
    if str(notice["exporter_profile_id"]) not in exporter_profile_ids:
        raise HTTPException(status_code=404, detail="Planting notice not found.")

    farmer_district = _get_farmer_district(farmer_id)
    allowed = notice.get("eligible_districts") or []
    if allowed and farmer_district not in allowed:
        raise HTTPException(status_code=404, detail="Planting notice not found.")

    # Fetch stages for the linked standard version
    std_v_id = notice["standard_version_id"]
    stages_res = (
        supabase.table("quality_standard_stages")
        .select("id, position, name, instructions")
        .eq("version_id", std_v_id)
        .order("position", desc=False)
        .execute()
    )
    stages = [
        {
            "id": s["id"],
            "stage_order": s.get("position", 1),
            "name": s.get("name", ""),
            "description": (s.get("instructions") or {}).get("en") if isinstance(s.get("instructions"), dict) else str(s.get("instructions") or ""),
            "rules_count": 0,
        }
        for s in (stages_res.data or [])
    ]

    # Current farmer response
    rep_res = (
        supabase.table("planting_notice_responses")
        .select("response, expected_volume_kg, plot_id")
        .eq("notice_id", notice_id)
        .eq("farmer_id", farmer_id)
        .maybe_single()
        .execute()
    )
    cur_rep = rep_res.data if rep_res else None

    exp = notice.get("exporter_profiles") or {}
    std = notice.get("standards") or {}

    return {
        "id": notice["id"],
        "crop": notice["crop"],
        "target_month": notice["target_month"],
        "volume_needed_kg": float(notice["volume_needed_kg"]),
        "title": notice["title"],
        "message": notice["message"],
        "published_at": notice["published_at"] or notice["created_at"],
        "exporter": {
            "company_name": exp.get("company_name") or "Exporter",
            "logo_url": exp.get("logo_url"),
        },
        "current_response": cur_rep["response"] if cur_rep else None,
        "current_expected_volume_kg": float(cur_rep["expected_volume_kg"]) if (cur_rep and cur_rep.get("expected_volume_kg")) else None,
        "current_plot_id": cur_rep.get("plot_id") if cur_rep else None,
        "standard_version_id": std_v_id,
        "standard_name": std.get("name") or "Standard",
        "standard_version_number": std.get("version_number") or 1,
        "stages": stages,
    }


def list_farmer_plots(farmer_id: str) -> List[dict]:
    """Returns the authenticated farmer's plots for reply selection."""
    res = (
        supabase.table("plot")
        .select("id, name, area_ha, district, dsd, gn_division")
        .eq("owner_user_id", farmer_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [
        {
            "id": str(p["id"]),
            "name": p.get("name") or "Plot",
            "area_ha": float(p.get("area_ha") or 0.0),
            "district": p.get("district"),
            "dsd": p.get("dsd"),
            "gn_division": p.get("gn_division"),
        }
        for p in (res.data or [])
    ]


def respond_to_notice(notice_id: str, farmer_id: str, data: dict) -> dict:
    """
    Submits or updates farmer response and maintains binding in single operation.
    Enforces:
    - Notice visibility to farmer
    - Season lock: today < target_month
    - Ready: plot must belong to farmer, expected volume > 0, no binding conflict
    - Cannot: expected volume and plot null, releases existing binding
    - Idempotency
    """
    # 1. Verify notice visibility
    notice = get_farmer_notice_detail(notice_id, farmer_id)

    # 2. Check lock: first day of target month
    today = datetime.now(timezone.utc).date()
    target_date = date.fromisoformat(notice["target_month"])
    if today >= target_date:
        raise HTTPException(
            status_code=409,
            detail="Replies are locked because the target planting month has already started.",
        )

    response_val = data["response"]
    exp_vol = data.get("expected_volume_kg")
    plot_id = data.get("plot_id")
    season = notice["target_month"][:7]  # e.g. "2026-11"
    crop = notice["crop"]
    std_v_id = notice["standard_version_id"]
    now_iso = datetime.now(timezone.utc).isoformat()

    if response_val == "ready":
        if not exp_vol or float(exp_vol) <= 0:
            raise HTTPException(status_code=400, detail="Expected volume in kg (> 0) is required when responding Ready.")
        if not plot_id:
            raise HTTPException(status_code=400, detail="A plot must be selected when responding Ready.")

        # Verify plot ownership
        plot_res = (
            supabase.table("plot")
            .select("id, owner_user_id")
            .eq("id", plot_id)
            .maybe_single()
            .execute()
        )
        if not plot_res or not plot_res.data:
            raise HTTPException(status_code=400, detail="Selected plot not found.")
        if str(plot_res.data["owner_user_id"]) != farmer_id:
            raise HTTPException(status_code=403, detail="The selected plot does not belong to your account.")

        # Check for active binding conflict: another notice already bound to this plot for this crop & season
        bind_res = (
            supabase.table("planting_bindings")
            .select("id, notice_id")
            .eq("plot_id", plot_id)
            .eq("crop", crop)
            .eq("season", season)
            .eq("status", "active")
            .maybe_single()
            .execute()
        )
        if bind_res and bind_res.data:
            existing_bind = bind_res.data
            if str(existing_bind["notice_id"]) != notice_id:
                raise HTTPException(
                    status_code=409,
                    detail="This plot is already committed to another planting notice for this crop and season.",
                )

        # 3. Upsert response
        upsert_payload = {
            "notice_id": notice_id,
            "farmer_id": farmer_id,
            "response": "ready",
            "expected_volume_kg": float(exp_vol),
            "plot_id": plot_id,
            "responded_at": now_iso,
            "updated_at": now_iso,
        }
        res_ins = (
            supabase.table("planting_notice_responses")
            .upsert(upsert_payload, on_conflict="notice_id,farmer_id")
            .execute()
        )
        if not res_ins.data:
            raise HTTPException(status_code=500, detail="Failed to save notice response.")

        # 4. Upsert/Record binding
        # If binding exists for this notice & farmer, reactivate or update plot
        existing_notice_bind = (
            supabase.table("planting_bindings")
            .select("id, plot_id, status")
            .eq("notice_id", notice_id)
            .eq("farmer_id", farmer_id)
            .maybe_single()
            .execute()
        )
        if existing_notice_bind and existing_notice_bind.data:
            b_row = existing_notice_bind.data
            # If plot changed, release old binding row first to prevent unique conflict
            if b_row.get("plot_id") != plot_id:
                supabase.table("planting_bindings").update({
                    "status": "released",
                    "released_at": now_iso,
                }).eq("id", b_row["id"]).execute()

                supabase.table("planting_bindings").insert({
                    "notice_id": notice_id,
                    "farmer_id": farmer_id,
                    "plot_id": plot_id,
                    "crop": crop,
                    "season": season,
                    "standard_version_id": std_v_id,
                    "status": "active",
                }).execute()
            else:
                # Same plot: ensure active
                supabase.table("planting_bindings").update({
                    "status": "active",
                    "released_at": None,
                }).eq("id", b_row["id"]).execute()
        else:
            supabase.table("planting_bindings").insert({
                "notice_id": notice_id,
                "farmer_id": farmer_id,
                "plot_id": plot_id,
                "crop": crop,
                "season": season,
                "standard_version_id": std_v_id,
                "status": "active",
            }).execute()

        msg = "You responded Ready. Your plot has been bound for this planting season."

    else:  # cannot
        upsert_payload = {
            "notice_id": notice_id,
            "farmer_id": farmer_id,
            "response": "cannot",
            "expected_volume_kg": None,
            "plot_id": None,
            "responded_at": now_iso,
            "updated_at": now_iso,
        }
        res_ins = (
            supabase.table("planting_notice_responses")
            .upsert(upsert_payload, on_conflict="notice_id,farmer_id")
            .execute()
        )
        if not res_ins.data:
            raise HTTPException(status_code=500, detail="Failed to save notice response.")

        # Release any active binding for this notice and farmer
        supabase.table("planting_bindings").update({
            "status": "released",
            "released_at": now_iso,
        }).eq("notice_id", notice_id).eq("farmer_id", farmer_id).eq("status", "active").execute()

        msg = "You responded Cannot for this season. Any previously bound plot has been released."

    return {
        "status": "ok",
        "notice_id": notice_id,
        "farmer_id": farmer_id,
        "response": response_val,
        "expected_volume_kg": float(exp_vol) if exp_vol else None,
        "plot_id": plot_id,
        "responded_at": now_iso,
        "message": msg,
    }
