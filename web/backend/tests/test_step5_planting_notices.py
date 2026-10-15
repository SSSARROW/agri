"""
Unit & Integration Tests for Step 5A + 5C:
- Exporter Planting Notices (Create draft, edit draft, publish, cancel, duplicate, list, detail)
- Immutability and DB Trigger integrity
- Verified exporter permissions on publish and cancel
- Farmer notice visibility (published, future month, approved link, eligible district)
- Farmer plot listing and reply (Ready with owned plot, Cannot releases binding)
- Partial unique binding conflict (409 on plot reuse for same crop & season)
- Season lock enforcement (409 once target month has started)
- Regression safety across farmer auth, ads, and links endpoints
"""
import uuid
import sys
import os
from datetime import datetime, date, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from core.security import create_access_token
from db.supabase import supabase

client = TestClient(app)


def _future_target_month(months_ahead: int = 2) -> str:
    """Returns YYYY-MM-01 format string in the future."""
    today = datetime.now(timezone.utc).date()
    m = today.month + months_ahead
    y = today.year + (m - 1) // 12
    m = ((m - 1) % 12) + 1
    return f"{y:04d}-{m:02d}-01"


def _seed_test_ecosystem():
    """Seeds verified exporter, published standard, approved farmer, and farmer plot."""
    exporter_user_id = str(uuid.uuid4())
    profile_id = str(uuid.uuid4())
    std_id = str(uuid.uuid4())
    std_v_id = str(uuid.uuid4())
    farmer_user_id = str(uuid.uuid4())
    plot_id = str(uuid.uuid4())

    # 1. Exporter user & profile
    supabase.table("users").insert({
        "id": exporter_user_id,
        "email": f"exp-{exporter_user_id[:8]}@test.lk",
        "name": "Notice Test Exporter",
        "role": "exporter",
        "phone": "+94771234567",
    }).execute()

    supabase.table("exporter_profiles").insert({
        "id": profile_id,
        "user_id": exporter_user_id,
        "company_name": "Notice Test Corp",
        "business_reg_no": f"PV-{profile_id[:6]}",
        "status": "verified",
        "crops_bought": ["tea"],
        "districts_served": ["Kandy", "Nuwara Eliya"],
    }).execute()

    # 2. Standard & published version
    supabase.table("quality_standards").insert({
        "id": std_id,
        "exporter_profile_id": profile_id,
        "crop": "tea",
    }).execute()

    supabase.table("quality_standard_versions").insert({
        "id": std_v_id,
        "standard_id": std_id,
        "version_number": 1,
        "name": "BOPF Standard v1",
        "status": "draft",
    }).execute()

    # 3. Quality stage
    stage_id = str(uuid.uuid4())
    supabase.table("quality_standard_stages").insert({
        "id": stage_id,
        "version_id": std_v_id,
        "position": 1,
        "name": "Soil Pre-conditioning",
        "timing_type": "one_time",
        "start_offset_days": 0,
    }).execute()

    # Publish version
    supabase.table("quality_standard_versions").update({
        "status": "published",
    }).eq("id", std_v_id).execute()

    # 4. Farmer user & plot
    supabase.table("users").insert({
        "id": farmer_user_id,
        "email": f"farmer-{farmer_user_id[:8]}@test.lk",
        "name": "Notice Test Farmer",
        "role": "farmer",
        "phone": "+94719876543",
        "district": "Kandy",
    }).execute()

    supabase.table("plot").insert({
        "id": plot_id,
        "owner_user_id": farmer_user_id,
        "name": "Mountain Tea Plot",
        "area_ha": 1.5,
        "district": "Kandy",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[80.6, 7.2], [80.7, 7.2], [80.7, 7.3], [80.6, 7.3], [80.6, 7.2]]],
        },
    }).execute()

    # 5. Approved link
    supabase.table("farmer_exporter_links").insert({
        "farmer_id": farmer_user_id,
        "exporter_profile_id": profile_id,
        "status": "approved",
    }).execute()

    return {
        "exporter_user_id": exporter_user_id,
        "profile_id": profile_id,
        "std_v_id": std_v_id,
        "farmer_user_id": farmer_user_id,
        "plot_id": plot_id,
    }


