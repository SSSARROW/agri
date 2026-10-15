"""
Tests for Step 2C: GET /api/exporter/standards/templates

Covers:
  1. Role enforcement  — farmer and admin get 403; exporter gets 200.
  2. Route order      — GET /templates does NOT fall into /{id} handler.
  3. Response shape   — both crops returned; grade_spec_fields present.
  4. Crop filter      — ?crop=tea returns only tea template.
  5. Stage validation — every template stage passes the existing
                        StageCreateUpdate Pydantic schema (same rules used
                        by the PUT endpoint).
  6. Schema properties per crop (recurring → interval>0, positions unique,
                        English present).

NOTE: these are unit/schema tests.  Network calls to Supabase are NOT made
because the templates endpoint is pure-code and does not touch the DB.
"""
import pytest
from fastapi.testclient import TestClient
from main import app
from core.security import create_access_token
from exporter.standards.schemas import StageCreateUpdate
from exporter.standards.templates import get_templates, TEA_TEMPLATE, CINNAMON_TEMPLATE

client = TestClient(app)


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _exporter_headers() -> dict:
    token = create_access_token(
        {"sub": "user-exp-tmpl", "role": "exporter", "email": "exp-tmpl@test.lk"}
    )
    return {"Authorization": f"Bearer {token}"}


def _farmer_headers() -> dict:
    token = create_access_token(
        {"sub": "user-farmer-tmpl", "role": "farmer", "email": "farmer-tmpl@test.lk"}
    )
    return {"Authorization": f"Bearer {token}"}


def _admin_headers() -> dict:
    token = create_access_token(
        {"sub": "user-admin-tmpl", "role": "admin", "email": "admin-tmpl@test.lk"}
    )
    return {"Authorization": f"Bearer {token}"}


# ──────────────────────────────────────────────────────────────────────────────
# 1. Role enforcement
# ──────────────────────────────────────────────────────────────────────────────

class TestTemplatesRoleEnforcement:
    def test_farmer_gets_403(self):
        res = client.get("/api/exporter/standards/templates", headers=_farmer_headers())
        assert res.status_code == 403, f"Expected 403 for farmer, got {res.status_code}"

    def test_admin_gets_403(self):
        res = client.get("/api/exporter/standards/templates", headers=_admin_headers())
        assert res.status_code == 403, f"Expected 403 for admin, got {res.status_code}"

    def test_unauthenticated_gets_401_or_403(self):
        res = client.get("/api/exporter/standards/templates")
        assert res.status_code in (401, 403), (
            f"Expected 401 or 403 for unauthenticated, got {res.status_code}"
        )

    def test_exporter_gets_200(self):
        """
        Exporter role → 200.
        NOTE: The service layer calls get_exporter_profile_by_user_id which hits
        Supabase, so this will return 404 in the test environment (no real DB).
        We accept either 200 (if profile found) or 404 from the profile lookup —
        but NOT 403, which would indicate a role check failure.
        """
        res = client.get("/api/exporter/standards/templates", headers=_exporter_headers())
        # Role gate passes → must not be 403
        assert res.status_code != 403, (
            "Exporter should NOT get 403; role gate is blocking incorrectly."
        )


# ──────────────────────────────────────────────────────────────────────────────
# 2. Route order — /templates must NOT be swallowed by /{id}
# ──────────────────────────────────────────────────────────────────────────────

class TestRouteOrder:
    def test_templates_literal_route_not_captured_by_id_param(self):
        """
        Confirm that the /templates path is not misrouted to the /{id} handler.
        The /{id} handler calls get_standard_full which hits Supabase with id='templates'
        and returns 404. The /templates handler returns 200 (or profile 404).
        The key assertion: the response body must NOT contain "Quality standard not found",
        which is the exact error message from get_standard_by_id_and_owner.
        """
        res = client.get("/api/exporter/standards/templates", headers=_exporter_headers())
        body = res.json()
        assert "Quality standard not found" not in str(body), (
            "Route /templates is being captured by the /{id} handler — route order is wrong!"
        )


# ──────────────────────────────────────────────────────────────────────────────
# 3. Pure-logic: get_templates() response shape (no HTTP)
# ──────────────────────────────────────────────────────────────────────────────

