"""
Comprehensive Unit & Integration Tests for Step 3A: Exporter Ads API
"""
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.security import create_access_token
from db.supabase import supabase
from exporter.ads.router import router as ads_router

test_app = FastAPI()
test_app.include_router(ads_router)

client = TestClient(test_app)


def _make_headers(user_id: str, role: str, email: str) -> dict:
    token = create_access_token({"sub": user_id, "role": role, "email": email})
    return {"Authorization": f"Bearer {token}"}


# ── 1. Role Guards ────────────────────────────────────────────────────────────

def test_ads_role_guards():
    """Farmer and admin tokens must get 403 on ads endpoints."""
    farmer_headers = _make_headers("farmer-1", "farmer", "farmer1@test.lk")
    admin_headers = _make_headers("admin-1", "admin", "admin1@test.lk")

    res1 = client.get("/api/exporter/ads", headers=farmer_headers)
    assert res1.status_code == 403
    assert "restricted to exporter accounts" in res1.json()["detail"].lower()

    res2 = client.get("/api/exporter/ads", headers=admin_headers)
    assert res2.status_code == 403


# ── 2. Full Ad Lifecycle & Immutability ────────────────────────────────────────

def test_ad_lifecycle_immutability_and_one_draft():
    """
    Test:
    1. Create ad with draft v1
    2. Edit draft v1
    3. Publish v1
    4. Editing published v1 fails (service and DB trigger)
    5. Create new draft (v2)
    6. Second draft fails (one-draft rule)
    7. Close ad
    8. Duplicate ad
    """
    exp_uid = str(uuid.uuid4())
    prof_id = str(uuid.uuid4())

    # Create exporter user and profile
    supabase.table("users").insert({
        "id": exp_uid,
        "email": f"exp_{exp_uid[:8]}@test.lk",
        "role": "exporter",
        "name": "Ads Test Exporter",
    }).execute()

    supabase.table("exporter_profiles").insert({
        "id": prof_id,
        "user_id": exp_uid,
        "company_name": "Ads Tea Corp",
        "business_reg_no": f"BR-ADS-{exp_uid[:8]}",
        "status": "verified",
    }).execute()

    # Create published standard for this exporter
    std_id = str(uuid.uuid4())
    std_v_id = str(uuid.uuid4())

    supabase.table("quality_standards").insert({
        "id": std_id,
        "exporter_profile_id": prof_id,
        "crop": "tea",
    }).execute()

    supabase.table("quality_standard_versions").insert({
        "id": std_v_id,
        "standard_id": std_id,
        "version_number": 1,
        "name": "v1 Ceylon Pure Standard",
        "status": "published",
        "published_at": datetime.now(timezone.utc).isoformat(),
    }).execute()

    headers = _make_headers(exp_uid, "exporter", f"exp_{exp_uid[:8]}@test.lk")

    now = datetime.now(timezone.utc)
    start_iso = (now + timedelta(days=2)).isoformat()
    end_iso = (now + timedelta(days=20)).isoformat()
    expires_iso = (now + timedelta(days=10)).isoformat()

    try:
        # 1. Create ad
        create_payload = {
            "crop": "tea",
            "standard_version_id": std_v_id,
            "title": {"en": "Ceylon High Grown Tea Buy Request", "si": "", "ta": ""},
            "description": {"en": "Looking for 5000kg of clean unbruised BOPF grade tea.", "si": "", "ta": ""},
            "grade_tier": "BOPF",
            "quantity_kg": 5000,
            "price_type": "fixed",
            "price_fixed": 1250.0,
            "collection_window_start": start_iso,
            "collection_window_end": end_iso,
            "pickup_location": "Nuwara Eliya Factory Gate",
            "eligible_districts": ["Nuwara Eliya", "Kandy"],
            "terms": {"payment_timing": "Within 7 days of delivery", "rejection_handling": "Returned at seller cost"},
            "expires_at": expires_iso,
        }

        res_create = client.post("/api/exporter/ads", json=create_payload, headers=headers)
        assert res_create.status_code == 200, res_create.text
        ad_data = res_create.json()
        ad_id = ad_data["id"]
        assert ad_data["computed_status"] == "draft"
        assert len(ad_data["versions"]) == 1
        assert ad_data["versions"][0]["version_number"] == 1
        assert ad_data["versions"][0]["status"] == "draft"

        # 2. Update draft v1
        update_payload = {
            "standard_version_id": std_v_id,
            "title": {"en": "Updated High Grown Buy Request", "si": "", "ta": ""},
            "description": {"en": "Updated description with specific delivery notes.", "si": "", "ta": ""},
            "grade_tier": "BOPF Special",
            "quantity_kg": 6000,
            "price_type": "range",
            "price_min": 1200.0,
            "price_max": 1350.0,
            "collection_window_start": start_iso,
            "collection_window_end": end_iso,
            "pickup_location": "Kandy Depot",
            "eligible_districts": ["Kandy"],
            "terms": {"payment_timing": "Cash on delivery"},
            "expires_at": expires_iso,
        }
        res_upd = client.put(f"/api/exporter/ads/{ad_id}/versions/1", json=update_payload, headers=headers)
        assert res_upd.status_code == 200
        v1_updated = res_upd.json()
        assert v1_updated["title"]["en"] == "Updated High Grown Buy Request"
        assert v1_updated["quantity_kg"] == 6000
        assert v1_updated["price_type"] == "range"

        # 3. Publish v1
        res_pub = client.post(f"/api/exporter/ads/{ad_id}/versions/1/publish", headers=headers)
        assert res_pub.status_code == 200
        v1_pub = res_pub.json()
        assert v1_pub["status"] == "published"
        assert v1_pub["published_at"] is not None

        # Verify ad computed status is now live
        res_detail = client.get(f"/api/exporter/ads/{ad_id}", headers=headers)
        assert res_detail.json()["computed_status"] == "live"

        # 4. Editing published v1 must fail (Service Layer)
        res_fail_edit = client.put(f"/api/exporter/ads/{ad_id}/versions/1", json=update_payload, headers=headers)
        assert res_fail_edit.status_code == 400
        assert "immutable" in res_fail_edit.json()["detail"].lower()

        # Direct DB update on published row must fail (DB Trigger)
        with pytest.raises(Exception) as exc_info:
            supabase.table("ad_versions").update({"quantity_kg": 9999}).eq("id", v1_pub["id"]).execute()
        assert "cannot update a published ad version" in str(exc_info.value).lower() or "p0001" in str(exc_info.value).lower()

        # 5. Create new draft (v2)
        res_v2 = client.post(f"/api/exporter/ads/{ad_id}/versions", headers=headers)
        assert res_v2.status_code == 200
        v2 = res_v2.json()
        assert v2["version_number"] == 2
        assert v2["status"] == "draft"

        # 6. Attempt second draft while v2 is draft -> must fail (One-Draft Rule)
        res_second_draft = client.post(f"/api/exporter/ads/{ad_id}/versions", headers=headers)
        assert res_second_draft.status_code == 400
        assert "only one draft is allowed" in res_second_draft.json()["detail"].lower()

        # 7. Close ad
        res_close = client.post(f"/api/exporter/ads/{ad_id}/close", json={"reason": "Sourcing quota fulfilled"}, headers=headers)
        assert res_close.status_code == 200
        ad_closed = res_close.json()
        assert ad_closed["status"] == "closed"
        assert ad_closed["computed_status"] == "closed"
        assert ad_closed["closed_reason"] == "Sourcing quota fulfilled"

        # 8. Duplicate ad
        res_dup = client.post(f"/api/exporter/ads/{ad_id}/duplicate", headers=headers)
        assert res_dup.status_code == 200
        dup_data = res_dup.json()
        assert dup_data["id"] != ad_id
        assert dup_data["computed_status"] == "draft"
        assert len(dup_data["versions"]) == 1
        assert dup_data["versions"][0]["version_number"] == 1
        assert "(Copy)" in dup_data["versions"][0]["title"]["en"]

    finally:
        # Best-effort cleanup (published ad versions and standards are strictly immutable by DB trigger)
        try:
            supabase.table("ads").delete().eq("exporter_profile_id", prof_id).execute()
        except Exception:
            pass
        try:
            supabase.table("quality_standards").delete().eq("id", std_id).execute()
        except Exception:
            pass
        try:
            supabase.table("exporter_profiles").delete().eq("id", prof_id).execute()
            supabase.table("users").delete().eq("id", exp_uid).execute()
        except Exception:
            pass


