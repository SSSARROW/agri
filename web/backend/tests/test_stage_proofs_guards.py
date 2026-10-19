"""
Unit & Integration Tests for Exporter Stage Proofs Router Guards & Access Control.

Covers:
1. Role enforcement — farmer and admin get 403 across all stage-proof endpoints.
2. Unverified exporter:
   - POST /approve, /reject, /reopen get 403 ("Your exporter account is not yet verified.")
   - GET list and GET detail do NOT get blocked by the verified guard.
3. Verified exporter:
   - POST /approve, /reject, /reopen pass the verification guard.
4. Exporter isolation:
   - Another exporter's submission returns 404.
"""
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from main import app
from core.security import create_access_token
import exporter.stage_proofs.service as stage_proofs_service

client = TestClient(app)

# ── Tokens ────────────────────────────────────────────────────────────────────

def _farmer_headers() -> dict:
    token = create_access_token({"sub": "user-farmer-1", "role": "farmer", "email": "f@test.lk"})
    return {"Authorization": f"Bearer {token}"}

def _admin_headers() -> dict:
    token = create_access_token({"sub": "user-admin-1", "role": "admin", "email": "a@test.lk"})
    return {"Authorization": f"Bearer {token}"}

def _unverified_exporter_headers() -> dict:
    token = create_access_token({"sub": "user-exp-unverified", "role": "exporter", "email": "unverified@test.lk"})
    return {"Authorization": f"Bearer {token}"}

def _verified_exporter_headers() -> dict:
    token = create_access_token({"sub": "user-exp-verified", "role": "exporter", "email": "verified@test.lk"})
    return {"Authorization": f"Bearer {token}"}


# ── 1. Role enforcement ───────────────────────────────────────────────────────

class TestStageProofsRoleEnforcement:
    def test_farmer_gets_403(self):
        h = _farmer_headers()
        assert client.get("/api/exporter/stage-proofs", headers=h).status_code == 403
        assert client.get("/api/exporter/stage-proofs/sub-1", headers=h).status_code == 403
        assert client.post("/api/exporter/stage-proofs/sub-1/approve", json={"notes": "ok"}, headers=h).status_code == 403
        assert client.post("/api/exporter/stage-proofs/sub-1/reject", json={"notes": "bad"}, headers=h).status_code == 403
        assert client.post("/api/exporter/stage-proofs/sub-1/reopen", headers=h).status_code == 403

    def test_admin_gets_403(self):
        h = _admin_headers()
        assert client.get("/api/exporter/stage-proofs", headers=h).status_code == 403
        assert client.get("/api/exporter/stage-proofs/sub-1", headers=h).status_code == 403
        assert client.post("/api/exporter/stage-proofs/sub-1/approve", json={"notes": "ok"}, headers=h).status_code == 403
        assert client.post("/api/exporter/stage-proofs/sub-1/reject", json={"notes": "bad"}, headers=h).status_code == 403
        assert client.post("/api/exporter/stage-proofs/sub-1/reopen", headers=h).status_code == 403


# ── 2. Unverified Exporter Guard ──────────────────────────────────────────────

class TestUnverifiedExporterGuard:
    @patch("exporter.router.supabase")
    def test_unverified_exporter_gets_403_on_actions(self, mock_router_supabase):
        """Unverified exporter (status=pending) gets 403 on approve/reject/reopen."""
        mock_res = MagicMock()
        mock_res.data = {"status": "pending"}
        mock_router_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_res

        h = _unverified_exporter_headers()

        # Approve
        res_app = client.post("/api/exporter/stage-proofs/sub-123/approve", json={"notes": "good"}, headers=h)
        assert res_app.status_code == 403
        assert "not yet verified" in res_app.json()["detail"]

        # Reject
        res_rej = client.post("/api/exporter/stage-proofs/sub-123/reject", json={"notes": "needs fix"}, headers=h)
        assert res_rej.status_code == 403
        assert "not yet verified" in res_rej.json()["detail"]

        # Reopen
        res_reo = client.post("/api/exporter/stage-proofs/sub-123/reopen", headers=h)
        assert res_reo.status_code == 403
        assert "not yet verified" in res_reo.json()["detail"]

    @patch("exporter.stage_proofs.router.get_exporter_profile_id_for_user")
    @patch("exporter.stage_proofs.router.service.list_submissions")
    def test_unverified_exporter_can_still_list(self, mock_list, mock_get_profile):
        """GET list does NOT require verified exporter; unverified can view list."""
        mock_get_profile.return_value = "prof-unverified-1"
        mock_list.return_value = {
            "items": [],
            "total": 0,
            "page": 1,
            "page_size": 20,
            "total_pages": 1,
            "pending_count": 0,
        }

        h = _unverified_exporter_headers()
        res = client.get("/api/exporter/stage-proofs", headers=h)
        assert res.status_code == 200
        assert res.json()["total"] == 0

    @patch("exporter.stage_proofs.router.get_exporter_profile_id_for_user")
    @patch("exporter.stage_proofs.router.service.get_submission_detail")
    def test_unverified_exporter_can_still_view_detail(self, mock_detail, mock_get_profile):
        """GET detail does NOT require verified exporter; unverified can view detail."""
        mock_get_profile.return_value = "prof-unverified-1"
        mock_detail.return_value = {
            "id": "sub-123",
            "link_id": "link-1",
            "farmer_id": "farmer-1",
            "farmer_name": "Perera",
            "stage_id": "stage-1",
            "stage_name": "Pruning",
            "stage_instructions": {"en": "Cut properly"},
            "plot_name": "Plot A",
            "photo_urls": [],
            "quick_field_answers": {},
            "note": None,
            "status": "pending",
            "submitted_at": "2026-10-19T10:00:00Z",
            "reviewed_at": None,
            "review_notes": None,
            "reopened_at": None,
        }

        h = _unverified_exporter_headers()
        res = client.get("/api/exporter/stage-proofs/sub-123", headers=h)
        assert res.status_code == 200
        assert res.json()["id"] == "sub-123"


