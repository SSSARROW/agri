-- ============================================================
-- Migration: 003_create_quality_standards (UP)
-- Run in: Supabase SQL Editor
-- Purpose: Add quality_standards, quality_standard_versions, and
--          quality_standard_stages tables with immutability triggers.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quality_standards (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exporter_profile_id UUID NOT NULL REFERENCES public.exporter_profiles(id) ON DELETE CASCADE,
    crop                TEXT NOT NULL,
    is_archived         BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quality_standard_versions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    standard_id         UUID NOT NULL REFERENCES public.quality_standards(id) ON DELETE CASCADE,
    version_number      INTEGER NOT NULL,
    name                TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    grade_spec          JSONB NOT NULL DEFAULT '{}'::jsonb,
    published_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (standard_id, version_number)
);

CREATE TABLE IF NOT EXISTS public.quality_standard_stages (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id            UUID NOT NULL REFERENCES public.quality_standard_versions(id) ON DELETE CASCADE,
    position              INTEGER NOT NULL,
    name                  TEXT NOT NULL,
    timing_type           TEXT NOT NULL CHECK (timing_type IN ('one_time', 'recurring')),
    start_offset_days     INTEGER NOT NULL,
    repeat_interval_days  INTEGER,
    end_offset_days       INTEGER,
    instructions          JSONB NOT NULL DEFAULT '{"en": ""}'::jsonb,
    dos                   JSONB NOT NULL DEFAULT '{"en": []}'::jsonb,
    donts                 JSONB NOT NULL DEFAULT '{"en": []}'::jsonb,
    allowed_inputs        JSONB NOT NULL DEFAULT '[]'::jsonb,
    banned_inputs         JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_proof        JSONB NOT NULL DEFAULT '{"photo_count": 0, "photo_descriptions": [], "quick_fields": []}'::jsonb,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (version_id, position)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quality_standards_exporter ON public.quality_standards(exporter_profile_id);
CREATE INDEX IF NOT EXISTS idx_quality_standards_crop ON public.quality_standards(crop);
CREATE INDEX IF NOT EXISTS idx_quality_standard_versions_standard ON public.quality_standard_versions(standard_id);
CREATE INDEX IF NOT EXISTS idx_quality_standard_stages_version ON public.quality_standard_stages(version_id);

-- Immutability trigger for published versions
CREATE OR REPLACE FUNCTION public.check_quality_standard_version_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF OLD.status = 'published' THEN
            -- Allow setting published_at on initial publish step, but block any other updates once published
            IF OLD.published_at IS NOT NULL AND (
                NEW.name IS DISTINCT FROM OLD.name OR
                NEW.grade_spec IS DISTINCT FROM OLD.grade_spec OR
                NEW.version_number IS DISTINCT FROM OLD.version_number
            ) THEN
                RAISE EXCEPTION 'Cannot update a published quality standard version.';
            END IF;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.status = 'published' THEN
            RAISE EXCEPTION 'Cannot delete a published quality standard version.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quality_standard_versions_immutability ON public.quality_standard_versions;
CREATE TRIGGER trg_quality_standard_versions_immutability
    BEFORE UPDATE OR DELETE ON public.quality_standard_versions
    FOR EACH ROW EXECUTE FUNCTION public.check_quality_standard_version_immutability();

-- Immutability trigger for stages belonging to published versions
CREATE OR REPLACE FUNCTION public.check_quality_standard_stage_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status
    FROM public.quality_standard_versions
    WHERE id = COALESCE(OLD.version_id, NEW.version_id);

    IF v_status = 'published' THEN
        RAISE EXCEPTION 'Cannot insert, update or delete stages of a published version.';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quality_standard_stages_immutability ON public.quality_standard_stages;
CREATE TRIGGER trg_quality_standard_stages_immutability
    BEFORE INSERT OR UPDATE OR DELETE ON public.quality_standard_stages
    FOR EACH ROW EXECUTE FUNCTION public.check_quality_standard_stage_immutability();
