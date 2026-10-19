-- ============================================================
-- Migration: 010_create_notifications (UP)
-- Run in: Supabase SQL Editor
-- Purpose: Add notifications and notification_runs tables
--          for Step 5B planting notice reminders with immutability triggers.
-- Non-destructive. Working rollback via 010_create_notifications_down.sql
-- ============================================================

-- ── 1. notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id            UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    notice_id            UUID         NOT NULL REFERENCES public.planting_notices(id) ON DELETE CASCADE,
    reminder_slot        INT          NOT NULL CHECK (reminder_slot IN (30, 14, 7)),
    channel              TEXT         NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'sms', 'push')),
    status               TEXT         NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped', 'read')),
    skip_reason          TEXT,
    title                TEXT         NOT NULL,
    body                 TEXT         NOT NULL,
    language             TEXT         NOT NULL DEFAULT 'en',
    attempts             INT          NOT NULL DEFAULT 0,
    last_error           TEXT,
    provider             TEXT         NOT NULL DEFAULT 'mock',
    provider_message_id  TEXT,
    scheduled_for        DATE         NOT NULL,
    sent_at              TIMESTAMPTZ,
    read_at              TIMESTAMPTZ,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_notice_farmer_slot UNIQUE (notice_id, farmer_id, reminder_slot)
);

CREATE INDEX IF NOT EXISTS idx_notifications_farmer_status
    ON public.notifications(farmer_id, status);

CREATE INDEX IF NOT EXISTS idx_notifications_notice_slot
    ON public.notifications(notice_id, reminder_slot);

CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_status
    ON public.notifications(scheduled_for, status);

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Immutability trigger:
-- Block DELETE completely.
-- Only status, skip_reason, attempts, last_error, provider_message_id, sent_at, read_at, updated_at may be updated.
-- Identity and content columns are immutable.
CREATE OR REPLACE FUNCTION public.check_notification_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Cannot delete notifications records.';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.id            <> NEW.id            OR
           OLD.farmer_id     <> NEW.farmer_id     OR
           OLD.notice_id     <> NEW.notice_id     OR
           OLD.reminder_slot <> NEW.reminder_slot OR
           OLD.channel       <> NEW.channel       OR
           OLD.title         <> NEW.title         OR
           OLD.body          <> NEW.body          OR
           OLD.language      <> NEW.language      OR
           OLD.provider      <> NEW.provider      OR
           OLD.scheduled_for <> NEW.scheduled_for OR
           OLD.created_at    <> NEW.created_at THEN
            RAISE EXCEPTION 'Cannot modify identity or immutable content fields on notifications.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_immutability ON public.notifications;
CREATE TRIGGER trg_notifications_immutability
    BEFORE UPDATE OR DELETE ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.check_notification_immutability();


-- ── 2. notification_runs ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_runs (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    finished_at          TIMESTAMPTZ,
    mode                 TEXT         NOT NULL DEFAULT 'manual' CHECK (mode IN ('manual', 'scheduler')),
    dry_run              BOOLEAN      NOT NULL DEFAULT false,
    today_override       DATE,
    counts               JSONB        NOT NULL DEFAULT '{"created": 0, "sent": 0, "failed": 0, "skipped": 0, "deferred": 0}'::jsonb,
    error                TEXT
);

CREATE INDEX IF NOT EXISTS idx_notification_runs_started_at
    ON public.notification_runs(started_at DESC);

-- Immutability trigger for runs:
-- Block DELETE completely.
-- Block UPDATE except finished_at, counts, error.
CREATE OR REPLACE FUNCTION public.check_notification_run_immutability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Cannot delete notification_runs records.';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.id             <> NEW.id             OR
           OLD.started_at     <> NEW.started_at     OR
           OLD.mode           <> NEW.mode           OR
           OLD.dry_run        <> NEW.dry_run        OR
           OLD.today_override IS DISTINCT FROM NEW.today_override THEN
            RAISE EXCEPTION 'Cannot modify identity or launch parameters on notification_runs.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notification_runs_immutability ON public.notification_runs;
CREATE TRIGGER trg_notification_runs_immutability
    BEFORE UPDATE OR DELETE ON public.notification_runs
    FOR EACH ROW EXECUTE FUNCTION public.check_notification_run_immutability();

NOTIFY pgrst, 'reload schema';
