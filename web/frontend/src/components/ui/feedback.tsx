"use client";

import {
  createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, cx } from "./primitives";
import { Icon } from "./Icon";
import { Field } from "./forms";

/* ── Loading / empty / error ────────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton h-4", className)} aria-hidden="true" />;
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-[72px] w-full rounded-xl" />
      ))}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-ink-mute" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-leaf-500 border-t-transparent" />
      {label}
    </div>
  );
}

export function EmptyState({
  title, body, action, icon = "leaf",
}: { title: string; body?: ReactNode; action?: ReactNode; icon?: "leaf" | "search" | "list" | "users" }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-leaf-50 text-leaf-600">
        <Icon name={icon} size={22} />
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {body && <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-danger-600/25 bg-danger-50 px-6 py-8 text-center">
      <Icon name="alert" size={22} className="mx-auto mb-2 text-danger-600" />
      <p className="text-sm font-medium text-danger-700">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>
      )}
    </div>
  );
}

type AlertTone = "info" | "warn" | "bad" | "good";
const ALERT_STYLES: Record<AlertTone, string> = {
  info: "border-info-600/20 bg-info-50 text-info-600",
  warn: "border-warn-600/25 bg-warn-50 text-warn-600",
  bad: "border-danger-600/25 bg-danger-50 text-danger-700",
  good: "border-leaf-500/25 bg-leaf-50 text-leaf-800",
};

export function Alert({
  tone = "info", title, children, action,
}: { tone?: AlertTone; title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={cx("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", ALERT_STYLES[tone])}>
      <Icon name={tone === "good" ? "check" : tone === "info" ? "info" : "alert"} size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx(title && "mt-0.5", "text-[13px] leading-relaxed opacity-90")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

/* ── Toasts ─────────────────────────────────────────────────────────────── */

interface Toast { id: number; tone: "good" | "bad" | "info"; text: string }
const ToastCtx = createContext<{ push: (tone: Toast["tone"], text: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "bad" ? 7000 : 4000);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 left-4 z-[60] flex flex-col items-center gap-2 sm:left-auto sm:items-end" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto max-w-md rounded-lg px-4 py-3 text-sm font-medium text-white shadow-pop",
              t.tone === "good" && "bg-leaf-800", t.tone === "bad" && "bg-danger-700", t.tone === "info" && "bg-ink",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return {
    success: (t: string) => ctx.push("good", t),
    error: (t: string) => ctx.push("bad", t),
    info: (t: string) => ctx.push("info", t),
  };
}

/* ── Modal & confirm ────────────────────────────────────────────────────── */

export function Modal({
  open, onClose, title, children, footer, wide,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx("flex max-h-[90dvh] w-full flex-col rounded-t-2xl bg-surface shadow-pop outline-none sm:rounded-2xl", wide ? "sm:max-w-2xl" : "sm:max-w-md")}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="-mr-2 rounded-md p-1.5 text-ink-mute hover:bg-sunken hover:text-ink">
            <Icon name="x" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 text-sm text-ink-soft">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "danger";
  /** When set, shows a reason box. */
  reason?: { label: string; required?: boolean; defaultValue?: string; placeholder?: string };
  onConfirm: (reason: string) => Promise<void> | void;
}

export function ConfirmDialog({ options, onClose }: { options: ConfirmOptions | null; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setReason(options?.reason?.defaultValue ?? "");
    setErr(null);
    setBusy(false);
  }, [options]);

  if (!options) return null;
  const needsReason = !!options.reason?.required;
  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await options.onConfirm(reason.trim());
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={busy ? () => {} : onClose}
      title={options.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant={options.tone === "danger" ? "danger" : "primary"} loading={busy} disabled={needsReason && !reason.trim()} onClick={submit}>
            {options.confirmLabel ?? "Confirm"}
          </Button>
        </>
      }
    >
      {options.body && <div className="mb-3 leading-relaxed">{options.body}</div>}
      {options.reason && (
        <Field label={options.reason.label} required={options.reason.required}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={options.reason.placeholder}
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink focus:border-leaf-500 focus:ring-2 focus:ring-leaf-500/20 focus:outline-none"
          />
        </Field>
      )}
      {err && <p role="alert" className="mt-3 text-sm text-danger-600">{err}</p>}
    </Modal>
  );
}

/** Imperative helper: `const { confirm, dialog } = useConfirm()` then render `{dialog}`. */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const confirm = useCallback((o: ConfirmOptions) => setOptions(o), []);
  const dialog = <ConfirmDialog options={options} onClose={() => setOptions(null)} />;
  return { confirm, dialog };
}
