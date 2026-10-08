-- ============================================================
-- Migration: 001_create_exporter_profiles (UP)
-- Run in: Supabase SQL Editor
-- Purpose: Add exporter_profiles table. Non-destructive.
--          Does NOT alter the users table.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exporter_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,

    -- Company identity
    company_name        TEXT NOT NULL DEFAULT '',
    business_reg_no     TEXT NOT NULL UNIQUE DEFAULT '',
    export_licence_no   TEXT,
    contact_person      TEXT,
    phone               TEXT,
    email               TEXT,
    description         TEXT,
    logo_url            TEXT,

    -- Operational fields (arrays stored as JSONB)
    districts_served    JSONB NOT NULL DEFAULT '[]'::jsonb,
    crops_bought        JSONB NOT NULL DEFAULT '["tea", "cinnamon"]'::jsonb,
    certifications      JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- certifications valid values: organic | rainforest_alliance | fairtrade | other

    -- Verification state
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'verified', 'rejected')),
    rejection_reason    TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exporter_profiles_updated_at ON public.exporter_profiles;
CREATE TRIGGER trg_exporter_profiles_updated_at
    BEFORE UPDATE ON public.exporter_profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index for fast lookup by user_id (unique constraint already covers this but explicit for clarity)
CREATE INDEX IF NOT EXISTS idx_exporter_profiles_user_id
    ON public.exporter_profiles(user_id);

-- Index for fast lookup by status (for future admin queries)
CREATE INDEX IF NOT EXISTS idx_exporter_profiles_status
    ON public.exporter_profiles(status);

COMMENT ON TABLE public.exporter_profiles IS
    'Extended profile for users with role=exporter. '
    'One row per exporter user. Status starts as pending until an admin approves.';
