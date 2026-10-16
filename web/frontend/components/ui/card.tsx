import React from "react";

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`bg-paper-raised border border-border rounded-xl ${
        padded ? "p-5 sm:p-6" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 className="font-display text-lg font-semibold text-ink-900">
          {title}
        </h3>
        {subtitle && <p className="text-sm text-ink-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// A flat stat tile — used in dashboard summary rows. Deliberately plain
// (no gradient, no glow) so a row of four reads as data, not decoration.
export function StatTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "neutral" | "brand" | "gold" | "danger";
}) {
  const toneClass = {
    neutral: "text-ink-900",
    brand: "text-brand-700",
    gold: "text-gold-600",
    danger: "text-danger",
  }[tone];
  return (
    <div className="bg-paper-raised border border-border rounded-xl p-4 text-center">
      <p className={`text-2xl font-display font-semibold ${toneClass}`}>
        {value}
      </p>
      <p className="text-[11px] text-ink-500 uppercase font-semibold mt-1 tracking-wide">
        {label}
      </p>
    </div>
  );
}