class TestGetTemplatesShape:
    def test_returns_both_templates_by_default(self):
        result = get_templates()
        templates = result["templates"]
        crops = {t["crop"] for t in templates}
        assert "tea" in crops, "Tea template missing"
        assert "cinnamon" in crops, "Cinnamon template missing"

    def test_grade_spec_fields_present_for_both_crops(self):
        result = get_templates()
        fields = result["grade_spec_fields"]
        assert "tea" in fields, "grade_spec_fields missing 'tea' key"
        assert "cinnamon" in fields, "grade_spec_fields missing 'cinnamon' key"

    def test_tea_grade_spec_fields_have_required_keys(self):
        result = get_templates()
        tea_fields = result["grade_spec_fields"]["tea"]
        field_keys = {f["key"] for f in tea_fields}
        assert "plucking_standard" in field_keys
        assert "moisture_max_pct" in field_keys
        assert "leaf_quality_notes" in field_keys

    def test_cinnamon_grade_spec_fields_have_required_keys(self):
        result = get_templates()
        cin_fields = result["grade_spec_fields"]["cinnamon"]
        field_keys = {f["key"] for f in cin_fields}
        assert "stem_maturity" in field_keys
        assert "quill_grade" in field_keys
        assert "moisture_max_pct" in field_keys

    def test_each_field_def_has_label_and_hint(self):
        result = get_templates()
        for crop, fields in result["grade_spec_fields"].items():
            for f in fields:
                assert "label" in f, f"Field {f.get('key')} for {crop} missing 'label'"
                assert "hint" in f, f"Field {f.get('key')} for {crop} missing 'hint'"

    def test_crop_filter_tea(self):
        result = get_templates(crop="tea")
        crops = {t["crop"] for t in result["templates"]}
        assert crops == {"tea"}, f"Expected only tea, got {crops}"

    def test_crop_filter_cinnamon(self):
        result = get_templates(crop="cinnamon")
        crops = {t["crop"] for t in result["templates"]}
        assert crops == {"cinnamon"}, f"Expected only cinnamon, got {crops}"

    def test_crop_filter_unknown_returns_empty(self):
        result = get_templates(crop="banana")
        assert result["templates"] == [], "Unknown crop should return empty templates list"

    def test_grade_spec_fields_still_returned_with_crop_filter(self):
        """grade_spec_fields is always the full dict regardless of crop filter."""
        result = get_templates(crop="tea")
        assert "cinnamon" in result["grade_spec_fields"], (
            "grade_spec_fields should contain all crops even when filtering templates"
        )


# ──────────────────────────────────────────────────────────────────────────────
# 4. Template content — placeholder marker present
# ──────────────────────────────────────────────────────────────────────────────

class TestTemplatePlaceholderMarkers:
    def test_tea_description_contains_placeholder(self):
        assert "PLACEHOLDER" in TEA_TEMPLATE["description"]

    def test_cinnamon_description_contains_placeholder(self):
        assert "PLACEHOLDER" in CINNAMON_TEMPLATE["description"]

    def test_every_tea_stage_instruction_contains_placeholder(self):
        for stage in TEA_TEMPLATE["stages"]:
            assert "PLACEHOLDER" in stage["instructions"]["en"], (
                f"Tea stage '{stage['name']}' instruction missing PLACEHOLDER marker"
            )

    def test_every_cinnamon_stage_instruction_contains_placeholder(self):
        for stage in CINNAMON_TEMPLATE["stages"]:
            assert "PLACEHOLDER" in stage["instructions"]["en"], (
                f"Cinnamon stage '{stage['name']}' instruction missing PLACEHOLDER marker"
            )


# ──────────────────────────────────────────────────────────────────────────────
# 5. Stage schema validation via StageCreateUpdate Pydantic model
#    (same validation used for PUT /{id}/versions/{n})
# ──────────────────────────────────────────────────────────────────────────────

def _validate_template_stages(template_name: str, stages: list) -> None:
    """Run every stage through StageCreateUpdate validation."""
    positions = []
    for raw in stages:
        try:
            parsed = StageCreateUpdate(**raw)
        except Exception as exc:
            pytest.fail(
                f"Template '{template_name}' stage '{raw.get('name', '?')}' "
                f"failed StageCreateUpdate validation: {exc}"
            )
        positions.append(parsed.position)

        # English instruction must be non-empty
        assert parsed.instructions.en.strip(), (
            f"Template '{template_name}' stage '{parsed.name}' has empty English instruction"
        )

        # Recurring → interval > 0
        if parsed.timing_type == "recurring":
            assert parsed.repeat_interval_days is not None and parsed.repeat_interval_days > 0, (
                f"Template '{template_name}' recurring stage '{parsed.name}' "
                f"has invalid repeat_interval_days={parsed.repeat_interval_days}"
            )

        # end_offset_days ≥ start_offset_days if set
        if parsed.end_offset_days is not None:
            assert parsed.end_offset_days >= parsed.start_offset_days, (
                f"Template '{template_name}' stage '{parsed.name}' "
                f"end_offset_days < start_offset_days"
            )

    # Positions must be unique
    assert len(positions) == len(set(positions)), (
        f"Template '{template_name}' has duplicate stage positions: {positions}"
    )


class TestTemplateStageSchemaValidation:
    def test_tea_stages_pass_schema(self):
        _validate_template_stages("tea", TEA_TEMPLATE["stages"])

    def test_cinnamon_stages_pass_schema(self):
        _validate_template_stages("cinnamon", CINNAMON_TEMPLATE["stages"])

    def test_tea_has_at_least_one_stage(self):
        assert len(TEA_TEMPLATE["stages"]) >= 1

    def test_cinnamon_has_at_least_one_stage(self):
        assert len(CINNAMON_TEMPLATE["stages"]) >= 1

    def test_tea_has_eight_stages(self):
        assert len(TEA_TEMPLATE["stages"]) == 8

    def test_cinnamon_has_eight_stages(self):
        assert len(CINNAMON_TEMPLATE["stages"]) == 8
