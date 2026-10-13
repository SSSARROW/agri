-- ============================================================
-- Migration: 005_create_exporter_ads (DOWN)
-- Rollback for 005_create_exporter_ads
-- ============================================================

DROP TRIGGER IF EXISTS trg_ad_versions_immutability ON public.ad_versions;
DROP FUNCTION IF EXISTS public.check_ad_version_immutability();
DROP TRIGGER IF EXISTS trg_ads_updated_at ON public.ads;
DROP INDEX IF EXISTS public.idx_ad_versions_one_draft;
DROP INDEX IF EXISTS public.idx_ad_versions_standard_version;
DROP INDEX IF EXISTS public.idx_ad_versions_ad;
DROP INDEX IF EXISTS public.idx_ads_status;
DROP INDEX IF EXISTS public.idx_ads_crop;
DROP INDEX IF EXISTS public.idx_ads_exporter;
DROP TABLE IF EXISTS public.ad_versions;
DROP TABLE IF EXISTS public.ads;

NOTIFY pgrst, 'reload schema';
