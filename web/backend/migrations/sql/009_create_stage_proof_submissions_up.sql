-- ============================================================
-- Migration: 009_create_stage_proof_submissions (UP)
-- Run in: Supabase SQL Editor
-- Purpose: Farmers following an exporter's own quality standard
--          (farmer_exporter_links, status='approved') submit photo
--          proof per standard stage; the exporter manually reviews it.
--          A rejected-and-not-yet-reopened submission is what
--          "flags" a relationship for exporter attention — computed
--          at query time in the API, not stored as a separate flag
--          column, so it can never drift out of sync.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stage_proof_submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    link_id             UUID NOT NULL REFERENCES public.farmer_exporter_links(id) ON DELETE CASCADE,
    farmer_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    exporter_profile_id UUID NOT NULL REFERENCES public.exporter_profiles(id) ON DELETE CASCADE,
    stage_id            UUID NOT NULL REFERENCES public.quality_standard_stages(id) ON DELETE CASCADE,
    -- References api/'s plot table (a different service's migration path,
    -- not a cross-schema FK) — which plot these photos were taken on.
    plot_id             UUID,
    photo_urls          JSONB NOT NULL DEFAULT '[]'::jsonb,
    quick_field_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    note                TEXT,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at         TIMESTAMPTZ,
    review_notes        TEXT,
    -- Set by the exporter on a rejected submission to let the farmer
    -- submit again for the same stage (the "one shot, then manual
    -- exporter follow-up" rule — a rejection alone does not reopen itself).
    reopened_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_stage_proof_submissions_updated_at ON public.stage_proof_submissions;
CREATE TRIGGER trg_stage_proof_submissions_updated_at
    BEFORE UPDATE ON public.stage_proof_submissions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- At most one PENDING submission per stage per relationship at a time —
-- stops a farmer from spamming new submissions while one is still awaiting
-- review.
CREATE UNIQUE INDEX IF NOT EXISTS idx_stage_proof_submissions_one_pending_per_stage
    ON public.stage_proof_submissions(link_id, stage_id)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_stage_proof_submissions_link
    ON public.stage_proof_submissions(link_id);
CREATE INDEX IF NOT EXISTS idx_stage_proof_submissions_exporter_status
    ON public.stage_proof_submissions(exporter_profile_id, status);
CREATE INDEX IF NOT EXISTS idx_stage_proof_submissions_stage
    ON public.stage_proof_submissions(stage_id);

COMMENT ON TABLE public.stage_proof_submissions IS
    'Farmer-submitted photo proof for one stage of the exporter standard they are following, manually reviewed by the exporter. '
    'A rejected submission with reopened_at IS NULL blocks resubmission for that stage until the exporter explicitly reopens it.';

NOTIFY pgrst, 'reload schema';
