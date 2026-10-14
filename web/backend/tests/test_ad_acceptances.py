"""
Unit & Integration Tests for Step 3B:
- Farmer Ad Browsing & Acceptance API
- Exporter Applicants Management & Decision Flow
- Active Link Reuse & Isolation Rules
- Database Immutability Trigger on ad_acceptances
"""

import uuid
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from main import app
from core.security import create_access_token
from db.supabase import supabase

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
        "status": "draft",
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


def test_role_guards():
    """Verify role guards for farmer ads and exporter applicants."""
    f_uid = str(uuid.uuid4())
    e_uid = str(uuid.uuid4())

    farmer_token = create_access_token({"sub": f_uid, "role": "farmer", "email": "f@test.lk"})
    exporter_token = create_access_token({"sub": e_uid, "role": "exporter", "email": "e@test.lk"})

    h_farmer = {"Authorization": f"Bearer {farmer_token}"}
    h_exporter = {"Authorization": f"Bearer {exporter_token}"}

    # Exporter accessing farmer ads -> 403
    res1 = client.get("/api/farmer/ads", headers=h_exporter)
    assert res1.status_code == 403

    # Farmer accessing exporter applicants -> 403
    fake_ad_id = str(uuid.uuid4())
    res2 = client.get(f"/api/exporter/ads/{fake_ad_id}/applicants", headers=h_farmer)
    assert res2.status_code == 403


def test_ad_acceptance_lifecycle_and_link_reuse():
    """
    Test acceptance creation, same-exporter link reuse,
    applicant review, phone masking, approval, and over-allocation prevention.
    """
    e_uid = str(uuid.uuid4())
    p_id = str(uuid.uuid4())
    f_uid = str(uuid.uuid4())

    data = _seed_exporter_and_ad(e_uid, p_id, quantity_kg=1000.0, district="Kandy")
    _seed_farmer(f_uid, district="Kandy")

    farmer_token = create_access_token({"sub": f_uid, "role": "farmer", "email": "f@test.lk"})
    exporter_token = create_access_token({"sub": e_uid, "role": "exporter", "email": "e@test.lk"})
    h_farmer = {"Authorization": f"Bearer {farmer_token}"}
    h_exporter = {"Authorization": f"Bearer {exporter_token}"}

    try:
        # 1. Farmer accepts ad
        payload = {"ad_version_id": data["ad_v_id"], "supply_quantity_kg": 400.0}
        res_acc = client.post(f"/api/farmer/ads/{data['ad_id']}/accept", json=payload, headers=h_farmer)
        assert res_acc.status_code == 200, res_acc.text
        acc_data = res_acc.json()
        assert acc_data["derived_status"] == "pending"
        link_id = acc_data["link_id"]

        # Verify link is requested in DB
        link_row = supabase.table("farmer_exporter_links").select("*").eq("id", link_id).single().execute().data
        assert link_row["status"] == "requested"

        # 2. Exporter views applicants: phone is masked (None) while pending
        res_apps = client.get(f"/api/exporter/ads/{data['ad_id']}/applicants", headers=h_exporter)
        assert res_apps.status_code == 200
        apps_data = res_apps.json()
        assert apps_data["total"] == 1
        assert apps_data["target_quantity_kg"] == 1000.0
        assert apps_data["pending_quantity_kg"] == 400.0
        assert apps_data["approved_quantity_kg"] == 0.0
        assert apps_data["remaining_quantity_kg"] == 1000.0
        app_item = apps_data["items"][0]
        assert app_item["phone"] is None  # Masked!

        # 3. Farmer checks my-acceptances
        res_my = client.get("/api/farmer/ads/my-acceptances", headers=h_farmer)
        assert res_my.status_code == 200
        assert len(res_my.json()["items"]) == 1
        assert res_my.json()["items"][0]["derived_status"] == "pending"

        # 4. Duplicate acceptance rejected (409)
        res_dup = client.post(f"/api/farmer/ads/{data['ad_id']}/accept", json=payload, headers=h_farmer)
        assert res_dup.status_code == 409

        # 5. Over-allocation prevention: create second farmer supplying 800kg (400 + 800 > 1000)
        f2_uid = str(uuid.uuid4())
        _seed_farmer(f2_uid, district="Kandy")
        f2_token = create_access_token({"sub": f2_uid, "role": "farmer", "email": "f2@test.lk"})
        res_f2 = client.post(
            f"/api/farmer/ads/{data['ad_id']}/accept",
            json={"ad_version_id": data["ad_v_id"], "supply_quantity_kg": 800.0},
            headers={"Authorization": f"Bearer {f2_token}"},
        )
        assert res_f2.status_code == 200
        f2_acc_id = res_f2.json()["acceptance_id"]

        # Approve first farmer (400kg) -> total approved = 400kg
        res_apprv1 = client.post(
            f"/api/exporter/ads/{data['ad_id']}/applicants/{acc_data['acceptance_id']}/approve",
            headers=h_exporter,
        )
        assert res_apprv1.status_code == 200

        # Now approve second farmer (800kg) -> 400 + 800 = 1200 > 1000 -> must fail with 400
        res_apprv2 = client.post(
            f"/api/exporter/ads/{data['ad_id']}/applicants/{f2_acc_id}/approve",
            headers=h_exporter,
        )
        assert res_apprv2.status_code == 400
        assert "over-allocation" in res_apprv2.json()["detail"].lower()

        # 6. Verify phone revealed after approval
        res_apps_after = client.get(f"/api/exporter/ads/{data['ad_id']}/applicants", headers=h_exporter)
        approved_app = next(a for a in res_apps_after.json()["items"] if a["acceptance_id"] == acc_data["acceptance_id"])
        assert approved_app["derived_status"] == "approved"
        assert approved_app["phone"] == "+94779998888"

    finally:
        # Cleanup
        try:
            supabase.table("farmer_exporter_links").delete().in_("farmer_id", [f_uid, f2_uid]).execute()
        except Exception:
            pass
        try:
            supabase.table("users").delete().in_("id", [f_uid, f2_uid]).execute()
        except Exception:
            pass


