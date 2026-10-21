"""
dispatcher.py — Core reminder dispatch engine for Step 5B planting notice reminders.

Pure dispatcher with injectable 'today' for automated testing and manual CLI triggers.
Enforces:
1. Slots: 30, 14, 7 days before first day of notice.target_month.
2. Catch-up: Sends only the latest due slot; earlier past-due slots recorded skipped ('missed').
3. Exactly-once per (notice, farmer, slot) enforced by DB unique constraint.
4. Skip reasons recorded explicitly:
   - already_replied
   - no_longer_approved
   - ineligible_district
   - district_unknown
   - missed
   - notice_cancelled
   - month_started
5. Daily throttling: Max 1 reminder per farmer per day across all notices; extras stay pending.
6. Max 3 attempts total for failed rows.
7. Language localization: farmer preferred language -> English fallback.
"""
import os
import logging
from datetime import datetime, date, timedelta, timezone
from typing import Optional, List, Dict, Any, Set

from db.supabase import supabase
from notifications.schemas import DispatchCounts, DispatchResult
from notifications.providers.factory import get_notification_provider
from farmer.planting_notices.service import _get_farmer_district
from farmer.ads.service import is_district_eligible

logger = logging.getLogger("notifications.dispatcher")

REMINDER_SLOTS = [30, 14, 7]


def _normalize_to_first_of_month(d: date) -> date:
    """Normalize date to 1st of month."""
    return d.replace(day=1)


def _resolve_text(content_jsonb: Any, lang: str, fallback_lang: str = "en") -> str:
    """Extracts localized text from JSONB map, falling back to fallback_lang, then empty string."""
    if not isinstance(content_jsonb, dict):
        return str(content_jsonb or "")
    val = content_jsonb.get(lang)
    if val and str(val).strip():
        return str(val).strip()
    fallback_val = content_jsonb.get(fallback_lang)
    if fallback_val and str(fallback_val).strip():
        return str(fallback_val).strip()
    for v in content_jsonb.values():
        if v and str(v).strip():
            return str(v).strip()
    return ""


