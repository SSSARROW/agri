-- ============================================================
-- Migration: 006_create_ad_acceptances (DOWN)
-- Run in: Supabase SQL Editor
-- Purpose: Rollback ad_acceptances table, trigger, and indexes.
-- ============================================================

DROP TRIGGER IF EXISTS trg_ad_acceptances_immutability ON public.ad_acceptances;
DROP FUNCTION IF EXISTS public.check_ad_acceptance_immutability();
DROP TABLE IF EXISTS public.ad_acceptances CASCADE;

NOTIFY pgrst, 'reload schema';
