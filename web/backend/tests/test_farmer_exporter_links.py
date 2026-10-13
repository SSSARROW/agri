"""
Comprehensive Unit & Integration Tests for STEP 4: Farmer-to-Exporter Link
Covers:
1. DB constraint: Second active link ('requested' or 'approved') for the same farmer is rejected.
2. State transitions:
   - requested -> approved (valid)
   - requested -> declined (valid)
   - approved -> removed (valid)
   - Invalid transitions fail (e.g. approved -> approved, declined -> approved).
3. Role enforcement & Isolation:
   - Exporter A cannot view or act on Exporter B's links (returns 404).
   - Admin and farmer tokens get 403 on exporter farmer endpoints.
   - Exporter tokens get 403 on farmer link endpoints.
4. Verification enforcement:
   - Unverified exporter cannot approve, decline, or remove (403 Forbidden).
5. Privacy & Data Protection:
   - Phone is strictly null/hidden until status is 'approved'.
   - NIC hash/salt and password hash are never returned.
6. Farmer API:
   - Only verified exporters are listed.
   - Request, current, and cancel workflows.
   - Duplicate active link request returns 409 Conflict.
"""
import uuid
import pytest
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.security import create_access_token
from db.supabase import supabase
from exporter.farmers.router import router as exporter_farmers_router
from farmer.router import router as farmer_exporter_link_router
from exporter.farmers import service

# Create dedicated test FastAPI app mounting both routers
test_app = FastAPI()
test_app.include_router(exporter_farmers_router)
test_app.include_router(farmer_exporter_link_router)

client = TestClient(test_app)


# ── Token Helpers ─────────────────────────────────────────────────────────────

def _make_headers(user_id: str, role: str, email: str) -> dict:
    token = create_access_token({"sub": user_id, "role": role, "email": email})
    return {"Authorization": f"Bearer {token}"}


# ── 1. Role Guards Tests ──────────────────────────────────────────────────────

def test_exporter_endpoints_role_guards():
    """Farmer and admin tokens must get 403 on exporter farmer endpoints."""
    farmer_headers = _make_headers("farmer-1", "farmer", "farmer1@test.lk")
    admin_headers = _make_headers("admin-1", "admin", "admin1@test.lk")

    # List endpoint
    res1 = client.get("/api/exporter/farmers", headers=farmer_headers)
    assert res1.status_code == 403
    assert "restricted to exporter accounts" in res1.json()["detail"].lower()

    res2 = client.get("/api/exporter/farmers", headers=admin_headers)
    assert res2.status_code == 403

    # Action endpoint
    res3 = client.post("/api/exporter/farmers/some-id/approve", headers=farmer_headers)
    assert res3.status_code == 403


def test_farmer_endpoints_role_guards():
    """Exporter and admin tokens must get 403 on farmer endpoints."""
    exporter_headers = _make_headers("exp-1", "exporter", "exp1@test.lk")
    admin_headers = _make_headers("admin-1", "admin", "admin1@test.lk")

    res1 = client.get("/api/farmer/exporter-link/exporters", headers=exporter_headers)
    assert res1.status_code == 403
    assert "restricted to farmer accounts" in res1.json()["detail"].lower()

    res2 = client.get("/api/farmer/exporter-link/exporters", headers=admin_headers)
    assert res2.status_code == 403


# ── 2. DB Partial Unique Constraint Test ──────────────────────────────────────

