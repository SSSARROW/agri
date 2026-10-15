-- ============================================================
-- Migration: 007_create_ad_activity (DOWN)
-- Run in: Supabase SQL Editor
-- Purpose: Rollback — drop tables and functions added in UP.
-- ============================================================

DROP TRIGGER IF EXISTS trg_ad_moderation_log_immutability ON public.ad_moderation_log;
DROP TRIGGER IF EXISTS trg_ad_reports_immutability         ON public.ad_reports;

DROP TABLE IF EXISTS public.ad_moderation_log;
DROP TABLE IF EXISTS public.ad_reports;
DROP TABLE IF EXISTS public.ad_views;

DROP FUNCTION IF EXISTS public.check_ad_moderation_log_immutability();
DROP FUNCTION IF EXISTS public.check_ad_report_immutability();

NOTIFY pgrst, 'reload schema';
