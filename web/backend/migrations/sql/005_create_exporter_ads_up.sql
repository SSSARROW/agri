-- ============================================================
-- Migration: 005_create_exporter_ads (UP)
-- Run in: Supabase SQL Editor
-- Purpose: Add ads and ad_versions tables with immutability
--          trigger and one-draft constraint. Non-destructive.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ads (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exporter_profile_id UUID NOT NULL REFERENCES public.exporter_profiles(id) ON DELETE CASCADE,
    crop                TEXT NOT NULL CHECK (crop IN ('tea', 'cinnamon')),
    status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed')),
    closed_at           TIMESTAMPTZ,
    closed_reason       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ad_versions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id                   UUID NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
    version_number          INTEGER NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    standard_version_id     UUID NOT NULL REFERENCES public.quality_standard_versions(id) ON DELETE RESTRICT,
    title                   JSONB NOT NULL DEFAULT '{"en": ""}'::jsonb,
    description             JSONB NOT NULL DEFAULT '{"en": ""}'::jsonb,
    grade_tier              TEXT NOT NULL DEFAULT '',
    quantity_kg             NUMERIC(12, 2) NOT NULL CHECK (quantity_kg > 0),
    price_type              TEXT NOT NULL CHECK (price_type IN ('fixed', 'range')),
    price_fixed             NUMERIC(10, 2),
    price_min               NUMERIC(10, 2),
    price_max               NUMERIC(10, 2),
    collection_window_start TIMESTAMPTZ NOT NULL,
    collection_window_end   TIMESTAMPTZ NOT NULL,
    pickup_location         TEXT NOT NULL DEFAULT '',
    eligible_districts      JSONB NOT NULL DEFAULT '[]'::jsonb,
    terms                   JSONB NOT NULL DEFAULT '{"payment_timing": "", "rejection_handling": "", "other": ""}'::jsonb,
    expires_at              TIMESTAMPTZ NOT NULL,
    published_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (ad_id, version_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ads_exporter ON public.ads(exporter_profile_id);
CREATE INDEX IF NOT EXISTS idx_ads_crop ON public.ads(crop);
CREATE INDEX IF NOT EXISTS idx_ads_status ON public.ads(status);
CREATE INDEX IF NOT EXISTS idx_ad_versions_ad ON public.ad_versions(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_versions_standard_version ON public.ad_versions(standard_version_id);

-- One-draft rule: at most one draft version per ad
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_versions_one_draft
    ON public.ad_versions(ad_id)
    WHERE status = 'draft';

-- Auto-update updated_at on ads
DROP TRIGGER IF EXISTS trg_ads_updated_at ON public.ads;
CREATE TRIGGER trg_ads_updated_at
    BEFORE UPDATE ON public.ads
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Immutability trigger for published ad versions
CREATE OR REPLACE FUNCTION public.check_ad_version_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'published' THEN
            RAISE EXCEPTION 'Cannot update a published ad version.';
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.status = 'published' THEN
            RAISE EXCEPTION 'Cannot delete a published ad version.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ad_versions_immutability ON public.ad_versions;
CREATE TRIGGER trg_ad_versions_immutability
    BEFORE UPDATE OR DELETE ON public.ad_versions
    FOR EACH ROW EXECUTE FUNCTION public.check_ad_version_immutability();

NOTIFY pgrst, 'reload schema';
