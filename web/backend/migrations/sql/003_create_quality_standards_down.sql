-- ============================================================
-- Migration: 003_create_quality_standards (DOWN)
-- Run in: Supabase SQL Editor
-- Purpose: Rollback quality standards tables and triggers.
-- ============================================================

DROP TRIGGER IF EXISTS trg_quality_standard_stages_immutability ON public.quality_standard_stages;
DROP FUNCTION IF EXISTS public.check_quality_standard_stage_immutability();

DROP TRIGGER IF EXISTS trg_quality_standard_versions_immutability ON public.quality_standard_versions;
DROP FUNCTION IF EXISTS public.check_quality_standard_version_immutability();

DROP TABLE IF EXISTS public.quality_standard_stages CASCADE;
DROP TABLE IF EXISTS public.quality_standard_versions CASCADE;
DROP TABLE IF EXISTS public.quality_standards CASCADE;