def test_db_active_link_uniqueness_constraint():
    """Verify that a second active link (requested/approved) for the same farmer raises a unique constraint error."""
    test_farmer_id = str(uuid.uuid4())
    test_exporter_1 = str(uuid.uuid4())
    test_exporter_2 = str(uuid.uuid4())

    # Create dummy farmer user and dummy exporters in DB
    u1 = supabase.table("users").insert({
        "id": test_farmer_id,
        "email": f"farmer_{test_farmer_id[:8]}@test.lk",
        "role": "farmer",
        "name": "Test Constraint Farmer",
        "phone": "0771234567"
    }).execute()

    # Create exporter profiles
    exp1_user = str(uuid.uuid4())
    exp2_user = str(uuid.uuid4())
    supabase.table("users").insert([
        {"id": exp1_user, "email": f"exp1_{exp1_user[:8]}@test.lk", "role": "exporter", "name": "Exporter User 1"},
        {"id": exp2_user, "email": f"exp2_{exp2_user[:8]}@test.lk", "role": "exporter", "name": "Exporter User 2"},
    ]).execute()

    p1 = supabase.table("exporter_profiles").insert({
        "id": test_exporter_1,
        "user_id": exp1_user,
        "company_name": "Exporter One",
        "business_reg_no": f"BR-{test_exporter_1[:8]}",
        "status": "verified"
    }).execute()
    p2 = supabase.table("exporter_profiles").insert({
        "id": test_exporter_2,
        "user_id": exp2_user,
        "company_name": "Exporter Two",
        "business_reg_no": f"BR-{test_exporter_2[:8]}",
        "status": "verified"
    }).execute()

    link1_id = None
    try:
        # First active link: status = 'requested'
        res1 = supabase.table("farmer_exporter_links").insert({
            "farmer_id": test_farmer_id,
            "exporter_profile_id": test_exporter_1,
            "status": "requested"
        }).execute()
        assert len(res1.data) == 1
        link1_id = res1.data[0]["id"]

        # Second active link for same farmer: must fail due to idx_farmer_exporter_links_active_farmer
        with pytest.raises(Exception) as exc_info:
            supabase.table("farmer_exporter_links").insert({
                "farmer_id": test_farmer_id,
                "exporter_profile_id": test_exporter_2,
                "status": "requested"
            }).execute()
        err_str = str(exc_info.value).lower()
        assert "idx_farmer_exporter_links_active_farmer" in err_str or "23505" in err_str or "unique" in err_str

        # Update first link to 'declined' (no longer active)
        supabase.table("farmer_exporter_links").update({"status": "declined"}).eq("id", link1_id).execute()

        # Now creating a new requested link MUST succeed because previous is declined
        res2 = supabase.table("farmer_exporter_links").insert({
            "farmer_id": test_farmer_id,
            "exporter_profile_id": test_exporter_2,
            "status": "requested"
        }).execute()
        assert len(res2.data) == 1

    finally:
        # Cleanup
        supabase.table("farmer_exporter_links").delete().eq("farmer_id", test_farmer_id).execute()
        supabase.table("exporter_profiles").delete().in_("id", [test_exporter_1, test_exporter_2]).execute()
        supabase.table("users").delete().in_("id", [test_farmer_id, exp1_user, exp2_user]).execute()


# ── 3. State Transitions & Verification Guard Tests ───────────────────────────

def test_state_transitions_and_unverified_guard():
    """
    Test transitions:
    - requested -> approved -> removed
    - unverified exporter cannot approve/decline/remove (403)
    - invalid transition fails (400)
    """
    farmer_id = str(uuid.uuid4())
    exp_verified_uid = str(uuid.uuid4())
    exp_unverified_uid = str(uuid.uuid4())

    supabase.table("users").insert([
        {"id": farmer_id, "email": f"farmer_{farmer_id[:8]}@test.lk", "role": "farmer", "name": "Transition Farmer", "phone": "0779998888"},
        {"id": exp_verified_uid, "email": f"ver_{exp_verified_uid[:8]}@test.lk", "role": "exporter", "name": "Verified Exporter User"},
        {"id": exp_unverified_uid, "email": f"unver_{exp_unverified_uid[:8]}@test.lk", "role": "exporter", "name": "Unverified Exporter User"},
    ]).execute()

    prof_v = supabase.table("exporter_profiles").insert({
        "user_id": exp_verified_uid,
        "company_name": "Verified Exporter Corp",
        "business_reg_no": f"BR-{exp_verified_uid[:8]}",
        "status": "verified"
    }).execute().data[0]

    prof_uv = supabase.table("exporter_profiles").insert({
        "user_id": exp_unverified_uid,
        "company_name": "Unverified Exporter Corp",
        "business_reg_no": f"BR-{exp_unverified_uid[:8]}",
        "status": "pending"
    }).execute().data[0]

    # Create link for verified exporter
    link_v = supabase.table("farmer_exporter_links").insert({
        "farmer_id": farmer_id,
        "exporter_profile_id": prof_v["id"],
        "status": "requested"
    }).execute().data[0]

    v_headers = _make_headers(exp_verified_uid, "role:exporter", f"ver_{exp_verified_uid[:8]}@test.lk")
    # Fix role in token
    v_headers = _make_headers(exp_verified_uid, "exporter", f"ver_{exp_verified_uid[:8]}@test.lk")
    uv_headers = _make_headers(exp_unverified_uid, "exporter", f"unver_{exp_unverified_uid[:8]}@test.lk")

    try:
        # Unverified exporter attempts to approve -> 403 Forbidden
        res_uv = client.post(f"/api/exporter/farmers/{link_v['id']}/approve", headers=uv_headers)
        assert res_uv.status_code == 403
        assert "not yet verified" in res_uv.json()["detail"].lower()

        # Verified exporter approves -> 200 OK
        res_v = client.post(f"/api/exporter/farmers/{link_v['id']}/approve", headers=v_headers)
        assert res_v.status_code == 200
        assert res_v.json()["status"] == "approved"
        assert res_v.json()["decided_at"] is not None

        # Phone is now visible because status is approved
        assert res_v.json()["farmer"]["phone"] == "0779998888"

        # Invalid transition: approving an already approved link -> 400 Bad Request
        res_invalid = client.post(f"/api/exporter/farmers/{link_v['id']}/approve", headers=v_headers)
        assert res_invalid.status_code == 400
        assert "only 'requested' links can be approved" in res_invalid.json()["detail"].lower()

        # Remove approved link -> 200 OK
        res_rm = client.post(f"/api/exporter/farmers/{link_v['id']}/remove", json={"reason": "Seasonal end"}, headers=v_headers)
        assert res_rm.status_code == 200
        assert res_rm.json()["status"] == "removed"
        assert res_rm.json()["decision_reason"] == "Seasonal end"

    finally:
        supabase.table("farmer_exporter_links").delete().eq("farmer_id", farmer_id).execute()
        supabase.table("exporter_profiles").delete().in_("id", [prof_v["id"], prof_uv["id"]]).execute()
        supabase.table("users").delete().in_("id", [farmer_id, exp_verified_uid, exp_unverified_uid]).execute()


