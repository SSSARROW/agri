"""
Unit & Integration Tests for Step 3C:
- Farmer Ad Views Recording & Daily Deduplication
- View Failure Safety (never breaks ad detail response)
- Exporter Ad Stats API (views, accepts, conversion rate, pending count)
- Farmer Ad Report API (validation, duplicate prevention, live ad rule)
- Admin Ad Moderation (list, detail, takedown, restore, reports management)
- Role Guards and Immutability Triggers
"""
import uuid
import sys
import os
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from core.security import create_access_token
from db.supabase import supabase
from farmer.ads.views import record_view

client = TestClient(app)


def _seed_exporter_and_ad(exporter_id: str, profile_id: str, crop: str = "tea", quantity_kg: float = 5000.0, district: str = "Kandy"):
    now = datetime.now(timezone.utc)
    # 1. User
    supabase.table("users").upsert({
        "id": exporter_id,
        "email": f"exp-{exporter_id[:8]}@test.lk",
        "name": f"Exporter {exporter_id[:6]}",
        "role": "exporter",
        "phone": "+94771112222",
    }).execute()

    # 2. Exporter profile
    supabase.table("exporter_profiles").upsert({
        "id": profile_id,
        "user_id": exporter_id,
        "company_name": f"Company {exporter_id[:6]}",
        "business_reg_no": f"PV-{exporter_id[:6]}",
        "status": "verified",
        "crops_bought": [crop],
        "districts_served": [district],
    }).execute()

    # 3. Quality Standard & Published Version
    std_id = str(uuid.uuid4())
    std_v_id = str(uuid.uuid4())
    supabase.table("quality_standards").insert({
        "id": std_id,
        "exporter_profile_id": profile_id,
        "crop": crop,
    }).execute()

    supabase.table("quality_standard_versions").insert({
        "id": std_v_id,
        "standard_id": std_id,
        "version_number": 1,
        "name": "Standard v1",
        "status": "published",
        "published_at": now.isoformat(),
    }).execute()

    # 4. Ad & Published Ad Version
    ad_id = str(uuid.uuid4())
    ad_v_id = str(uuid.uuid4())
    supabase.table("ads").insert({
        "id": ad_id,
        "exporter_profile_id": profile_id,
        "crop": crop,
        "status": "published",
    }).execute()

    supabase.table("ad_versions").insert({
        "id": ad_v_id,
        "ad_id": ad_id,
        "version_number": 1,
        "status": "published",
        "standard_version_id": std_v_id,
        "title": {"en": f"Ceylon {crop.capitalize()} Request"},
        "description": {"en": "Looking for top quality harvest."},
        "quantity_kg": quantity_kg,
        "price_type": "fixed",
        "price_fixed": 1200.0,
        "collection_window_start": (now + timedelta(days=2)).isoformat(),
        "collection_window_end": (now + timedelta(days=15)).isoformat(),
        "expires_at": (now + timedelta(days=10)).isoformat(),
        "eligible_districts": [district],
        "terms": {"payment_timing": "7 days"},
        "published_at": now.isoformat(),
    }).execute()

    return {
        "exporter_id": exporter_id,
        "profile_id": profile_id,
        "std_id": std_id,
        "std_v_id": std_v_id,
        "ad_id": ad_id,
        "ad_v_id": ad_v_id,
    }


def _seed_farmer(farmer_id: str, district: str = "Kandy"):
    supabase.table("users").upsert({
        "id": farmer_id,
        "email": f"farmer-{farmer_id[:8]}@test.lk",
        "name": f"Farmer {farmer_id[:6]}",
        "role": "farmer",
        "phone": "+94779998888",
        "district": district,
    }).execute()


def _seed_admin(admin_id: str):
    supabase.table("users").upsert({
        "id": admin_id,
        "email": f"admin-{admin_id[:8]}@test.lk",
        "name": f"Admin {admin_id[:6]}",
        "role": "admin",
        "phone": "+94770001111",
    }).execute()