# ── 3. Validation at Publish Tests ────────────────────────────────────────────

def test_publish_validations():
    """
    Test publish validations:
    - Draft standard rejected
    - Wrong crop standard rejected
    - Other exporter standard rejected
    - Price violations rejected
    - Date violations rejected
    - Missing English title/desc rejected
    """
    exp1_uid = str(uuid.uuid4())
    prof1_id = str(uuid.uuid4())
    exp2_uid = str(uuid.uuid4())
    prof2_id = str(uuid.uuid4())

    supabase.table("users").insert([
        {"id": exp1_uid, "email": f"e1_{exp1_uid[:8]}@test.lk", "role": "exporter", "name": "Exporter 1"},
        {"id": exp2_uid, "email": f"e2_{exp2_uid[:8]}@test.lk", "role": "exporter", "name": "Exporter 2"},
    ]).execute()

    supabase.table("exporter_profiles").insert([
        {"id": prof1_id, "user_id": exp1_uid, "company_name": "Corp 1", "business_reg_no": f"BR-1-{exp1_uid[:8]}", "status": "verified"},
        {"id": prof2_id, "user_id": exp2_uid, "company_name": "Corp 2", "business_reg_no": f"BR-2-{exp2_uid[:8]}", "status": "verified"},
    ]).execute()

    # Exporter 1 has:
    # - published tea standard
    # - draft tea standard
    # - published cinnamon standard
    std_pub_tea = str(uuid.uuid4())
    ver_pub_tea = str(uuid.uuid4())
    std_draft_tea = str(uuid.uuid4())
    ver_draft_tea = str(uuid.uuid4())
    std_pub_cin = str(uuid.uuid4())
    ver_pub_cin = str(uuid.uuid4())

    # Exporter 2 has:
    # - published tea standard
    std_exp2_tea = str(uuid.uuid4())
    ver_exp2_tea = str(uuid.uuid4())

    supabase.table("quality_standards").insert([
        {"id": std_pub_tea, "exporter_profile_id": prof1_id, "crop": "tea"},
        {"id": std_draft_tea, "exporter_profile_id": prof1_id, "crop": "tea"},
        {"id": std_pub_cin, "exporter_profile_id": prof1_id, "crop": "cinnamon"},
        {"id": std_exp2_tea, "exporter_profile_id": prof2_id, "crop": "tea"},
    ]).execute()

    supabase.table("quality_standard_versions").insert([
        {"id": ver_pub_tea, "standard_id": std_pub_tea, "version_number": 1, "name": "Pub Tea", "status": "published"},
        {"id": ver_draft_tea, "standard_id": std_draft_tea, "version_number": 1, "name": "Draft Tea", "status": "draft"},
        {"id": ver_pub_cin, "standard_id": std_pub_cin, "version_number": 1, "name": "Pub Cin", "status": "published"},
        {"id": ver_exp2_tea, "standard_id": std_exp2_tea, "version_number": 1, "name": "Exp2 Tea", "status": "published"},
    ]).execute()

    headers = _make_headers(exp1_uid, "exporter", "e1@test.lk")
    now = datetime.now(timezone.utc)

    try:
        # Base valid payload
        valid_payload = {
            "crop": "tea",
            "standard_version_id": ver_pub_tea,
            "title": {"en": "Ceylon Tea Standard Ad"},
            "description": {"en": "Full English description."},
            "quantity_kg": 1000,
            "price_type": "fixed",
            "price_fixed": 900,
            "collection_window_start": (now + timedelta(days=1)).isoformat(),
            "collection_window_end": (now + timedelta(days=20)).isoformat(),
            "expires_at": (now + timedelta(days=10)).isoformat(),
            "eligible_districts": ["Kandy"],
        }

        # 1. Reject linking other exporter's standard
        bad_exp_payload = dict(valid_payload, standard_version_id=ver_exp2_tea)
        res_exp2 = client.post("/api/exporter/ads", json=bad_exp_payload, headers=headers)
        assert res_exp2.status_code == 400
        assert "does not belong" in res_exp2.json()["detail"].lower()

        # 2. Reject linking wrong crop standard
        bad_crop_payload = dict(valid_payload, standard_version_id=ver_pub_cin)
        res_crop = client.post("/api/exporter/ads", json=bad_crop_payload, headers=headers)
        assert res_crop.status_code == 400
        assert "crop" in res_crop.json()["detail"].lower()

        # 3. Create ad with draft standard -> allowed in draft
        draft_std_payload = dict(valid_payload, standard_version_id=ver_draft_tea)
        res_draft_ad = client.post("/api/exporter/ads", json=draft_std_payload, headers=headers)
        assert res_draft_ad.status_code == 200
        draft_ad_id = res_draft_ad.json()["id"]

        # But publish must FAIL because linked standard is not published
        res_pub_draft_std = client.post(f"/api/exporter/ads/{draft_ad_id}/versions/1/publish", headers=headers)
        assert res_pub_draft_std.status_code == 400
        assert "must be published" in res_pub_draft_std.json()["detail"].lower()

        # 4. Date validation: expires_at in the past
        res_ad_valid = client.post("/api/exporter/ads", json=valid_payload, headers=headers)
        ad_valid_id = res_ad_valid.json()["id"]

        past_exp_payload = dict(valid_payload, expires_at=(now - timedelta(days=1)).isoformat())
        client.put(f"/api/exporter/ads/{ad_valid_id}/versions/1", json=past_exp_payload, headers=headers)
        res_pub_past = client.post(f"/api/exporter/ads/{ad_valid_id}/versions/1/publish", headers=headers)
        assert res_pub_past.status_code == 400
        assert "future" in res_pub_past.json()["detail"].lower()

        # 5. Date validation: expires_at after collection window end
        late_exp_payload = dict(valid_payload, expires_at=(now + timedelta(days=30)).isoformat())
        client.put(f"/api/exporter/ads/{ad_valid_id}/versions/1", json=late_exp_payload, headers=headers)
        res_pub_late = client.post(f"/api/exporter/ads/{ad_valid_id}/versions/1/publish", headers=headers)
        assert res_pub_late.status_code == 400
        assert "on or before" in res_pub_late.json()["detail"].lower()

        # 6. Price validation: range min > max
        bad_range_payload = dict(valid_payload, price_type="range", price_min=1000, price_max=800)
        res_bad_range = client.put(f"/api/exporter/ads/{ad_valid_id}/versions/1", json=bad_range_payload, headers=headers)
        assert res_bad_range.status_code == 400
        assert "maximum price" in res_bad_range.json()["detail"].lower()

        # 7. Missing English title
        no_title_payload = dict(valid_payload, title={"en": "   "})
        client.put(f"/api/exporter/ads/{ad_valid_id}/versions/1", json=no_title_payload, headers=headers)
        res_pub_notitle = client.post(f"/api/exporter/ads/{ad_valid_id}/versions/1/publish", headers=headers)
        assert res_pub_notitle.status_code == 400
        assert "english title" in res_pub_notitle.json()["detail"].lower()

    finally:
        supabase.table("ads").delete().in_("exporter_profile_id", [prof1_id, prof2_id]).execute()
        supabase.table("quality_standard_versions").update({"status": "draft"}).in_("id", [ver_pub_tea, ver_draft_tea, ver_pub_cin, ver_exp2_tea]).execute()
        supabase.table("quality_standards").delete().in_("id", [std_pub_tea, std_draft_tea, std_pub_cin, std_exp2_tea]).execute()
        supabase.table("exporter_profiles").delete().in_("id", [prof1_id, prof2_id]).execute()
        supabase.table("users").delete().in_("id", [exp1_uid, exp2_uid]).execute()


