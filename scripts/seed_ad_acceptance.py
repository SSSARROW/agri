#!/usr/bin/env python3
"""
scripts/seed_ad_acceptance.py

CLI helper script to simulate a farmer accepting an ad.
Calls the exact same service function `farmer.ads.service.accept_ad` as the API.

Usage:
    python scripts/seed_ad_acceptance.py --ad <ad_id_or_title> --farmer <uuid_email_or_phone> --qty <kg>
    python scripts/seed_ad_acceptance.py --list-farmers
    python scripts/seed_ad_acceptance.py --list-ads
"""

import sys
import os
import uuid
import argparse

from dotenv import load_dotenv

# Ensure web/backend is on sys.path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "web", "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from db.supabase import supabase
from farmer.ads.service import accept_ad


def is_valid_uuid(val: str) -> bool:
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, AttributeError):
        return False


def get_available_farmers():
    res = (
        supabase.table("users")
        .select("id, name, email, phone, role, district")
        .eq("role", "farmer")
        .limit(25)
        .execute()
    )
    return res.data or []


def find_farmer(query: str):
    """
    Look up farmer by UUID (only if valid UUID), email, or phone.
    """
    query = query.strip()
    
    # 1. UUID lookup
    if is_valid_uuid(query):
        res = supabase.table("users").select("*").eq("id", query).maybe_single().execute()
        if res and res.data and res.data.get("role") == "farmer":
            return res.data

    # 2. Email lookup
    res_email = supabase.table("users").select("*").eq("email", query).maybe_single().execute()
    if res_email and res_email.data and res_email.data.get("role") == "farmer":
        return res_email.data

    # 3. Phone lookup
    res_phone = supabase.table("users").select("*").eq("phone", query).maybe_single().execute()
    if res_phone and res_phone.data and res_phone.data.get("role") == "farmer":
        return res_phone.data

    return None


def find_ad(query: str):
    query = query.strip()
    if is_valid_uuid(query):
        res = supabase.table("ads").select("*").eq("id", query).maybe_single().execute()
        if res and res.data:
            return res.data

    # Search in ad_versions title
    ver_res = (
        supabase.table("ad_versions")
        .select("ad_id, version_number, title, quantity_kg, status")
        .eq("status", "published")
        .execute()
    )
    for v in (ver_res.data or []):
        en_title = (v.get("title") or {}).get("en", "")
        if query.lower() in en_title.lower():
            res = supabase.table("ads").select("*").eq("id", v["ad_id"]).maybe_single().execute()
            if res and res.data:
                return res.data
    return None


def main():
    parser = argparse.ArgumentParser(description="Seed an ad acceptance by a farmer.")
    parser.add_argument("--ad", help="Ad UUID or substring of ad English title")
    parser.add_argument("--farmer", help="Farmer UUID, email, or phone number")
    parser.add_argument("--qty", type=float, help="Supply quantity in kg")
    parser.add_argument("--list-farmers", action="store_true", help="List available farmers")
    parser.add_argument("--list-ads", action="store_true", help="List live advertisements")

    args = parser.parse_args()

    if args.list_farmers:
        farmers = get_available_farmers()
        print("\n--- Available Registered Farmers ---")
        if not farmers:
            print("No farmers found in users table.")
        for f in farmers:
            print(f"ID: {f['id']} | Name: {f.get('name')} | Email: {f.get('email')} | Phone: {f.get('phone')} | District: {f.get('district')}")
        return

    if args.list_ads:
        ads_res = supabase.table("ads").select("id, crop, status").neq("status", "closed").execute()
        print("\n--- Open Advertisements ---")
        for ad in (ads_res.data or []):
            ver = (
                supabase.table("ad_versions")
                .select("id, version_number, title, quantity_kg, status")
                .eq("ad_id", ad["id"])
                .eq("status", "published")
                .order("version_number", desc=True)
                .limit(1)
                .execute()
            )
            v_data = ver.data[0] if (ver and ver.data) else {}
            title = (v_data.get("title") or {}).get("en", "Untitled")
            print(f"ID: {ad['id']} | Crop: {ad['crop']} | Title: {title} | Target: {v_data.get('quantity_kg')}kg (v{v_data.get('version_number')})")
        return

    if not args.ad or not args.farmer or not args.qty:
        parser.print_help()
        sys.exit(1)

    # 1. Look up farmer
    farmer = find_farmer(args.farmer)
    if not farmer:
        print(f"\n[ERROR] Farmer not found matching '{args.farmer}'.")
        print("\nAvailable farmers in the system:")
        farmers = get_available_farmers()
        for f in farmers:
            print(f" - {f['id']} | {f.get('name')} | {f.get('email')} | {f.get('phone')} | District: {f.get('district')}")
        sys.exit(1)

    # 2. Look up ad
    ad = find_ad(args.ad)
    if not ad:
        print(f"\n[ERROR] Advertisement not found matching '{args.ad}'.")
        sys.exit(1)

    # 3. Get latest published version
    ver_res = (
        supabase.table("ad_versions")
        .select("id, version_number, quantity_kg, expires_at, title")
        .eq("ad_id", ad["id"])
        .eq("status", "published")
        .order("version_number", desc=True)
        .limit(1)
        .execute()
    )
    if not ver_res or not ver_res.data:
        print(f"\n[ERROR] Advertisement {ad['id']} has no published version.")
        sys.exit(1)

    live_ver = ver_res.data[0]

    # 4. Call service function
    try:
        result = accept_ad(
            ad_id=ad["id"],
            farmer_id=farmer["id"],
            ad_version_id=live_ver["id"],
            supply_quantity_kg=args.qty,
        )
        print("\n[SUCCESS] Ad acceptance submitted!")
        print(f"Acceptance ID: {result['acceptance_id']}")
        print(f"Ad: {ad['id']} ({live_ver.get('title', {}).get('en')})")
        print(f"Farmer: {farmer['id']} ({farmer.get('name')})")
        print(f"Link ID: {result['link_id']}")
        print(f"Supply Quantity: {result['supply_quantity_kg']} kg")
        print(f"Derived Status: {result['derived_status']}")
        print(f"Terms Hash: {result['terms_hash']}")
    except Exception as exc:
        print(f"\n[FAILED] Could not accept ad: {getattr(exc, 'detail', str(exc))}")
        sys.exit(1)


if __name__ == "__main__":
    main()
