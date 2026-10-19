#!/usr/bin/env python3
"""
run_notice_reminders.py
-----------------------
Manual and CLI entry point for Step 5B planting notice reminders dispatch.

Usage:
------
1. Normal live run for today:
   python scripts/run_notice_reminders.py

2. Dry-run simulation (no notifications written, shows what would be sent):
   python scripts/run_notice_reminders.py --dry-run

3. Override date for historical or forward testing:
   python scripts/run_notice_reminders.py --today 2026-10-18 --dry-run

4. Run for a single planting notice:
   python scripts/run_notice_reminders.py --notice <notice-uuid>
"""
import sys
import os
import argparse
from datetime import datetime

from dotenv import load_dotenv

# Add web/backend to sys.path and load its .env file
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web", "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from notifications.dispatcher import dispatch_reminders


def main():
    parser = argparse.ArgumentParser(description="Dispatch Step 5B planting notice reminders.")
    parser.add_argument("--dry-run", action="store_true", help="Calculate dispatch actions without sending or writing notifications.")
    parser.add_argument("--today", type=str, help="Override today's date (YYYY-MM-DD) for evaluation.")
    parser.add_argument("--notice", type=str, help="Scope dispatch to a specific planting notice UUID.")
    parser.add_argument("--provider", type=str, help="Override delivery provider (e.g. mock, in_app).")

    args = parser.parse_args()

    eval_today = None
    if args.today:
        try:
            eval_today = datetime.strptime(args.today, "%Y-%m-%d").date()
        except ValueError:
            print(f"Error: Invalid date format '{args.today}'. Expected YYYY-MM-DD.")
            sys.exit(1)

    print("============================================================")
    print("Parampara Planting Notice Reminders Dispatch")
    print("============================================================")
    print(f"Mode: {'DRY RUN (simulation)' if args.dry_run else 'LIVE DISPATCH'}")
    print(f"Evaluation Date: {eval_today.isoformat() if eval_today else 'Today (UTC)'}")
    if args.notice:
        print(f"Notice Filter: {args.notice}")
    if args.provider:
        print(f"Provider Override: {args.provider}")
    print("------------------------------------------------------------")

    res = dispatch_reminders(
        today=eval_today,
        notice_id=args.notice,
        dry_run=args.dry_run,
        mode="manual",
        provider_override=args.provider,
    )

    print("\nResults:")
    print(f"  Run ID:    {res.run_id or 'None'}")
    print(f"  Created:   {res.counts.created}")
    print(f"  Sent:      {res.counts.sent}")
    print(f"  Failed:    {res.counts.failed}")
    print(f"  Skipped:   {res.counts.skipped}")
    print(f"  Deferred:  {res.counts.deferred}")

    if res.error:
        print(f"\n[!] Errors reported: {res.error}")

    if res.items:
        print(f"\nProcessed Items ({len(res.items)}):")
        for item in res.items[:15]:
            status = item.get("status")
            farmer = item.get("farmer_id")
            slot = item.get("reminder_slot")
            reason = item.get("skip_reason") or item.get("error") or ""
            print(f"  - Farmer {farmer[:8]}... Slot {slot}d: [{status}] {reason}")
        if len(res.items) > 15:
            print(f"  ... and {len(res.items) - 15} more items.")

    print("\nDone.")


if __name__ == "__main__":
    main()
