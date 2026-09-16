import bcrypt
import os
from datetime import datetime, timedelta
from jose import jwt, JWTError
from core.config import settings

def hash_nic(nic: str) -> tuple[str, str]:
    """Returns (hashed_nic, salt) — salt stored separately for audit."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(nic.encode(), salt)
    return hashed.decode(), salt.decode()

def verify_nic(nic: str, hashed: str) -> bool:
    return bcrypt.checkpw(nic.encode(), hashed.encode())

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])