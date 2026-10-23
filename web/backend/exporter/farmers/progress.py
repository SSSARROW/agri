"""
Farmer progress for exporters — API router (prefix /api/exporter/farmers).

Joins what an approved farmer has recorded in the field app (plots, plantings,
photos, harvest batches — tables owned by the field-data service) with the
exporter's own quality standards and the proof the farmer has submitted for
them, so an exporter can see *how far along* each farmer is.

Must be included BEFORE the farmers router, otherwise "/progress" would be
swallowed by "/{link_id}".
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException

from db.supabase import supabase
from exporter.farmers import service
from exporter.router import get_current_exporter

router = APIRouter(prefix="/api/exporter/farmers", tags=["exporter-farmers-progress"])


# ── helpers ──────────────────────────────────────────────────────────────────

def _dt(v: Any) -> Optional[datetime]:
    if not v:
        return None
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _iso(d: Optional[datetime]) -> Optional[str]:
    return d.isoformat() if d else None


def _safe(fn, default):
    try:
        return fn()
    except Exception:
        return default


def _published_standards(exporter_profile_id: str) -> List[dict]:
    """Latest published version (with stages) of each non-archived standard."""
    stds = (
        supabase.table("quality_standards")
        .select("id, crop")
        .eq("exporter_profile_id", exporter_profile_id)
        .eq("is_archived", False)
        .execute()
        .data
        or []
    )
    out: List[dict] = []
    for s in stds:
        vers = (
            supabase.table("quality_standard_versions")
            .select("id, version_number, name")
            .eq("standard_id", s["id"])
            .eq("status", "published")
            .order("version_number", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        if not vers:
            continue
        v = vers[0]
        stages = (
            supabase.table("quality_standard_stages")
            .select("id, position, name, timing_type, start_offset_days, repeat_interval_days, end_offset_days, required_proof")
            .eq("version_id", v["id"])
            .order("position")
            .execute()
            .data
            or []
        )
        out.append({"id": s["id"], "crop": (s["crop"] or "").lower(), "name": v["name"], "version": v["version_number"], "stages": stages})
    return out


def _field_data(farmer_ids: List[str]) -> Dict[str, Any]:
    """Plots, plantings, photos and batches for a set of farmers, grouped by farmer."""
    plots = _safe(
        lambda: supabase.table("plot")
        .select("id, owner_user_id, name, area_ha, district, dsd, gn_division, plot_type, boundary_source, created_at")
        .in_("owner_user_id", farmer_ids)
        .execute()
        .data,
        [],
    ) or []
    plot_owner = {p["id"]: p["owner_user_id"] for p in plots}
    plot_ids = list(plot_owner)
    events: List[dict] = []
    batches: List[dict] = []
    if plot_ids:
        events = _safe(
            lambda: supabase.table("event")
            .select("id, event_type, plot_id, batch_id, payload, occurred_at, user_id")
            .in_("plot_id", plot_ids)
            .order("occurred_at", desc=True)
            .limit(2000)
            .execute()
            .data,
            [],
        ) or []
        batches = _safe(
            lambda: supabase.table("batch")
            .select("id, code, crop, plot_id, protocol_id, parent_batch_ids, created_at")
            .in_("plot_id", plot_ids)
            .order("created_at", desc=True)
            .execute()
            .data,
            [],
        ) or []
    batch_ids = [b["id"] for b in batches]
    batch_events: List[dict] = []
    if batch_ids:
        batch_events = _safe(
            lambda: supabase.table("event")
            .select("event_type, batch_id, payload, occurred_at")
            .in_("batch_id", batch_ids)
            .order("occurred_at", desc=True)
            .limit(2000)
            .execute()
            .data,
            [],
        ) or []
    return {"plots": plots, "plot_owner": plot_owner, "events": events, "batches": batches, "batch_events": batch_events}


def _batch_summary(b: dict, evs: List[dict]) -> dict:
    mine = [e for e in evs if e["batch_id"] == b["id"]]
    weight = next((e["payload"].get("weight_kg") for e in mine if e["event_type"] == "weigh" and e["payload"].get("weight_kg") is not None), None)
    grade = next((e["payload"].get("grade") for e in mine if e["event_type"] == "grade" and e["payload"].get("grade")), None)
    latest = mine[0] if mine else None
    return {
        "id": b["id"],
        "code": b["code"],
        "crop": b["crop"],
        "created_at": b["created_at"],
        "latest_status": latest["event_type"] if latest else "registered",
        "latest_at": latest["occurred_at"] if latest else b["created_at"],
        "weight_kg": float(weight) if weight is not None else None,
        "grade": grade,
        "steps": sorted({e["event_type"] for e in mine}),
    }


def _stage_status(latest_sub: Optional[dict], due: Optional[datetime], now: datetime) -> str:
    if latest_sub:
        if latest_sub["status"] == "rejected" and latest_sub.get("reopened_at"):
            return "reopened"
        return latest_sub["status"]
    if due is None:
        return "waiting"
    # a few days of grace so a farmer who has just planted is not flagged on day zero
    return "overdue" if due < now - timedelta(days=3) else "upcoming"


def _progress_for(link: dict, standards: List[dict], data: Dict[str, Any], subs: List[dict], now: datetime) -> dict:
    farmer_id = link["farmer_id"]
    my_plot_ids = {pid for pid, owner in data["plot_owner"].items() if owner == farmer_id}
    my_plots = [p for p in data["plots"] if p["id"] in my_plot_ids]
    my_events = [e for e in data["events"] if e["plot_id"] in my_plot_ids]
    my_batches = [b for b in data["batches"] if b["plot_id"] in my_plot_ids]
    my_batch_ids = {b["id"] for b in my_batches}
    my_batch_events = [e for e in data["batch_events"] if e["batch_id"] in my_batch_ids]

    # Plantings: latest planted event per (plot, crop)
    plantings: Dict[tuple, dict] = {}
    for e in my_events:
        if e["event_type"] != "planted":
            continue
        crop = (e["payload"].get("crop") or "").strip()
        key = (e["plot_id"], crop.lower())
        if key not in plantings:  # events are newest-first
            plantings[key] = {"plot_id": e["plot_id"], "crop": crop, "planted_at": e["occurred_at"], "area_ha": e["payload"].get("area_ha"),
                              "protocol_name": e["payload"].get("protocol_name")}

    plots_out = []
    for p in my_plots:
        photos = [e for e in my_events if e["plot_id"] == p["id"] and e["payload"].get("photo_url")]
        plots_out.append({
            "id": p["id"], "name": p.get("name"), "area_ha": p.get("area_ha"), "district": p.get("district"), "dsd": p.get("dsd"),
            "gn_division": p.get("gn_division"), "plot_type": p.get("plot_type"), "boundary_source": p.get("boundary_source"),
            "plantings": [v for (pid, _), v in plantings.items() if pid == p["id"]],
            "photo_count": len(photos),
            "last_photo_at": photos[0]["occurred_at"] if photos else None,
            "has_registration_photo": any(e["event_type"] == "plot_photo" for e in photos),
        })

    my_subs = [s for s in subs if s["farmer_id"] == farmer_id]
    std_out = []
    totals = {"approved": 0, "pending": 0, "rejected": 0, "overdue": 0, "upcoming": 0, "waiting": 0, "reopened": 0}
    for std in standards:
        planted = [v for (pid, c), v in plantings.items() if c == std["crop"]]
        planted_at = max((_dt(v["planted_at"]) for v in planted), default=None)
        stages_out = []
        for st in std["stages"]:
            due = planted_at + timedelta(days=st["start_offset_days"] or 0) if planted_at else None
            stage_subs = sorted((x for x in my_subs if x["stage_id"] == st["id"]), key=lambda x: x["submitted_at"], reverse=True)
            latest = stage_subs[0] if stage_subs else None
            status = _stage_status(latest, due, now)
            totals[status] = totals.get(status, 0) + 1
            stages_out.append({
                "id": st["id"], "position": st["position"], "name": st["name"], "timing_type": st["timing_type"],
                "start_offset_days": st["start_offset_days"], "due_date": _iso(due), "status": status,
                "submission_id": latest["id"] if latest else None,
                "submitted_at": latest["submitted_at"] if latest else None,
                "reviewed_at": latest.get("reviewed_at") if latest else None,
                "review_notes": latest.get("review_notes") if latest else None,
                "photo_count": len(latest["photo_urls"] or []) if latest else 0,
                "photos_required": (st.get("required_proof") or {}).get("photo_count", 0),
            })
        done = sum(1 for s in stages_out if s["status"] == "approved")
        std_out.append({
            "standard_id": std["id"], "name": std["name"], "version": std["version"], "crop": std["crop"],
            "planted_at": _iso(planted_at), "days_since_planting": (now - planted_at).days if planted_at else None,
            "stages": stages_out, "approved": done, "total": len(stages_out),
            "applies": bool(planted),
        })

    batches_out = [_batch_summary(b, my_batch_events) for b in my_batches]
    activity = [_dt(e["occurred_at"]) for e in my_events + my_batch_events] + [_dt(s["submitted_at"]) for s in my_subs]
    last_activity = max((a for a in activity if a), default=None)

    needs_attention = totals["rejected"] > 0 or totals["overdue"] > 0
    state = "needs_attention" if needs_attention else ("waiting_review" if totals["pending"] else ("on_track" if plantings else "not_started"))

    return {
        "link_id": link["id"],
        "farmer": link["farmer"],
        "state": state,
        "crops": sorted({v["crop"] for v in plantings.values()}),
        "plots": plots_out,
        "standards": std_out,
        "totals": totals,
        "batches": batches_out,
        "harvested_kg": round(sum(b["weight_kg"] or 0 for b in batches_out), 2),
        "last_activity_at": _iso(last_activity),
        "recent_activity": [
            {"event_type": e["event_type"], "occurred_at": e["occurred_at"], "plot_id": e["plot_id"], "photo_url": e["payload"].get("photo_url"),
             "caption": e["payload"].get("caption"), "crop": e["payload"].get("crop")}
            for e in my_events[:12]
        ],
    }


def _approved_links(exporter_profile_id: str, only_link: Optional[str] = None) -> List[dict]:
    q = (
        supabase.table("farmer_exporter_links")
        .select("id, farmer_id, status, requested_at, decided_at")
        .eq("exporter_profile_id", exporter_profile_id)
        .eq("status", "approved")
    )
    if only_link:
        q = q.eq("id", only_link)
    links = q.execute().data or []
    if not links:
        return []
    users = (
        supabase.table("users")
        .select("id, name, district, dsd, gn_division, phone, farm_size_ha")
        .in_("id", [l["farmer_id"] for l in links])
        .execute()
        .data
        or []
    )
    by_id = {u["id"]: u for u in users}
    for l in links:
        u = by_id.get(l["farmer_id"], {})
        l["farmer"] = {"id": l["farmer_id"], "name": u.get("name") or "Farmer", "district": u.get("district"), "dsd": u.get("dsd"),
                       "gn_division": u.get("gn_division"), "phone": u.get("phone"), "farm_size_ha": u.get("farm_size_ha")}
    return links


def _subs(exporter_profile_id: str, farmer_ids: List[str]) -> List[dict]:
    return (
        supabase.table("stage_proof_submissions")
        .select("id, farmer_id, stage_id, status, photo_urls, submitted_at, reviewed_at, review_notes, reopened_at")
        .eq("exporter_profile_id", exporter_profile_id)
        .in_("farmer_id", farmer_ids)
        .execute()
        .data
        or []
    )


# ── routes ───────────────────────────────────────────────────────────────────

@router.get("/progress")
async def network_progress(current_exporter: dict = Depends(get_current_exporter)):
    """One progress summary per approved farmer, most in need of attention first."""
    profile_id = service.get_exporter_profile_id_for_user(current_exporter["sub"])
    links = _approved_links(profile_id)
    if not links:
        return {"items": [], "summary": {"farmers": 0, "needs_attention": 0, "waiting_review": 0, "on_track": 0, "not_started": 0, "harvested_kg": 0}}
    farmer_ids = [l["farmer_id"] for l in links]
    standards = _published_standards(profile_id)
    data = _field_data(farmer_ids)
    subs = _subs(profile_id, farmer_ids)
    now = datetime.now(timezone.utc)

    items = []
    for l in links:
        p = _progress_for(l, standards, data, subs, now)
        applicable = [s for s in p["standards"] if s["applies"]]
        p["stages_approved"] = sum(s["approved"] for s in applicable)
        p["stages_total"] = sum(s["total"] for s in applicable)
        p["days_since_planting"] = max((s["days_since_planting"] for s in applicable if s["days_since_planting"] is not None), default=None)
        # list view stays light
        for k in ("plots", "standards", "recent_activity", "batches"):
            p["n_" + k] = len(p[k])
            del p[k]
        items.append(p)

    order = {"needs_attention": 0, "waiting_review": 1, "on_track": 2, "not_started": 3}
    items.sort(key=lambda x: (order[x["state"]], x["farmer"]["name"]))
    summary = {k: sum(1 for i in items if i["state"] == k) for k in order}
    summary.update({"farmers": len(items), "harvested_kg": round(sum(i["harvested_kg"] for i in items), 2)})
    return {"items": items, "summary": summary}


@router.get("/{link_id}/progress")
async def farmer_progress(link_id: str, current_exporter: dict = Depends(get_current_exporter)):
    """Full progress picture for one approved farmer."""
    profile_id = service.get_exporter_profile_id_for_user(current_exporter["sub"])
    links = _approved_links(profile_id, only_link=link_id)
    if not links:
        raise HTTPException(status_code=404, detail="Approved farmer link not found")
    link = links[0]
    standards = _published_standards(profile_id)
    data = _field_data([link["farmer_id"]])
    subs = _subs(profile_id, [link["farmer_id"]])
    return _progress_for(link, standards, data, subs, datetime.now(timezone.utc))
