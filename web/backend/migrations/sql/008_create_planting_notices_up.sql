-- ============================================================
-- Migration: 008_create_planting_notices (UP)
-- Run in: Supabase SQL Editor
-- Purpose: Add planting_notices, planting_notice_responses,
--          planting_bindings tables with immutability triggers.
-- Non-destructive. Working rollback via 008_..._down.sql
-- ============================================================

-- ── 1. planting_notices ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.planting_notices (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    exporter_profile_id  UUID         NOT NULL REFERENCES public.exporter_profiles(id) ON DELETE CASCADE,
    crop                 TEXT         NOT NULL CHECK (crop IN ('tea', 'cinnamon')),
    status               TEXT         NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled')),
    standard_version_id  UUID         NOT NULL REFERENCES public.quality_standard_versions(id) ON DELETE RESTRICT,
    target_month         DATE         NOT NULL,
    volume_needed_kg     NUMERIC(12, 2) NOT NULL CHECK (volume_needed_kg > 0),
    eligible_districts   JSONB        NOT NULL DEFAULT '[]'::jsonb,
    title                JSONB        NOT NULL DEFAULT '{"en": ""}'::jsonb,
    message              JSONB        NOT NULL DEFAULT '{"en": ""}'::jsonb,
    published_at         TIMESTAMPTZ,
    cancelled_at         TIMESTAMPTZ,
    cancelled_reason     TEXT,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planting_notices_exporter     ON public.planting_notices(exporter_profile_id);
CREATE INDEX IF NOT EXISTS idx_planting_notices_crop         ON public.planting_notices(crop);
CREATE INDEX IF NOT EXISTS idx_planting_notices_status       ON public.planting_notices(status);
CREATE INDEX IF NOT EXISTS idx_planting_notices_target_month ON public.planting_notices(target_month);

-- Content immutability trigger:
-- Block DELETE always.
-- Once published or cancelled, content columns cannot be modified.
-- Status can only transition draft -> published -> cancelled.
CREATE OR REPLACE FUNCTION public.check_planting_notice_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Cannot delete planting_notices records.';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IN ('published', 'cancelled') THEN
            IF OLD.id                  <> NEW.id                  OR
               OLD.exporter_profile_id <> NEW.exporter_profile_id OR
               OLD.crop                <> NEW.crop                OR
               OLD.standard_version_id <> NEW.standard_version_id OR
               OLD.target_month        <> NEW.target_month        OR
               OLD.volume_needed_kg    <> NEW.volume_needed_kg    OR
               OLD.eligible_districts  <> NEW.eligible_districts  OR
               OLD.title               <> NEW.title               OR
               OLD.message             <> NEW.message             OR
               COALESCE(OLD.published_at, 'epoch'::timestamptz) <> COALESCE(NEW.published_at, 'epoch'::timestamptz) OR
               OLD.created_at          <> NEW.created_at THEN
                RAISE EXCEPTION 'Cannot modify content columns on a published or cancelled planting notice.';
            END IF;
        END IF;

        IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
            RAISE EXCEPTION 'Cannot change status of a cancelled planting notice.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_planting_notices_immutability ON public.planting_notices;
CREATE TRIGGER trg_planting_notices_immutability
    BEFORE UPDATE OR DELETE ON public.planting_notices
    FOR EACH ROW EXECUTE FUNCTION public.check_planting_notice_immutability();


-- ── 2. planting_notice_responses ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.planting_notice_responses (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    notice_id            UUID         NOT NULL REFERENCES public.planting_notices(id) ON DELETE CASCADE,
    farmer_id            UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    response             TEXT         NOT NULL CHECK (response IN ('ready', 'cannot')),
    expected_volume_kg   NUMERIC(12, 2) CHECK (expected_volume_kg > 0),
    plot_id              UUID         REFERENCES public.plot(id) ON DELETE RESTRICT,
    responded_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (notice_id, farmer_id),
    CONSTRAINT chk_response_payload CHECK (
        (response = 'ready' AND expected_volume_kg IS NOT NULL AND plot_id IS NOT NULL) OR
        (response = 'cannot' AND expected_volume_kg IS NULL AND plot_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_notice_responses_notice_id ON public.planting_notice_responses(notice_id);
CREATE INDEX IF NOT EXISTS idx_notice_responses_farmer_id ON public.planting_notice_responses(farmer_id);

-- Immutability trigger: block DELETE; only allow updating response, volume, plot, timestamps
CREATE OR REPLACE FUNCTION public.check_notice_response_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Cannot delete planting_notice_responses records.';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.id        <> NEW.id        OR
           OLD.notice_id <> NEW.notice_id OR
           OLD.farmer_id <> NEW.farmer_id THEN
            RAISE EXCEPTION 'Cannot modify identity fields on planting_notice_responses.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notice_responses_immutability ON public.planting_notice_responses;
CREATE TRIGGER trg_notice_responses_immutability
    BEFORE UPDATE OR DELETE ON public.planting_notice_responses
    FOR EACH ROW EXECUTE FUNCTION public.check_notice_response_immutability();


-- ── 3. planting_bindings ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.planting_bindings (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    notice_id            UUID         NOT NULL REFERENCES public.planting_notices(id) ON DELETE CASCADE,
    farmer_id            UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    plot_id              UUID         NOT NULL REFERENCES public.plot(id) ON DELETE RESTRICT,
    crop                 TEXT         NOT NULL CHECK (crop IN ('tea', 'cinnamon')),
    season               TEXT         NOT NULL, -- e.g. '2026-11'
    standard_version_id  UUID         NOT NULL REFERENCES public.quality_standard_versions(id) ON DELETE RESTRICT,
    status               TEXT         NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released')),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    released_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_planting_bindings_notice_id ON public.planting_bindings(notice_id);
CREATE INDEX IF NOT EXISTS idx_planting_bindings_farmer_id ON public.planting_bindings(farmer_id);
CREATE INDEX IF NOT EXISTS idx_planting_bindings_plot_id   ON public.planting_bindings(plot_id);

-- Partial unique index: a plot cannot have more than one active binding for the same crop and season
CREATE UNIQUE INDEX IF NOT EXISTS idx_planting_bindings_active_plot_crop_season
    ON public.planting_bindings (plot_id, crop, season)
    WHERE status = 'active';

-- Immutability trigger: block DELETE; only status and released_at may be updated
CREATE OR REPLACE FUNCTION public.check_planting_binding_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Cannot delete planting_bindings records.';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.id                  <> NEW.id                  OR
           OLD.notice_id           <> NEW.notice_id           OR
           OLD.farmer_id           <> NEW.farmer_id           OR
           OLD.plot_id             <> NEW.plot_id             OR
           OLD.crop                <> NEW.crop                OR
           OLD.season              <> NEW.season              OR
           OLD.standard_version_id <> NEW.standard_version_id OR
           OLD.created_at          <> NEW.created_at THEN
            RAISE EXCEPTION 'Cannot modify identity or specification fields on planting_bindings.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_planting_bindings_immutability ON public.planting_bindings;
CREATE TRIGGER trg_planting_bindings_immutability
    BEFORE UPDATE OR DELETE ON public.planting_bindings
    FOR EACH ROW EXECUTE FUNCTION public.check_planting_binding_immutability();

NOTIFY pgrst, 'reload schema';
