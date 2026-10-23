"use client";

import { api } from "@/lib/api";
import { fmtKg, fmtPct } from "@/lib/format";
import type { AdStats } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { Card, ErrorState, ProgressBar, Spinner, Stat } from "@/components/ui";

/** The API only returns days that had views; lay them over a full run of days so bars are the right width. */
function fillDays(points: { date: string; views: number }[], days = 30) {
  const byDate = new Map(points.map((p) => [p.date, p.views]));
  const out: { date: string; views: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(d);
    out.push({ date: key, views: byDate.get(key) ?? 0 });
  }
  return out;
}

function ViewsChart({ points: raw }: { points: { date: string; views: number }[] }) {
  const points = fillDays(raw);
  const max = Math.max(1, ...points.map((p) => p.views));
  const W = 640, H = 140, pad = 4;
  const bw = (W - pad * 2) / points.length;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H + 22}`} className="w-full" role="img" aria-label={`Views per day over the last ${points.length} days, peak ${max}`}>
        {[0, 0.5, 1].map((t) => (
          <line key={t} x1={0} x2={W} y1={H - t * (H - 8)} y2={H - t * (H - 8)} stroke="var(--color-line)" strokeWidth={1} />
        ))}
        {points.map((p, i) => {
          const h = (p.views / max) * (H - 8);
          return (
            <g key={p.date}>
              <rect x={pad + i * bw + 1} y={H - h} width={Math.max(2, bw - 2)} height={h} rx={2} fill="var(--color-leaf-500)">
                <title>{`${p.date}: ${p.views} view${p.views === 1 ? "" : "s"}`}</title>
              </rect>
            </g>
          );
        })}
        <text x={pad} y={H + 16} fontSize="11" fill="var(--color-ink-mute)">{points[0]?.date}</text>
        <text x={W - pad} y={H + 16} fontSize="11" fill="var(--color-ink-mute)" textAnchor="end">{points[points.length - 1]?.date}</text>
      </svg>
    </figure>
  );
}

export function AdStatsPanel({ adId }: { adId: string }) {
  const s = useFetch(() => api.get<AdStats>(`/api/exporter/ads/${adId}/stats`, { params: { days: 30 } }).then((r) => r.data), [adId]);
  if (s.loading && !s.data) return <Spinner />;
  if (s.error) return <ErrorState message={s.error} onRetry={s.reload} />;
  const d = s.data!;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Views" value={d.total_views} hint={`${d.unique_viewers} unique farmers`} />
        <Stat label="Applications" value={d.accepts.total} hint={`${d.accepts.pending} pending`} />
        <Stat label="View → apply" value={fmtPct(d.view_to_accept_rate)} hint="of unique viewers applied" />
        <Stat label="Filled" value={fmtPct(d.filled_percentage)} hint={`${fmtKg(d.approved_quantity_kg)} of ${fmtKg(d.target_quantity_kg)}`} tone={d.filled_percentage >= 100 ? "good" : undefined} />
      </div>
      <Card>
        <h3 className="mb-3 font-semibold">Applications</h3>
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span><strong className="text-leaf-700">{d.accepts.approved}</strong> approved</span>
          <span><strong className="text-warn-600">{d.accepts.pending}</strong> pending</span>
          <span><strong className="text-danger-600">{d.accepts.declined}</strong> declined</span>
          <span><strong className="text-ink-soft">{d.accepts.withdrawn}</strong> withdrawn</span>
        </div>
        <ProgressBar max={Math.max(1, d.accepts.total)} label="Application outcomes" segments={[
          { value: d.accepts.approved, className: "bg-leaf-500", label: "Approved" },
          { value: d.accepts.pending, className: "bg-warn-600/60", label: "Pending" },
          { value: d.accepts.declined, className: "bg-danger-600/70", label: "Declined" },
          { value: d.accepts.withdrawn, className: "bg-line-strong", label: "Withdrawn" },
        ]} />
      </Card>
      {d.views_per_day && d.views_per_day.length > 0 && (
        <Card>
          <h3 className="mb-3 font-semibold">Views per day <span className="text-sm font-normal text-ink-mute">(last 30 days)</span></h3>
          <ViewsChart points={d.views_per_day} />
        </Card>
      )}
    </div>
  );
}
