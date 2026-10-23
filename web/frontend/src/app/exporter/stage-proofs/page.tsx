"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import type { ProofPage } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { EmptyState, ErrorState, Icon, ListSkeleton, PageHeader, Pagination, Segmented, StatusBadge } from "@/components/ui";

const PAGE_SIZE = 15;
type Filter = "pending" | "approved" | "rejected" | "all";

export default function StageProofs() {
  const [status, setStatus] = useState<Filter>("pending");
  const [page, setPage] = useState(1);
  const list = useFetch(
    // "all" is the server's empty status
    () => api.get<ProofPage>("/api/exporter/stage-proofs", { params: { status: status === "all" ? "" : status, page, page_size: PAGE_SIZE } }).then((r) => r.data),
    [status, page],
  );

  return (
    <>
      <PageHeader title="Stage proof" subtitle="Approved farmers photograph each stage of your standard. Review their evidence here. Rejected stages stay locked for the farmer until you reopen them." />
      <div className="mb-5">
        <Segmented<Filter> label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ value: "pending", label: "To review", count: list.data?.pending_count }, { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" }, { value: "all", label: "All" }]} />
      </div>
      {list.loading && !list.data ? <ListSkeleton /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.data && list.data.items.length === 0 ? (
        <EmptyState icon="list" title={status === "pending" ? "Nothing to review" : "No submissions here"} body={status === "pending" ? "When a farmer submits photo proof for one of your standard’s stages, it will wait here." : "Try another status."} />
      ) : (
        <ul className="space-y-3">
          {list.data?.items.map((s) => (
            <li key={s.id}>
              <Link href={`/exporter/stage-proofs/${s.id}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-leaf-500/60">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-bark-50 text-bark-600"><Icon name="camera" size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">{s.stage_name}<StatusBadge status={s.status} />{s.needs_attention && <StatusBadge status="overdue" label="Waiting for farmer to resubmit" />}</span>
                  <span className="block text-sm text-ink-soft">{s.farmer_name} · {s.plot_name || "No plot linked"} · {s.photo_count} photo{s.photo_count === 1 ? "" : "s"}</span>
                  <span className="block text-xs text-ink-mute">Submitted {fmtDateTime(s.submitted_at)}</span>
                </span>
                <Icon name="chevronRight" className="text-ink-mute" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {list.data && <Pagination page={list.data.page} totalPages={list.data.total_pages} total={list.data.total} pageSize={PAGE_SIZE} onPage={setPage} />}
    </>
  );
}
