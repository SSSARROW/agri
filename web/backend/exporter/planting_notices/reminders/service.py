import os
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any
from fastapi import HTTPException

from db.supabase import supabase
from notifications.providers.factory import get_notification_provider

REMINDER_SLOTS = [30, 14, 7]


def _normalize_to_first_of_month(d: date) -> date:
    return d.replace(day=1)


def get_notice_reminders(
    notice_id: str,
    exporter_profile_id: str,
    slot_filter: Optional[int] = None,
    status_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """Fetch slot statistics and paginated delivery outbox for a planting notice."""
    # 1. Verify notice ownership
    notice_res = (
        supabase.table("planting_notices")
        .select("id, exporter_profile_id, target_month")
        .eq("id", notice_id)
        .maybe_single()
        .execute()
    )
    if not notice_res or not getattr(notice_res, "data", None):
        raise HTTPException(status_code=404, detail="Planting notice not found.")

    notice = notice_res.data
    if str(notice["exporter_profile_id"]) != str(exporter_profile_id):
        raise HTTPException(status_code=404, detail="Planting notice not found.")

    # 2. Parse target_month and compute slot dates
    raw_tm = notice.get("target_month")
    if isinstance(raw_tm, str):
        target_month_dt = _normalize_to_first_of_month(datetime.strptime(raw_tm[:10], "%Y-%m-%d").date())
    elif isinstance(raw_tm, (datetime, date)):
        target_month_dt = _normalize_to_first_of_month(raw_tm if isinstance(raw_tm, date) else raw_tm.date())
    else:
        target_month_dt = date.today().replace(day=1)

    slot_dates = {
        s: (target_month_dt - timedelta(days=s)).isoformat()
        for s in REMINDER_SLOTS
    }

    # 3. Query all notifications for slot stats
    all_notifs_res = (
        supabase.table("notifications")
        .select("id, reminder_slot, status, skip_reason")
        .eq("notice_id", notice_id)
        .execute()
    )
    all_notifs = all_notifs_res.data or []

    # Aggregate stats per slot
    stats_by_slot = {
        s: {
            "slot": s,
            "scheduled_date": slot_dates[s],
            "sent": 0,
            "failed": 0,
            "skipped": 0,
            "skipped_reasons": {},
            "pending": 0,
        }
        for s in REMINDER_SLOTS
    }

    for n in all_notifs:
        s = int(n["reminder_slot"])
        st = n.get("status")
        if s not in stats_by_slot:
            continue
        if st in ("sent", "read"):
            stats_by_slot[s]["sent"] += 1
        elif st == "failed":
            stats_by_slot[s]["failed"] += 1
        elif st == "skipped":
            stats_by_slot[s]["skipped"] += 1
            reason = n.get("skip_reason") or "other"
            stats_by_slot[s]["skipped_reasons"][reason] = (
                stats_by_slot[s]["skipped_reasons"].get(reason, 0) + 1
            )
        elif st in ("pending", "sending"):
            stats_by_slot[s]["pending"] += 1

    # 4. Query paginated deliveries
    query = supabase.table("notifications").select(
        "id, farmer_id, reminder_slot, channel, status, skip_reason, sent_at, attempts, last_error, created_at",
        count="exact",
    ).eq("notice_id", notice_id)

    if slot_filter in REMINDER_SLOTS:
        query = query.eq("reminder_slot", slot_filter)
    if status_filter and status_filter.strip():
        query = query.eq("status", status_filter.strip())

    query = query.order("created_at", desc=True)

    start = (page - 1) * page_size
    end = start + page_size - 1
    paged_res = query.range(start, end).execute()
    items = paged_res.data or []
    total = paged_res.count or len(items)

    # Enrich farmer names from users (NO phone, NIC, or passwords!)
    farmer_ids = list({str(it["farmer_id"]) for it in items if it.get("farmer_id")})
    farmer_names: Dict[str, str] = {}
    if farmer_ids:
        try:
            u_res = supabase.table("users").select("id, name").in_("id", farmer_ids).execute()
            for u in (u_res.data or []):
                farmer_names[str(u["id"])] = u.get("name") or "Farmer"
        except Exception:
            pass

    delivery_items = []
    for it in items:
        delivery_items.append({
            "id": str(it["id"]),
            "farmer_name": farmer_names.get(str(it["farmer_id"]), "Farmer"),
            "reminder_slot": int(it["reminder_slot"]),
            "channel": it.get("channel", "in_app"),
            "status": it.get("status", "pending"),
            "skip_reason": it.get("skip_reason"),
            "sent_at": it.get("sent_at"),
            "attempts": int(it.get("attempts") or 0),
            "last_error": it.get("last_error"),
            "created_at": it.get("created_at", ""),
        })

    active_provider = get_notification_provider()
    total_pages = max(1, (total + page_size - 1) // page_size)

    return {
        "notice_id": notice_id,
        "provider": active_provider.name,
        "slots": [stats_by_slot[s] for s in REMINDER_SLOTS],
        "deliveries": delivery_items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


def retry_failed_reminders(notice_id: str, exporter_profile_id: str) -> dict:
    """Resets failed reminders with attempts < 3 to pending for subsequent dispatch."""
    # 1. Verify notice ownership
    notice_res = (
        supabase.table("planting_notices")
        .select("id, exporter_profile_id")
        .eq("id", notice_id)
        .maybe_single()
        .execute()
    )
    if not notice_res or not getattr(notice_res, "data", None):
        raise HTTPException(status_code=404, detail="Planting notice not found.")

    notice = notice_res.data
    if str(notice["exporter_profile_id"]) != str(exporter_profile_id):
        raise HTTPException(status_code=404, detail="Planting notice not found.")

    # 2. Reset failed rows where attempts < 3
    update_res = (
        supabase.table("notifications")
        .update({"status": "pending", "last_error": None})
        .eq("notice_id", notice_id)
        .eq("status", "failed")
        .lt("attempts", 3)
        .execute()
    )
    retried_rows = update_res.data or []
    count = len(retried_rows)

    return {
        "notice_id": notice_id,
        "retried_count": count,
        "message": f"Reset {count} failed reminder(s) to pending.",
    }