# ── 3. Verified Exporter Guard & Isolation ────────────────────────────────────

class TestVerifiedExporterActions:
    @patch("exporter.stage_proofs.router.get_exporter_profile_id_for_user")
    @patch("exporter.stage_proofs.router.service.approve_submission")
    @patch("exporter.router.supabase")
    def test_verified_exporter_approve_succeeds(self, mock_router_supabase, mock_approve, mock_get_profile):
        """Verified exporter passes require_verified_exporter and approves."""
        mock_res = MagicMock()
        mock_res.data = {"status": "verified"}
        mock_router_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_res

        mock_get_profile.return_value = "prof-verified-1"
        mock_approve.return_value = {
            "id": "sub-123",
            "link_id": "link-1",
            "farmer_id": "farmer-1",
            "farmer_name": "Perera",
            "stage_id": "stage-1",
            "stage_name": "Pruning",
            "stage_instructions": {"en": "Cut properly"},
            "plot_name": "Plot A",
            "photo_urls": [],
            "quick_field_answers": {},
            "note": None,
            "status": "approved",
            "submitted_at": "2026-10-19T10:00:00Z",
            "reviewed_at": "2026-10-19T10:30:00Z",
            "review_notes": "Well done",
            "reopened_at": None,
        }

        h = _verified_exporter_headers()
        res = client.post("/api/exporter/stage-proofs/sub-123/approve", json={"notes": "Well done"}, headers=h)
        assert res.status_code == 200
        assert res.json()["status"] == "approved"

    @patch("exporter.stage_proofs.router.get_exporter_profile_id_for_user")
    @patch("exporter.stage_proofs.router.service.reject_submission")
    @patch("exporter.router.supabase")
    def test_verified_exporter_reject_succeeds(self, mock_router_supabase, mock_reject, mock_get_profile):
        """Verified exporter passes require_verified_exporter and rejects."""
        mock_res = MagicMock()
        mock_res.data = {"status": "verified"}
        mock_router_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_res

        mock_get_profile.return_value = "prof-verified-1"
        mock_reject.return_value = {
            "id": "sub-123",
            "link_id": "link-1",
            "farmer_id": "farmer-1",
            "farmer_name": "Perera",
            "stage_id": "stage-1",
            "stage_name": "Pruning",
            "stage_instructions": {"en": "Cut properly"},
            "plot_name": "Plot A",
            "photo_urls": [],
            "quick_field_answers": {},
            "note": None,
            "status": "rejected",
            "submitted_at": "2026-10-19T10:00:00Z",
            "reviewed_at": "2026-10-19T10:30:00Z",
            "review_notes": "Blurry photos",
            "reopened_at": None,
        }

        h = _verified_exporter_headers()
        res = client.post("/api/exporter/stage-proofs/sub-123/reject", json={"notes": "Blurry photos"}, headers=h)
        assert res.status_code == 200
        assert res.json()["status"] == "rejected"

    @patch("exporter.stage_proofs.router.get_exporter_profile_id_for_user")
    @patch("exporter.stage_proofs.router.service.reopen_submission")
    @patch("exporter.router.supabase")
    def test_verified_exporter_reopen_succeeds(self, mock_router_supabase, mock_reopen, mock_get_profile):
        """Verified exporter passes require_verified_exporter and reopens."""
        mock_res = MagicMock()
        mock_res.data = {"status": "verified"}
        mock_router_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_res

        mock_get_profile.return_value = "prof-verified-1"
        mock_reopen.return_value = {
            "id": "sub-123",
            "link_id": "link-1",
            "farmer_id": "farmer-1",
            "farmer_name": "Perera",
            "stage_id": "stage-1",
            "stage_name": "Pruning",
            "stage_instructions": {"en": "Cut properly"},
            "plot_name": "Plot A",
            "photo_urls": [],
            "quick_field_answers": {},
            "note": None,
            "status": "rejected",
            "submitted_at": "2026-10-19T10:00:00Z",
            "reviewed_at": "2026-10-19T10:30:00Z",
            "review_notes": "Blurry photos",
            "reopened_at": "2026-10-19T11:00:00Z",
        }

        h = _verified_exporter_headers()
        res = client.post("/api/exporter/stage-proofs/sub-123/reopen", headers=h)
        assert res.status_code == 200
        assert res.json()["reopened_at"] is not None

    @patch("exporter.stage_proofs.service.supabase")
    def test_cross_exporter_isolation_returns_404(self, mock_service_supabase):
        """Accessing another exporter's submission raises 404 Submission not found."""
        mock_res = MagicMock()
        mock_res.data = {
            "id": "sub-other",
            "exporter_profile_id": "prof-other-exporter",
        }
        mock_service_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value = mock_res

        with pytest.raises(Exception) as excinfo:
            stage_proofs_service.get_submission_detail("sub-other", "prof-my-exporter")
        assert "404" in str(excinfo.value)
        assert "Submission not found" in str(excinfo.value)
