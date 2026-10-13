"""
Service layer for Exporter Advertisements (Step 3A).
Handles business rules, validations, immutability, state computation, and versioning.
"""
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone
import uuid
from fastapi import HTTPException
from db.supabase import supabase
from exporter.ads.constants import VALID_CROPS, SRI_LANKA_DISTRICTS
from exporter.ads.schemas import (
    AdCreateRequest,
    AdVersionDraftUpdate,
    CloseAdRequest,
    MultilingualText,
    TermsSpec,
)
from exporter.farmers.service import get_exporter_profile_id_for_user


def _parse_dt(dt_str: str) -> datetime:
    """Parse ISO datetime string to timezone-aware UTC datetime."""
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid datetime format: '{dt_str}'. Use ISO 8601 format.")


def _validate_districts(districts: List[str]):
    for d in districts:
        if d not in SRI_LANKA_DISTRICTS:
            raise HTTPException(status_code=400, detail=f"Invalid district '{d}'. Must be a valid Sri Lankan district.")


def _validate_pricing(price_type: str, price_fixed: Optional[float], price_min: Optional[float], price_max: Optional[float]):
    if price_type == "fixed":
        if price_fixed is None or price_fixed <= 0:
            raise HTTPException(status_code=400, detail="Fixed price must be greater than 0.")
    elif price_type == "range":
        if price_min is None or price_min <= 0:
            raise HTTPException(status_code=400, detail="Minimum price must be greater than 0.")
        if price_max is None or price_max < price_min:
            raise HTTPException(status_code=400, detail="Maximum price must be greater than or equal to minimum price.")


def _validate_dates(start_str: str, end_str: str, expires_str: str, is_publish: bool = False):
    start = _parse_dt(start_str)
    end = _parse_dt(end_str)
    expires = _parse_dt(expires_str)

    if end < start:
        raise HTTPException(status_code=400, detail="Collection window end must be on or after collection window start.")

    if is_publish:
        now = datetime.now(timezone.utc)
        if expires <= now:
            raise HTTPException(status_code=400, detail="Ad expiry date must be in the future.")
        if expires > end:
            raise HTTPException(status_code=400, detail="Ad expiry date must be on or before the collection window end date.")


