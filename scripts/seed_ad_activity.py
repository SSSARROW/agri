#!/usr/bin/env python3
"""
seed_ad_activity.py
Records views and/or a report for a given ad as a given farmer.
Usage:
  python scripts/seed_ad_activity.py \
      --ad <ad-id> \
      --farmer <farmer-uuid-or-email-or-phone> \
      [--views 5] \
      [--report fake_ad] [--details "Optional details"]

Farmer lookup:
  - If input is a valid UUID, it is used directly.
  - Otherwise, looks up by email or phone in the users table.
"""
import sys
import os
import argparse
import uuid as _uuid

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "web", "backend"))

from db.supabase import supabase
from farmer.ads.views import record_view
from farmer.ads.reports.service import submit_report
from datetime import date, timedelta


def is_valid_uuid(s: str) -> bool:
    try:
        _uuid.UUID(s)
        return True
    except ValueError:
        return False


def lookup_farmer(identifier: str) -> str:
    """Returns farmer UUID. Raises SystemExit with clear message if not found."""
    if is_valid_uuid(identifier):
        res = supabase.table("users").select("id, name, email").eq("id", identifier).maybe_single().execute()
        if res and res.data:
            print(f"  Farmer: {res.data.get('name')} <{res.data.get('email')}> (UUID direct)")
            return identifier
        print(f"ERROR: No user found with UUID '{identifier}'.")
        _list_farmers()
        sys.exit(1)
    else:
        # Search by email or phone
        res = supabase.table("users").select("id, name, email, phone").or_(
            f"email.eq.{identifier},phone.eq.{identifier}"
        ).maybe_single().execute()
        if res and res.data:
            u = res.data
            print(f"  Farmer: {u.get('name')} <{u.get('email')}> ({u.get('id')})")
            return u["id"]
        print(f"ERROR: No user found matching '{identifier}'.")
        _list_farmers()
        sys.exit(1)


def _list_farmers():
    res = supabase.table("users").select("id, name, email, phone").eq("role", "farmer").limit(10).execute()
    if res and res.data:
        print("\nAvailable farmers (first 10):")
        for u in res.data:
            print(f"  {u['id']}  {u.get('name','?')}  {u.get('email','')}  {u.get('phone','')}")


def main():
    parser = argparse.ArgumentParser(description="Seed ad views and/or a report.")
    parser.add_argument("--ad", required=True, help="Ad UUID")
    parser.add_argument("--farmer", required=True, help="Farmer UUID, email, or phone")
    parser.add_argument("--views", type=int, default=1, help="Number of days of views to seed (default 1)")
    parser.add_argument("--report", choices=["fake_ad", "wrong_information", "suspicious_exporter", "other"], help="Submit a report with this reason")
    parser.add_argument("--details", default=None, help="Optional report details (max 500 chars)")
    args = parser.parse_args()

    print(f"\nLooking up farmer '{args.farmer}'...")
    farmer_id = lookup_farmer(args.farmer)

    print(f"\nSeeding {args.views} view(s) for ad {args.ad}...")
    today = date.today()
    for i in range(args.views):
        day = (today - timedelta(days=i)).isoformat()
        try:
            supabase.table("ad_views").insert(
                {"ad_id": args.ad, "farmer_id": farmer_id, "view_date": day},
                returning="minimal",
            ).execute()
            print(f"  ✓ View recorded for {day}")
        except Exception as e:
            if "unique" in str(e).lower():
                print(f"  — View for {day} already exists (skipped)")
            else:
                print(f"  ✗ Failed for {day}: {e}")

    if args.report:
        print(f"\nSubmitting report '{args.report}'...")
        try:
            result = submit_report(
                ad_id=args.ad,
                farmer_id=farmer_id,
                reason=args.report,
                details=args.details,
            )
            print(f"  ✓ Report submitted: {result['report_id']}")
        except Exception as e:
            print(f"  ✗ Report failed: {e}")

    print("\nDone.")


if __name__ == "__main__":
    main()
