import uuid

from pydantic import BaseModel


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None
    phone: str | None
    role: str
    district: str | None
    dsd: str | None
    gn_division: str | None
    business_name: str | None