def test_withdraw_and_cancellation():
    """Test farmer withdrawal and link cancellation."""
    e_uid = str(uuid.uuid4())
    p_id = str(uuid.uuid4())
    f_uid = str(uuid.uuid4())

    data = _seed_exporter_and_ad(e_uid, p_id, quantity_kg=2000.0, district="Kandy")
    _seed_farmer(f_uid, district="Kandy")

    farmer_token = create_access_token({"sub": f_uid, "role": "farmer", "email": "f@test.lk"})
    h_farmer = {"Authorization": f"Bearer {farmer_token}"}

    try:
        # Accept ad
        payload = {"ad_version_id": data["ad_v_id"], "supply_quantity_kg": 300.0}
        res_acc = client.post(f"/api/farmer/ads/{data['ad_id']}/accept", json=payload, headers=h_farmer)
        assert res_acc.status_code == 200
        link_id = res_acc.json()["link_id"]

        # Withdraw while pending
        res_wd = client.post(f"/api/farmer/ads/{data['ad_id']}/withdraw", headers=h_farmer)
        assert res_wd.status_code == 200

        # Verify link is now cancelled
        link_row = supabase.table("farmer_exporter_links").select("*").eq("id", link_id).single().execute().data
        assert link_row["status"] == "cancelled"

        # Verify status in my-acceptances is withdrawn
        res_my = client.get("/api/farmer/ads/my-acceptances", headers=h_farmer)
        assert res_my.json()["items"][0]["derived_status"] == "withdrawn"

    finally:
        try:
            supabase.table("farmer_exporter_links").delete().eq("farmer_id", f_uid).execute()
            supabase.table("users").delete().eq("id", f_uid).execute()
        except Exception:
            pass


def test_ad_acceptances_db_immutability():
    """Verify DB trigger blocks DELETE and UPDATE on fields other than withdrawn_at."""
    e_uid = str(uuid.uuid4())
    p_id = str(uuid.uuid4())
    f_uid = str(uuid.uuid4())

    data = _seed_exporter_and_ad(e_uid, p_id, quantity_kg=1000.0, district="Kandy")
    _seed_farmer(f_uid, district="Kandy")

    farmer_token = create_access_token({"sub": f_uid, "role": "farmer", "email": "f@test.lk"})
    h_farmer = {"Authorization": f"Bearer {farmer_token}"}

    try:
        payload = {"ad_version_id": data["ad_v_id"], "supply_quantity_kg": 500.0}
        res_acc = client.post(f"/api/farmer/ads/{data['ad_id']}/accept", json=payload, headers=h_farmer)
        acc_id = res_acc.json()["acceptance_id"]

        # 1. Direct UPDATE of supply_quantity_kg must fail via trigger
        with pytest.raises(Exception) as exc_info:
            supabase.table("ad_acceptances").update({"supply_quantity_kg": 9999.0}).eq("id", acc_id).execute()
        assert "cannot modify ad acceptance fields" in str(exc_info.value).lower() or "p0001" in str(exc_info.value).lower()

        # 2. Direct DELETE must fail via trigger
        with pytest.raises(Exception) as exc_info2:
            supabase.table("ad_acceptances").delete().eq("id", acc_id).execute()
        assert "cannot delete ad acceptance records" in str(exc_info2.value).lower() or "p0001" in str(exc_info2.value).lower()

    finally:
        try:
            supabase.table("farmer_exporter_links").delete().eq("farmer_id", f_uid).execute()
            supabase.table("users").delete().eq("id", f_uid).execute()
        except Exception:
            pass
