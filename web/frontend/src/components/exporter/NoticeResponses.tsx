"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { fmtDate, fmtHa, fmtKg, fmtPct } from "@/lib/format";
import type { NoticeResponses } from "@/lib/types";
import { useDebounced } from "@/hooks/useDebounced";
import { useFetch } from "@/hooks/useFetch";
import { Card, EmptyState, ErrorState, Icon, ListSkeleton, Pagination, ProgressBar, SearchInput, Segmented, Stat, StatusBadge } from "@/components/ui";

const PAGE_SIZE = 15;
type Filter = "all" | "ready" | "cannot" | "no_reply";

export function NoticeResponsesPanel({ noticeId }: { noticeId: string }) {
  const [resp, setResp] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [page, setPage] = useState(1);
  const data = useFetch(
    () => api.get<NoticeResponses>(`/api/exporter/planting-notices/${noticeId}/responses`, { params: { response: resp === "all" ? undefined : resp, search: q || undefined, page, page_size: PAGE_SIZE } }).then((r) => r.data),
    [noticeId, resp, q, page],
  );
  const d = data.data;

  return (
    <div className="space-y-5">
      {d && (
        <>
          <Card>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">Volume committed</p>
              <p className="text-sm text-ink-soft"><strong className="text-leaf-700">{fmtKg(d.total_expected_volume_kg)}</strong> of {fmtKg(d.volume_needed_kg)} ({fmtPct(d.volume_percentage)})</p>
            </div>
            <ProgressBar value={Math.min(100, d.volume_percentage)} label="Committed volume" />
          </Card>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Ready" value={d.counts.ready} tone="good" />
            <Stat label="Can’t" value={d.counts.cannot} />
            <Stat label="No reply yet" value={d.counts.no_reply} tone={d.counts.no_reply ? "warn" : undefined} />
            <Stat label="Eligible farmers" value={d.counts.eligible_total} />
          </div>
        </>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<Filter> label="Response" value={resp} onChange={(v) => { setResp(v); setPage(1); }}
          options={[{ value: "all", label: "All" }, { value: "ready", label: "Ready" }, { value: "cannot", label: "Can’t" }, { value: "no_reply", label: "Pending" }]} />
        <div className="min-w-52 flex-1 sm:max-w-xs"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by farmer" /></div>
      </div>
      {data.loading && !d ? <ListSkeleton rows={4} /> : data.error ? <ErrorState message={data.error} onRetry={data.reload} /> : d && d.items.length === 0 ? (
        <EmptyState icon="users" title="No farmers here" body={resp === "all" && !q ? "Responses appear once this notice is published and farmers open it." : "Nothing matches this filter."} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-sunken/60 text-xs tracking-wide text-ink-mute uppercase">
              <tr><th className="px-4 py-3 font-medium">Farmer</th><th className="px-4 py-3 font-medium">Response</th><th className="px-4 py-3 font-medium">Expected</th><th className="px-4 py-3 font-medium">Plot</th><th className="px-4 py-3 font-medium">When</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d?.items.map((r) => (
                <tr key={r.farmer_id}>
                  <td className="px-4 py-3"><p className="font-medium">{r.farmer_name}</p><p className="text-xs text-ink-mute">{r.district}{r.phone ? <> · <Icon name="phone" size={11} className="inline" /> {r.phone}</> : null}</p></td>
                  <td className="px-4 py-3"><StatusBadge status={r.response} label={r.response === "no_reply" ? "Pending" : r.response === "cannot" ? "Can’t" : "Ready"} /></td>
                  <td className="px-4 py-3 tabular-nums">{r.expected_volume_kg != null ? fmtKg(r.expected_volume_kg) : "—"}</td>
                  <td className="px-4 py-3">{r.plot_name ? <>{r.plot_name} <span className="text-ink-mute">({fmtHa(r.plot_area_ha)})</span></> : "—"}</td>
                  <td className="px-4 py-3 text-ink-mute">{fmtDate(r.responded_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {d && <Pagination page={d.page} totalPages={d.total_pages} total={d.total} pageSize={PAGE_SIZE} onPage={setPage} />}
    </div>
  );
}
