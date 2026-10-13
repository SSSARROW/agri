-- ============================================================
-- Migration: 004_create_farmer_exporter_links (UP)
-- Run in: Supabase SQL Editor
-- Purpose: Add farmer_exporter_links table with active link uniqueness constraint.
--          Non-destructive.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.farmer_exporter_links (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    exporter_profile_id UUID NOT NULL REFERENCES public.exporter_profiles(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'requested'
                            CHECK (status IN ('requested', 'approved', 'declined', 'removed', 'cancelled')),
    requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at          TIMESTAMPTZ,
    decision_reason     TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_farmer_exporter_links_updated_at ON public.farmer_exporter_links;
CREATE TRIGGER trg_farmer_exporter_links_updated_at
    BEFORE UPDATE ON public.farmer_exporter_links
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Partial unique index: a farmer has at most ONE active link ('requested' or 'approved') across all exporters
CREATE UNIQUE INDEX IF NOT EXISTS idx_farmer_exporter_links_active_farmer
    ON public.farmer_exporter_links(farmer_id)
    WHERE status IN ('requested', 'approved');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_farmer_exporter_links_exporter_status
    ON public.farmer_exporter_links(exporter_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_farmer_exporter_links_farmer
    ON public.farmer_exporter_links(farmer_id);

COMMENT ON TABLE public.farmer_exporter_links IS
    'Links between farmers and exporters. Status: requested, approved, declined, removed, cancelled. '
    'A farmer can only have one active (requested or approved) link at any time.';

NOTIFY pgrst, 'reload schema';
