from datetime import datetime, timezone
from typing import Dict, Any, List
from fastapi import HTTPException
from db.supabase import supabase


def list_farmer_notifications(
    farmer_id: str,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """
    List delivered notifications (status 'sent' or 'read') for the farmer,
    ordered newest first, along with the unread count. Safe empty list on no rows.
    """
    # 1. Count unread
    unread_res = (
        supabase.table("notifications")
        .select("id", count="exact")
        .eq("farmer_id", farmer_id)
        .eq("status", "sent")
        .execute()
    )
    unread_count = unread_res.count or 0

    # 2. Paginated query for sent or read notifications
    query = (
        supabase.table("notifications")
        .select(
            "id, notice_id, reminder_slot, title, body, language, channel, status, sent_at, read_at, created_at",
            count="exact",
        )
        .eq("farmer_id", farmer_id)
        .in_("status", ["sent", "read"])
        .order("created_at", desc=True)
    )

    start = (page - 1) * page_size
    end = start + page_size - 1
    paged_res = query.range(start, end).execute()
    items = paged_res.data or []
    total = paged_res.count or len(items)
    total_pages = max(1, (total + page_size - 1) // page_size)

    return {
        "items": items,
        "total": total,
        "unread_count": unread_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


def mark_notification_read(notification_id: str, farmer_id: str) -> dict:
    """
    Marks a notification as read. Idempotent: if already read, returns 200.
    Returns 404 if not found or belongs to another farmer.
    """
    res = (
        supabase.table("notifications")
        .select("id, farmer_id, status, read_at")
        .eq("id", notification_id)
        .maybe_single()
        .execute()
    )
    if not res or not getattr(res, "data", None):
        raise HTTPException(status_code=404, detail="Notification not found.")

    row = res.data
    if str(row["farmer_id"]) != str(farmer_id):
        raise HTTPException(status_code=404, detail="Notification not found.")

    if row.get("status") == "read" and row.get("read_at"):
        return {
            "id": notification_id,
            "status": "read",
            "read_at": row["read_at"],
        }

    now_ts = datetime.now(timezone.utc).isoformat()
    upd_res = (
        supabase.table("notifications")
        .update({"status": "read", "read_at": now_ts})
        .eq("id", notification_id)
        .execute()
    )
    if not upd_res.data:
        raise HTTPException(status_code=500, detail="Failed to mark notification as read.")

    return {
        "id": notification_id,
        "status": "read",
        "read_at": now_ts,
    }
