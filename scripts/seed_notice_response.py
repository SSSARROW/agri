#!/usr/bin/env python3
"""
seed_notice_response.py
-----------------------
Submits or updates a farmer response (Ready or Cannot) for a planting notice.
Enables CLI testing and simulation of farmer replies before the mobile screens are built.

Usage:
------
1. Submit Ready reply:
   python scripts/seed_notice_response.py \
       --notice <notice-uuid> \
       --farmer <farmer-uuid-or-email-or-phone> \
       --response ready \
       --volume 750 \
       [--plot <plot-uuid>]

2. Submit Cannot reply:
   python scripts/seed_notice_response.py \
       --notice <notice-uuid> \
       --farmer <farmer-uuid-or-email-or-phone> \
       --response cannot
"""
import sys
import os
import argparse
import uuid as _uuid

# Add web/backend to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "web", "backend"))

from db.supabase import supabase
from farmer.planting_notices.service import respond_to_notice, list_farmer_plots


def is_valid_uuid(s: str) -> bool:
    try:
        _uuid.UUID(s)
        return True
    except ValueError:
        return False


def lookup_farmer(identifier: str) -> dict:
    if is_valid_uuid(identifier):
        res = supabase.table("users").select("id, name, email, phone, role").eq("id", identifier).maybe_single().execute()
    else:
        res = supabase.table("users").select("id, name, email, phone, role").or_(
            f"email.eq.{identifier},phone.eq.{identifier}"
        ).maybe_single().execute()

    if not res or not res.data:
        print(f"[ERROR] No user found matching identifier '{identifier}'.")
        sys.exit(1)

    u = res.data
    if u.get("role") != "farmer":
        print(f"[WARNING] User '{u.get('name')}' has role '{u.get('role')}', expected 'farmer'.")
    return u


def main():
    parser = argparse.ArgumentParser(description="Seed farmer planting notice response.")
    parser.add_argument("--notice", required=True, help="Planting notice UUID")
    parser.add_argument("--farmer", required=True, help="Farmer UUID, email, or phone")
    parser.add_argument("--response", required=True, choices=["ready", "cannot"], help="Response choice")
    parser.add_argument("--volume", type=float, help="Expected volume in kg (required if ready)")
    parser.add_argument("--plot", help="Plot UUID (optional; will pick first owned plot if omitted when ready)")

    args = parser.parse_args()

    farmer = lookup_farmer(args.farmer)
    farmer_id = farmer["id"]
    print(f"Loaded Farmer: {farmer['name']} ({farmer_id})")

    plot_id = args.plot
    if args.response == "ready":
        if not args.volume or args.volume <= 0:
            print("[ERROR] --volume (> 0) is required when responding 'ready'.")
            sys.exit(1)

        if not plot_id:
            plots = list_farmer_plots(farmer_id)
            if not plots:
                print(f"[ERROR] Farmer '{farmer['name']}' has no plots registered. Cannot respond Ready.")
                sys.exit(1)
            plot_id = plots[0]["id"]
            print(f"Auto-selected farmer plot: {plots[0]['name']} ({plot_id}) - {plots[0]['area_ha']} ha")

    payload = {
        "response": args.response,
        "expected_volume_kg": args.volume if args.response == "ready" else None,
        "plot_id": plot_id if args.response == "ready" else None,
    }

    print(f"Submitting response for notice {args.notice}...")
    try:
        res = respond_to_notice(args.notice, farmer_id, payload)
        print("[SUCCESS] Response recorded successfully!")
        print(f"  Response: {res['response']}")
        if res.get("expected_volume_kg"):
            print(f"  Volume:   {res['expected_volume_kg']} kg")
        if res.get("plot_id"):
            print(f"  Plot ID:  {res['plot_id']}")
        print(f"  Message:  {res['message']}")
    except Exception as e:
        print(f"[ERROR] Failed to submit response: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
