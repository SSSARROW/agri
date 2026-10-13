"""
seed_farmer_link.py
-------------------
CLI script to create a requested (or approved) link between a farmer and an exporter.
Enables testing of the Exporter 'My Farmers' UI before the farmer mobile app picker is wired up.

Usage:
------
1. Link by email:
   python scripts/seed_farmer_link.py --farmer farmer@test.lk --exporter exporter@test.lk

2. Specify status (requested | approved):
   python scripts/seed_farmer_link.py --farmer farmer@test.lk --exporter exporter@test.lk --status approved

3. Auto-seed with any available farmer and exporter:
   python scripts/seed_farmer_link.py --auto

SQL Alternative (Run in Supabase SQL Editor):
--------------------------------------------
INSERT INTO public.farmer_exporter_links (farmer_id, exporter_profile_id, status)
VALUES (
    (SELECT id FROM public.users WHERE role = 'farmer' LIMIT 1),
    (SELECT id FROM public.exporter_profiles WHERE status = 'verified' LIMIT 1),
    'requested'
)
ON CONFLICT (farmer_id) WHERE status IN ('requested', 'approved')
DO UPDATE SET status = 'requested', updated_at = now();
"""
import sys
import argparse
from pathlib import Path

# Add web/backend to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from db.supabase import supabase  # noqa: E402
from exporter.farmers.service import get_exporter_profile_id_for_user  # noqa: E402


def find_user_by_email_or_id(identifier: str, expected_role: str = None) -> dict:
    # Try by id first if valid uuid, else by email
    res = supabase.table("users").select("*").eq("id", identifier).execute()
    if not res.data:
        res = supabase.table("users").select("*").eq("email", identifier).execute()

    if not res.data:
        print(f"[ERROR] User not found for '{identifier}'")
        sys.exit(1)

    user = res.data[0]
    if expected_role and user.get("role") != expected_role:
        print(f"[WARNING] User '{identifier}' has role '{user.get('role')}', expected '{expected_role}'.")
    return user


def find_first_user(role: str) -> dict:
    res = supabase.table("users").select("*").eq("role", role).limit(1).execute()
    if not res.data:
        print(f"[ERROR] No user found with role '{role}'. Please create one first.")
        sys.exit(1)
    return res.data[0]


def main():
    parser = argparse.ArgumentParser(description="Create a test link between a farmer and an exporter.")
    parser.add_argument("--farmer", help="Farmer email or UUID")
    parser.add_argument("--exporter", help="Exporter email or UUID")
    parser.add_argument("--status", default="requested", choices=["requested", "approved", "declined", "removed"],
                        help="Link status (default: requested)")
    parser.add_argument("--auto", action="store_true", help="Auto-select first available farmer and verified exporter")
    args = parser.parse_args()

    if args.auto:
        farmer = find_first_user("farmer")
        exporter_user = find_first_user("exporter")
    else:
        if not args.farmer or not args.exporter:
            print("[ERROR] Please provide both --farmer and --exporter, or use --auto.")
            sys.exit(1)
        farmer = find_user_by_email_or_id(args.farmer, "farmer")
        exporter_user = find_user_by_email_or_id(args.exporter, "exporter")

    farmer_id = farmer["id"]
    exporter_user_id = exporter_user["id"]

    # Retrieve or create exporter profile
    profile_id = get_exporter_profile_id_for_user(exporter_user_id)

    print(f"Farmer: {farmer.get('name', 'N/A')} ({farmer.get('email', 'N/A')}) -> ID: {farmer_id}")
    print(f"Exporter: {exporter_user.get('name', 'N/A')} ({exporter_user.get('email', 'N/A')}) -> Profile ID: {profile_id}")

    # Check for existing active links to avoid unique constraint collision
    existing = (
        supabase.table("farmer_exporter_links")
        .select("id, status")
        .eq("farmer_id", farmer_id)
        .in_("status", ["requested", "approved"])
        .execute()
    )

    if existing.data:
        old_id = existing.data[0]["id"]
        old_status = existing.data[0]["status"]
        print(f"[INFO] Farmer already has active link (ID: {old_id}, status: {old_status}). Updating to '{args.status}'...")
        res = (
            supabase.table("farmer_exporter_links")
            .update({
                "exporter_profile_id": profile_id,
                "status": args.status,
                "decision_reason": "Updated via test seed helper",
            })
            .eq("id", old_id)
            .execute()
        )
        link = res.data[0]
    else:
        new_row = {
            "farmer_id": farmer_id,
            "exporter_profile_id": profile_id,
            "status": args.status,
        }
        res = supabase.table("farmer_exporter_links").insert(new_row).execute()
        link = res.data[0]

    print(f"[SUCCESS] Link created/updated!")
    print(f"  Link ID:     {link['id']}")
    print(f"  Status:      {link['status']}")
    print(f"  Requested At:{link['requested_at']}")
    print(f"\nYou can now test the Exporter dashboard at: /exporter/farmers")


if __name__ == "__main__":
    main()
