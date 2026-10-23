"use client";

import { useState } from "react";
import { api, parseError } from "@/lib/api";
import { fmtDate, fmtDateTime, titleCase } from "@/lib/format";
import type { Reminders } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { useExporter, VerificationNote } from "@/components/shell/ExporterContext";
import { Alert, Button, Card, EmptyState, ErrorState, ListSkeleton, Pagination, Segmented, StatusBadge, useToast } from "@/components/ui";

const PAGE_SIZE = 15;
type Slot = "all" | "30" | "14" | "7";
type Status = "all" | "sent" | "pending" | "failed" | "skipped";

const SKIP: Record<string, string> = {
  already_replied: "Already replied", link_not_approved: "No longer approved", district_not_eligible: "District not eligible",
  district_unknown: "District unknown", earlier_slot_missed: "Earlier reminder missed", notice_cancelled: "Notice cancelled", target_month_started: "Target month started",
};

export function NoticeRemindersPanel({ noticeId, published }: { noticeId: string; published: boolean }) {
  const { verified } = useExporter();
  const toast = useToast();
  const [slot, setSlot] = useState<Slot>("all");
  const [status, setStatus] = useState<Status>("all");
  const [page, setPage] = useState(1);
  const [retrying, setRetrying] = useState(false);

  const data = useFetch(
    () => (published ? api.get<Reminders>(`/api/exporter/planting-notices/${noticeId}/reminders`, { params: { slot: slot === "all" ? undefined : slot, status: status === "all" ? undefined : status, page, page_size: PAGE_SIZE } }).then((r) => r.data) : Promise.resolve(null)),
    [noticeId, slot, status, page, published],
  );

  if (!published) return <EmptyState icon="list" title="Reminders start after you publish" body="Once this notice is live, Origo reminds eligible farmers who haven’t replied 30, 14 and 7 days before the target month." />;
  const d = data.data;
  const failedCount = d?.slots.reduce((a, s) => a + s.failed, 0) ?? 0;

  const retry = async () => {
    setRetrying(true);
    try { const { data: r } = await api.post<{ retried_count: number; message: string }>(`/api/exporter/planting-notices/${noticeId}/reminders/retry-failed`); toast.success(r.message || `Retried ${r.retried_count}`); data.reload(); }
    catch (e) { toast.error(parseError(e).message); } finally { setRetrying(false); }
  };

  return (
    <div className="space-y-5">
      {d && /mock|sim|test/i.test(d.provider) && (
        <Alert tone="warn" title="Reminders are running in test mode">Delivery uses a simulated “{d.provider}” provider, so nothing real reaches farmers’ phones yet. The log below is accurate for what the system attempted.</Alert>
      )}
      {d && (
        <div className="grid gap-3 md:grid-cols-3">
          {d.slots.map((s) => (
            <Card key={s.slot}>
              <p className="text-xs font-medium tracking-wide text-ink-mute uppercase">{s.slot} days before</p>
              <p className="font-display text-lg font-semibold">{fmtDate(s.scheduled_date)}</p>
              <div className="mt-3 grid grid-cols-4 gap-1 text-center text-xs">
                <div><p className="text-base font-semibold text-leaf-700">{s.sent}</p>sent</div>
                <div><p className="text-base font-semibold text-warn-600">{s.pending}</p>pending</div>
                <div><p className="text-base font-semibold text-danger-600">{s.failed}</p>failed</div>
                <div><p className="text-base font-semibold text-ink-soft">{s.skipped}</p>skipped</div>
              </div>
              {Object.keys(s.skipped_reasons).length > 0 && (
                <ul className="mt-3 space-y-0.5 border-t border-line pt-2 text-xs text-ink-mute">
                  {Object.entries(s.skipped_reasons).map(([k, n]) => <li key={k} className="flex justify-between"><span>{SKIP[k] ?? titleCase(k)}</span><span className="tabular-nums">{n}</span></li>)}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<Slot> label="Reminder" value={slot} onChange={(v) => { setSlot(v); setPage(1); }} options={[{ value: "all", label: "All" }, { value: "30", label: "30 days" }, { value: "14", label: "14 days" }, { value: "7", label: "7 days" }]} />
        <Segmented<Status> label="Delivery status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} options={[{ value: "all", label: "Any" }, { value: "sent", label: "Sent" }, { value: "pending", label: "Pending" }, { value: "failed", label: "Failed" }, { value: "skipped", label: "Skipped" }]} />
        <div className="ml-auto flex items-center gap-3">
          {!verified && <VerificationNote action="retry deliveries" />}
          <Button variant="secondary" size="sm" onClick={retry} loading={retrying} disabled={!verified || failedCount === 0}>Retry failed{failedCount ? ` (${failedCount})` : ""}</Button>
        </div>
      </div>

      {data.loading && !d ? <ListSkeleton rows={4} /> : data.error ? <ErrorState message={data.error} onRetry={data.reload} /> : d && d.deliveries.length === 0 ? (
        <EmptyState icon="list" title="No deliveries yet" body="Reminders are queued as each date approaches." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-sunken/60 text-xs tracking-wide text-ink-mute uppercase">
              <tr><th className="px-4 py-3 font-medium">Farmer</th><th className="px-4 py-3 font-medium">Reminder</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Detail</th><th className="px-4 py-3 font-medium">Sent</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {d?.deliveries.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.farmer_name}</td>
                  <td className="px-4 py-3">{r.reminder_slot} days · {r.channel}</td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-ink-mute">{r.skip_reason ? SKIP[r.skip_reason] ?? titleCase(r.skip_reason) : r.last_error ? `${r.last_error} (${r.attempts} attempts)` : "—"}</td>
                  <td className="px-4 py-3 text-ink-mute">{fmtDateTime(r.sent_at)}</td>
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
