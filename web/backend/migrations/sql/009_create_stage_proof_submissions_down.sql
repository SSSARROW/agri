-- ============================================================
-- Migration: 009_create_stage_proof_submissions (DOWN)
-- ============================================================

DROP TRIGGER IF EXISTS trg_stage_proof_submissions_updated_at ON public.stage_proof_submissions;
DROP TABLE IF EXISTS public.stage_proof_submissions;

NOTIFY pgrst, 'reload schema';
