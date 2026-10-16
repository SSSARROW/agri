import React from "react";

export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full border-[3px] border-brand-200 border-t-brand-700 animate-spin"
    />
  );
}

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="min-h-screen bg-paper flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Spinner size={36} />
        {label && <p className="text-ink-500 text-sm font-medium">{label}</p>}
      </div>
    </div>
  );
}

export function SectionSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner size={32} />
    </div>
  );
}
