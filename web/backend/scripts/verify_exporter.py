"""
verify_exporter.py
------------------
CLI script to approve or reject an exporter's account.
Does NOT touch the admin dashboard — admin verification is intentionally
handled out-of-band (Step 1 scope only).

Usage
-----
  Approve:
    python scripts/verify_exporter.py exporter@company.lk --approve

  Reject (reason is required):
    python scripts/verify_exporter.py exporter@company.lk --reject "Missing export licence"

Run from the web/backend directory so that the local .env is picked up:
    cd web/backend
    python scripts/verify_exporter.py <email> --approve
"""
import sys
import argparse
from pathlib import Path

# Allow imports relative to web/backend (one level up from scripts/)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import settings  # noqa: E402 — must be after sys.path tweak
from db.supabase import supabase  # noqa: E402


def find_user(email: str) -> dict:
    res = supabase.table("users").select("id, email, role").eq("email", email).execute()
    if not res.data:
        print(f"[ERROR] No user found with email: {email}")
        sys.exit(1)
    user = res.data[0]
    if user["role"] != "exporter":
        print(f"[ERROR] User '{email}' has role '{user['role']}', not 'exporter'.")
        sys.exit(1)
    return user


def find_or_warn_profile(user_id: str) -> dict | None:
    res = (
        supabase.table("exporter_profiles")
        .select("id, status, company_name")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return res.data


def approve(email: str) -> None:
    user = find_user(email)
    profile = find_or_warn_profile(user["id"])

    if not profile:
        print(f"[WARN] No exporter_profiles row for '{email}'. Creating a minimal pending row first.")
        insert_res = supabase.table("exporter_profiles").insert({
            "user_id": user["id"],
            "company_name": "",
            "business_reg_no": "",
            "status": "pending",
        }).execute()
        if not insert_res.data:
            print("[ERROR] Failed to create profile row.")
            sys.exit(1)
        profile = insert_res.data[0]

    res = (
        supabase.table("exporter_profiles")
        .update({"status": "verified", "rejection_reason": None})
        .eq("user_id", user["id"])
        .execute()
    )
    if res.data:
        company = res.data[0].get("company_name") or "(unnamed)"
        print(f"[OK] Exporter '{email}' ({company}) → status: verified")
    else:
        print("[ERROR] Update failed — check Supabase logs.")
        sys.exit(1)


def reject(email: str, reason: str) -> None:
    if not reason or not reason.strip():
        print("[ERROR] --reject requires a non-empty reason string.")
        sys.exit(1)

    user = find_user(email)
    profile = find_or_warn_profile(user["id"])

    if not profile:
        print(f"[WARN] No exporter_profiles row for '{email}'. Creating a minimal one first.")
        supabase.table("exporter_profiles").insert({
            "user_id": user["id"],
            "company_name": "",
            "business_reg_no": "",
            "status": "pending",
        }).execute()

    res = (
        supabase.table("exporter_profiles")
        .update({"status": "rejected", "rejection_reason": reason.strip()})
        .eq("user_id", user["id"])
        .execute()
    )
    if res.data:
        company = res.data[0].get("company_name") or "(unnamed)"
        print(f"[OK] Exporter '{email}' ({company}) → status: rejected")
        print(f"     Reason: {reason.strip()}")
    else:
        print("[ERROR] Update failed — check Supabase logs.")
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Approve or reject an exporter account via Supabase."
    )
    parser.add_argument("email", help="The exporter's registered email address")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--approve", action="store_true", help="Approve (verify) the exporter"
    )
    group.add_argument(
        "--reject", metavar="REASON", help="Reject the exporter with a reason string"
    )

    args = parser.parse_args()

    if args.approve:
        approve(args.email)
    else:
        reject(args.email, args.reject)


if __name__ == "__main__":
    main()