def _validate_standard_version(standard_version_id: str, exporter_profile_id: str, crop: str, is_publish: bool = False) -> dict:
    """
    Validates that standard_version_id exists, is owned by the exporter,
    matches the crop, and (if publishing) is published.
    """
    res = (
        supabase.table("quality_standard_versions")
        .select("id, standard_id, version_number, name, status")
        .eq("id", standard_version_id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=400, detail="Linked quality standard version not found.")

    version_data = res.data

    # Check parent standard
    std_res = (
        supabase.table("quality_standards")
        .select("id, exporter_profile_id, crop, is_archived")
        .eq("id", version_data["standard_id"])
        .maybe_single()
        .execute()
    )
    if not std_res or not std_res.data:
        raise HTTPException(status_code=400, detail="Parent quality standard not found.")

    standard_data = std_res.data
    if str(standard_data["exporter_profile_id"]) != exporter_profile_id:
        raise HTTPException(status_code=400, detail="Quality standard does not belong to your company.")

    if standard_data["crop"].lower() != crop.lower():
        raise HTTPException(
            status_code=400,
            detail=f"Quality standard crop '{standard_data['crop']}' does not match ad crop '{crop}'."
        )

    if standard_data.get("is_archived"):
        raise HTTPException(status_code=400, detail="Cannot link to an archived quality standard.")

    if is_publish and version_data["status"] != "published":
        raise HTTPException(
            status_code=400,
            detail="Linked quality standard version must be published before the ad can be published."
        )

    return {**version_data, "standard_crop": standard_data["crop"]}


def compute_ad_status(ad: dict, versions: List[dict]) -> str:
    """
    Computes overall state: 'draft' | 'live' | 'expired' | 'closed'.
    """
    if ad.get("status") == "closed":
        return "closed"

    # Find latest published version
    published_versions = [v for v in versions if v.get("status") == "published"]
    if not published_versions:
        return "draft"

    published_versions.sort(key=lambda x: x.get("version_number", 0), reverse=True)
    latest_pub = published_versions[0]

    expires_at_str = latest_pub.get("expires_at")
    if expires_at_str:
        expires = _parse_dt(expires_at_str)
        now = datetime.now(timezone.utc)
        if now > expires:
            return "expired"

    return "live"


def get_ad_by_id_and_owner(ad_id: str, exporter_profile_id: str) -> dict:
    res = (
        supabase.table("ads")
        .select("*")
        .eq("id", ad_id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Advertisement not found")

    ad = res.data
    if str(ad["exporter_profile_id"]) != exporter_profile_id:
        raise HTTPException(status_code=404, detail="Advertisement not found")
    return ad


def list_ads(
    exporter_profile_id: str,
    crop: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    query = (
        supabase.table("ads")
        .select("*")
        .eq("exporter_profile_id", exporter_profile_id)
    )

    if crop and crop.strip() and crop != "all":
        query = query.eq("crop", crop.strip().lower())

    ads_res = query.order("created_at", desc=True).execute()
    all_ads = ads_res.data or []

    if not all_ads:
        return {
            "items": [],
            "total": 0,
            "page": page,
            "page_size": page_size,
            "total_pages": 1,
        }

    ad_ids = [a["id"] for a in all_ads]
    vers_res = (
        supabase.table("ad_versions")
        .select("*")
        .in_("ad_id", ad_ids)
        .order("version_number", desc=True)
        .execute()
    )
    all_versions = vers_res.data or []
    versions_by_ad: Dict[str, List[dict]] = {aid: [] for aid in ad_ids}
    for v in all_versions:
        versions_by_ad.setdefault(v["ad_id"], []).append(v)

    enriched_items = []
    for ad in all_ads:
        aid = ad["id"]
        v_list = versions_by_ad.get(aid, [])
        computed = compute_ad_status(ad, v_list)

        # Filter by computed status if requested
        if status and status.strip() and status != "all":
            if computed != status.strip().lower():
                continue

        # Use latest version (or latest published if live/expired)
        v_list_sorted = sorted(v_list, key=lambda x: x["version_number"], reverse=True)
        top_v = v_list_sorted[0] if v_list_sorted else {}

        enriched_items.append({
            "id": ad["id"],
            "exporter_profile_id": ad["exporter_profile_id"],
            "crop": ad["crop"],
            "status": ad["status"],
            "computed_status": computed,
            "closed_at": ad.get("closed_at"),
            "closed_reason": ad.get("closed_reason"),
            "created_at": ad["created_at"],
            "updated_at": ad["updated_at"],
            "current_version_number": top_v.get("version_number", 1),
            "title": top_v.get("title", {"en": ""}),
            "grade_tier": top_v.get("grade_tier", ""),
            "quantity_kg": float(top_v.get("quantity_kg", 0)),
            "price_type": top_v.get("price_type", "fixed"),
            "price_fixed": float(top_v["price_fixed"]) if top_v.get("price_fixed") is not None else None,
            "price_min": float(top_v["price_min"]) if top_v.get("price_min") is not None else None,
            "price_max": float(top_v["price_max"]) if top_v.get("price_max") is not None else None,
            "expires_at": top_v.get("expires_at"),
            "standard_version_id": top_v.get("standard_version_id"),
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
    }


def create_ad(exporter_profile_id: str, req: AdCreateRequest) -> dict:
    crop = req.crop.strip().lower()
    if crop not in VALID_CROPS:
        raise HTTPException(status_code=400, detail=f"Crop must be one of {VALID_CROPS}")

    _validate_districts(req.eligible_districts)
    _validate_pricing(req.price_type, req.price_fixed, req.price_min, req.price_max)
    _validate_dates(req.collection_window_start, req.collection_window_end, req.expires_at, is_publish=False)
    _validate_standard_version(req.standard_version_id, exporter_profile_id, crop, is_publish=False)

    # 1. Insert ad root
    ad_res = supabase.table("ads").insert({
        "exporter_profile_id": exporter_profile_id,
        "crop": crop,
        "status": "draft",
    }).execute()
    if not ad_res.data:
        raise HTTPException(status_code=500, detail="Failed to create advertisement record")

    ad = ad_res.data[0]
    ad_id = ad["id"]

    # 2. Insert draft v1
    v1_row = {
        "ad_id": ad_id,
        "version_number": 1,
        "status": "draft",
        "standard_version_id": req.standard_version_id,
        "title": req.title.model_dump(),
        "description": req.description.model_dump(),
        "grade_tier": req.grade_tier or "",
        "quantity_kg": req.quantity_kg,
        "price_type": req.price_type,
        "price_fixed": req.price_fixed if req.price_type == "fixed" else None,
        "price_min": req.price_min if req.price_type == "range" else None,
        "price_max": req.price_max if req.price_type == "range" else None,
        "collection_window_start": req.collection_window_start,
        "collection_window_end": req.collection_window_end,
        "pickup_location": req.pickup_location or "",
        "eligible_districts": req.eligible_districts,
        "terms": (req.terms.model_dump() if req.terms else {"payment_timing": "", "rejection_handling": "", "other": ""}),
        "expires_at": req.expires_at,
    }

    ver_res = supabase.table("ad_versions").insert(v1_row).execute()
    if not ver_res.data:
        raise HTTPException(status_code=500, detail="Failed to create initial ad version")

    return get_ad_detail(ad_id, exporter_profile_id)


def get_ad_detail(ad_id: str, exporter_profile_id: str) -> dict:
    ad = get_ad_by_id_and_owner(ad_id, exporter_profile_id)
    vers_res = (
        supabase.table("ad_versions")
        .select("*")
        .eq("ad_id", ad_id)
        .order("version_number", desc=True)
        .execute()
    )
    versions = vers_res.data or []
    computed = compute_ad_status(ad, versions)

    return {
        "id": ad["id"],
        "exporter_profile_id": ad["exporter_profile_id"],
        "crop": ad["crop"],
        "status": ad["status"],
        "computed_status": computed,
        "closed_at": ad.get("closed_at"),
        "closed_reason": ad.get("closed_reason"),
        "created_at": ad["created_at"],
        "updated_at": ad["updated_at"],
        "versions": versions,
    }


def get_version_detail(ad_id: str, version_number: int, exporter_profile_id: str) -> dict:
    ad = get_ad_by_id_and_owner(ad_id, exporter_profile_id)
    ver_res = (
        supabase.table("ad_versions")
        .select("*")
        .eq("ad_id", ad_id)
        .eq("version_number", version_number)
        .maybe_single()
        .execute()
    )
    if not ver_res or not ver_res.data:
        raise HTTPException(status_code=404, detail=f"Version {version_number} not found for this advertisement")

    version = ver_res.data

    # Enrich with standard name and crop
    std_info = _validate_standard_version(version["standard_version_id"], exporter_profile_id, ad["crop"], is_publish=False)
    version["standard_name"] = std_info.get("name")
    version["standard_crop"] = std_info.get("standard_crop")

    return version


def update_draft_version(
    ad_id: str,
    version_number: int,
    exporter_profile_id: str,
    body: AdVersionDraftUpdate,
) -> dict:
    ad = get_ad_by_id_and_owner(ad_id, exporter_profile_id)
    ver = get_version_detail(ad_id, version_number, exporter_profile_id)

    if ver["status"] == "published":
        raise HTTPException(
            status_code=400,
            detail="Cannot update a published version. Published versions are immutable."
        )

    _validate_districts(body.eligible_districts)
    _validate_pricing(body.price_type, body.price_fixed, body.price_min, body.price_max)
    _validate_dates(body.collection_window_start, body.collection_window_end, body.expires_at, is_publish=False)
    _validate_standard_version(body.standard_version_id, exporter_profile_id, ad["crop"], is_publish=False)

    upd_data = {
        "standard_version_id": body.standard_version_id,
        "title": body.title.model_dump(),
        "description": body.description.model_dump(),
        "grade_tier": body.grade_tier or "",
        "quantity_kg": body.quantity_kg,
        "price_type": body.price_type,
        "price_fixed": body.price_fixed if body.price_type == "fixed" else None,
        "price_min": body.price_min if body.price_type == "range" else None,
        "price_max": body.price_max if body.price_type == "range" else None,
        "collection_window_start": body.collection_window_start,
        "collection_window_end": body.collection_window_end,
        "pickup_location": body.pickup_location or "",
        "eligible_districts": body.eligible_districts,
        "terms": (body.terms.model_dump() if body.terms else {"payment_timing": "", "rejection_handling": "", "other": ""}),
        "expires_at": body.expires_at,
    }

    res = (
        supabase.table("ad_versions")
        .update(upd_data)
        .eq("id", ver["id"])
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update draft ad version")

    return get_version_detail(ad_id, version_number, exporter_profile_id)


def publish_version(ad_id: str, version_number: int, exporter_profile_id: str) -> dict:
    ad = get_ad_by_id_and_owner(ad_id, exporter_profile_id)
    ver = get_version_detail(ad_id, version_number, exporter_profile_id)

    if ver["status"] == "published":
        raise HTTPException(status_code=400, detail="Version is already published")

    if ad["status"] == "closed":
        raise HTTPException(status_code=400, detail="Cannot publish a version for a closed advertisement.")

    # 1. Title and Description: English required
    title_en = (ver.get("title", {}).get("en") or "").strip()
    desc_en = (ver.get("description", {}).get("en") or "").strip()
    if not title_en:
        raise HTTPException(status_code=400, detail="English title is required for publishing.")
    if not desc_en:
        raise HTTPException(status_code=400, detail="English description is required for publishing.")

    # 2. Linked standard version must be PUBLISHED, owned by this exporter, matching crop
    _validate_standard_version(ver["standard_version_id"], exporter_profile_id, ad["crop"], is_publish=True)

    # 3. Pricing validation
    _validate_pricing(ver["price_type"], ver.get("price_fixed"), ver.get("price_min"), ver.get("price_max"))

    # 4. Dates validation: expires_at must be in future and on or before collection_window_end
    _validate_dates(ver["collection_window_start"], ver["collection_window_end"], ver["expires_at"], is_publish=True)

    # 5. Quantity validation
    if float(ver.get("quantity_kg", 0)) <= 0:
        raise HTTPException(status_code=400, detail="Target quantity must be greater than 0.")

    # 6. Districts validation
    _validate_districts(ver.get("eligible_districts") or [])

    now_iso = datetime.now(timezone.utc).isoformat()

    # Update version status to published
    v_res = (
        supabase.table("ad_versions")
        .update({
            "status": "published",
            "published_at": now_iso,
        })
        .eq("id", ver["id"])
        .execute()
    )
    if not v_res.data:
        raise HTTPException(status_code=500, detail="Failed to publish ad version")

    # Update parent ad status to published
    supabase.table("ads").update({"status": "published"}).eq("id", ad_id).execute()

    return get_version_detail(ad_id, version_number, exporter_profile_id)


def create_new_draft(ad_id: str, exporter_profile_id: str) -> dict:
    ad = get_ad_by_id_and_owner(ad_id, exporter_profile_id)

    if ad["status"] == "closed":
        raise HTTPException(status_code=400, detail="Cannot create a new draft for a closed advertisement.")

    # One-draft rule: check if any draft version already exists
    draft_check = (
        supabase.table("ad_versions")
        .select("id")
        .eq("ad_id", ad_id)
        .eq("status", "draft")
        .maybe_single()
        .execute()
    )
    if draft_check and draft_check.data:
        raise HTTPException(
            status_code=400,
            detail="A draft version already exists for this advertisement. Only one draft is allowed at a time."
        )

    # Find latest published version
    pub_res = (
        supabase.table("ad_versions")
        .select("*")
        .eq("ad_id", ad_id)
        .eq("status", "published")
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if not pub_res.data:
        raise HTTPException(status_code=400, detail="No published version exists to create a new draft from.")

    source_ver = pub_res.data[0]

    # Find highest version number
    highest_res = (
        supabase.table("ad_versions")
        .select("version_number")
        .eq("ad_id", ad_id)
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    highest_v = highest_res.data[0]["version_number"] if highest_res.data else 1
    new_v_number = highest_v + 1

    new_draft_row = {
        "ad_id": ad_id,
        "version_number": new_v_number,
        "status": "draft",
        "standard_version_id": source_ver["standard_version_id"],
        "title": source_ver.get("title") or {"en": ""},
        "description": source_ver.get("description") or {"en": ""},
        "grade_tier": source_ver.get("grade_tier") or "",
        "quantity_kg": source_ver.get("quantity_kg"),
        "price_type": source_ver.get("price_type"),
        "price_fixed": source_ver.get("price_fixed"),
        "price_min": source_ver.get("price_min"),
        "price_max": source_ver.get("price_max"),
        "collection_window_start": source_ver.get("collection_window_start"),
        "collection_window_end": source_ver.get("collection_window_end"),
        "pickup_location": source_ver.get("pickup_location") or "",
        "eligible_districts": source_ver.get("eligible_districts") or [],
        "terms": source_ver.get("terms") or {"payment_timing": "", "rejection_handling": "", "other": ""},
        "expires_at": source_ver.get("expires_at"),
    }

    try:
        ins_res = supabase.table("ad_versions").insert(new_draft_row).execute()
    except Exception as exc:
        err_msg = str(exc)
        if "idx_ad_versions_one_draft" in err_msg or "23505" in err_msg or "unique" in err_msg.lower():
            raise HTTPException(
                status_code=400,
                detail="A draft version already exists for this advertisement. Only one draft is allowed at a time."
            )
        raise HTTPException(status_code=500, detail=f"Failed to create new draft: {err_msg}")

    if not ins_res.data:
        raise HTTPException(status_code=500, detail="Failed to create new draft version")

    return get_version_detail(ad_id, new_v_number, exporter_profile_id)


def close_ad(ad_id: str, exporter_profile_id: str, reason: Optional[str] = None) -> dict:
    ad = get_ad_by_id_and_owner(ad_id, exporter_profile_id)

    if ad["status"] == "closed":
        raise HTTPException(status_code=400, detail="Advertisement is already closed.")

    if ad["status"] != "published":
        raise HTTPException(status_code=400, detail="Only published advertisements can be closed.")

    now_iso = datetime.now(timezone.utc).isoformat()
    upd_res = (
        supabase.table("ads")
        .update({
            "status": "closed",
            "closed_at": now_iso,
            "closed_reason": reason,
        })
        .eq("id", ad_id)
        .execute()
    )
    if not upd_res.data:
        raise HTTPException(status_code=500, detail="Failed to close advertisement")

    return get_ad_detail(ad_id, exporter_profile_id)


def duplicate_ad(ad_id: str, exporter_profile_id: str) -> dict:
    """
    Duplicates an ad by copying its latest version into a brand new ad with draft v1.
    """
    ad = get_ad_by_id_and_owner(ad_id, exporter_profile_id)
    vers_res = (
        supabase.table("ad_versions")
        .select("*")
        .eq("ad_id", ad_id)
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if not vers_res.data:
        raise HTTPException(status_code=404, detail="Source advertisement has no versions to duplicate.")

    source_v = vers_res.data[0]

    # Create new ad
    new_ad_res = supabase.table("ads").insert({
        "exporter_profile_id": exporter_profile_id,
        "crop": ad["crop"],
        "status": "draft",
    }).execute()
    if not new_ad_res.data:
        raise HTTPException(status_code=500, detail="Failed to create duplicated advertisement")

    new_ad = new_ad_res.data[0]
    new_ad_id = new_ad["id"]

    # Copy title with "(Copy)" suffix on English title
    new_title = dict(source_v.get("title") or {"en": ""})
    new_title["en"] = f"{new_title.get('en', '')} (Copy)".strip()

    new_v1_row = {
        "ad_id": new_ad_id,
        "version_number": 1,
        "status": "draft",
        "standard_version_id": source_v["standard_version_id"],
        "title": new_title,
        "description": source_v.get("description") or {"en": ""},
        "grade_tier": source_v.get("grade_tier") or "",
        "quantity_kg": source_v.get("quantity_kg"),
        "price_type": source_v.get("price_type"),
        "price_fixed": source_v.get("price_fixed"),
        "price_min": source_v.get("price_min"),
        "price_max": source_v.get("price_max"),
        "collection_window_start": source_v.get("collection_window_start"),
        "collection_window_end": source_v.get("collection_window_end"),
        "pickup_location": source_v.get("pickup_location") or "",
        "eligible_districts": source_v.get("eligible_districts") or [],
        "terms": source_v.get("terms") or {"payment_timing": "", "rejection_handling": "", "other": ""},
        "expires_at": source_v.get("expires_at"),
    }

    supabase.table("ad_versions").insert(new_v1_row).execute()
    return get_ad_detail(new_ad_id, exporter_profile_id)
