"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ── Button ─────────────────────────────────────────────────────────────── */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-leaf-600 text-white hover:bg-leaf-700 active:bg-leaf-800 shadow-card",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-sunken",
  ghost: "text-ink-soft hover:bg-sunken hover:text-ink",
  soft: "bg-leaf-50 text-leaf-800 hover:bg-leaf-100",
  danger: "bg-danger-600 text-white hover:bg-danger-700 shadow-card",
};
const SIZES = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-base" };

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZES;
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", loading, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant], SIZES[size], className,
      )}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function LinkButton({
  href, variant = "secondary", size = "md", className, children,
}: { href: string; variant?: Variant; size?: keyof typeof SIZES; className?: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        VARIANTS[variant], SIZES[size], className,
      )}
    >
      {children}
    </Link>
  );
}

/* ── Badge ──────────────────────────────────────────────────────────────── */

export type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "bark";
const TONES: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-soft",
  good: "bg-leaf-50 text-leaf-800",
  warn: "bg-warn-50 text-warn-600",
  bad: "bg-danger-50 text-danger-700",
  info: "bg-info-50 text-info-600",
  bark: "bg-bark-50 text-bark-700",
};
const DOTS: Record<Tone, string> = {
  neutral: "bg-ink-mute", good: "bg-leaf-500", warn: "bg-warn-600", bad: "bg-danger-600", info: "bg-info-600", bark: "bg-bark-500",
};

export function Badge({ tone = "neutral", dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TONES[tone])}>
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", DOTS[tone])} />}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  live: "good", published: "good", approved: "good", verified: "good", ready: "good", done: "good", sent: "good", read: "good", active: "good",
  draft: "neutral", archived: "neutral", withdrawn: "neutral", cancelled: "neutral", skipped: "neutral", no_reply: "neutral", closed: "neutral",
  pending: "warn", requested: "warn", upcoming: "info", sending: "info", open: "warn", overdue: "bad",
  expired: "neutral", past: "neutral", filled: "info",
  rejected: "bad", declined: "bad", removed: "bad", failed: "bad", taken_down: "bad", cannot: "bad", inactive: "bad",
  reviewed: "info", dismissed: "neutral",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const text = label ?? status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return <Badge tone={STATUS_TONE[status] ?? "neutral"} dot>{text}</Badge>;
}

/* ── Card & layout bits ─────────────────────────────────────────────────── */

export function Card({ className, children, padded = true }: { className?: string; children: ReactNode; padded?: boolean }) {
  return (
    <div className={cx("rounded-xl border border-line bg-surface shadow-card", padded && "p-5", className)}>{children}</div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title, subtitle, actions, back,
}: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-ink-mute hover:text-ink">
          <Icon name="chevronLeft" size={14} /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-tight font-semibold text-ink">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function Stat({
  label, value, hint, tone,
}: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <p className="text-xs font-medium tracking-wide text-ink-mute uppercase">{label}</p>
      <p
        className={cx(
          "mt-1 font-display text-2xl font-semibold tabular-nums",
          tone === "good" && "text-leaf-700", tone === "warn" && "text-warn-600", tone === "bad" && "text-danger-600",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}

export function ProgressBar({
  value, max = 100, segments, label,
}: {
  value?: number;
  max?: number;
  /** Stacked segments, e.g. approved + pending, each as a share of max. */
  segments?: { value: number; className: string; label: string }[];
  label?: string;
}) {
  const segs = segments ?? [{ value: value ?? 0, className: "bg-leaf-500", label: label ?? "" }];
  return (
    <div
      className="flex h-2.5 w-full overflow-hidden rounded-full bg-sunken"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={segs.reduce((a, s) => a + s.value, 0)}
      aria-label={label}
    >
      {segs.map((s, i) => (
        <div key={i} title={s.label} className={cx("h-full transition-[width]", s.className)} style={{ width: `${Math.min(100, (s.value / (max || 1)) * 100)}%` }} />
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; count?: number }[];
  label?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === o.value ? "bg-surface text-ink shadow-card" : "text-ink-soft hover:text-ink",
          )}
        >
          {o.label}
          {o.count !== undefined && o.count > 0 && (
            <span className="rounded-full bg-bark-100 px-1.5 text-[11px] font-semibold text-bark-700">{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({
  value, onChange, tabs,
}: { value: T; onChange: (v: T) => void; tabs: { value: T; label: string; badge?: number }[] }) {
  return (
    <div role="tablist" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
            value === t.value ? "border-leaf-600 text-leaf-800" : "border-transparent text-ink-mute hover:text-ink",
          )}
        >
          {t.label}
          {!!t.badge && <span className="rounded-full bg-bark-100 px-1.5 text-[11px] font-semibold text-bark-700">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

export function DefList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-xs font-medium tracking-wide text-ink-mute uppercase">{i.label}</dt>
          <dd className="mt-0.5 text-sm text-ink">{i.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Chips({ items, empty = "—" }: { items: string[]; empty?: string }) {
  if (!items.length) return <span className="text-ink-mute">{empty}</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i} className="rounded-md bg-sunken px-2 py-0.5 text-xs text-ink-soft">{i}</span>
      ))}
    </span>
  );
}
