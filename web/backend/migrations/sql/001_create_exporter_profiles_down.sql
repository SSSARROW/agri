-- ============================================================
-- Migration: 001_create_exporter_profiles (DOWN / ROLLBACK)
-- Run in: Supabase SQL Editor
-- Purpose: Fully revert the UP migration.
-- ============================================================

DROP TRIGGER IF EXISTS trg_exporter_profiles_updated_at ON public.exporter_profiles;
DROP INDEX IF EXISTS idx_exporter_profiles_status;
DROP INDEX IF EXISTS idx_exporter_profiles_user_id;
DROP TABLE IF EXISTS public.exporter_profiles;
-- Note: set_updated_at() function is intentionally kept because other tables
-- may reuse it. Drop manually if no other table uses it:
-- DROP FUNCTION IF EXISTS public.set_updated_at();
