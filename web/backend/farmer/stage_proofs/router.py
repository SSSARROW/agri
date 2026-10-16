from fastapi import APIRouter, Depends, Path
from farmer.auth import get_current_farmer
from farmer.stage_proofs import service
from farmer.stage_proofs.schemas import (
    FarmerStandardsResponse,
    SubmitProofBody,
    SubmissionOut,
    MySubmissionsResponse,
)

router = APIRouter(prefix="/api/farmer/stage-proofs", tags=["farmer-stage-proofs"])


@router.get("/standards", response_model=FarmerStandardsResponse)
async def get_my_standards(current_farmer: dict = Depends(get_current_farmer)):
    """
    The farmer's approved exporter's published standard(s), each stage
    annotated with the farmer's latest submission status for it. Empty
    standards list (with has_approved_exporter true) if the exporter
    hasn't published anything yet.
    """
    farmer_id = current_farmer["sub"]
    return service.get_farmer_standards_view(farmer_id)


@router.post("/{stage_id}/submit", response_model=SubmissionOut)
async def submit_proof(
    body: SubmitProofBody,
    stage_id: str = Path(..., description="Quality standard stage ID"),
    current_farmer: dict = Depends(get_current_farmer),
):
    """
    Submit photo proof (+ optional quick-field answers and a note) for one
    stage of the farmer's approved exporter's standard. Blocked if a
    submission for this stage is already pending review, or if the most
    recent one was rejected and the exporter hasn't reopened it yet.
    """
    farmer_id = current_farmer["sub"]
    return service.submit_stage_proof(farmer_id, stage_id, body.model_dump())


@router.get("/my-submissions", response_model=MySubmissionsResponse)
async def list_my_submissions(current_farmer: dict = Depends(get_current_farmer)):
    """Full submission history across every stage, newest first."""
    farmer_id = current_farmer["sub"]
    return service.list_my_submissions(farmer_id)
