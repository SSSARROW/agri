"use client";

import Link from "next/link";
import { api, assetUrl } from "@/lib/api";
import { fmtDate, fmtDateTime, fmtHa, fmtKg, timeAgo, titleCase } from "@/lib/format";
import type { FarmerProgress } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { StageBar, STAGE_STYLE } from "@/components/exporter/StageBar";
import { Alert, Card, ErrorState, Icon, Spinner, Stat, cx } from "@/components/ui";

const EVENT_LABEL: Record<string, string> = {
  planted: "Planted", plot_photo: "Plot photo", planting_photo: "Planting photo", progress_photo: "Progress photo", batch_photo: "Batch photo",
  collect: "Collected", weigh: "Weighed", process: "Processed", grade: "Graded", pack: "Packed", collector_attestation: "Collector check",
};

export function FarmerProgressPanel({ linkId }: { linkId: string }) {
  const p = useFetch(() => api.get<FarmerProgress>(`/api/exporter/farmers/${linkId}/progress`).then((r) => r.data), [linkId]);
  if (p.loading && !p.data) return <Spinner />;
  if (p.error) return <ErrorState message={p.error} onRetry={p.reload} />;
  const d = p.data!;
  const std = d.standards.filter((s) => s.applies);
  const shown = std.length ? std : d.standards;
  const photos = d.recent_activity.filter((a) => a.photo_url).slice(0, 8);
  const issues = d.totals.rejected + d.totals.overdue;

  return (
    <div className="space-y-8">
      {issues > 0 && (
        <Alert tone="bad" title={`${issues} stage${issues === 1 ? "" : "s"} need${issues === 1 ? "s" : ""} attention`}>
          {d.totals.rejected > 0 && <>{d.totals.rejected} proof submission{d.totals.rejected === 1 ? " was" : "s were"} sent back and {d.totals.rejected === 1 ? "is" : "are"} waiting for a resubmission. </>}
          {d.totals.overdue > 0 && <>{d.totals.overdue} stage{d.totals.overdue === 1 ? " is" : "s are"} past due with no proof.</>}
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Stages approved" value={`${shown.reduce((a, s) => a + s.approved, 0)} / ${shown.reduce((a, s) => a + s.total, 0)}`} tone={issues ? undefined : "good"} />
        <Stat label="Harvested" value={d.harvested_kg ? fmtKg(d.harvested_kg) : "None yet"} hint={`${d.batches.length} batch${d.batches.length === 1 ? "" : "es"}`} />
        <Stat label="Plots" value={d.plots.length} hint={fmtHa(d.plots.reduce((a, x) => a + (x.area_ha ?? 0), 0))} />
        <Stat label="Last active" value={timeAgo(d.last_activity_at) || "—"} />
      </div>

      {shown.map((s) => (
        <section key={s.standard_id}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{s.name} <span className="text-sm font-normal text-ink-mute">v{s.version}</span></h2>
              <p className="text-sm text-ink-mute">
                {s.planted_at ? <>Planted {fmtDate(s.planted_at)} · day {s.days_since_planting}</> : "No planting recorded yet, so stage dates can't be worked out."}
              </p>
            </div>
            <p className="text-sm"><strong className="text-ink">{s.approved}</strong> <span className="text-ink-mute">of {s.total} approved</span></p>
          </div>
          <StageBar stages={s.stages} className="mb-5" />
          <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            {s.stages.map((st) => (
              <li key={st.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-4">
                <span className={cx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", STAGE_STYLE[st.status].bar)} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{st.position}. {st.name}</p>
                  <p className="text-sm text-ink-mute">
                    {st.due_date ? `Due ${fmtDate(st.due_date)}` : "Date set once planted"}
                    {st.submitted_at && <> · proof sent {fmtDate(st.submitted_at)} ({st.photo_count} photo{st.photo_count === 1 ? "" : "s"})</>}
                    {st.reviewed_at && <> · reviewed {fmtDate(st.reviewed_at)}</>}
                  </p>
                  {st.review_notes && <p className="mt-1 text-sm text-ink-soft">“{st.review_notes}”</p>}
                </div>
                <span className={cx("text-sm font-medium", STAGE_STYLE[st.status].text)}>{STAGE_STYLE[st.status].label}</span>
                {st.submission_id && (
                  <Link href={`/exporter/stage-proofs/${st.submission_id}`} className="inline-flex items-center gap-1 text-sm font-medium text-leaf-700 hover:underline">
                    View proof <Icon name="chevronRight" size={14} />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
      {shown.length === 0 && <Card className="text-sm text-ink-soft">You have no published standard for this farmer's crops yet, so there are no stages to track.</Card>}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Plots and plantings</h2>
        {d.plots.length === 0 ? <p className="text-sm text-ink-soft">This farmer has not mapped a plot yet.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {d.plots.map((pl) => (
              <Card key={pl.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{pl.name || "Unnamed plot"}</p>
                    <p className="text-sm text-ink-mute">{[pl.gn_division, pl.dsd, pl.district].filter(Boolean).join(", ")}</p>
                  </div>
                  <span className="font-display text-lg font-semibold">{fmtHa(pl.area_ha)}</span>
                </div>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {pl.plantings.length === 0 && <li className="text-ink-mute">Nothing planted yet</li>}
                  {pl.plantings.map((pt) => (
                    <li key={pt.crop} className="flex items-center gap-2">
                      <Icon name="leaf" size={15} className="text-leaf-600" />
                      <span><strong>{pt.crop}</strong> planted {fmtDate(pt.planted_at)}{pt.protocol_name ? <span className="text-ink-mute"> · committed to {pt.protocol_name}</span> : null}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-line pt-3 text-xs text-ink-mute">
                  {pl.photo_count} photo{pl.photo_count === 1 ? "" : "s"} on file{pl.last_photo_at ? ` · latest ${timeAgo(pl.last_photo_at)}` : ""}
                  {!pl.has_registration_photo && <span className="ml-2 font-medium text-danger-600">No registration photo</span>}
                  {pl.boundary_source === "estimated_square" && <span className="ml-2 font-medium text-warn-600">Estimated boundary</span>}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Harvest batches</h2>
        {d.batches.length === 0 ? <p className="text-sm text-ink-soft">No batches registered yet.</p> : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-sunken/60 text-xs tracking-wide text-ink-mute uppercase">
                <tr><th className="px-4 py-3 font-medium">Batch</th><th className="px-4 py-3 font-medium">Weight</th><th className="px-4 py-3 font-medium">Grade</th><th className="px-4 py-3 font-medium">Steps recorded</th><th className="px-4 py-3 font-medium">Registered</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {d.batches.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-3">
                      <Link href={`/batch/${b.code}`} target="_blank" className="font-mono font-medium tracking-wider text-leaf-700 hover:underline">{b.code}</Link>
                      <span className="ml-2 text-ink-mute">{b.crop}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{b.weight_kg != null ? fmtKg(b.weight_kg) : "—"}</td>
                    <td className="px-4 py-3">{b.grade || "—"}</td>
                    <td className="px-4 py-3"><span className="flex flex-wrap gap-1">{b.steps.map((s) => <span key={s} className="rounded bg-sunken px-1.5 py-0.5 text-xs text-ink-soft">{EVENT_LABEL[s] ?? titleCase(s)}</span>)}</span></td>
                    <td className="px-4 py-3 text-ink-mute">{fmtDate(b.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {photos.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Recent photos</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((a, i) => (
              <figure key={i} className="overflow-hidden rounded-xl border border-line bg-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetUrl(a.photo_url)} alt={EVENT_LABEL[a.event_type] ?? a.event_type} loading="lazy" className="aspect-[4/3] w-full object-cover" />
                <figcaption className="px-3 py-2 text-xs"><span className="font-medium text-ink">{EVENT_LABEL[a.event_type] ?? titleCase(a.event_type)}</span><br /><span className="text-ink-mute">{fmtDateTime(a.occurred_at)}</span></figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