def dispatch_reminders(
    today: Optional[date] = None,
    notice_id: Optional[str] = None,
    dry_run: bool = False,
    mode: str = "manual",
    provider_override: Optional[str] = None,
    db=None,
) -> DispatchResult:
    """
    Main dispatch engine.
    Scans planting notices and schedules/delivers reminders.
    """
    sb = db or supabase
    eval_today = today or datetime.now(timezone.utc).date()
    counts = DispatchCounts()
    processed_items: List[Dict[str, Any]] = []

    # 1. Create a notification_runs row (if live or recorded dry-run)
    run_id: Optional[str] = None
    try:
        run_record = {
            "mode": mode,
            "dry_run": dry_run,
            "today_override": eval_today.isoformat() if today else None,
            "counts": counts.model_dump(),
        }
        res_run = sb.table("notification_runs").insert(run_record).execute()
        if res_run and getattr(res_run, "data", None):
            run_id = str(res_run.data[0]["id"])
    except Exception as exc:
        logger.warning(f"Could not record notification_run entry: {exc}")

    active_provider = get_notification_provider(provider_override)
    provider_name = active_provider.name

    try:
        # 2. Query notices to evaluate
        query = sb.table("planting_notices").select("*")
        if notice_id:
            query = query.eq("id", notice_id)
        else:
            # All published or cancelled notices
            query = query.in_("status", ["published", "cancelled"])

        notices_res = query.execute()
        notices = notices_res.data or []

        # Track farmers who have already been sent a reminder today (across notices)
        sent_today_farmer_ids: Set[str] = set()

        # Query all notifications already sent today to enforce max 1/day across notices
        try:
            today_sent_res = (
                sb.table("notifications")
                .select("farmer_id")
                .eq("status", "sent")
                .gte("sent_at", f"{eval_today.isoformat()}T00:00:00Z")
                .execute()
            )
            for row in (today_sent_res.data or []):
                sent_today_farmer_ids.add(str(row["farmer_id"]))
        except Exception as exc:
            logger.warning(f"Could not pre-fetch today sent farmers: {exc}")

        for notice in notices:
            nid = str(notice["id"])
            exporter_profile_id = str(notice["exporter_profile_id"])
            n_status = notice.get("status")

            # Parse target_month
            raw_tm = notice.get("target_month")
            if isinstance(raw_tm, str):
                target_month_dt = _normalize_to_first_of_month(datetime.strptime(raw_tm[:10], "%Y-%m-%d").date())
            elif isinstance(raw_tm, (datetime, date)):
                target_month_dt = _normalize_to_first_of_month(raw_tm if isinstance(raw_tm, date) else raw_tm.date())
            else:
                continue

            # Calculate slot scheduled dates (first day of target_month minus N days)
            slot_dates = {
                slot: target_month_dt - timedelta(days=slot)
                for slot in REMINDER_SLOTS
            }

            # Check general notice skip conditions
            is_cancelled = (n_status == "cancelled")
            is_month_started = (eval_today >= target_month_dt)

            # Determine due slots based on today:
            # A slot is due if eval_today >= slot_date
            due_slots = [slot for slot in REMINDER_SLOTS if eval_today >= slot_dates[slot]]

            # If no slots are due yet, nothing to evaluate for this notice
            if not due_slots and not is_cancelled:
                continue

            # Product Rule 4 (Catch-up):
            # Send ONLY the most recent due slot (minimum slot number among due slots)
            candidate_slot = min(due_slots) if due_slots else None
            missed_slots = [s for s in due_slots if s > candidate_slot] if candidate_slot else []

            # 3. Query all links (both approved and non-approved) to check approved vs no_longer_approved
            links_res = (
                sb.table("farmer_exporter_links")
                .select("farmer_id, status")
                .eq("exporter_profile_id", exporter_profile_id)
                .execute()
            )
            links = links_res.data or []
            farmer_links_map = {str(link["farmer_id"]): link.get("status") for link in links}

            # 4. Query notice replies to detect already_replied
            replies_res = (
                sb.table("planting_notice_responses")
                .select("farmer_id")
                .eq("notice_id", nid)
                .execute()
            )
            replied_farmer_ids = {str(r["farmer_id"]) for r in (replies_res.data or [])}

            # 5. Query existing notification rows for this notice to avoid duplicates
            existing_notifs_res = (
                sb.table("notifications")
                .select("*")
                .eq("notice_id", nid)
                .execute()
            )
            existing_notifs = existing_notifs_res.data or []
            existing_notifs_map = {
                (str(r["notice_id"]), str(r["farmer_id"]), int(r["reminder_slot"])): r
                for r in existing_notifs
            }

            # 6. Evaluate each linked farmer
            eligible_districts = notice.get("eligible_districts") or []

            for fid, link_status in farmer_links_map.items():
                # Query farmer user record
                user_res = (
                    sb.table("users")
                    .select("id, name, phone, district")
                    .eq("id", fid)
                    .maybe_single()
                    .execute()
                )
                farmer_user = user_res.data if (user_res and getattr(user_res, "data", None)) else {}

                # District lookup using existing 5c helper and column users.district
                f_district = farmer_user.get("district")
                if not f_district or not str(f_district).strip():
                    try:
                        f_district = _get_farmer_district(fid)
                    except Exception as e:
                        logger.debug(f"Could not fetch district for farmer {fid}: {e}")
                        f_district = None

                phone = farmer_user.get("phone")
                farmer_lang = farmer_user.get("preferred_language") or "en"
                notice_title = _resolve_text(notice.get("title"), farmer_lang) or "Planting Notice"
                notice_body = (
                    _resolve_text(notice.get("message"), farmer_lang)
                    or f"Notice for {notice.get('crop', 'crop')} planting in {notice.get('target_month')}."
                )

                # Determine base skip reason (if any)
                base_skip: Optional[str] = None
                if is_cancelled:
                    base_skip = "notice_cancelled"
                elif is_month_started:
                    base_skip = "month_started"
                elif fid in replied_farmer_ids:
                    base_skip = "already_replied"
                elif link_status != "approved":
                    base_skip = "no_longer_approved"
                elif not f_district or not str(f_district).strip():
                    base_skip = "district_unknown"
                elif eligible_districts and not is_district_eligible([f_district], eligible_districts):
                    base_skip = "ineligible_district"

                # Record skipped for earlier missed slots (Catch-up rule)
                for missed_slot in missed_slots:
                    slot_key = (nid, fid, missed_slot)
                    if slot_key not in existing_notifs_map:
                        reason = base_skip or "missed"
                        if not dry_run:
                            try:
                                insert_payload = {
                                    "farmer_id": fid,
                                    "notice_id": nid,
                                    "reminder_slot": missed_slot,
                                    "channel": "in_app",
                                    "status": "skipped",
                                    "skip_reason": reason,
                                    "title": notice_title,
                                    "body": notice_body,
                                    "language": farmer_lang,
                                    "scheduled_for": slot_dates[missed_slot].isoformat(),
                                    "provider": provider_name,
                                    "attempts": 0,
                                }
                                ins_res = sb.table("notifications").insert(insert_payload).execute()
                                if ins_res and getattr(ins_res, "data", None):
                                    counts.skipped += 1
                                    existing_notifs_map[slot_key] = ins_res.data[0]
                            except Exception as exc:
                                logger.info(f"Notification already recorded for slot {missed_slot}: {exc}")
                        else:
                            counts.skipped += 1
                            processed_items.append({
                                "notice_id": nid,
                                "farmer_id": fid,
                                "reminder_slot": missed_slot,
                                "status": "skipped",
                                "skip_reason": reason,
                                "dry_run": True,
                            })

                if not candidate_slot:
                    continue

                slot_key = (nid, fid, candidate_slot)
                existing_row = existing_notifs_map.get(slot_key)

                # If candidate slot has a skip reason
                if base_skip:
                    if slot_key not in existing_notifs_map:
                        if not dry_run:
                            try:
                                insert_payload = {
                                    "farmer_id": fid,
                                    "notice_id": nid,
                                    "reminder_slot": candidate_slot,
                                    "channel": "in_app",
                                    "status": "skipped",
                                    "skip_reason": base_skip,
                                    "title": notice_title,
                                    "body": notice_body,
                                    "language": farmer_lang,
                                    "scheduled_for": slot_dates[candidate_slot].isoformat(),
                                    "provider": provider_name,
                                    "attempts": 0,
                                }
                                ins_res = sb.table("notifications").insert(insert_payload).execute()
                                if ins_res and getattr(ins_res, "data", None):
                                    counts.skipped += 1
                                    existing_notifs_map[slot_key] = ins_res.data[0]
                            except Exception as exc:
                                logger.info(f"Conflict recording skip for {slot_key}: {exc}")
                        else:
                            counts.skipped += 1
                            processed_items.append({
                                "notice_id": nid,
                                "farmer_id": fid,
                                "reminder_slot": candidate_slot,
                                "status": "skipped",
                                "skip_reason": base_skip,
                                "dry_run": True,
                            })
                    continue

                # If row already exists and is finished (sent or skipped or read)
                if existing_row and existing_row.get("status") in ["sent", "skipped", "read"]:
                    continue

                # If existing row failed with attempts >= 3: do not retry
                if existing_row and int(existing_row.get("attempts") or 0) >= 3:
                    continue

                # Product Rule 5: Max 1 reminder per farmer per day across all notices
                if fid in sent_today_farmer_ids:
                    counts.deferred += 1
                    # Ensure a pending row exists so it is picked up tomorrow
                    if not existing_row and not dry_run:
                        try:
                            insert_payload = {
                                "farmer_id": fid,
                                "notice_id": nid,
                                "reminder_slot": candidate_slot,
                                "channel": "in_app",
                                "status": "pending",
                                "title": notice_title,
                                "body": notice_body,
                                "language": farmer_lang,
                                "scheduled_for": slot_dates[candidate_slot].isoformat(),
                                "provider": provider_name,
                                "attempts": 0,
                            }
                            ins_res = sb.table("notifications").insert(insert_payload).execute()
                            if ins_res and getattr(ins_res, "data", None):
                                counts.created += 1
                                existing_notifs_map[slot_key] = ins_res.data[0]
                        except Exception as exc:
                            logger.warning(f"Could not insert deferred pending notification: {exc}")
                    continue

                # Eligible for delivery!
                if dry_run:
                    counts.sent += 1
                    sent_today_farmer_ids.add(fid)
                    processed_items.append({
                        "notice_id": nid,
                        "farmer_id": fid,
                        "reminder_slot": candidate_slot,
                        "status": "sent",
                        "dry_run": True,
                    })
                    continue

                # Live dispatch: Claim or create row
                notif_record = existing_row
                if not notif_record:
                    try:
                        insert_payload = {
                            "farmer_id": fid,
                            "notice_id": nid,
                            "reminder_slot": candidate_slot,
                            "channel": "in_app",
                            "status": "pending",
                            "title": notice_title,
                            "body": notice_body,
                            "language": farmer_lang,
                            "scheduled_for": slot_dates[candidate_slot].isoformat(),
                            "provider": provider_name,
                            "attempts": 0,
                        }
                        ins_res = sb.table("notifications").insert(insert_payload).execute()
                        if ins_res and getattr(ins_res, "data", None):
                            counts.created += 1
                            notif_record = ins_res.data[0]
                            existing_notifs_map[slot_key] = notif_record
                        else:
                            continue
                    except Exception as exc:
                        logger.info(f"Conflict or error creating notification {slot_key}: {exc}")
                        continue

                # Atomic row transition: pending/failed -> sending
                notif_id = str(notif_record["id"])
                current_attempts = int(notif_record.get("attempts") or 0)
                if current_attempts >= 3:
                    continue

                try:
                    claim_res = (
                        sb.table("notifications")
                        .update({"status": "sending"})
                        .eq("id", notif_id)
                        .in_("status", ["pending", "failed"])
                        .execute()
                    )
                    if not claim_res or not getattr(claim_res, "data", None):
                        continue
                except Exception as exc:
                    logger.warning(f"Failed to claim notification {notif_id}: {exc}")
                    continue

                # Deliver through provider
                payload_to_send = {
                    "id": notif_id,
                    "farmer_id": fid,
                    "notice_id": nid,
                    "reminder_slot": candidate_slot,
                    "channel": notif_record.get("channel", "in_app"),
                    "title": notice_title,
                    "body": notice_body,
                    "language": farmer_lang,
                    "phone": phone,
                }

                try:
                    res_provider = active_provider.send(payload_to_send)
                    if res_provider.ok:
                        now_ts = datetime.now(timezone.utc).isoformat()
                        sb.table("notifications").update({
                            "status": "sent",
                            "sent_at": now_ts,
                            "provider_message_id": res_provider.provider_message_id,
                            "attempts": current_attempts + 1,
                            "last_error": None,
                        }).eq("id", notif_id).execute()

                        counts.sent += 1
                        sent_today_farmer_ids.add(fid)
                        processed_items.append({
                            "id": notif_id,
                            "notice_id": nid,
                            "farmer_id": fid,
                            "reminder_slot": candidate_slot,
                            "status": "sent",
                        })
                    else:
                        err_msg = res_provider.error or "Provider returned not ok"
                        sb.table("notifications").update({
                            "status": "failed",
                            "attempts": current_attempts + 1,
                            "last_error": err_msg,
                        }).eq("id", notif_id).execute()

                        counts.failed += 1
                        processed_items.append({
                            "id": notif_id,
                            "notice_id": nid,
                            "farmer_id": fid,
                            "reminder_slot": candidate_slot,
                            "status": "failed",
                            "error": err_msg,
                        })
                except Exception as exc:
                    err_msg = str(exc)
                    logger.error(f"Provider exception for notification {notif_id}: {err_msg}")
                    try:
                        sb.table("notifications").update({
                            "status": "failed",
                            "attempts": current_attempts + 1,
                            "last_error": err_msg,
                        }).eq("id", notif_id).execute()
                    except Exception:
                        pass
                    counts.failed += 1
                    processed_items.append({
                        "id": notif_id,
                        "notice_id": nid,
                        "farmer_id": fid,
                        "reminder_slot": candidate_slot,
                        "status": "failed",
                        "error": err_msg,
                    })

    except Exception as exc:
        err_str = str(exc)
        logger.exception(f"Unhandled error in dispatch_reminders: {err_str}")
        if run_id:
            try:
                finished_at = datetime.now(timezone.utc).isoformat()
                sb.table("notification_runs").update({
                    "finished_at": finished_at,
                    "counts": counts.model_dump(),
                    "error": err_str,
                }).eq("id", run_id).execute()
            except Exception:
                pass
        return DispatchResult(
            run_id=run_id,
            mode=mode,
            dry_run=dry_run,
            today=eval_today.isoformat(),
            counts=counts,
            items=processed_items,
            error=err_str,
        )

    # Finalize notification_runs record
    finished_at = datetime.now(timezone.utc).isoformat()
    if run_id:
        try:
            sb.table("notification_runs").update({
                "finished_at": finished_at,
                "counts": counts.model_dump(),
                "error": None,
            }).eq("id", run_id).execute()
        except Exception as exc:
            logger.warning(f"Could not finalize notification_runs record {run_id}: {exc}")

    return DispatchResult(
        run_id=run_id,
        mode=mode,
        dry_run=dry_run,
        today=eval_today.isoformat(),
        counts=counts,
        items=processed_items,
        error=None,
    )
