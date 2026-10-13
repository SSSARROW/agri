-- ============================================================
-- Migration: 004_create_farmer_exporter_links (DOWN)
-- Rollback for 004_create_farmer_exporter_links
-- ============================================================

DROP TRIGGER IF EXISTS trg_farmer_exporter_links_updated_at ON public.farmer_exporter_links;
DROP INDEX IF EXISTS public.idx_farmer_exporter_links_active_farmer;
DROP INDEX IF EXISTS public.idx_farmer_exporter_links_exporter_status;
DROP INDEX IF EXISTS public.idx_farmer_exporter_links_farmer;
DROP TABLE IF EXISTS public.farmer_exporter_links;

NOTIFY pgrst, 'reload schema';
