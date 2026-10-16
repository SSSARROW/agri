import React from "react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border mb-6">
      <div>
        {eyebrow && (
          <p className="text-xs font-bold text-brand-700 uppercase tracking-widest mb-1.5">
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-ink-900 leading-tight">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-ink-500 mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
