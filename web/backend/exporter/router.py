"""
Exporter API router — prefix: /api/exporter
All endpoints require the exporter role.  Exporters can only read and update
their own profile record.  status/rejection_reason are never writable by the
exporter themselves.

A require_verified_exporter guard is defined here for future use but is NOT
applied to any endpoint in this file yet (Step 1 scope only).
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from core.security import decode_token
from db.supabase import supabase
from exporter.schemas import ExporterProfileResponse, ExporterProfileUpdate

router = APIRouter(prefix="/api/exporter", tags=["exporter"])
bearer = HTTPBearer()


# ── Auth helpers ──────────────────────────────────────────────────────────────

async def get_current_exporter(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    """Decode the JWT and assert role == exporter."""
    try:
        payload = decode_token(creds.credentials)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if payload.get("role") != "exporter":
        raise HTTPException(
            status_code=403,
            detail="Access restricted to exporter accounts",
        )
    return payload


async def require_verified_exporter(
    current_user: dict = Depends(get_current_exporter),
) -> dict:
    """Guard for future endpoints that require a verified (approved) exporter.
    NOT applied to any endpoint in this module yet (Step 1 scope only)."""
    user_id = current_user["sub"]
    try:
        res = (
            supabase.table("exporter_profiles")
            .select("status")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception:
        res = None

    if not res or not getattr(res, "data", None) or res.data.get("status") != "verified":
        raise HTTPException(
            status_code=403,
            detail="Your exporter account is not yet verified.",
        )
    return current_user


# ── Profile helpers ───────────────────────────────────────────────────────────

def _seed_profile_from_user(user_row: dict) -> dict:
    """Build an initial exporter_profiles row from the existing users row.
    Called automatically on first GET /me if no profile row exists yet."""
    return {
        "user_id": user_row["id"],
        "company_name": user_row.get("business_name") or "",
        "business_reg_no": user_row.get("business_reg_no") or "",
        "export_licence_no": user_row.get("export_license_no"),
        "contact_person": user_row.get("name"),
        "phone": user_row.get("phone"),
        "email": user_row.get("email"),
        "status": "pending",
    }


def _get_or_create_profile(user_id: str) -> dict:
    """Return the exporter_profiles row for user_id, creating it if absent."""
    try:
        res = (
            supabase.table("exporter_profiles")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as e:
        print(f"Error querying exporter_profiles: {e}")
        res = None

    if res and getattr(res, "data", None):
        return res.data

    # No profile yet — seed from the users table
    try:
        user_res = (
            supabase.table("users")
            .select("*")
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as e:
        print(f"Error querying users: {e}")
        user_res = None

    if not user_res or not getattr(user_res, "data", None):
        raise HTTPException(status_code=404, detail="User account not found")

    seed = _seed_profile_from_user(user_res.data)
    try:
        insert_res = supabase.table("exporter_profiles").insert(seed).execute()
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to initialise exporter profile: {e}"
        )
    if not insert_res or not getattr(insert_res, "data", None):
        raise HTTPException(
            status_code=500, detail="Failed to initialise exporter profile"
        )
    return insert_res.data[0]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/me", response_model=ExporterProfileResponse)
async def get_exporter_profile(
    current_user: dict = Depends(get_current_exporter),
):
    """Return the exporter's own company profile.
    If no profile row exists yet (legacy signup), one is auto-created from
    the users table so the exporter can then edit it."""
    profile = _get_or_create_profile(current_user["sub"])
    return profile


@router.put("/me", response_model=ExporterProfileResponse)
async def update_exporter_profile(
    body: ExporterProfileUpdate,
    current_user: dict = Depends(get_current_exporter),
):
    """Update the exporter's own company profile.
    status and rejection_reason are intentionally not in ExporterProfileUpdate
    so they can never be changed through this endpoint."""
    user_id = current_user["sub"]

    # Ensure profile exists before updating
    _get_or_create_profile(user_id)

    update_data = body.model_dump(exclude_unset=True)
    if not update_data:
        # Nothing to update — just return current state
        return _get_or_create_profile(user_id)

    # Guard: if business_reg_no is being changed, check uniqueness
    if "business_reg_no" in update_data:
        try:
            dup = (
                supabase.table("exporter_profiles")
                .select("id")
                .eq("business_reg_no", update_data["business_reg_no"])
                .neq("user_id", user_id)
                .execute()
            )
            if dup and getattr(dup, "data", None):
                raise HTTPException(
                    status_code=400,
                    detail="That business registration number is already registered to another account.",
                )
        except HTTPException:
            raise
        except Exception:
            pass

    try:
        res = (
            supabase.table("exporter_profiles")
            .update(update_data)
            .eq("user_id", user_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {e}")

    if not res or not getattr(res, "data", None):
        raise HTTPException(status_code=500, detail="Failed to update profile")
    return res.data[0]