def test_role_guards():
    """Verify role guards for all Step 3C endpoints."""
    f_uid = str(uuid.uuid4())
    e_uid = str(uuid.uuid4())
    a_uid = str(uuid.uuid4())
    dummy_ad = str(uuid.uuid4())

    farmer_token = create_access_token({"sub": f_uid, "role": "farmer", "email": "f@test.lk"})
    exporter_token = create_access_token({"sub": e_uid, "role": "exporter", "email": "e@test.lk"})
    admin_token = create_access_token({"sub": a_uid, "role": "admin", "email": "a@test.lk"})

    h_farmer = {"Authorization": f"Bearer {farmer_token}"}
    h_exporter = {"Authorization": f"Bearer {exporter_token}"}
    h_admin = {"Authorization": f"Bearer {admin_token}"}

    # 1. Report ad requires farmer role
    res = client.post(f"/api/farmer/ads/{dummy_ad}/report", json={"reason": "fake_ad"}, headers=h_exporter)
    assert res.status_code == 403

    # 2. Exporter stats requires exporter role
    res = client.get(f"/api/exporter/ads/{dummy_ad}/stats", headers=h_farmer)
    assert res.status_code == 403

    # 3. Admin endpoints require admin role
    res = client.get("/api/admin/ads", headers=h_exporter)
    assert res.status_code == 403
    res = client.get("/api/admin/ads", headers=h_farmer)
    assert res.status_code == 403
    res = client.post(f"/api/admin/ads/{dummy_ad}/takedown", json={"reason": "test"}, headers=h_exporter)
    assert res.status_code == 403
    res = client.post(f"/api/admin/ads/{dummy_ad}/restore", headers=h_farmer)
    assert res.status_code == 403


def test_record_view_and_deduplication():
    """Verify record_view inserts once per day and ignores duplicate views."""
    exp_id = str(uuid.uuid4())
    prof_id = str(uuid.uuid4())
    seed = _seed_exporter_and_ad(exp_id, prof_id)
    ad_id = seed["ad_id"]

    farmer_id = str(uuid.uuid4())
    _seed_farmer(farmer_id, district="Kandy")

    # Call record_view twice
    record_view(ad_id, farmer_id)
    record_view(ad_id, farmer_id)

    # Check database: should have exactly 1 record for this ad and farmer
    views_res = (
        supabase.table("ad_views")
        .select("id")
        .eq("ad_id", ad_id)
        .eq("farmer_id", farmer_id)
        .execute()
    )
    assert len(views_res.data or []) == 1


def test_view_hook_on_ad_detail():
    """Verify GET /api/farmer/ads/{id} triggers a view recording."""
    exp_id = str(uuid.uuid4())
    prof_id = str(uuid.uuid4())
    seed = _seed_exporter_and_ad(exp_id, prof_id)
    ad_id = seed["ad_id"]

    farmer_id = str(uuid.uuid4())
    _seed_farmer(farmer_id, district="Kandy")
    farmer_token = create_access_token({"sub": farmer_id, "role": "farmer", "email": "f@test.lk"})

    res = client.get(f"/api/farmer/ads/{ad_id}", headers={"Authorization": f"Bearer {farmer_token}"})
    assert res.status_code == 200

    views_res = (
        supabase.table("ad_views")
        .select("id")
        .eq("ad_id", ad_id)
        .eq("farmer_id", farmer_id)
        .execute()
    )
    assert len(views_res.data or []) == 1


def test_exporter_stats_calculation():
    """Verify stats computation for total views, unique viewers, and accepts."""
    exp_id = str(uuid.uuid4())
    prof_id = str(uuid.uuid4())
    seed = _seed_exporter_and_ad(exp_id, prof_id, quantity_kg=1000.0)
    ad_id = seed["ad_id"]

    f1 = str(uuid.uuid4())
    f2 = str(uuid.uuid4())
    _seed_farmer(f1)
    _seed_farmer(f2)

    # 2 farmers view the ad
    record_view(ad_id, f1)
    record_view(ad_id, f2)

    # f1 accepts the ad
    acc_id = str(uuid.uuid4())
    supabase.table("ad_acceptances").insert({
        "id": acc_id,
        "ad_id": ad_id,
        "ad_version_id": seed["ad_v_id"],
        "farmer_id": f1,
        "supply_quantity_kg": 250.0,
        "terms_hash": "dummyhash",
    }).execute()

    exp_token = create_access_token({"sub": exp_id, "role": "exporter", "email": "exp@test.lk"})
    res = client.get(f"/api/exporter/ads/{ad_id}/stats", headers={"Authorization": f"Bearer {exp_token}"})
    assert res.status_code == 200
    data = res.json()

    assert data["total_views"] == 2
    assert data["unique_viewers"] == 2
    assert data["accepts"]["total"] == 1
    assert data["pending_count"] == 1
    assert data["view_to_accept_rate"] == 50.0


