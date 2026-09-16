from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from authlib.integrations.httpx_client import AsyncOAuth2Client
from auth.schemas import *
from core.security import *
from core.config import settings
from db.supabase import supabase

router = APIRouter(prefix="/auth", tags=["auth"])
bearer = HTTPBearer()

# ── Email/password login ──────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    res = supabase.table("users").select("*").eq("email", body.email).single().execute()
    user = res.data
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": user["id"], "role": user["role"], "email": user["email"]})
    return {"access_token": token, "role": user["role"]}

# ── Farmer signup ─────────────────────────────────────────────
@router.post("/signup/farmer", response_model=TokenResponse)
async def signup_farmer(body: FarmerSignupRequest):
    existing = supabase.table("users").select("id").eq("email", body.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    nic_hash, nic_salt = hash_nic(body.nic)
    pw_hash = hash_password(body.password)

    new_user = {
        "email": body.email,
        "password_hash": pw_hash,
        "role": "farmer",
        "name": body.name,
        "phone": body.phone,
        "nic_hash": nic_hash,
        "nic_salt": nic_salt,
        "district": body.district,
        "dsd": body.dsd,
        "gn_division": body.gn_division,
        "farm_address": body.farm_address,
        "farm_size_ha": body.farm_size_ha,
    }
    res = supabase.table("users").insert(new_user).execute()
    user = res.data[0]
    token = create_access_token({"sub": user["id"], "role": "farmer", "email": user["email"]})
    return {"access_token": token, "role": "farmer"}

# ── Exporter signup ───────────────────────────────────────────
@router.post("/signup/exporter", response_model=TokenResponse)
async def signup_exporter(body: ExporterSignupRequest):
    existing = supabase.table("users").select("id").eq("email", body.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")

    pw_hash = hash_password(body.password)
    new_user = {
        "email": body.email,
        "password_hash": pw_hash,
        "role": "exporter",
        "name": body.name,
        "phone": body.phone,
        "business_name": body.business_name,
        "business_reg_no": body.business_reg_no,
        "business_address": body.business_address,
        "export_license_no": body.export_license_no,
    }
    res = supabase.table("users").insert(new_user).execute()
    user = res.data[0]
    token = create_access_token({"sub": user["id"], "role": "exporter", "email": user["email"]})
    return {"access_token": token, "role": "exporter"}

# ── Google OAuth ──────────────────────────────────────────────
@router.get("/google")
async def google_redirect():
    client = AsyncOAuth2Client(
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        redirect_uri=f"{settings.FRONTEND_URL}/api/auth/callback/google",
    )
    uri, state = client.create_authorization_url(
        "https://accounts.google.com/o/oauth2/auth",
        scope="openid email profile"
    )
    return {"url": uri}

@router.get("/google/callback")
async def google_callback(code: str):
    client = AsyncOAuth2Client(
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        redirect_uri=f"{settings.FRONTEND_URL}/api/auth/callback/google",
    )
    token = await client.fetch_token("https://oauth2.googleapis.com/token", code=code)
    userinfo = await client.get("https://www.googleapis.com/oauth2/v3/userinfo")
    info = userinfo.json()

    # Upsert user
    existing = supabase.table("users").select("*").eq("google_id", info["sub"]).execute()
    if existing.data:
        user = existing.data[0]
    else:
        res = supabase.table("users").insert({
            "email": info["email"],
            "name": info["name"],
            "google_id": info["sub"],
            "role": "farmer",   # default role — can be updated later
        }).execute()
        user = res.data[0]

    jwt_token = create_access_token({"sub": user["id"], "role": user["role"], "email": user["email"]})
    return {"access_token": jwt_token, "role": user["role"]}

# ── Auth guard (reusable dependency) ─────────────────────────
async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        payload = decode_token(creds.credentials)
        return payload
    except:
        raise HTTPException(status_code=401, detail="Invalid or expired token")