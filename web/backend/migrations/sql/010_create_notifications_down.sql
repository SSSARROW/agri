-- ============================================================
-- Migration: 010_create_notifications (DOWN / ROLLBACK)
-- Run in: Supabase SQL Editor
-- Purpose: Complete, clean rollback of 010_create_notifications_up.sql.
-- ============================================================

DROP TRIGGER IF EXISTS trg_notification_runs_immutability ON public.notification_runs;
DROP FUNCTION IF EXISTS public.check_notification_run_immutability();

DROP TABLE IF EXISTS public.notification_runs CASCADE;

DROP TRIGGER IF EXISTS trg_notifications_immutability ON public.notifications;
DROP FUNCTION IF EXISTS public.check_notification_immutability();

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;

DROP TABLE IF EXISTS public.notifications CASCADE;

NOTIFY pgrst, 'reload schema';
