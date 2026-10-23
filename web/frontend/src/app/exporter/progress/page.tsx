"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { fmtKg, timeAgo } from "@/lib/format";
import type { NetworkProgress, ProgressState, StageState } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { StageBar } from "@/components/exporter/StageBar";
import { EmptyState, ErrorState, Icon, ListSkeleton, PageHeader, Segmented, StatusBadge } from "@/components/ui";

type Filter = "all" | ProgressState;

const STATE_LABEL: Record<ProgressState, string> = {
  needs_attention: "Needs attention", waiting_review: "Waiting for review", on_track: "On track", not_started: "Not planted yet",
};

export default function ProgressPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const data = useFetch(() => api.get<NetworkProgress>("/api/exporter/farmers/progress").then((r) => r.data), []);
  const d = data.data;

  const items = useMemo(() => (d?.items ?? []).filter((i) => filter === "all" || i.state === filter), [d, filter]);

  return (
    <>
      <PageHeader
        title="Farmer progress"
        subtitle="How far each approved farmer has got through your quality standard, from planting to harvest, based on what they record in the field and the proof you have reviewed."
      />
      {d && d.summary.farmers > 0 && (
        <p className="mb-8 max-w-3xl text-lg leading-relaxed text-ink-soft">
          <strong className="font-semibold text-ink">{d.summary.farmers} farmers</strong> are following your standard. {d.summary.on_track} are on track
          {d.summary.needs_attention ? <>, <strong className="font-semibold text-danger-600">{d.summary.needs_attention} {d.summary.needs_attention === 1 ? "needs" : "need"} attention</strong></> : null}
          {d.summary.waiting_review ? <>, {d.summary.waiting_review} have proof waiting for you</> : null}. Together they have harvested{" "}
          <strong className="font-semibold text-ink">{fmtKg(d.summary.harvested_kg)}</strong>.
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented<Filter> label="Progress state" value={filter} onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "needs_attention", label: "Needs attention", count: d?.summary.needs_attention },
            { value: "waiting_review", label: "Waiting for review", count: d?.summary.waiting_review },
            { value: "on_track", label: "On track" },
          ]} />
      </div>

      {data.loading && !d ? <ListSkeleton /> : data.error ? <ErrorState message={data.error} onRetry={data.reload} /> : d && d.items.length === 0 ? (
        <EmptyState icon="users" title="No approved farmers yet" body="Once you approve farmers in your network, their progress through your standard appears here." />
      ) : items.length === 0 ? (
        <EmptyState icon="search" title="Nobody here" body="No farmers match this filter." />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          {items.map((r) => {
            const segs = [
              ...Array(r.totals.approved).fill("approved"), ...Array(r.totals.pending).fill("pending"), ...Array(r.totals.rejected).fill("rejected"),
              ...Array(r.totals.reopened).fill("reopened"), ...Array(r.totals.overdue).fill("overdue"), ...Array(r.totals.upcoming).fill("upcoming"),
              ...Array(r.totals.waiting).fill("waiting"),
            ].map((s, i) => ({ name: `Stage ${i + 1}`, status: s as StageState }));
            return (
              <li key={r.link_id}>
                <Link href={`/exporter/farmers/${r.link_id}`} className="group grid items-center gap-x-6 gap-y-3 px-5 py-4 transition-colors hover:bg-sunken/50 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.5fr)_150px_170px]">
                  <span className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-leaf-50 font-semibold text-leaf-700">{r.farmer.name.charAt(0)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-ink">{r.farmer.name}</span>
                      <span className="block truncate text-sm text-ink-mute">{[r.farmer.gn_division, r.farmer.district].filter(Boolean).join(", ")} · {r.crops.join(", ") || "No crop yet"}</span>
                    </span>
                  </span>
                  <span>
                    <StageBar stages={segs} />
                    <span className="mt-1.5 block text-xs text-ink-mute">
                      {r.stages_total ? <><strong className="text-ink">{r.stages_approved}</strong> of {r.stages_total} stages approved</> : "No stages yet"}
                      {r.days_since_planting != null && <> · day {r.days_since_planting} since planting</>}
                    </span>
                  </span>
                  <span className="text-sm md:text-right">
                    <span className="block font-medium tabular-nums">{r.harvested_kg ? fmtKg(r.harvested_kg) : "No harvest"}</span>
                    <span className="block text-xs text-ink-mute">{r.n_batches} batch{r.n_batches === 1 ? "" : "es"} · active {timeAgo(r.last_activity_at) || "never"}</span>
                  </span>
                  <span className="flex items-center justify-between gap-3 md:justify-end">
                    <StatusBadge status={r.state === "needs_attention" ? "rejected" : r.state === "waiting_review" ? "pending" : r.state === "on_track" ? "approved" : "draft"} label={STATE_LABEL[r.state]} />
                    <Icon name="chevronRight" className="text-ink-mute transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
