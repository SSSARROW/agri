import json
import hashlib
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timezone
from fastapi import HTTPException

from db.supabase import supabase


def _parse_dt(dt_str: Optional[str]) -> datetime:
    if not dt_str:
        return datetime.min.replace(tzinfo=timezone.utc)
    d = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    if d.tzinfo is None:
        return d.replace(tzinfo=timezone.utc)
    return d


def compute_terms_hash(ad_version: dict, stages: List[dict]) -> str:
    """
    Computes a deterministic SHA256 hash of the terms, pricing, and standard stages
    presented to the farmer for acceptance.
    """
    canonical_payload = {
        "version_number": ad_version.get("version_number"),
        "title": ad_version.get("title") or {},
        "description": ad_version.get("description") or {},
        "grade_tier": ad_version.get("grade_tier") or "",
        "price_type": ad_version.get("price_type") or "",
        "price_fixed": float(ad_version["price_fixed"]) if ad_version.get("price_fixed") is not None else None,
        "price_min": float(ad_version["price_min"]) if ad_version.get("price_min") is not None else None,
        "price_max": float(ad_version["price_max"]) if ad_version.get("price_max") is not None else None,
        "collection_window_start": ad_version.get("collection_window_start") or "",
        "collection_window_end": ad_version.get("collection_window_end") or "",
        "pickup_location": ad_version.get("pickup_location") or "",
        "terms": ad_version.get("terms") or {},
        "stages": [
            {
                "position": s.get("position"),
                "name": s.get("name"),
                "timing_type": s.get("timing_type"),
                "start_offset_days": s.get("start_offset_days"),
                "instructions": s.get("instructions") or {},
                "dos": s.get("dos") or {},
                "donts": s.get("donts") or {},
            }
            for s in sorted(stages, key=lambda x: x.get("position", 0))
        ],
    }
    encoded = json.dumps(canonical_payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def get_farmer_districts(farmer_id: str) -> List[str]:
    """
    Returns unique non-empty districts associated with the farmer:
    from users.district and plot.district.
    """
    districts = set()

    # User primary district
    u_res = (
        supabase.table("users")
        .select("district")
        .eq("id", farmer_id)
        .maybe_single()
        .execute()
    )
    if u_res and u_res.data and u_res.data.get("district"):
        d = u_res.data["district"].strip()
        if d:
            districts.add(d)

    # Plot districts
    p_res = (
        supabase.table("plot")
        .select("district")
        .eq("owner_user_id", farmer_id)
        .execute()
    )
    for row in (p_res.data or []):
        if row.get("district"):
            d = row["district"].strip()
            if d:
                districts.add(d)

    return list(districts)


def is_district_eligible(farmer_districts: List[str], eligible_districts: List[str]) -> bool:
    """
    If eligible_districts is empty, any district is eligible.
    Otherwise, at least one of the farmer's districts must match.
    """
    if not eligible_districts:
        return True
    eligible_lower = {d.strip().lower() for d in eligible_districts if d and d.strip()}
    if not eligible_lower:
        return True
    return any(fd.strip().lower() in eligible_lower for fd in farmer_districts)


def get_approved_quantity_for_ad(ad_id: str) -> float:
    """
    Calculates total approved quantity (kg) for an ad from non-withdrawn acceptances
    where the linked farmer_exporter_links has status = 'approved'.
    """
    acc_res = (
        supabase.table("ad_acceptances")
        .select("supply_quantity_kg, link_id, withdrawn_at")
        .eq("ad_id", ad_id)
        .is_("withdrawn_at", "null")
        .execute()
    )
    acceptances = acc_res.data or []
    if not acceptances:
        return 0.0

    link_ids = list({a["link_id"] for a in acceptances if a.get("link_id")})
    if not link_ids:
        return 0.0

    links_res = (
        supabase.table("farmer_exporter_links")
        .select("id, status")
        .in_("id", link_ids)
        .execute()
    )
    approved_link_ids = {
        l["id"] for l in (links_res.data or []) if l.get("status") == "approved"
    }

    total_approved = sum(
        float(a.get("supply_quantity_kg") or 0.0)
        for a in acceptances
        if a.get("link_id") in approved_link_ids
    )
    return total_approved


def list_open_ads(
    farmer_id: str,
    crop: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    """
    Returns open ads for farmers:
    - Ad not closed
    - Has a published version
    - Expiry date is in the future
    - Approved quantity < target quantity (not filled)
    - Farmer's district is eligible
    """
    farmer_districts = get_farmer_districts(farmer_id)
    now = datetime.now(timezone.utc)

    # 1. Fetch ads
    q = (
        supabase.table("ads")
        .select("id, exporter_profile_id, crop, status, created_at, updated_at")
        .neq("status", "closed")
    )
    if crop and crop.strip() and crop.lower() != "all":
        q = q.eq("crop", crop.strip().lower())

    ads_res = q.order("created_at", desc=True).execute()
    raw_ads = ads_res.data or []
    if not raw_ads:
        return {"items": [], "total": 0, "page": page, "page_size": page_size, "total_pages": 1}

    ad_ids = [a["id"] for a in raw_ads]
    exporter_ids = list({a["exporter_profile_id"] for a in raw_ads})

    # 2. Batch-fetch exporter profiles (verified only, no contact details)
    exp_res = (
        supabase.table("exporter_profiles")
        .select("id, company_name, description, logo_url, certifications, status")
        .in_("id", exporter_ids)
        .execute()
    )
    exporter_map = {
        e["id"]: e for e in (exp_res.data or []) if e.get("status") == "verified"
    }

    # 3. Batch-fetch published versions for these ads
    ver_res = (
        supabase.table("ad_versions")
        .select("*")
        .in_("ad_id", ad_ids)
        .eq("status", "published")
        .order("version_number", desc=True)
        .execute()
    )
    # Map latest published version per ad
    latest_versions: Dict[str, dict] = {}
    for v in (ver_res.data or []):
        aid = v["ad_id"]
        if aid not in latest_versions:
            latest_versions[aid] = v

    # 4. Batch-fetch acceptances for these ads to compute approved quantity
    acc_res = (
        supabase.table("ad_acceptances")
        .select("ad_id, supply_quantity_kg, link_id, withdrawn_at")
        .in_("ad_id", ad_ids)
        .is_("withdrawn_at", "null")
        .execute()
    )
    all_acc = acc_res.data or []
    link_ids = list({a["link_id"] for a in all_acc if a.get("link_id")})
    approved_link_ids = set()
    if link_ids:
        links_res = (
            supabase.table("farmer_exporter_links")
            .select("id, status")
            .in_("id", link_ids)
            .execute()
        )
        approved_link_ids = {
            l["id"] for l in (links_res.data or []) if l.get("status") == "approved"
        }

    approved_by_ad: Dict[str, float] = {aid: 0.0 for aid in ad_ids}
    for a in all_acc:
        if a.get("link_id") in approved_link_ids:
            aid = a["ad_id"]
            approved_by_ad[aid] = approved_by_ad.get(aid, 0.0) + float(a.get("supply_quantity_kg") or 0.0)

    # 5. Filter open ads
    open_items = []
    for ad in raw_ads:
        aid = ad["id"]
        exp = exporter_map.get(ad["exporter_profile_id"])
        if not exp:
            continue

        ver = latest_versions.get(aid)
        if not ver:
            continue

        # Check expiry
        exp_dt = _parse_dt(ver.get("expires_at"))
        if now > exp_dt:
            continue

        target_qty = float(ver.get("quantity_kg") or 0.0)
        approved_qty = approved_by_ad.get(aid, 0.0)

        # Check filled status
        if approved_qty >= target_qty:
            continue

        # Check district eligibility
        elig_districts = ver.get("eligible_districts") or []
        if not is_district_eligible(farmer_districts, elig_districts):
            continue

        remaining_qty = max(0.0, target_qty - approved_qty)

        open_items.append({
            "id": aid,
            "crop": ad["crop"],
            "grade_tier": ver.get("grade_tier") or "",
            "quantity_kg": target_qty,
            "approved_quantity_kg": approved_qty,
            "remaining_quantity_kg": remaining_qty,
            "price_type": ver.get("price_type") or "fixed",
            "price_fixed": ver.get("price_fixed"),
            "price_min": ver.get("price_min"),
            "price_max": ver.get("price_max"),
            "collection_window_start": ver.get("collection_window_start") or "",
            "collection_window_end": ver.get("collection_window_end") or "",
            "pickup_location": ver.get("pickup_location"),
            "eligible_districts": elig_districts,
            "expires_at": ver.get("expires_at") or "",
            "title": ver.get("title") or {},
            "exporter": {
                "company_name": exp.get("company_name") or "Exporter",
                "description": exp.get("description"),
                "logo_url": exp.get("logo_url"),
                "certifications": exp.get("certifications") or [],
            },
        })

    total = len(open_items)
    total_pages = max(1, (total + page_size - 1) // page_size)
    start_idx = (page - 1) * page_size
    paged_items = open_items[start_idx : start_idx + page_size]

    return {
        "items": paged_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


def get_open_ad_detail(ad_id: str, farmer_id: str) -> dict:
    """
    Returns full live version of the ad:
    - Title & description in all languages
    - Pricing, dates, logistics, commercial terms
    - Linked published quality standard version and stages
    - Canonical terms_hash computed server-side
    """
    # 1. Fetch ad
    ad_res = (
        supabase.table("ads")
        .select("id, exporter_profile_id, crop, status, created_at, updated_at")
        .eq("id", ad_id)
        .maybe_single()
        .execute()
    )
    if not ad_res or not ad_res.data:
        raise HTTPException(status_code=404, detail="Advertisement not found.")

    ad = ad_res.data
    if ad.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Advertisement is closed.")

    # 2. Fetch latest published version
    ver_res = (
        supabase.table("ad_versions")
        .select("*")
        .eq("ad_id", ad_id)
        .eq("status", "published")
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if not ver_res or not ver_res.data:
        raise HTTPException(status_code=404, detail="No published version available for this advertisement.")

    ver = ver_res.data[0]

    # Expiry check
    now = datetime.now(timezone.utc)
    exp_dt = _parse_dt(ver.get("expires_at"))
    if now > exp_dt:
        raise HTTPException(status_code=400, detail="Advertisement has expired.")

    # Exporter public profile
    exp_res = (
        supabase.table("exporter_profiles")
        .select("company_name, description, logo_url, certifications, status")
        .eq("id", ad["exporter_profile_id"])
        .maybe_single()
        .execute()
    )
    exp = exp_res.data or {}

    # Target & approved quantity
    target_qty = float(ver.get("quantity_kg") or 0.0)
    approved_qty = get_approved_quantity_for_ad(ad_id)
    remaining_qty = max(0.0, target_qty - approved_qty)

    # 3. Fetch linked published quality standard version
    std_v_id = ver.get("standard_version_id")
    std_ver_res = (
        supabase.table("quality_standard_versions")
        .select("id, standard_id, version_number, name, status, grade_spec")
        .eq("id", std_v_id)
        .maybe_single()
        .execute()
    )
    std_ver = std_ver_res.data if std_ver_res else {}

    # 4. Fetch stages for this standard version
    stages_res = (
        supabase.table("quality_standard_stages")
        .select("*")
        .eq("version_id", std_v_id)
        .order("position", desc=False)
        .execute()
    )
    stages = stages_res.data or []

    # 5. Compute server terms hash
    terms_hash = compute_terms_hash(ver, stages)

    return {
        "id": ad["id"],
        "crop": ad["crop"],
        "status": ad["status"],
        "computed_status": "live",
        "ad_version_id": ver["id"],
        "version_number": ver["version_number"],
        "title": ver.get("title") or {},
        "description": ver.get("description") or {},
        "grade_tier": ver.get("grade_tier") or "",
        "quantity_kg": target_qty,
        "approved_quantity_kg": approved_qty,
        "remaining_quantity_kg": remaining_qty,
        "price_type": ver.get("price_type") or "fixed",
        "price_fixed": ver.get("price_fixed"),
        "price_min": ver.get("price_min"),
        "price_max": ver.get("price_max"),
        "collection_window_start": ver.get("collection_window_start") or "",
        "collection_window_end": ver.get("collection_window_end") or "",
        "pickup_location": ver.get("pickup_location"),
        "eligible_districts": ver.get("eligible_districts") or [],
        "terms": ver.get("terms") or {},
        "expires_at": ver.get("expires_at") or "",
        "exporter": {
            "company_name": exp.get("company_name") or "Exporter",
            "description": exp.get("description"),
            "logo_url": exp.get("logo_url"),
            "certifications": exp.get("certifications") or [],
        },
        "standard_name": std_ver.get("name") or "Quality Standard",
        "standard_version_number": std_ver.get("version_number") or 1,
        "standard_stages": [
            {
                "position": s.get("position"),
                "name": s.get("name"),
                "timing_type": s.get("timing_type"),
                "start_offset_days": s.get("start_offset_days"),
                "instructions": s.get("instructions") or {},
                "dos": s.get("dos") or {},
                "donts": s.get("donts") or {},
                "allowed_inputs": s.get("allowed_inputs") or [],
                "banned_inputs": s.get("banned_inputs") or [],
                "required_proof": s.get("required_proof") or {},
            }
            for s in stages
        ],
        "terms_hash": terms_hash,
    }


def accept_ad(
    ad_id: str,
    farmer_id: str,
    ad_version_id: str,
    supply_quantity_kg: float,
) -> dict:
    """
    Submits an acceptance from a farmer for a live ad.
    - Validates ad is live, not expired, not filled.
    - Validates district eligibility and supply quantity.
    - Validates ad_version_id matches the latest published version.
    - Enforces farmer active link rule:
      - If active link with another exporter -> 409
      - If active link with same exporter -> reuse link
      - If no active link -> create requested link
    - Inserts ad_acceptances record with canonical server-computed terms hash.
    """
    if supply_quantity_kg <= 0:
        raise HTTPException(status_code=400, detail="Supply quantity must be greater than 0 kg.")

    # 1. Fetch ad
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
    if ad.get("status") == "closed":
        raise HTTPException(status_code=400, detail="Advertisement is closed.")

    # 2. Fetch latest published version
    ver_res = (
        supabase.table("ad_versions")
        .select("*")
        .eq("ad_id", ad_id)
        .eq("status", "published")
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if not ver_res or not ver_res.data:
        raise HTTPException(status_code=404, detail="Advertisement has no published version.")

    live_ver = ver_res.data[0]

    # Stale version check -> 409 Conflict
    if live_ver["id"] != ad_version_id:
        raise HTTPException(status_code=409, detail="Ad was updated, reload.")

    # Expiry check
    now = datetime.now(timezone.utc)
    exp_dt = _parse_dt(live_ver.get("expires_at"))
    if now > exp_dt:
        raise HTTPException(status_code=400, detail="Advertisement has expired.")

    # Quantity check
    target_qty = float(live_ver.get("quantity_kg") or 0.0)
    if supply_quantity_kg > target_qty:
        raise HTTPException(
            status_code=400,
            detail=f"Supply quantity ({supply_quantity_kg} kg) cannot exceed ad target quantity ({target_qty} kg).",
        )

    # Filled check
    approved_qty = get_approved_quantity_for_ad(ad_id)
    if approved_qty >= target_qty:
        raise HTTPException(
            status_code=400,
            detail="Advertisement is already filled and no longer open to acceptances.",
        )

    # District eligibility check
    farmer_districts = get_farmer_districts(farmer_id)
    elig_districts = live_ver.get("eligible_districts") or []
    if not is_district_eligible(farmer_districts, elig_districts):
        raise HTTPException(
            status_code=400,
            detail="Your registered district is not eligible for this advertisement.",
        )

    # 3. Check for existing acceptance for this ad by this farmer -> 409
    dup_res = (
        supabase.table("ad_acceptances")
        .select("id")
        .eq("ad_id", ad_id)
        .eq("farmer_id", farmer_id)
        .maybe_single()
        .execute()
    )
    if dup_res and dup_res.data:
        raise HTTPException(
            status_code=409,
            detail="You have already submitted an acceptance for this advertisement.",
        )

    # 4. Check active links
    exporter_profile_id = str(ad["exporter_profile_id"])
    active_links_res = (
        supabase.table("farmer_exporter_links")
        .select("id, exporter_profile_id, status")
        .eq("farmer_id", farmer_id)
        .in_("status", ["requested", "approved"])
        .execute()
    )
    active_links = active_links_res.data or []

    link_id: Optional[str] = None
    if active_links:
        existing_link = active_links[0]
        if str(existing_link["exporter_profile_id"]) != exporter_profile_id:
            raise HTTPException(
                status_code=409,
                detail="Conflict: You already have an active link with another exporter.",
            )
        # Same exporter -> reuse link
        link_id = existing_link["id"]
    else:
        # No active link -> create requested link
        new_link_payload = {
            "farmer_id": farmer_id,
            "exporter_profile_id": exporter_profile_id,
            "status": "requested",
            "requested_at": now.isoformat(),
        }
        link_insert_res = (
            supabase.table("farmer_exporter_links")
            .insert(new_link_payload)
            .execute()
        )
        if not link_insert_res.data:
            raise HTTPException(status_code=500, detail="Failed to initialize farmer-exporter link.")
        link_id = link_insert_res.data[0]["id"]

    # 5. Fetch stages to compute terms_hash
    stages_res = (
        supabase.table("quality_standard_stages")
        .select("*")
        .eq("version_id", live_ver["standard_version_id"])
        .order("position", desc=False)
        .execute()
    )
    stages = stages_res.data or []
    terms_hash = compute_terms_hash(live_ver, stages)

    # 6. Insert acceptance record
    acc_payload = {
        "ad_id": ad_id,
        "ad_version_id": live_ver["id"],
        "farmer_id": farmer_id,
        "link_id": link_id,
        "supply_quantity_kg": supply_quantity_kg,
        "terms_hash": terms_hash,
        "accepted_at": now.isoformat(),
    }
    try:
        acc_insert_res = (
            supabase.table("ad_acceptances")
            .insert(acc_payload)
            .execute()
        )
    except Exception as exc:
        err_msg = str(exc)
        if "idx_ad_acceptances_ad_farmer" in err_msg or "unique" in err_msg.lower():
            raise HTTPException(
                status_code=409,
                detail="You have already submitted an acceptance for this advertisement.",
            )
        raise HTTPException(status_code=500, detail=f"Failed to record acceptance: {err_msg}")

    if not acc_insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to save acceptance record.")

    acceptance = acc_insert_res.data[0]

    return {
        "acceptance_id": acceptance["id"],
        "ad_id": ad_id,
        "ad_version_id": live_ver["id"],
        "farmer_id": farmer_id,
        "link_id": link_id,
        "supply_quantity_kg": supply_quantity_kg,
        "terms_hash": terms_hash,
        "accepted_at": acceptance["accepted_at"],
        "derived_status": "pending",
        "message": "Advertisement acceptance submitted successfully.",
    }


def withdraw_acceptance(ad_id: str, farmer_id: str) -> dict:
    """
    Farmer withdraws an acceptance. Allowed only while pending.
    Sets withdrawn_at = now().
    If no other pending acceptance depends on that link, cancels the link.
    """
    # 1. Fetch acceptance
    acc_res = (
        supabase.table("ad_acceptances")
        .select("id, link_id, withdrawn_at")
        .eq("ad_id", ad_id)
        .eq("farmer_id", farmer_id)
        .maybe_single()
        .execute()
    )
    if not acc_res or not acc_res.data:
        raise HTTPException(status_code=404, detail="Acceptance record not found.")

    acc = acc_res.data
    if acc.get("withdrawn_at"):
        raise HTTPException(status_code=400, detail="This acceptance has already been withdrawn.")

    link_id = acc["link_id"]

    # 2. Check link status
    link_res = (
        supabase.table("farmer_exporter_links")
        .select("id, status")
        .eq("id", link_id)
        .maybe_single()
        .execute()
    )
    link = link_res.data if link_res else {}
    link_status = link.get("status")

    if link_status == "approved":
        raise HTTPException(
            status_code=400,
            detail="Your supply has already been approved by the exporter. Please contact the exporter to request removal.",
        )

    if link_status != "requested":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot withdraw an acceptance with link status '{link_status}'. Only pending acceptances can be withdrawn.",
        )

    # 3. Mark acceptance as withdrawn
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        supabase.table("ad_acceptances").update({"withdrawn_at": now_iso}).eq("id", acc["id"]).execute()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to withdraw acceptance: {str(exc)}")

    # 4. Check if any other pending acceptance depends on this link
    other_res = (
        supabase.table("ad_acceptances")
        .select("id")
        .eq("link_id", link_id)
        .is_("withdrawn_at", "null")
        .execute()
    )
    other_pending = other_res.data or []

    # If no other pending acceptance depends on this link, cancel it
    if not other_pending and link_status == "requested":
        supabase.table("farmer_exporter_links").update({
            "status": "cancelled",
            "decision_reason": "All associated ad acceptances withdrawn by farmer",
        }).eq("id", link_id).execute()

    return {
        "success": True,
        "message": "Advertisement acceptance withdrawn successfully.",
        "withdrawn_at": now_iso,
    }


def get_my_acceptances(farmer_id: str) -> dict:
    """
    Returns all ad acceptances submitted by the farmer with their derived statuses.
    """
    acc_res = (
        supabase.table("ad_acceptances")
        .select("*")
        .eq("farmer_id", farmer_id)
        .order("accepted_at", desc=True)
        .execute()
    )
    acceptances = acc_res.data or []
    if not acceptances:
        return {"items": [], "total": 0}

    ad_ids = list({a["ad_id"] for a in acceptances})
    link_ids = list({a["link_id"] for a in acceptances if a.get("link_id")})
    ver_ids = list({a["ad_version_id"] for a in acceptances if a.get("ad_version_id")})

    # Batch-fetch ads
    ads_res = supabase.table("ads").select("id, crop, exporter_profile_id").in_("id", ad_ids).execute()
    ads_map = {a["id"]: a for a in (ads_res.data or [])}

    # Batch-fetch exporter profiles
    exp_ids = list({a["exporter_profile_id"] for a in ads_map.values()})
    exp_res = supabase.table("exporter_profiles").select("id, company_name, logo_url").in_("id", exp_ids).execute()
    exp_map = {e["id"]: e for e in (exp_res.data or [])}

    # Batch-fetch versions
    ver_res = (
        supabase.table("ad_versions")
        .select("id, version_number, title, grade_tier, price_type, price_fixed, price_min, price_max, collection_window_start, collection_window_end")
        .in_("id", ver_ids)
        .execute()
    )
    ver_map = {v["id"]: v for v in (ver_res.data or [])}

    # Batch-fetch links
    links_res = supabase.table("farmer_exporter_links").select("id, status").in_("id", link_ids).execute()
    links_map = {l["id"]: l for l in (links_res.data or [])}

    items = []
    for a in acceptances:
        ad = ads_map.get(a["ad_id"]) or {}
        exp = exp_map.get(ad.get("exporter_profile_id")) or {}
        ver = ver_map.get(a["ad_version_id"]) or {}
        link = links_map.get(a["link_id"]) or {}
        link_status = link.get("status") or "requested"

        # Compute derived status
        if a.get("withdrawn_at"):
            derived_status = "withdrawn"
        elif link_status == "requested":
            derived_status = "pending"
        elif link_status == "approved":
            derived_status = "approved"
        elif link_status == "declined":
            derived_status = "declined"
        elif link_status == "removed":
            derived_status = "removed"
        else:
            derived_status = link_status

        items.append({
            "acceptance_id": a["id"],
            "ad_id": a["ad_id"],
            "ad_title": ver.get("title") or {},
            "crop": ad.get("crop") or "tea",
            "grade_tier": ver.get("grade_tier") or "",
            "ad_version_number": ver.get("version_number") or 1,
            "exporter_name": exp.get("company_name") or "Exporter",
            "exporter_logo_url": exp.get("logo_url"),
            "supply_quantity_kg": float(a.get("supply_quantity_kg") or 0.0),
            "price_type": ver.get("price_type") or "fixed",
            "price_fixed": ver.get("price_fixed"),
            "price_min": ver.get("price_min"),
            "price_max": ver.get("price_max"),
            "collection_window_start": ver.get("collection_window_start") or "",
            "collection_window_end": ver.get("collection_window_end") or "",
            "accepted_at": a["accepted_at"],
            "withdrawn_at": a.get("withdrawn_at"),
            "derived_status": derived_status,
            "link_status": link_status,
        })

    return {"items": items, "total": len(items)}
