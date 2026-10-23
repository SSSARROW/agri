"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { CROP_LABEL } from "@/lib/constants";
import { fmtKg, fmtMonth, fmtPct } from "@/lib/format";
import type { NoticeListItem, Page } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { EmptyState, ErrorState, Icon, LinkButton, ListSkeleton, PageHeader, Pagination, ProgressBar, Segmented, SelectField, StatusBadge } from "@/components/ui";

const PAGE_SIZE = 10;
type StateFilter = "all" | "draft" | "upcoming" | "past" | "cancelled";

export default function NoticesPage() {
  const [state, setState] = useState<StateFilter>("all");
  const [crop, setCrop] = useState("");
  const [page, setPage] = useState(1);
  const list = useFetch(
    () => api.get<Page<NoticeListItem>>("/api/exporter/planting-notices", { params: { crop: crop || undefined, state: state === "all" ? undefined : state, page, page_size: PAGE_SIZE } }).then((r) => r.data),
    [state, crop, page],
  );
  const filtered = state !== "all" || !!crop;

  return (
    <>
      <PageHeader
        title="Planting notices"
        subtitle="Tell your approved farmers what you’ll need in a future month. They reply Ready (with a plot and volume) or Can’t, and the Origo app reminds those who haven’t replied."
        actions={<LinkButton href="/exporter/planting-notices/new" variant="primary"><Icon name="plus" size={16} /> New notice</LinkButton>}
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented<StateFilter> label="State" value={state} onChange={(v) => { setState(v); setPage(1); }}
          options={[{ value: "all", label: "All" }, { value: "draft", label: "Drafts" }, { value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }, { value: "cancelled", label: "Cancelled" }]} />
        <div className="w-36"><SelectField aria-label="Crop" value={crop} onChange={(e) => { setCrop(e.target.value); setPage(1); }}><option value="">All crops</option><option value="tea">Tea</option><option value="cinnamon">Cinnamon</option></SelectField></div>
      </div>

      {list.loading && !list.data ? <ListSkeleton /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.data && list.data.items.length === 0 ? (
        <EmptyState icon="list" title={filtered ? "No notices match" : "No planting notices yet"} body={filtered ? "Try a different state or crop." : "Announce next season’s volume to your farmers and see who commits."}
          action={!filtered && <LinkButton href="/exporter/planting-notices/new" variant="primary"><Icon name="plus" size={16} /> Create a notice</LinkButton>} />
      ) : (
        <ul className="space-y-3">
          {list.data?.items.map((n) => (
            <li key={n.id}>
              <Link href={`/exporter/planting-notices/${n.id}`} className="block rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-leaf-500/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">{n.title?.en || "Untitled"}<StatusBadge status={n.computed_state} /></p>
                    <p className="mt-0.5 text-sm text-ink-soft">{CROP_LABEL[n.crop] ?? n.crop} · {fmtMonth(n.target_month)} · {fmtKg(n.volume_needed_kg)} needed{n.standard_name ? ` · ${n.standard_name} v${n.standard_version_number}` : ""}</p>
                  </div>
                  <Icon name="chevronRight" className="text-ink-mute" />
                </div>
                {n.status !== "draft" && (
                  <div className="mt-3">
                    <ProgressBar value={Math.min(100, n.volume_percentage)} label="Committed volume" />
                    <p className="mt-1.5 flex flex-wrap gap-x-4 text-xs text-ink-mute">
                      <span><strong className="text-ink">{fmtPct(n.volume_percentage)}</strong> committed ({fmtKg(n.total_expected_volume_kg)})</span>
                      <span className="text-leaf-700">{n.counts.ready} ready</span>
                      <span>{n.counts.cannot} can’t</span>
                      <span>{n.counts.no_reply} no reply</span>
                      <span>of {n.counts.eligible_total} eligible</span>
                    </p>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {list.data && <Pagination page={list.data.page} totalPages={list.data.total_pages} total={list.data.total} pageSize={PAGE_SIZE} onPage={setPage} />}
    </>
  );
}