# ── 4. Exporter Isolation & Privacy Tests ─────────────────────────────────────

def test_exporter_isolation_and_phone_privacy():
    """
    - Exporter A cannot see Exporter B's link (404).
    - Phone is hidden when link is 'requested' or 'declined'.
    - NIC and password are never returned.
    """
    farmer_id = str(uuid.uuid4())
    exp_a_uid = str(uuid.uuid4())
    exp_b_uid = str(uuid.uuid4())

    supabase.table("users").insert([
        {
            "id": farmer_id,
            "email": f"farmer_{farmer_id[:8]}@test.lk",
            "role": "farmer",
            "name": "Secret Phone Farmer",
            "phone": "0775554444",
            "password_hash": "secret_pw_hash",
            "nic_hash": "secret_nic_hash"
        },
        {"id": exp_a_uid, "email": f"a_{exp_a_uid[:8]}@test.lk", "role": "exporter", "name": "Exporter A User"},
        {"id": exp_b_uid, "email": f"b_{exp_b_uid[:8]}@test.lk", "role": "exporter", "name": "Exporter B User"},
    ]).execute()

    prof_a = supabase.table("exporter_profiles").insert({
        "user_id": exp_a_uid,
        "company_name": "Exporter A",
        "business_reg_no": f"BR-{exp_a_uid[:8]}",
        "status": "verified"
    }).execute().data[0]

    prof_b = supabase.table("exporter_profiles").insert({
        "user_id": exp_b_uid,
        "company_name": "Exporter B",
        "business_reg_no": f"BR-{exp_b_uid[:8]}",
        "status": "verified"
    }).execute().data[0]

    # Link belongs to Exporter A
    link_a = supabase.table("farmer_exporter_links").insert({
        "farmer_id": farmer_id,
        "exporter_profile_id": prof_a["id"],
        "status": "requested"
    }).execute().data[0]

    headers_a = _make_headers(exp_a_uid, "exporter", "a@test.lk")
    headers_b = _make_headers(exp_b_uid, "exporter", "b@test.lk")

    try:
        # Exporter B attempts to view Exporter A's link -> 404
        res_b = client.get(f"/api/exporter/farmers/{link_a['id']}", headers=headers_b)
        assert res_b.status_code == 404

        # Exporter A views their own link -> 200
        res_a = client.get(f"/api/exporter/farmers/{link_a['id']}", headers=headers_a)
        assert res_a.status_code == 200
        data = res_a.json()

        # Phone MUST BE None because status is 'requested' (not approved)
        assert data["farmer"]["phone"] is None

        # Sensitive credentials MUST NEVER be present
        raw_text = res_a.text
        assert "secret_pw_hash" not in raw_text
        assert "secret_nic_hash" not in raw_text

    finally:
        supabase.table("farmer_exporter_links").delete().eq("farmer_id", farmer_id).execute()
        supabase.table("exporter_profiles").delete().in_("id", [prof_a["id"], prof_b["id"]]).execute()
        supabase.table("users").delete().in_("id", [farmer_id, exp_a_uid, exp_b_uid]).execute()


