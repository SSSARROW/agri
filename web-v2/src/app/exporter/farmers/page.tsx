"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, parseError } from "@/lib/api";
import { CROP_LABEL, DISTRICTS, NETWORK_CROPS } from "@/lib/constants";
import { fmtDate, fmtHa } from "@/lib/format";
import type { FarmerLink, FarmerLinkPage, LinkStatus } from "@/lib/types";
import { useDebounced } from "@/hooks/useDebounced";
import { useFetch } from "@/hooks/useFetch";
import { useExporter } from "@/components/shell/ExporterContext";
import { Button, EmptyState, ErrorState, Icon, ListSkeleton, PageHeader, Pagination, SearchInput, Segmented, SelectField, StatusBadge, useConfirm, useToast } from "@/components/ui";

const PAGE_SIZE = 10;
type View = "requests" | "mine" | "past";
const PAST: LinkStatus[] = ["declined", "removed", "cancelled"];

export default function FarmersPage() {
  const { verified, counts, reloadCounts } = useExporter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [view, setView] = useState<View>("requests");
  const [district, setDistrict] = useState("");
  const [crop, setCrop] = useState("");
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [page, setPage] = useState(1);

  const list = useFetch(async () => {
    const base = { district: district || undefined, crop: crop || undefined, search: q || undefined };
    if (view !== "past") {
      const r = await api.get<FarmerLinkPage>("/api/exporter/farmers", { params: { ...base, status: view === "requests" ? "requested" : "approved", page, page_size: PAGE_SIZE } });
      return r.data;
    }
    // "Past" spans three statuses the server can only filter one at a time, so merge them here.
    const rs = await Promise.all(PAST.map((s) => api.get<FarmerLinkPage>("/api/exporter/farmers", { params: { ...base, status: s, page: 1, page_size: 100 } })));
    const items = rs.flatMap((r) => r.data.items).sort((a, b) => (b.decided_at ?? b.requested_at).localeCompare(a.decided_at ?? a.requested_at));
    const total = items.length;
    return { items: items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), total, page, page_size: PAGE_SIZE, total_pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), pending_count: counts.requests } as FarmerLinkPage;
  }, [view, district, crop, q, page]);

  const filtered = !!(district || crop || q);
  const copy = useMemo(() => ({
    requests: { title: "No pending requests", body: "When a farmer asks to follow your standard, or applies to one of your buy requests, they’ll appear here for you to accept or decline." },
    mine: { title: "No farmers in your network yet", body: "Approve a request or an ad applicant to add your first farmer." },
    past: { title: "Nothing here", body: "Declined, removed and cancelled relationships appear here." },
  }[view]), [view]);

  const act = (kind: "approve" | "decline", l: FarmerLink) =>
    confirm({
      title: kind === "approve" ? `Approve ${l.farmer.name}?` : `Decline ${l.farmer.name}?`,
      tone: kind === "approve" ? "primary" : "danger",
      confirmLabel: kind === "approve" ? "Approve farmer" : "Decline",
      body: kind === "approve" ? "Approving unlocks their phone number and lets them submit stage proof against your standards." : "They can’t follow another exporter while their request is open, so decline promptly.",
      reason: kind === "decline" ? { label: "Reason (optional)" } : undefined,
      onConfirm: async (reason) => {
        try { await api.post(`/api/exporter/farmers/${l.id}/${kind}`, kind === "decline" ? { reason: reason || undefined } : undefined); } catch (e) { throw new Error(parseError(e).message); }
        toast.success(kind === "approve" ? "Farmer approved" : "Request declined"); list.reload(); reloadCounts();
      },
    });

  return (
    <>
      <PageHeader title="Farmer network" subtitle="Farmers ask to follow your quality standard. You decide who joins. Each farmer can follow one exporter at a time." />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented<View> label="View" value={view} onChange={(v) => { setView(v); setPage(1); }}
          options={[{ value: "requests", label: "Requests", count: counts.requests }, { value: "mine", label: "My farmers" }, { value: "past", label: "Past" }]} />
        <div className="w-44"><SelectField aria-label="District" value={district} onChange={(e) => { setDistrict(e.target.value); setPage(1); }}><option value="">All districts</option>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</SelectField></div>
        <div className="w-36"><SelectField aria-label="Crop" value={crop} onChange={(e) => { setCrop(e.target.value); setPage(1); }}><option value="">All crops</option>{NETWORK_CROPS.map((c) => <option key={c} value={CROP_LABEL[c]}>{CROP_LABEL[c]}</option>)}</SelectField></div>
        <div className="min-w-52 flex-1 sm:max-w-xs"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name" /></div>
      </div>

      {list.loading && !list.data ? <ListSkeleton /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.data && list.data.items.length === 0 ? (
        <EmptyState icon="users" title={filtered ? "No farmers match these filters" : copy.title} body={filtered ? "Clear a filter to see more." : copy.body} />
      ) : (
        <ul className="space-y-3">
          {list.data?.items.map((l) => (
            <li key={l.id} className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-leaf-50 font-display text-lg font-semibold text-leaf-700">{l.farmer.name.charAt(0).toUpperCase()}</span>
                <Link href={`/exporter/farmers/${l.id}`} className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-semibold hover:text-leaf-700">{l.farmer.name}{view === "past" && <StatusBadge status={l.status} />}</span>
                  <span className="block text-sm text-ink-soft">
                    {[l.farmer.dsd, l.farmer.district].filter(Boolean).join(", ") || "Location not given"} · {l.farmer.total_plots ? <>{fmtHa(l.farmer.total_plot_area_ha)} across {l.farmer.total_plots} plot{l.farmer.total_plots === 1 ? "" : "s"}</> : "No plots mapped yet"}
                  </span>
                  <span className="block text-xs text-ink-mute">
                    {l.farmer.crops.length ? l.farmer.crops.join(", ") : "No crops recorded"} · {l.status === "requested" ? `requested ${fmtDate(l.requested_at)}` : `${l.status} ${fmtDate(l.decided_at)}`}
                    {l.decision_reason ? ` — “${l.decision_reason}”` : ""}
                  </span>
                </Link>
                {l.status === "requested" && (
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={!verified} onClick={() => act("decline", l)}>Decline</Button>
                    <Button size="sm" disabled={!verified} onClick={() => act("approve", l)}><Icon name="check" size={15} /> Approve</Button>
                  </div>
                )}
                {l.status === "approved" && l.farmer.phone && <a href={`tel:${l.farmer.phone}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-leaf-700 hover:underline"><Icon name="phone" size={14} />{l.farmer.phone}</a>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {!verified && view === "requests" && <p className="mt-4 text-xs text-warn-600">You can read requests now. Approving and declining unlock once an administrator verifies your account.</p>}
      {list.data && <Pagination page={list.data.page} totalPages={list.data.total_pages} total={list.data.total} pageSize={PAGE_SIZE} onPage={setPage} />}
      {dialog}
    </>
  );
}
