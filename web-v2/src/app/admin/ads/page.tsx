"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { CROP_LABEL } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import type { AdminAdRow, AdminAdState, Page } from "@/lib/types";
import { useDebounced } from "@/hooks/useDebounced";
import { useFetch } from "@/hooks/useFetch";
import { Checkbox, EmptyState, ErrorState, Icon, ListSkeleton, PageHeader, Pagination, SearchInput, SelectField, StatusBadge } from "@/components/ui";

const PAGE_SIZE = 20;

export default function AdminAds() {
  const [state, setState] = useState("");
  const [crop, setCrop] = useState("");
  const [reported, setReported] = useState(false);
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [page, setPage] = useState(1);
  const list = useFetch(
    () => api.get<Page<AdminAdRow>>("/api/admin/ads", { params: { state: state || undefined, crop: crop || undefined, has_open_reports: reported || undefined, search: q || undefined, page, page_size: PAGE_SIZE } }).then((r) => r.data),
    [state, crop, reported, q, page],
  );

  return (
    <>
      <PageHeader title="Ad moderation" subtitle="Every buy request on the platform. Open one to read farmer reports and take it down or restore it." />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-60 flex-1 sm:max-w-xs"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search company or title" /></div>
        <div className="w-40"><SelectField aria-label="State" value={state} onChange={(e) => { setState(e.target.value); setPage(1); }}>
          <option value="">Any state</option>{["live", "draft", "expired", "closed", "taken_down", "filled"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </SelectField></div>
        <div className="w-36"><SelectField aria-label="Crop" value={crop} onChange={(e) => { setCrop(e.target.value); setPage(1); }}><option value="">All crops</option><option value="tea">Tea</option><option value="cinnamon">Cinnamon</option></SelectField></div>
        <Checkbox checked={reported} onChange={(v) => { setReported(v); setPage(1); }}>Has open reports</Checkbox>
      </div>
      {list.loading && !list.data ? <ListSkeleton /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.data && list.data.items.length === 0 ? (
        <EmptyState icon="search" title="No ads match" body="Adjust the filters." />
      ) : (
        <ul className="space-y-3">
          {list.data?.items.map((a) => (
            <li key={a.id}>
              <Link href={`/admin/ads/${a.id}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-leaf-500/60">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-semibold">{a.title?.en || "Untitled"}<StatusBadge status={a.admin_state as AdminAdState} />
                    {a.open_report_count > 0 && <StatusBadge status="open" label={`${a.open_report_count} open report${a.open_report_count > 1 ? "s" : ""}`} />}</span>
                  <span className="block text-sm text-ink-soft">{a.exporter_company} · {CROP_LABEL[a.crop] ?? a.crop} · v{a.version_number}</span>
                  <span className="block text-xs text-ink-mute">Expires {fmtDate(a.expires_at)} · {a.total_views} views · {a.total_accepts} applications</span>
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
