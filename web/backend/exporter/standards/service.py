"""
Service layer for Exporter Quality Standards.
Implements business rules, validation, ownership checks, and immutability logic.
"""
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from fastapi import HTTPException
from db.supabase import supabase
from exporter.standards.schemas import CreateStandardRequest, DraftVersionUpdate, StageCreateUpdate


def get_exporter_profile_by_user_id(user_id: str) -> dict:
    """Find the exporter_profiles row for the given user_id."""
    res = (
        supabase.table("exporter_profiles")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Exporter profile not found")
    return res.data


def get_standard_by_id_and_owner(standard_id: str, exporter_profile_id: str) -> dict:
    """Retrieve standard ensuring it belongs to exporter_profile_id. Return 404 if not owned."""
    res = (
        supabase.table("quality_standards")
        .select("*")
        .eq("id", standard_id)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Quality standard not found")

    standard = res.data
    if standard["exporter_profile_id"] != exporter_profile_id:
        raise HTTPException(status_code=404, detail="Quality standard not found")
    return standard


def get_version_by_number(standard_id: str, version_number: int) -> dict:
    """Fetch version record by standard_id and version_number."""
    res = (
        supabase.table("quality_standard_versions")
        .select("*")
        .eq("standard_id", standard_id)
        .eq("version_number", version_number)
        .maybe_single()
        .execute()
    )
    if not res or not res.data:
        raise HTTPException(status_code=404, detail=f"Version {version_number} not found")
    return res.data


def _dump_stage(stage: StageCreateUpdate, version_id: str) -> dict:
    return {
        "version_id": version_id,
        "position": stage.position,
        "name": stage.name,
        "timing_type": stage.timing_type,
        "start_offset_days": stage.start_offset_days,
        "repeat_interval_days": stage.repeat_interval_days,
        "end_offset_days": stage.end_offset_days,
        "instructions": stage.instructions.model_dump(),
        "dos": stage.dos.model_dump(),
        "donts": stage.donts.model_dump(),
        "allowed_inputs": stage.allowed_inputs,
        "banned_inputs": [b.model_dump() for b in stage.banned_inputs],
        "required_proof": stage.required_proof.model_dump(),
    }


def create_standard(exporter_profile_id: str, req: CreateStandardRequest) -> dict:
    """Create a quality_standard row with initial draft version (v1)."""
    # 1. Insert standard
    std_res = supabase.table("quality_standards").insert({
        "exporter_profile_id": exporter_profile_id,
        "crop": req.crop.strip().lower(),
        "is_archived": False,
    }).execute()

    if not std_res.data:
        raise HTTPException(status_code=500, detail="Failed to create quality standard")

    standard = std_res.data[0]
    standard_id = standard["id"]

    # 2. Insert draft version (v1)
    ver_res = supabase.table("quality_standard_versions").insert({
        "standard_id": standard_id,
        "version_number": 1,
        "name": req.name,
        "status": "draft",
        "grade_spec": req.grade_spec,
    }).execute()

    if not ver_res.data:
        raise HTTPException(status_code=500, detail="Failed to create initial version")

    version = ver_res.data[0]
    version_id = version["id"]

    # 3. Insert stages if provided
    if req.stages:
        stage_rows = [_dump_stage(s, version_id) for s in req.stages]
        supabase.table("quality_standard_stages").insert(stage_rows).execute()

    return get_standard_full(standard_id, exporter_profile_id)


def list_standards(
    exporter_profile_id: str,
    crop: Optional[str] = None,
    is_archived: Optional[bool] = None,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    """List quality standards for exporter with filters and pagination."""
    query = (
        supabase.table("quality_standards")
        .select("*, versions:quality_standard_versions(*)", count="exact")
        .eq("exporter_profile_id", exporter_profile_id)
    )

    if crop and crop.strip():
        query = query.eq("crop", crop.strip().lower())
    if is_archived is not None:
        query = query.eq("is_archived", is_archived)

    start = (page - 1) * page_size
    end = start + page_size - 1
    res = query.order("created_at", desc=True).range(start, end).execute()

    items = res.data or []
    total = res.count or 0
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 1

    # Order versions inside each item by version_number desc
    for item in items:
        if "versions" in item and item["versions"]:
            item["versions"].sort(key=lambda v: v["version_number"], reverse=True)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


def get_standard_full(standard_id: str, exporter_profile_id: str) -> dict:
    """Get standard with all versions list."""
    standard = get_standard_by_id_and_owner(standard_id, exporter_profile_id)
    ver_res = (
        supabase.table("quality_standard_versions")
        .select("*")
        .eq("standard_id", standard_id)
        .order("version_number", desc=True)
        .execute()
    )
    standard["versions"] = ver_res.data or []
    return standard


def get_version_detail(standard_id: str, version_number: int, exporter_profile_id: str) -> dict:
    """Get details of version N including stages."""
    get_standard_by_id_and_owner(standard_id, exporter_profile_id)
    version = get_version_by_number(standard_id, version_number)

    stages_res = (
        supabase.table("quality_standard_stages")
        .select("*")
        .eq("version_id", version["id"])
        .order("position", desc=False)
        .execute()
    )
    version["stages"] = stages_res.data or []
    return version


def update_draft_version(
    standard_id: str,
    version_number: int,
    exporter_profile_id: str,
    body: DraftVersionUpdate,
) -> dict:
    """Replace name, grade_spec, and stages of a DRAFT version. Rejects if published."""
    get_standard_by_id_and_owner(standard_id, exporter_profile_id)
    version = get_version_by_number(standard_id, version_number)

    if version["status"] == "published":
        raise HTTPException(status_code=400, detail="Cannot update a published version. Published versions are immutable.")

    version_id = version["id"]

    # 1. Update version row
    upd_res = (
        supabase.table("quality_standard_versions")
        .update({"name": body.name, "grade_spec": body.grade_spec})
        .eq("id", version_id)
        .execute()
    )
    if not upd_res.data:
        raise HTTPException(status_code=500, detail="Failed to update version record")

    # 2. Delete existing stages
    supabase.table("quality_standard_stages").delete().eq("version_id", version_id).execute()

    # 3. Insert new stages
    if body.stages:
        stage_rows = [_dump_stage(s, version_id) for s in body.stages]
        supabase.table("quality_standard_stages").insert(stage_rows).execute()

    return get_version_detail(standard_id, version_number, exporter_profile_id)


def publish_version(standard_id: str, version_number: int, exporter_profile_id: str) -> dict:
    """Publish a draft version. Requires verified exporter, and at least 1 stage."""
    get_standard_by_id_and_owner(standard_id, exporter_profile_id)
    version = get_version_by_number(standard_id, version_number)

    if version["status"] == "published":
        raise HTTPException(status_code=400, detail="Version is already published")

    version_id = version["id"]

    # Check stage count
    stages_res = (
        supabase.table("quality_standard_stages")
        .select("id", count="exact")
        .eq("version_id", version_id)
        .execute()
    )
    stage_count = stages_res.count or len(stages_res.data or [])
    if stage_count < 1:
        raise HTTPException(status_code=400, detail="Cannot publish a version without any stages. At least one stage is required.")

    now_iso = datetime.now(timezone.utc).isoformat()
    upd_res = (
        supabase.table("quality_standard_versions")
        .update({"status": "published", "published_at": now_iso})
        .eq("id", version_id)
        .execute()
    )
    if not upd_res.data:
        raise HTTPException(status_code=500, detail="Failed to publish version")

    return get_version_detail(standard_id, version_number, exporter_profile_id)


def create_new_draft(standard_id: str, exporter_profile_id: str) -> dict:
    """Create a new draft version by copying the latest published version. Reject if a draft already exists."""
    get_standard_by_id_and_owner(standard_id, exporter_profile_id)

    # Check if there is already a draft version
    draft_res = (
        supabase.table("quality_standard_versions")
        .select("id")
        .eq("standard_id", standard_id)
        .eq("status", "draft")
        .maybe_single()
        .execute()
    )
    if draft_res and draft_res.data:
        raise HTTPException(status_code=400, detail="A draft version already exists for this standard. Only one draft is allowed at a time.")

    # Find the latest published version
    pub_res = (
        supabase.table("quality_standard_versions")
        .select("*")
        .eq("standard_id", standard_id)
        .eq("status", "published")
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if not pub_res.data:
        raise HTTPException(status_code=400, detail="No published version exists to create a new draft from.")

    source_ver = pub_res.data[0]

    # Find highest version_number for this standard
    all_ver_res = (
        supabase.table("quality_standard_versions")
        .select("version_number")
        .eq("standard_id", standard_id)
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    highest_v = all_ver_res.data[0]["version_number"] if all_ver_res.data else 1
    new_v_number = highest_v + 1

    # Insert new draft version
    new_ver_res = supabase.table("quality_standard_versions").insert({
        "standard_id": standard_id,
        "version_number": new_v_number,
        "name": f"v{new_v_number} Draft",
        "status": "draft",
        "grade_spec": source_ver.get("grade_spec", {}),
    }).execute()

    if not new_ver_res.data:
        raise HTTPException(status_code=500, detail="Failed to create new draft version")

    new_version = new_ver_res.data[0]
    new_version_id = new_version["id"]

    # Copy stages from source version
    source_stages_res = (
        supabase.table("quality_standard_stages")
        .select("*")
        .eq("version_id", source_ver["id"])
        .order("position", desc=False)
        .execute()
    )
    source_stages = source_stages_res.data or []

    if source_stages:
        new_stages = []
        for stage in source_stages:
            new_stages.append({
                "version_id": new_version_id,
                "position": stage["position"],
                "name": stage["name"],
                "timing_type": stage["timing_type"],
                "start_offset_days": stage["start_offset_days"],
                "repeat_interval_days": stage.get("repeat_interval_days"),
                "end_offset_days": stage.get("end_offset_days"),
                "instructions": stage.get("instructions", {}),
                "dos": stage.get("dos", {}),
                "donts": stage.get("donts", {}),
                "allowed_inputs": stage.get("allowed_inputs", []),
                "banned_inputs": stage.get("banned_inputs", []),
                "required_proof": stage.get("required_proof", {}),
            })
        supabase.table("quality_standard_stages").insert(new_stages).execute()

    return get_version_detail(standard_id, new_v_number, exporter_profile_id)


def duplicate_standard(standard_id: str, exporter_profile_id: str) -> dict:
    """Copy a standard into a new standard with a draft v1."""
    source_std = get_standard_by_id_and_owner(standard_id, exporter_profile_id)

    # Get latest version (draft or published)
    ver_res = (
        supabase.table("quality_standard_versions")
        .select("*")
        .eq("standard_id", standard_id)
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    source_ver = ver_res.data[0] if ver_res.data else None

    # Insert new standard
    new_std_res = supabase.table("quality_standards").insert({
        "exporter_profile_id": exporter_profile_id,
        "crop": source_std["crop"],
        "is_archived": False,
    }).execute()

    if not new_std_res.data:
        raise HTTPException(status_code=500, detail="Failed to duplicate quality standard")

    new_std = new_std_res.data[0]
    new_std_id = new_std["id"]

    # Insert draft v1
    v1_name = f"Copy of {source_ver['name']}" if source_ver else "v1 Draft"
    grade_spec = source_ver.get("grade_spec", {}) if source_ver else {}

    v1_res = supabase.table("quality_standard_versions").insert({
        "standard_id": new_std_id,
        "version_number": 1,
        "name": v1_name,
        "status": "draft",
        "grade_spec": grade_spec,
    }).execute()

    if not v1_res.data:
        raise HTTPException(status_code=500, detail="Failed to create duplicated version")

    v1 = v1_res.data[0]
    v1_id = v1["id"]

    # Copy stages if source version exists
    if source_ver:
        stages_res = (
            supabase.table("quality_standard_stages")
            .select("*")
            .eq("version_id", source_ver["id"])
            .order("position", desc=False)
            .execute()
        )
        source_stages = stages_res.data or []
        if source_stages:
            new_stages = []
            for stage in source_stages:
                new_stages.append({
                    "version_id": v1_id,
                    "position": stage["position"],
                    "name": stage["name"],
                    "timing_type": stage["timing_type"],
                    "start_offset_days": stage["start_offset_days"],
                    "repeat_interval_days": stage.get("repeat_interval_days"),
                    "end_offset_days": stage.get("end_offset_days"),
                    "instructions": stage.get("instructions", {}),
                    "dos": stage.get("dos", {}),
                    "donts": stage.get("donts", {}),
                    "allowed_inputs": stage.get("allowed_inputs", []),
                    "banned_inputs": stage.get("banned_inputs", []),
                    "required_proof": stage.get("required_proof", {}),
                })
            supabase.table("quality_standard_stages").insert(new_stages).execute()

    return get_standard_full(new_std_id, exporter_profile_id)


def set_archive_status(standard_id: str, exporter_profile_id: str, is_archived: bool) -> dict:
    """Archive or unarchive a quality standard."""
    get_standard_by_id_and_owner(standard_id, exporter_profile_id)
    res = (
        supabase.table("quality_standards")
        .update({"is_archived": is_archived, "updated_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", standard_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update archive status")
    return get_standard_full(standard_id, exporter_profile_id)
