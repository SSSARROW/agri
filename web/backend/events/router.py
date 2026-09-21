from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends, Query, Response
from auth.router import get_current_user
from db.supabase import supabase
from events.schemas import EventCreate, EventResponse, PaginatedEventsResponse
from events.validators import validate_payload

router = APIRouter(prefix="/events", tags=["events"])

KNOWN_EVENT_TYPES = {"planted", "harvested", "weighed", "graded", "packed", "transferred"}

def sanitize_event(event: dict) -> dict:
    event_copy = event.copy()

    payload = event_copy.get("payload")
    if not isinstance(payload, dict):
        event_copy["payload"] = {}

    if "batch_id" not in event_copy:
        event_copy["batch_id"] = None

    if "plot_id" not in event_copy:
        event_copy["plot_id"] = None

    occurred_at = event_copy.get("occurred_at")
    if isinstance(occurred_at, datetime):
        event_copy["occurred_at"] = occurred_at.isoformat()
    elif occurred_at is not None:
        event_copy["occurred_at"] = str(occurred_at)

    recorded_at = event_copy.get("recorded_at")
    if isinstance(recorded_at, datetime):
        event_copy["recorded_at"] = recorded_at.isoformat()
    elif recorded_at is not None:
        event_copy["recorded_at"] = str(recorded_at)

    return event_copy


@router.post("", response_model=EventResponse)
async def create_event(
    body: EventCreate,
    response: Response,
    current_user: dict = Depends(get_current_user)
):
    # 1. Idempotency Check: check if event with body.id already exists
    existing_res = supabase.table("event").select("*").eq("id", body.id).execute()
    if existing_res.data:
        response.status_code = 200
        return sanitize_event(existing_res.data[0])

    # 2. Validate event_type is known
    if body.event_type not in KNOWN_EVENT_TYPES:
        raise HTTPException(
            status_code=422,
            detail="Unknown event_type. Must be one of: planted, harvested, weighed, graded, packed, transferred"
        )

    # 3. Validate payload fields per event_type
    validate_payload(body.event_type, body.payload)

    # 4. Prepare event record
    user_id = current_user.get("id") or current_user.get("sub")
    recorded_at = datetime.now(timezone.utc).isoformat()
    occurred_at = body.occurred_at.isoformat() if isinstance(body.occurred_at, datetime) else str(body.occurred_at)

    new_event = {
        "id": body.id,
        "event_type": body.event_type,
        "user_id": user_id,
        "batch_id": body.batch_id,
        "plot_id": body.plot_id,
        "payload": body.payload,
        "occurred_at": occurred_at,
        "recorded_at": recorded_at
    }

    # 5. Insert row into database
    insert_res = supabase.table("event").insert(new_event).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to create event record")

    response.status_code = 201
    return sanitize_event(insert_res.data[0])


@router.get("", response_model=PaginatedEventsResponse)
async def list_events(
    batch_id: Optional[str] = Query(None, description="Filter by batch ID"),
    plot_id: Optional[str] = Query(None, description="Filter by plot ID"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    query = supabase.table("event").select("*", count="exact")

    if batch_id and batch_id.strip():
        query = query.eq("batch_id", batch_id.strip())

    if plot_id and plot_id.strip():
        query = query.eq("plot_id", plot_id.strip())

    if event_type and event_type.strip():
        query = query.eq("event_type", event_type.strip())

    if user_id and user_id.strip():
        query = query.eq("user_id", user_id.strip())

    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size - 1

    res = query.range(start_idx, end_idx).order("occurred_at", desc=True).execute()

    total_count = res.count if res.count is not None else len(res.data or [])
    items = [sanitize_event(e) for e in (res.data or [])]
    total_pages = (total_count + page_size - 1) // page_size if total_count > 0 else 1

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: str,
    current_user: dict = Depends(get_current_user)
):
    res = supabase.table("event").select("*").eq("id", event_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Event not found")

    return sanitize_event(res.data[0])
