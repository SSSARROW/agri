import os
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from db.supabase import supabase
from notifications.dispatcher import dispatch_reminders

logger = logging.getLogger("notifications.scheduler")

_scheduler_task: Optional[asyncio.Task] = None
_should_run = False


async def _scheduler_loop():
    global _should_run
    logger.info("Notice reminder scheduler loop started.")

    target_hour = int(os.getenv("NOTICE_SCHEDULER_HOUR", "2"))  # 2 AM UTC default
    check_interval_seconds = int(os.getenv("NOTICE_SCHEDULER_INTERVAL_SEC", "3600"))

    while _should_run:
        try:
            now_utc = datetime.now(timezone.utc)
            today_str = now_utc.date().isoformat()

            # Run if in the target hour window
            if now_utc.hour == target_hour:
                # DB-level guard: check if scheduler run already started today
                existing_run = (
                    supabase.table("notification_runs")
                    .select("id")
                    .eq("mode", "scheduler")
                    .eq("dry_run", False)
                    .gte("started_at", f"{today_str}T00:00:00Z")
                    .execute()
                )
                if not (existing_run.data and len(existing_run.data) > 0):
                    logger.info(f"Triggering scheduled notice reminders dispatch for {today_str} (hour={target_hour})")
                    dispatch_reminders(mode="scheduler")
                else:
                    logger.debug(f"Scheduler run for {today_str} already recorded; skipping duplicate run.")
        except Exception as exc:
            logger.error(f"Error in notice reminder scheduler loop: {exc}")

        await asyncio.sleep(check_interval_seconds)


def start_scheduler():
    """Starts the in-process reminder scheduler if ENABLE_NOTICE_SCHEDULER is true."""
    global _scheduler_task, _should_run
    enable_scheduler = os.getenv("ENABLE_NOTICE_SCHEDULER", "false").lower() == "true"
    if not enable_scheduler:
        logger.info("Notice reminder scheduler is disabled (ENABLE_NOTICE_SCHEDULER is false).")
        return

    if _scheduler_task is not None and not _scheduler_task.done():
        logger.warning("Notice reminder scheduler is already running.")
        return

    _should_run = True
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            _scheduler_task = loop.create_task(_scheduler_loop())
        else:
            logger.warning("Event loop is not running; scheduler task deferred.")
    except Exception as exc:
        logger.error(f"Failed to start notice reminder scheduler: {exc}")


def stop_scheduler():
    """Stops the in-process reminder scheduler."""
    global _scheduler_task, _should_run
    _should_run = False
    if _scheduler_task and not _scheduler_task.done():
        _scheduler_task.cancel()
        logger.info("Notice reminder scheduler stopped.")
