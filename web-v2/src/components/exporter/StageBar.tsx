import type { StageState } from "@/lib/types";
import { cx } from "@/components/ui";

export const STAGE_STYLE: Record<StageState, { bar: string; label: string; text: string }> = {
  approved: { bar: "bg-leaf-500", label: "Approved", text: "text-leaf-700" },
  pending: { bar: "bg-warn-600/70", label: "Waiting for your review", text: "text-warn-600" },
  rejected: { bar: "bg-danger-600", label: "Sent back", text: "text-danger-600" },
  reopened: { bar: "bg-info-600/70", label: "Reopened", text: "text-info-600" },
  overdue: { bar: "bg-danger-600/40 ring-1 ring-danger-600/50", label: "Overdue", text: "text-danger-600" },
  upcoming: { bar: "bg-line-strong", label: "Not due yet", text: "text-ink-mute" },
  waiting: { bar: "bg-sunken", label: "Not started", text: "text-ink-mute" },
};

/** One segment per stage, coloured by its review state. */
export function StageBar({ stages, className }: { stages: { name: string; status: StageState }[]; className?: string }) {
  if (stages.length === 0) return <div className={cx("h-2 rounded-full bg-sunken", className)} />;
  return (
    <div className={cx("flex gap-1", className)} role="img" aria-label={`${stages.filter((s) => s.status === "approved").length} of ${stages.length} stages approved`}>
      {stages.map((s, i) => (
        <span key={i} title={`${s.name}: ${STAGE_STYLE[s.status].label}`} className={cx("h-2 flex-1 rounded-full", STAGE_STYLE[s.status].bar)} />
      ))}
    </div>
  );
}