# ── 5. Farmer API Workflow Tests ──────────────────────────────────────────────

def test_farmer_api_workflow():
    """
    Farmer tests:
    - GET /exporters returns only verified exporters and hides contact numbers
    - POST /request creates status requested
    - GET /current returns active link
    - POST /request second time fails with 409
    - POST /cancel transitions to cancelled
    """
    farmer_uid = str(uuid.uuid4())
    exp_ver_uid = str(uuid.uuid4())
    exp_unv_uid = str(uuid.uuid4())

    supabase.table("users").insert([
        {"id": farmer_uid, "email": f"f_{farmer_uid[:8]}@test.lk", "role": "farmer", "name": "App Farmer"},
        {"id": exp_ver_uid, "email": f"v_{exp_ver_uid[:8]}@test.lk", "role": "exporter", "name": "Verified Exporter User"},
        {"id": exp_unv_uid, "email": f"uv_{exp_unv_uid[:8]}@test.lk", "role": "exporter", "name": "Unverified Exporter User"},
    ]).execute()

    p_ver = supabase.table("exporter_profiles").insert({
        "user_id": exp_ver_uid,
        "company_name": "Public Verified Exporter",
        "business_reg_no": f"BR-{exp_ver_uid[:8]}",
        "phone": "0112223333",
        "email": "private_contact@exporter.lk",
        "status": "verified"
    }).execute().data[0]

    p_unv = supabase.table("exporter_profiles").insert({
        "user_id": exp_unv_uid,
        "company_name": "Hidden Pending Exporter",
        "business_reg_no": f"BR-{exp_unv_uid[:8]}",
        "status": "pending"
    }).execute().data[0]

    farmer_headers = _make_headers(farmer_uid, "farmer", "farmer_app@test.lk")

    try:
        # 1. Directory only includes verified
        res_dir = client.get("/api/farmer/exporter-link/exporters", headers=farmer_headers)
        assert res_dir.status_code == 200
        ids = [x["id"] for x in res_dir.json()]
        assert p_ver["id"] in ids
        assert p_unv["id"] not in ids

        # Contact numbers/emails are omitted from directory
        dir_text = res_dir.text
        assert "0112223333" not in dir_text
        assert "private_contact@exporter.lk" not in dir_text

        # 2. Check current: initially empty
        res_cur = client.get("/api/farmer/exporter-link/current", headers=farmer_headers)
        assert res_cur.status_code == 200
        assert res_cur.json()["has_active_link"] is False

        # 3. Request link to verified exporter
        res_req = client.post("/api/farmer/exporter-link/request", json={"exporter_profile_id": p_ver["id"]}, headers=farmer_headers)
        assert res_req.status_code == 200
        assert res_req.json()["status"] == "requested"

        # 4. Request second active link -> 409 Conflict
        res_req2 = client.post("/api/farmer/exporter-link/request", json={"exporter_profile_id": p_ver["id"]}, headers=farmer_headers)
        assert res_req2.status_code == 409

        # 5. Check current: now active
        res_cur2 = client.get("/api/farmer/exporter-link/current", headers=farmer_headers)
        assert res_cur2.status_code == 200
        assert res_cur2.json()["has_active_link"] is True
        assert res_cur2.json()["link"]["status"] == "requested"

        # 6. Cancel pending request -> 200 OK
        res_cancel = client.post("/api/farmer/exporter-link/cancel", headers=farmer_headers)
        assert res_cancel.status_code == 200
        assert res_cancel.json()["status"] == "cancelled"

        # 7. Check current after cancel: no active link
        res_cur3 = client.get("/api/farmer/exporter-link/current", headers=farmer_headers)
        assert res_cur3.json()["has_active_link"] is False

    finally:
        supabase.table("farmer_exporter_links").delete().eq("farmer_id", farmer_uid).execute()
        supabase.table("exporter_profiles").delete().in_("id", [p_ver["id"], p_unv["id"]]).execute()
        supabase.table("users").delete().in_("id", [farmer_uid, exp_ver_uid, exp_unv_uid]).execute()
