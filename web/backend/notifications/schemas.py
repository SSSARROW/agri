from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class DispatchCounts(BaseModel):
    created: int = 0
    sent: int = 0
    failed: int = 0
    skipped: int = 0
    deferred: int = 0


class DispatchResult(BaseModel):
    run_id: Optional[str] = None
    mode: str = "manual"
    dry_run: bool = False
    today: str
    counts: DispatchCounts
    items: List[Dict[str, Any]] = Field(default_factory=list)
    error: Optional[str] = None


class ProviderSendResult(BaseModel):
    ok: bool
    provider_message_id: Optional[str] = None
    error: Optional[str] = None