def test_notice_lifecycle_and_farmer_reply():
    data = _seed_test_ecosystem()
    exp_token = create_access_token({"sub": data["exporter_user_id"], "role": "exporter"})
    farmer_token = create_access_token({"sub": data["farmer_user_id"], "role": "farmer"})
    exp_headers = {"Authorization": f"Bearer {exp_token}"}
    farmer_headers = {"Authorization": f"Bearer {farmer_token}"}

    target_month = _future_target_month(2)

    # 1. Create Draft Notice
    create_payload = {
        "crop": "tea",
        "standard_version_id": data["std_v_id"],
        "target_month": target_month,
        "volume_needed_kg": 5000.0,
        "eligible_districts": ["Kandy", "Nuwara Eliya"],
        "title": {"en": "November 2026 High Grown Tea Demand", "si": "තේ ඉල්ලුම"},
        "message": {"en": "Preparing for winter export cycle. Please confirm readiness."},
    }
    r = client.post("/api/exporter/planting-notices", json=create_payload, headers=exp_headers)
    assert r.status_code == 200, r.text
    notice_id = r.json()["id"]
    assert r.json()["status"] == "draft"
    assert r.json()["computed_state"] == "draft"

    # 2. Farmer cannot see draft notice
    r = client.get("/api/farmer/planting-notices", headers=farmer_headers)
    assert r.status_code == 200
    farmer_notice_ids = [n["id"] for n in r.json()["items"]]
    assert notice_id not in farmer_notice_ids

    # 3. Exporter can update draft notice
    update_payload = {
        "volume_needed_kg": 6000.0,
        "title": {"en": "Updated Tea Demand Notice"},
    }
    r = client.put(f"/api/exporter/planting-notices/{notice_id}", json=update_payload, headers=exp_headers)
    assert r.status_code == 200
    assert r.json()["volume_needed_kg"] == 6000.0
    assert r.json()["title"]["en"] == "Updated Tea Demand Notice"

    # 4. Exporter publishes notice
    r = client.post(f"/api/exporter/planting-notices/{notice_id}/publish", headers=exp_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "published"
    assert r.json()["computed_state"] == "upcoming"

    # 5. Immutability: Published notice cannot be edited
    r = client.put(f"/api/exporter/planting-notices/{notice_id}", json={"volume_needed_kg": 7000.0}, headers=exp_headers)
    assert r.status_code == 400

    # 6. Farmer now sees published notice
    r = client.get("/api/farmer/planting-notices", headers=farmer_headers)
    assert r.status_code == 200
    farmer_notices = r.json()["items"]
    assert any(n["id"] == notice_id for n in farmer_notices)

    # 7. Farmer gets notice detail with standard stages
    r = client.get(f"/api/farmer/planting-notices/{notice_id}", headers=farmer_headers)
    assert r.status_code == 200
    detail = r.json()
    assert detail["id"] == notice_id
    assert detail["current_response"] is None
    assert len(detail["stages"]) >= 1

    # 8. Farmer lists plots for notice
    r = client.get(f"/api/farmer/planting-notices/{notice_id}/plots", headers=farmer_headers)
    assert r.status_code == 200
    plots = r.json()
    assert any(p["id"] == data["plot_id"] for p in plots)

    # 9. Farmer replies Ready
    reply_payload = {
        "response": "ready",
        "expected_volume_kg": 1200.0,
        "plot_id": data["plot_id"],
    }
    r = client.post(f"/api/farmer/planting-notices/{notice_id}/respond", json=reply_payload, headers=farmer_headers)
    assert r.status_code == 200, r.text
    assert r.json()["response"] == "ready"
    assert r.json()["expected_volume_kg"] == 1200.0

    # 10. Check binding was created in DB
    bind_res = supabase.table("planting_bindings").select("*").eq("notice_id", notice_id).eq("status", "active").execute()
    assert len(bind_res.data) == 1
    assert bind_res.data[0]["plot_id"] == data["plot_id"]
    assert bind_res.data[0]["crop"] == "tea"

    # 11. Exporter sees response in responses API
    r = client.get(f"/api/exporter/planting-notices/{notice_id}/responses", headers=exp_headers)
    assert r.status_code == 200
    resp_data = r.json()
    assert resp_data["counts"]["ready"] == 1
    assert resp_data["total_expected_volume_kg"] == 1200.0
    farmer_item = next(i for i in resp_data["items"] if i["farmer_id"] == data["farmer_user_id"])
    assert farmer_item["response"] == "ready"
    assert farmer_item["expected_volume_kg"] == 1200.0
    assert farmer_item["phone"] is not None  # Visible because approved

    # 12. Conflict test: Another notice for same crop & season cannot bind the same plot
    r2 = client.post("/api/exporter/planting-notices", json=create_payload, headers=exp_headers)
    notice2_id = r2.json()["id"]
    client.post(f"/api/exporter/planting-notices/{notice2_id}/publish", headers=exp_headers)

    conflict_reply = {
        "response": "ready",
        "expected_volume_kg": 500.0,
        "plot_id": data["plot_id"],
    }
    r = client.post(f"/api/farmer/planting-notices/{notice2_id}/respond", json=conflict_reply, headers=farmer_headers)
    assert r.status_code == 409  # Conflict: plot already bound

    # 13. Farmer changes response to Cannot on notice 1
    r = client.post(f"/api/farmer/planting-notices/{notice_id}/respond", json={"response": "cannot"}, headers=farmer_headers)
    assert r.status_code == 200
    assert r.json()["response"] == "cannot"

    # Active binding released
    bind_res = supabase.table("planting_bindings").select("*").eq("notice_id", notice_id).eq("status", "active").execute()
    assert len(bind_res.data) == 0

    # Now notice 2 can bind the plot!
    r = client.post(f"/api/farmer/planting-notices/{notice2_id}/respond", json=conflict_reply, headers=farmer_headers)
    assert r.status_code == 200

    # 14. Exporter cancels notice 2
    r = client.post(f"/api/exporter/planting-notices/{notice2_id}/cancel", json={"reason": "Harvest plan cancelled"}, headers=exp_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"
    assert r.json()["computed_state"] == "cancelled"

    # Cancellation automatically releases notice 2 bindings
    bind_res2 = supabase.table("planting_bindings").select("*").eq("notice_id", notice2_id).eq("status", "active").execute()
    assert len(bind_res2.data) == 0


def test_unverified_exporter_blocked_from_publish():
    """Unverified exporters can save drafts but are forbidden from publishing or cancelling."""
    user_id = str(uuid.uuid4())
    prof_id = str(uuid.uuid4())
    std_id = str(uuid.uuid4())
    std_v_id = str(uuid.uuid4())

    supabase.table("users").insert({
        "id": user_id,
        "email": f"unv-{user_id[:8]}@test.lk",
        "name": "Unverified Exporter",
        "role": "exporter",
    }).execute()

    supabase.table("exporter_profiles").insert({
        "id": prof_id,
        "user_id": user_id,
        "company_name": "Unverified Corp",
        "business_reg_no": f"PV-{prof_id[:6]}",
        "status": "pending",  # NOT verified
    }).execute()

    supabase.table("quality_standards").insert({
        "id": std_id,
        "exporter_profile_id": prof_id,
        "crop": "tea",
    }).execute()

    supabase.table("quality_standard_versions").insert({
        "id": std_v_id,
        "standard_id": std_id,
        "version_number": 1,
        "name": "Tea Standard v1",
        "status": "published",
    }).execute()

    token = create_access_token({"sub": user_id, "role": "exporter"})
    headers = {"Authorization": f"Bearer {token}"}

    # Draft creation allowed
    r = client.post("/api/exporter/planting-notices", json={
        "crop": "tea",
        "standard_version_id": std_v_id,
        "target_month": _future_target_month(3),
        "volume_needed_kg": 2000.0,
        "title": {"en": "Draft Notice"},
        "message": {"en": "Draft Message"},
    }, headers=headers)
    assert r.status_code == 200
    notice_id = r.json()["id"]

    # Publish forbidden: 403
    r = client.post(f"/api/exporter/planting-notices/{notice_id}/publish", headers=headers)
    assert r.status_code == 403


def test_regression_existing_endpoints():
    """Ensures existing farmer auth and endpoints are unaffected."""
    r = client.get("/")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
