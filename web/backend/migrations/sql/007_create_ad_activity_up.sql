-- ============================================================
-- Migration: 007_create_ad_activity (UP)
-- Run in: Supabase SQL Editor
-- Purpose: Add ad_views, ad_reports, ad_moderation_log tables.
-- Non-destructive. Working rollback via 007_..._down.sql
-- ============================================================

-- ── ad_views ─────────────────────────────────────────────────────────────────
-- One row per farmer per ad per day. Deduplicated via UNIQUE constraint.
-- Inserts use ON CONFLICT DO NOTHING for safe deduplication.
CREATE TABLE IF NOT EXISTS public.ad_views (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id       UUID         NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
    farmer_id   UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    view_date   DATE         NOT NULL DEFAULT CURRENT_DATE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (ad_id, farmer_id, view_date)
);

CREATE INDEX IF NOT EXISTS idx_ad_views_ad_id     ON public.ad_views(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_views_farmer_id ON public.ad_views(farmer_id);
CREATE INDEX IF NOT EXISTS idx_ad_views_date      ON public.ad_views(view_date);

-- ── ad_reports ────────────────────────────────────────────────────────────────
-- One report per farmer per ad (UNIQUE(ad_id, farmer_id)).
-- Immutable except for status, reviewed_by, reviewed_at (enforced by trigger).
CREATE TABLE IF NOT EXISTS public.ad_reports (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id           UUID         NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
    ad_version_id   UUID         NOT NULL REFERENCES public.ad_versions(id) ON DELETE RESTRICT,
    farmer_id       UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason          TEXT         NOT NULL
                    CHECK (reason IN ('fake_ad','wrong_information','suspicious_exporter','other')),
    details         TEXT         CHECK (char_length(details) <= 500),
    status          TEXT         NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','reviewed','dismissed')),
    reviewed_by     UUID         REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (ad_id, farmer_id)
);

CREATE INDEX IF NOT EXISTS idx_ad_reports_ad_id     ON public.ad_reports(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_reports_farmer_id ON public.ad_reports(farmer_id);
CREATE INDEX IF NOT EXISTS idx_ad_reports_status    ON public.ad_reports(status);

-- Immutability trigger: block DELETE; only allow status/reviewed_by/reviewed_at updates
CREATE OR REPLACE FUNCTION public.check_ad_report_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Cannot delete ad_reports records.';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.id            <> NEW.id            OR
           OLD.ad_id         <> NEW.ad_id         OR
           OLD.ad_version_id <> NEW.ad_version_id OR
           OLD.farmer_id     <> NEW.farmer_id     OR
           OLD.reason        <> NEW.reason        OR
           COALESCE(OLD.details, '') <> COALESCE(NEW.details, '') OR
           OLD.created_at    <> NEW.created_at    THEN
            RAISE EXCEPTION 'Cannot modify immutable fields on ad_reports.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ad_reports_immutability ON public.ad_reports;
CREATE TRIGGER trg_ad_reports_immutability
    BEFORE UPDATE OR DELETE ON public.ad_reports
    FOR EACH ROW EXECUTE FUNCTION public.check_ad_report_immutability();

-- ── ad_moderation_log ─────────────────────────────────────────────────────────
-- Append-only audit log for admin takedown/restore actions.
-- UPDATE and DELETE are blocked by trigger.
CREATE TABLE IF NOT EXISTS public.ad_moderation_log (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id           UUID        NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
    admin_user_id   UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    action          TEXT        NOT NULL CHECK (action IN ('takedown','restore')),
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_moderation_log_ad_id ON public.ad_moderation_log(ad_id);

CREATE OR REPLACE FUNCTION public.check_ad_moderation_log_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Cannot delete ad_moderation_log records.';
    ELSIF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Cannot update ad_moderation_log records.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ad_moderation_log_immutability ON public.ad_moderation_log;
CREATE TRIGGER trg_ad_moderation_log_immutability
    BEFORE UPDATE OR DELETE ON public.ad_moderation_log
    FOR EACH ROW EXECUTE FUNCTION public.check_ad_moderation_log_immutability();

NOTIFY pgrst, 'reload schema';
