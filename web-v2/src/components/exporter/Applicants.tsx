"use client";

import { useState } from "react";
import { api, parseError } from "@/lib/api";
import { CROP_LABEL } from "@/lib/constants";
import { fmtDate, fmtHa, fmtKg } from "@/lib/format";
import type { Applicant, ApplicantsResponse } from "@/lib/types";
import { useDebounced } from "@/hooks/useDebounced";
import { useFetch } from "@/hooks/useFetch";
import { useExporter, VerificationNote } from "@/components/shell/ExporterContext";
import { Alert, Button, Card, EmptyState, ErrorState, Icon, ListSkeleton, Pagination, ProgressBar, SearchInput, Segmented, StatusBadge, useConfirm, useToast } from "@/components/ui";

const PAGE_SIZE = 10;
type Filter = "all" | "pending" | "approved" | "declined" | "withdrawn";

export function Applicants({ adId, onChanged }: { adId: string; onChanged: () => void }) {
  const { verified, reloadCounts } = useExporter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [status, setStatus] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [page, setPage] = useState(1);

  const data = useFetch(
    () => api.get<ApplicantsResponse>(`/api/exporter/ads/${adId}/applicants`, { params: { status: status === "all" ? undefined : status, search: q || undefined, page, page_size: PAGE_SIZE } }).then((r) => r.data),
    [adId, status, q, page],
  );

  const d = data.data;

  const approve = (a: Applicant) =>
    confirm({
      title: `Approve ${a.farmer_name}?`,
      body: <>You’ll buy up to <strong>{fmtKg(a.supply_quantity_kg)}</strong> from them. Approving also adds them to your farmer network and reveals their phone number.{d && <> Remaining capacity is currently <strong>{fmtKg(d.remaining_quantity_kg)}</strong>.</>}</>,
      confirmLabel: "Approve supply",
      onConfirm: async () => {
        try { await api.post(`/api/exporter/ads/${adId}/applicants/${a.acceptance_id}/approve`); } catch (e) { throw new Error(parseError(e).message); }
        toast.success(`${a.farmer_name} approved`); data.reload(); onChanged(); reloadCounts();
      },
    });

  const decline = (a: Applicant) =>
    confirm({
      title: `Decline ${a.farmer_name}?`, tone: "danger", confirmLabel: "Decline",
      body: "They’ll see their application as declined.",
      reason: { label: "Reason (optional)", placeholder: "e.g. Quantity already covered" },
      onConfirm: async (reason) => {
        try { await api.post(`/api/exporter/ads/${adId}/applicants/${a.acceptance_id}/decline`, { reason: reason || undefined }); } catch (e) { throw new Error(parseError(e).message); }
        toast.success("Applicant declined"); data.reload(); onChanged();
      },
    });

  return (
    <div className="space-y-5">
      {d && (
        <Card>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold">Supply committed</p>
            <p className="text-sm text-ink-soft">
              <strong className="text-leaf-700">{fmtKg(d.approved_quantity_kg)}</strong> approved
              {d.pending_quantity_kg > 0 && <> · <strong className="text-warn-600">{fmtKg(d.pending_quantity_kg)}</strong> pending</>}
              {" "}of {fmtKg(d.target_quantity_kg)}
            </p>
          </div>
          <ProgressBar
            max={d.target_quantity_kg}
            label="Supply committed"
            segments={[
              { value: d.approved_quantity_kg, className: "bg-leaf-500", label: "Approved" },
              { value: d.pending_quantity_kg, className: "bg-warn-600/60", label: "Pending" },
            ]}
          />
          <p className="mt-2 text-xs text-ink-mute">
            {d.is_filled ? "Target reached. This request closed automatically." : `${fmtKg(d.remaining_quantity_kg)} still needed.`}
          </p>
        </Card>
      )}

      {!verified && <Alert tone="warn" title="Read-only until you’re verified"><VerificationNote action="approve or decline applicants" /></Alert>}

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<Filter> label="Applicant status" value={status} onChange={(v) => { setStatus(v); setPage(1); }}
          options={[{ value: "all", label: "All" }, { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "declined", label: "Declined" }, { value: "withdrawn", label: "Withdrawn" }]} />
        <div className="min-w-56 flex-1 sm:max-w-xs"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by farmer name" /></div>
      </div>

      {data.loading && !d ? <ListSkeleton rows={3} /> : data.error ? <ErrorState message={data.error} onRetry={data.reload} /> : d && d.items.length === 0 ? (
        <EmptyState icon="users" title={status === "all" && !q ? "No applicants yet" : "No applicants match"} body={status === "all" && !q ? "Farmers in eligible districts can apply from the Origo Field app while this request is live." : "Try a different status or search."} />
      ) : (
        <ul className="space-y-3">
          {d?.items.map((a) => (
            <li key={a.acceptance_id} className="rounded-xl border border-line bg-surface p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">{a.farmer_name}<StatusBadge status={a.derived_status} /></p>
                  <p className="mt-0.5 text-sm text-ink-soft">
                    {[a.gn_division, a.dsd, a.farmer_district].filter(Boolean).join(", ") || "Location not given"}
                    {a.farm_size_ha != null && <> · {fmtHa(a.farm_size_ha)} farm</>}
                  </p>
                  <p className="mt-1.5 text-sm">
                    Offers <strong>{fmtKg(a.supply_quantity_kg)}</strong>
                    <span className="text-ink-mute"> · applied {fmtDate(a.accepted_at)} to v{a.ad_version_number}</span>
                  </p>
                  {a.plots.length > 0 && (
                    <p className="mt-1 text-xs text-ink-mute">
                      {a.plots.map((p) => `${p.name || "Plot"} (${fmtHa(p.area_ha)}${p.crops.length ? ` · ${p.crops.map((c) => CROP_LABEL[c.toLowerCase()] ?? c).join(", ")}` : ""})`).join("  ·  ")}
                    </p>
                  )}
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm">
                    <Icon name="phone" size={14} className="text-ink-mute" />
                    {a.phone ? <a href={`tel:${a.phone}`} className="font-medium text-leaf-700 hover:underline">{a.phone}</a> : <span className="text-ink-mute">Shown once you approve</span>}
                  </p>
                </div>
                {a.derived_status === "pending" && (
                  <div className="flex shrink-0 gap-2">
                    <Button variant="secondary" size="sm" disabled={!verified} onClick={() => decline(a)}>Decline</Button>
                    <Button size="sm" disabled={!verified} onClick={() => approve(a)}><Icon name="check" size={15} /> Approve</Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {d && <Pagination page={d.page} totalPages={d.total_pages} total={d.total} pageSize={PAGE_SIZE} onPage={setPage} />}
      {dialog}
    </div>
  );
}