# ── 4. Unverified Exporter Guard Tests ────────────────────────────────────────

def test_unverified_exporter_guard():
    """
    Unverified exporter can create and edit drafts, but cannot publish or close.
    """
    unver_uid = str(uuid.uuid4())
    prof_id = str(uuid.uuid4())
    std_id = str(uuid.uuid4())
    ver_id = str(uuid.uuid4())

    supabase.table("users").insert({
        "id": unver_uid,
        "email": f"unv_{unver_uid[:8]}@test.lk",
        "role": "exporter",
        "name": "Unverified Exporter",
    }).execute()

    supabase.table("exporter_profiles").insert({
        "id": prof_id,
        "user_id": unver_uid,
        "company_name": "Pending Verification Corp",
        "business_reg_no": f"BR-UNV-{unver_uid[:8]}",
        "status": "pending",
    }).execute()

    supabase.table("quality_standards").insert({
        "id": std_id,
        "exporter_profile_id": prof_id,
        "crop": "tea",
    }).execute()

    supabase.table("quality_standard_versions").insert({
        "id": ver_id,
        "standard_id": std_id,
        "version_number": 1,
        "name": "Std 1",
        "status": "published",
    }).execute()

    headers = _make_headers(unver_uid, "exporter", "unv@test.lk")
    now = datetime.now(timezone.utc)

    try:
        # Create draft -> allowed
        payload = {
            "crop": "tea",
            "standard_version_id": ver_id,
            "title": {"en": "Unverified Draft"},
            "description": {"en": "Description"},
            "quantity_kg": 100,
            "price_type": "fixed",
            "price_fixed": 500,
            "collection_window_start": (now + timedelta(days=1)).isoformat(),
            "collection_window_end": (now + timedelta(days=10)).isoformat(),
            "expires_at": (now + timedelta(days=5)).isoformat(),
        }
        res_create = client.post("/api/exporter/ads", json=payload, headers=headers)
        assert res_create.status_code == 200
        ad_id = res_create.json()["id"]

        # Publish -> 403 Forbidden (not verified)
        res_pub = client.post(f"/api/exporter/ads/{ad_id}/versions/1/publish", headers=headers)
        assert res_pub.status_code == 403
        assert "not yet verified" in res_pub.json()["detail"].lower()

        # Close -> 403 Forbidden
        res_close = client.post(f"/api/exporter/ads/{ad_id}/close", headers=headers)
        assert res_close.status_code == 403

    finally:
        supabase.table("ads").delete().eq("exporter_profile_id", prof_id).execute()
        supabase.table("quality_standard_versions").update({"status": "draft"}).eq("id", ver_id).execute()
        supabase.table("quality_standards").delete().eq("id", std_id).execute()
        supabase.table("exporter_profiles").delete().eq("id", prof_id).execute()
        supabase.table("users").delete().eq("id", unver_uid).execute()