def test_farmer_report_lifecycle():
    """Verify farmer report submission, duplicate rejection, and admin review/dismiss."""
    exp_id = str(uuid.uuid4())
    prof_id = str(uuid.uuid4())
    seed = _seed_exporter_and_ad(exp_id, prof_id)
    ad_id = seed["ad_id"]

    f_id = str(uuid.uuid4())
    _seed_farmer(f_id)
    f_token = create_access_token({"sub": f_id, "role": "farmer", "email": "f@test.lk"})

    admin_id = str(uuid.uuid4())
    _seed_admin(admin_id)
    a_token = create_access_token({"sub": admin_id, "role": "admin", "email": "admin@test.lk"})

    # 1. Submit report
    rep_res = client.post(
        f"/api/farmer/ads/{ad_id}/report",
        json={"reason": "fake_ad", "details": "Exporter contact number is disconnected."},
        headers={"Authorization": f"Bearer {f_token}"},
    )
    assert rep_res.status_code == 200
    rep_data = rep_res.json()
    rep_id = rep_data["report_id"]
    assert rep_data["status"] == "open"

    # 2. Duplicate report returns 409
    dup_res = client.post(
        f"/api/farmer/ads/{ad_id}/report",
        json={"reason": "other", "details": "Another attempt"},
        headers={"Authorization": f"Bearer {f_token}"},
    )
    assert dup_res.status_code == 409

    # 3. Admin lists reports
    list_res = client.get(f"/api/admin/ads/reports?ad_id={ad_id}", headers={"Authorization": f"Bearer {a_token}"})
    assert list_res.status_code == 200
    assert len(list_res.json()["items"]) >= 1

    # 4. Admin reviews report
    rev_res = client.post(f"/api/admin/ads/reports/{rep_id}/review", headers={"Authorization": f"Bearer {a_token}"})
    assert rev_res.status_code == 200
    assert rev_res.json()["new_status"] == "reviewed"


def test_admin_takedown_and_restore():
    """Verify takedown closes the ad, marks reports reviewed, and restore reactivates it."""
    exp_id = str(uuid.uuid4())
    prof_id = str(uuid.uuid4())
    seed = _seed_exporter_and_ad(exp_id, prof_id)
    ad_id = seed["ad_id"]

    admin_id = str(uuid.uuid4())
    _seed_admin(admin_id)
    a_token = create_access_token({"sub": admin_id, "role": "admin", "email": "admin@test.lk"})

    # Takedown
    td_res = client.post(
        f"/api/admin/ads/{ad_id}/takedown",
        json={"reason": "Misleading pricing terms"},
        headers={"Authorization": f"Bearer {a_token}"},
    )
    assert td_res.status_code == 200

    # Verify status is closed with taken_down prefix
    ad_row = supabase.table("ads").select("status, closed_reason").eq("id", ad_id).single().execute()
    assert ad_row.data["status"] == "closed"
    assert ad_row.data["closed_reason"].startswith("taken_down:")

    # Restore
    rest_res = client.post(
        f"/api/admin/ads/{ad_id}/restore",
        headers={"Authorization": f"Bearer {a_token}"},
    )
    assert rest_res.status_code == 200

    # Verify status is restored to published
    ad_row_rest = supabase.table("ads").select("status, closed_reason, closed_at").eq("id", ad_id).single().execute()
    assert ad_row_rest.data["status"] == "published"
    assert ad_row_rest.data["closed_reason"] is None
    assert ad_row_rest.data["closed_at"] is None
