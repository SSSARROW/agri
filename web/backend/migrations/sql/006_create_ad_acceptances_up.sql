-- ============================================================
-- Migration: 006_create_ad_acceptances (UP)
-- Run in: Supabase SQL Editor
-- Purpose: Add ad_acceptances table with immutability
--          trigger and unique farmer-per-ad constraint.
--          Non-destructive.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ad_acceptances (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id               UUID NOT NULL REFERENCES public.ads(id) ON DELETE CASCADE,
    ad_version_id       UUID NOT NULL REFERENCES public.ad_versions(id) ON DELETE RESTRICT,
    farmer_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    link_id             UUID NOT NULL REFERENCES public.farmer_exporter_links(id) ON DELETE RESTRICT,
    supply_quantity_kg  NUMERIC(12, 2) NOT NULL CHECK (supply_quantity_kg > 0),
    terms_hash          TEXT NOT NULL,
    accepted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    withdrawn_at        TIMESTAMPTZ
);

-- Unique index: One acceptance per farmer per ad
CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_acceptances_ad_farmer
    ON public.ad_acceptances(ad_id, farmer_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_ad_acceptances_ad_id
    ON public.ad_acceptances(ad_id);

CREATE INDEX IF NOT EXISTS idx_ad_acceptances_farmer_id
    ON public.ad_acceptances(farmer_id);

CREATE INDEX IF NOT EXISTS idx_ad_acceptances_link_id
    ON public.ad_acceptances(link_id);

-- Immutability trigger: Block DELETE, and block UPDATE of any column except withdrawn_at
CREATE OR REPLACE FUNCTION public.check_ad_acceptance_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Cannot delete ad acceptance records.';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.id <> NEW.id OR
           OLD.ad_id <> NEW.ad_id OR
           OLD.ad_version_id <> NEW.ad_version_id OR
           OLD.farmer_id <> NEW.farmer_id OR
           OLD.link_id <> NEW.link_id OR
           OLD.supply_quantity_kg <> NEW.supply_quantity_kg OR
           OLD.terms_hash <> NEW.terms_hash OR
           OLD.accepted_at <> NEW.accepted_at THEN
            RAISE EXCEPTION 'Cannot modify ad acceptance fields other than withdrawn_at.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ad_acceptances_immutability ON public.ad_acceptances;
CREATE TRIGGER trg_ad_acceptances_immutability
    BEFORE UPDATE OR DELETE ON public.ad_acceptances
    FOR EACH ROW EXECUTE FUNCTION public.check_ad_acceptance_immutability();

NOTIFY pgrst, 'reload schema';