# ── 5. Exporter Isolation Tests ───────────────────────────────────────────────

def test_exporter_isolation():
    """Exporter A cannot view or act on Exporter B's ad (returns 404)."""
    e1_uid = str(uuid.uuid4())
    p1_id = str(uuid.uuid4())
    e2_uid = str(uuid.uuid4())
    p2_id = str(uuid.uuid4())

    supabase.table("users").insert([
        {"id": e1_uid, "email": f"a1_{e1_uid[:8]}@test.lk", "role": "exporter", "name": "A1"},
        {"id": e2_uid, "email": f"a2_{e2_uid[:8]}@test.lk", "role": "exporter", "name": "A2"},
    ]).execute()

    supabase.table("exporter_profiles").insert([
        {"id": p1_id, "user_id": e1_uid, "company_name": "Corp A1", "business_reg_no": f"BR-A1-{e1_uid[:8]}", "status": "verified"},
        {"id": p2_id, "user_id": e2_uid, "company_name": "Corp A2", "business_reg_no": f"BR-A2-{e2_uid[:8]}", "status": "verified"},
    ]).execute()

    std1_id = str(uuid.uuid4())
    std1_v_id = str(uuid.uuid4())

    supabase.table("quality_standards").insert({"id": std1_id, "exporter_profile_id": p1_id, "crop": "tea"}).execute()
    supabase.table("quality_standard_versions").insert({
        "id": std1_v_id, "standard_id": std1_id, "version_number": 1, "name": "Std A1", "status": "published"
    }).execute()

    headers_1 = _make_headers(e1_uid, "exporter", "a1@test.lk")
    headers_2 = _make_headers(e2_uid, "exporter", "a2@test.lk")

    now = datetime.now(timezone.utc)

    try:
        # Exporter 1 creates ad
        res = client.post("/api/exporter/ads", json={
            "crop": "tea",
            "standard_version_id": std1_v_id,
            "title": {"en": "Ad A1"},
            "description": {"en": "Description A1"},
            "quantity_kg": 500,
            "price_type": "fixed",
            "price_fixed": 800,
            "collection_window_start": (now + timedelta(days=1)).isoformat(),
            "collection_window_end": (now + timedelta(days=10)).isoformat(),
            "expires_at": (now + timedelta(days=5)).isoformat(),
        }, headers=headers_1)
        ad_id = res.json()["id"]

        # Exporter 2 tries to GET ad -> 404
        res_iso_get = client.get(f"/api/exporter/ads/{ad_id}", headers=headers_2)
        assert res_iso_get.status_code == 404

        # Exporter 2 tries to GET version -> 404
        res_iso_ver = client.get(f"/api/exporter/ads/{ad_id}/versions/1", headers=headers_2)
        assert res_iso_ver.status_code == 404

        # Exporter 2 tries to duplicate -> 404
        res_iso_dup = client.post(f"/api/exporter/ads/{ad_id}/duplicate", headers=headers_2)
        assert res_iso_dup.status_code == 404

    finally:
        supabase.table("ads").delete().in_("exporter_profile_id", [p1_id, p2_id]).execute()
        supabase.table("quality_standard_versions").update({"status": "draft"}).eq("id", std1_v_id).execute()
        supabase.table("quality_standards").delete().eq("id", std1_id).execute()
        supabase.table("exporter_profiles").delete().in_("id", [p1_id, p2_id]).execute()
        supabase.table("users").delete().in_("id", [e1_uid, e2_uid]).execute()
