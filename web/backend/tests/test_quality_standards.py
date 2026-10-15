"""
Unit & Integration Tests for Exporter Quality Standards API
"""
import pytest
from fastapi.testclient import TestClient
from main import app
from core.security import create_access_token

client = TestClient(app)


def test_standards_auth_roles():
    """Verify non-exporter tokens get 403 Forbidden."""
    farmer_token = create_access_token({"sub": "user-farmer", "role": "farmer", "email": "farmer@test.lk"})
    admin_token = create_access_token({"sub": "user-admin", "role": "admin", "email": "admin@test.lk"})

    headers_farmer = {"Authorization": f"Bearer {farmer_token}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    res_farmer = client.get("/api/exporter/standards/", headers=headers_farmer)
    assert res_farmer.status_code == 403
    assert "restricted to exporter accounts" in res_farmer.json()["detail"].lower() or "privilege" in res_farmer.json()["detail"].lower()

    res_admin = client.get("/api/exporter/standards/", headers=headers_admin)
    assert res_admin.status_code == 403


def test_schema_validations():
    """Test stage Pydantic validation rules."""
    exporter_token = create_access_token({"sub": "user-exp-1", "role": "exporter", "email": "exp1@test.lk"})
    headers = {"Authorization": f"Bearer {exporter_token}"}

    # 1. Invalid timing_type
    bad_payload_1 = {
        "crop": "tea",
        "name": "v1 Draft",
        "stages": [
            {
                "position": 1,
                "name": "Soil prep",
                "timing_type": "invalid_type",
                "start_offset_days": 0,
                "instructions": {"en": "Prepare soil"},
                "dos": {"en": []},
                "donts": {"en": []}
            }
        ]
    }
    res = client.post("/api/exporter/standards/", json=bad_payload_1, headers=headers)
    assert res.status_code == 422

    # 2. Recurring stage missing repeat_interval_days
    bad_payload_2 = {
        "crop": "tea",
        "name": "v1 Draft",
        "stages": [
            {
                "position": 1,
                "name": "Weekly weeding",
                "timing_type": "recurring",
                "start_offset_days": 0,
                "instructions": {"en": "Weed plot"},
                "dos": {"en": []},
                "donts": {"en": []}
            }
        ]
    }
    res = client.post("/api/exporter/standards/", json=bad_payload_2, headers=headers)
    assert res.status_code == 422

    # 3. Duplicate positions
    bad_payload_3 = {
        "crop": "tea",
        "name": "v1 Draft",
        "stages": [
            {
                "position": 1,
                "name": "Stage A",
                "timing_type": "one_time",
                "start_offset_days": 0,
                "instructions": {"en": "A"},
                "dos": {"en": []},
                "donts": {"en": []}
            },
            {
                "position": 1,
                "name": "Stage B",
                "timing_type": "one_time",
                "start_offset_days": 5,
                "instructions": {"en": "B"},
                "dos": {"en": []},
                "donts": {"en": []}
            }
        ]
    }
    res = client.post("/api/exporter/standards/", json=bad_payload_3, headers=headers)
    assert res.status_code == 422
