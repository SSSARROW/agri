import React from "react";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand" | "gold";

const toneClasses: Record<Tone, string> = {
  success: "bg-success-bg text-success border-success-border",
  warning: "bg-warning-bg text-warning border-warning-border",
  danger: "bg-danger-bg text-danger border-danger-border",
  info: "bg-info-bg text-info border-info-border",
  neutral: "bg-paper-sunken text-ink-700 border-border",
  brand: "bg-brand-50 text-brand-700 border-brand-200",
  gold: "bg-gold-50 text-gold-700 border-gold-200",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wide ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

// Maps the handful of recurring domain statuses (exporter verification,
// ads, planting notices, batches) to one consistent tone + label so the
// same word always means the same color across every page.
export const STATUS_TONE: Record<string, Tone> = {
  verified: "success",
  approved: "success",
  active: "success",
  live: "success",
  accepted: "success",
  done: "success",
  published: "success",
  pending: "warning",
  review: "warning",
  open: "warning",
  draft: "neutral",
  filled: "info",
  rejected: "danger",
  closed: "danger",
  expired: "danger",
  cancelled: "danger",
  taken_down: "danger",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status.toLowerCase()] ?? "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}
