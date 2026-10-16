import React from "react";
import type { Tone } from "./badge";

const toneStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: "bg-success-bg",
    border: "border-success-border",
    text: "text-success",
    icon: "M5 13l4 4L19 7",
  },
  warning: {
    bg: "bg-warning-bg",
    border: "border-warning-border",
    text: "text-warning",
    icon: "M12 9v3.75m0 3.75h.008v.008H12v-.008zM21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  danger: {
    bg: "bg-danger-bg",
    border: "border-danger-border",
    text: "text-danger",
    icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
  },
  info: {
    bg: "bg-info-bg",
    border: "border-info-border",
    text: "text-info",
    icon: "M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z",
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: Extract<Tone, "success" | "warning" | "danger" | "info">;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const s = toneStyles[tone];
  return (
    <div className={`flex items-start gap-3.5 p-4 rounded-xl border ${s.bg} ${s.border}`}>
      <svg
        className={`w-5 h-5 shrink-0 mt-0.5 ${s.text}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
      </svg>
      <div className="min-w-0">
        <p className={`font-semibold text-sm ${s.text}`}>{title}</p>
        {children && <div className="text-sm text-ink-700 mt-0.5">{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}
