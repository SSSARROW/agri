-- ============================================================
-- Migration: 008_create_planting_notices (DOWN)
-- Run in: Supabase SQL Editor
-- Purpose: Rollback — drop tables and functions added in 008 UP.
-- ============================================================

DROP TRIGGER IF EXISTS trg_planting_bindings_immutability ON public.planting_bindings;
DROP TRIGGER IF EXISTS trg_notice_responses_immutability ON public.planting_notice_responses;
DROP TRIGGER IF EXISTS trg_planting_notices_immutability ON public.planting_notices;

DROP TABLE IF EXISTS public.planting_bindings;
DROP TABLE IF EXISTS public.planting_notice_responses;
DROP TABLE IF EXISTS public.planting_notices;

DROP FUNCTION IF EXISTS public.check_planting_binding_immutability();
DROP FUNCTION IF EXISTS public.check_notice_response_immutability();
DROP FUNCTION IF EXISTS public.check_planting_notice_immutability();

NOTIFY pgrst, 'reload schema';
