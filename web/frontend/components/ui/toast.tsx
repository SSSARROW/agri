import React from "react";

export type ToastState = { message: string; type: "success" | "error" } | null;

// A fixed-position toast — pass the state down from whatever page-local
// useState<ToastState> hook is managing it (kept local per-page rather
// than a global provider, since only one page ever shows one at a time).
export function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  const isError = toast.type === "error";
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium ${
        isError
          ? "bg-danger-bg border-danger-border text-danger"
          : "bg-success-bg border-success-border text-success"
      }`}
      role="status"
    >
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {isError ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        )}
      </svg>
      {toast.message}
    </div>
  );
}
