import uuid

from pydantic import BaseModel


class AuditFinding(BaseModel):
    rule: str
    severity: float
    explanation: str
    batch_code: str | None
    plot_id: uuid.UUID | None


class AuditQueueEntry(BaseModel):
    user_id: uuid.UUID
    name: str | None
    role: str | None
    district: str | None
    score: int
    level: str  # "high" | "medium" | "low"
    findings: list[AuditFinding]


class AuditQueueOut(BaseModel):
    entries: list[AuditQueueEntry]


class BatchAuditOut(BaseModel):
    batch_code: str
    findings: list[AuditFinding]
