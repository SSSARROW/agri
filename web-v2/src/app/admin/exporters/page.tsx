"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { AdminExporterPage, ExporterStatus } from "@/lib/types";
import { useDebounced } from "@/hooks/useDebounced";
import { useFetch } from "@/hooks/useFetch";
import { EmptyState, ErrorState, Icon, ListSkeleton, PageHeader, Pagination, SearchInput, Segmented, StatusBadge } from "@/components/ui";

const PAGE_SIZE = 10;
type Filter = ExporterStatus | "all";

function List() {
  const initial = (useSearchParams().get("status") as Filter) || "pending";
  const [status, setStatus] = useState<Filter>(initial);
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [page, setPage] = useState(1);
  const list = useFetch(() => api.get<AdminExporterPage>("/api/admin/exporters", { params: { status, search: q || undefined, page, page_size: PAGE_SIZE } }).then((r) => r.data), [status, q, page]);
  const c = list.data?.counts;

  return (
    <>
      <PageHeader title="Exporter verification" subtitle="Check each company’s details, then approve, reject or reopen. Approval unlocks publishing; exporters see the outcome next time they open their workspace." />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented<Filter> label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ value: "pending", label: `Pending${c ? ` (${c.pending})` : ""}` }, { value: "verified", label: `Verified${c ? ` (${c.verified})` : ""}` }, { value: "rejected", label: `Rejected${c ? ` (${c.rejected})` : ""}` }, { value: "all", label: "All" }]} />
        <div className="min-w-60 flex-1 sm:max-w-sm"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search company, email, registration no." /></div>
      </div>
      {list.loading && !list.data ? <ListSkeleton /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.data && list.data.items.length === 0 ? (
        <EmptyState icon="search" title={status === "pending" && !q ? "No applications waiting" : "No exporters match"} body={status === "pending" && !q ? "You’re all caught up." : "Try another status or search."} />
      ) : (
        <ul className="space-y-3">
          {list.data?.items.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/exporters/${e.id}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-leaf-500/60">
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-info-50 text-info-600"><Icon name="building" size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">{e.company_name}<StatusBadge status={e.status} /></span>
                  <span className="block text-sm text-ink-soft">Reg. {e.business_reg_no} · {e.email || e.users?.email}</span>
                  <span className="block text-xs text-ink-mute">Applied {fmtDate(e.created_at)}{e.users?.name ? ` · ${e.users.name}` : ""}</span>
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

export default function ExporterVerificationPage() {
  return <Suspense><List /></Suspense>;
}
