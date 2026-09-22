from pydantic import BaseModel
from typing import Optional, List

class BatchCreate(BaseModel):
    crop: str
    plot_id: str
    parent_batch_ids: Optional[List[str]] = []
    protocol_id: Optional[str] = None
    commitment_id: Optional[str] = None

class BatchResponse(BaseModel):
    id: str
    code: str
    crop: str
    plot_id: str
    parent_batch_ids: List[str] = []
    created_at: Optional[str] = None
    protocol_id: Optional[str] = None
    commitment_id: Optional[str] = None

class PaginatedBatchesResponse(BaseModel):
    items: List[BatchResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

class SplitPiece(BaseModel):
    crop: str
    label: Optional[str] = None

class MergeRequest(BaseModel):
    parent_batch_ids: List[str]
    crop: str
    plot_id: str

class SplitRequest(BaseModel):
    pieces: List[SplitPiece]

class LineageBatch(BaseModel):
    id: str
    code: str
    crop: str
    depth: int
    parent_batch_ids: List[str]

class LineageResponse(BaseModel):
    batch_id: str
    ancestors: List[LineageBatch]
    descendants: List[LineageBatch]
    total_ancestors: int
    total_descendants: int
