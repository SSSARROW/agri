"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, parseError } from "@/lib/api";
import { CROP_LABEL } from "@/lib/constants";
import { fmtDate, fmtKg, fmtPrice } from "@/lib/format";
import type { AdListItem, Page } from "@/lib/types";
import { useDebounced } from "@/hooks/useDebounced";
import { useFetch } from "@/hooks/useFetch";
import { useExporter } from "@/components/shell/ExporterContext";
import {
  Button, EmptyState, ErrorState, Icon, LinkButton, ListSkeleton, PageHeader, Pagination, Segmented, SearchInput, SelectField, StatusBadge, useConfirm, useToast,
} from "@/components/ui";

const PAGE_SIZE = 10;
type StatusFilter = "all" | "live" | "draft" | "expired" | "closed";

export default function AdsPage() {
  const router = useRouter();
  const toast = useToast();
  const { verified } = useExporter();
  const { confirm, dialog } = useConfirm();
  const [crop, setCrop] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [page, setPage] = useState(1);

  const list = useFetch(
    () => api.get<Page<AdListItem>>("/api/exporter/ads", { params: { crop: crop || undefined, status: status === "all" ? undefined : status, search: q || undefined, page, page_size: PAGE_SIZE } }).then((r) => r.data),
    [crop, status, q, page],
  );

  const duplicate = async (id: string) => {
    try { const { data } = await api.post<{ id: string }>(`/api/exporter/ads/${id}/duplicate`); toast.success("Duplicated as a new draft"); router.push(`/exporter/ads/${data.id}`); }
    catch (e) { toast.error(parseError(e).message); }
  };

  const close = (ad: AdListItem) =>
    confirm({
      title: "Close this buy request?",
      body: "Farmers will no longer see it or be able to apply. Existing approvals stay in place.",
      confirmLabel: "Close request", tone: "danger",
      reason: { label: "Reason (shown in your records)", defaultValue: "Sourcing quota fulfilled" },
      onConfirm: async (reason) => {
        try { await api.post(`/api/exporter/ads/${ad.id}/close`, { reason: reason || "Closed by exporter" }); } catch (e) { throw new Error(parseError(e).message); }
        toast.success("Buy request closed"); list.reload();
      },
    });

  const filtered = !!(crop || status !== "all" || q);

  return (
    <>
      <PageHeader
        title="Buy requests"
        subtitle="Advertise the volume and price you’ll pay. Farmers in eligible districts see live requests in the Origo Field app and apply with the quantity they can supply."
        actions={<LinkButton href="/exporter/ads/new" variant="primary"><Icon name="plus" size={16} /> New buy request</LinkButton>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Segmented<StatusFilter> label="Status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ value: "all", label: "All" }, { value: "live", label: "Live" }, { value: "draft", label: "Drafts" }, { value: "expired", label: "Expired" }, { value: "closed", label: "Closed" }]} />
        <div className="w-36"><SelectField aria-label="Crop" value={crop} onChange={(e) => { setCrop(e.target.value); setPage(1); }}><option value="">All crops</option><option value="tea">Tea</option><option value="cinnamon">Cinnamon</option></SelectField></div>
        <div className="min-w-56 flex-1 sm:max-w-xs"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search title, location, crop" /></div>
      </div>

      {list.loading && !list.data ? <ListSkeleton /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.data && list.data.items.length === 0 ? (
        <EmptyState icon="list" title={filtered ? "No buy requests match" : "No buy requests yet"} body={filtered ? "Try clearing a filter or searching for something else." : "Post what you want to buy and farmers will come to you. You’ll need a published quality standard first."}
          action={!filtered && <LinkButton href="/exporter/ads/new" variant="primary"><Icon name="plus" size={16} /> Create your first request</LinkButton>} />
      ) : (
        <ul className="space-y-3">
          {list.data?.items.map((ad) => {
            const title = ad.latest_title?.en || ad.title?.en || "Untitled";
            const price = fmtPrice({ price_type: ad.latest_price_type ?? ad.price_type, price_fixed: ad.latest_price_fixed ?? ad.price_fixed, price_min: ad.latest_price_min ?? ad.price_min, price_max: ad.latest_price_max ?? ad.price_max });
            return (
              <li key={ad.id} className="rounded-xl border border-line bg-surface p-4 shadow-card">
                <div className="flex flex-wrap items-start gap-4">
                  <Link href={`/exporter/ads/${ad.id}`} className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-base font-semibold hover:text-leaf-700">{title}</span>
                      <StatusBadge status={ad.computed_status} />
                    </span>
                    <span className="mt-1 block text-sm text-ink-soft">
                      {CROP_LABEL[ad.crop] ?? ad.crop}{ad.grade_tier ? ` · ${ad.grade_tier}` : ""} · {fmtKg(ad.latest_quantity_kg ?? ad.quantity_kg)} · {price}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-mute">
                      Collect {fmtDate(ad.latest_collection_start ?? ad.collection_window_start)} – {fmtDate(ad.latest_collection_end ?? ad.collection_window_end)} · expires {fmtDate(ad.latest_expires_at ?? ad.expires_at)}
                      {ad.latest_standard_name ? ` · ${ad.latest_standard_name}` : ""} · v{ad.latest_version_number}
                    </span>
                    {ad.computed_status === "closed" && ad.closed_reason && <span className="mt-1 block text-xs text-ink-mute">Closed: {ad.closed_reason.replace(/^taken_down:\s*/, "Taken down by an administrator — ")}</span>}
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => duplicate(ad.id)}><Icon name="copy" size={15} /> Duplicate</Button>
                    {ad.computed_status !== "closed" && ad.computed_status !== "draft" && (
                      <Button variant="ghost" size="sm" disabled={!verified} title={verified ? undefined : "Available once your account is verified"} onClick={() => close(ad)}>Close</Button>
                    )}
                    <LinkButton href={`/exporter/ads/${ad.id}`} variant="soft" size="sm">Open</LinkButton>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {list.data && <Pagination page={list.data.page} totalPages={list.data.total_pages} total={list.data.total} pageSize={PAGE_SIZE} onPage={setPage} />}
      {dialog}
    </>
  );
}
