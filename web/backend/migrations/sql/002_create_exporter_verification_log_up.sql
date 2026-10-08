-- ============================================================
-- Migration: 002_create_exporter_verification_log (UP)
-- Run in: Supabase SQL Editor
-- Purpose: Add exporter_verification_log table for audit trail.
--          Non-destructive. Does NOT alter existing tables.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exporter_verification_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exporter_profile_id UUID NOT NULL REFERENCES public.exporter_profiles(id) ON DELETE CASCADE,
    admin_user_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action              TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'reopened')),
    reason              TEXT,
    previous_status     TEXT NOT NULL,
    new_status          TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by exporter profile
CREATE INDEX IF NOT EXISTS idx_exporter_verification_log_profile
    ON public.exporter_verification_log(exporter_profile_id);

COMMENT ON TABLE public.exporter_verification_log IS
    'Audit log for exporter verification status transitions (approve/reject/reopen).';
