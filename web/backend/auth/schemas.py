from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum

class UserRole(str, Enum):
    admin = "admin"
    farmer = "farmer"
    exporter = "exporter"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class FarmerSignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: str
    nic: str                  # raw — will be hashed before storage
    district: str
    dsd: str
    gn_division: str
    farm_address: str
    farm_size_ha: float

class ExporterSignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: str
    business_name: str
    business_reg_no: str
    business_address: str
    export_license_no: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole