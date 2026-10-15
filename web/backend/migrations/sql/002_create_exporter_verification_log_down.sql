-- ============================================================
-- Migration: 002_create_exporter_verification_log (DOWN)
-- Run in: Supabase SQL Editor
-- Purpose: Rollback exporter_verification_log table
-- ============================================================

DROP TABLE IF EXISTS public.exporter_verification_log CASCADE;
