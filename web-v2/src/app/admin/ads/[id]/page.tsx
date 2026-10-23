"use client";

import { useParams } from "next/navigation";
import { api, parseError } from "@/lib/api";
import { CROP_LABEL } from "@/lib/constants";
import { fmtDate, fmtDateTime, fmtKg, fmtPrice, titleCase } from "@/lib/format";
import type { AdminAdDetail } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { Alert, Button, Card, Chips, DefList, ErrorState, PageHeader, Spinner, Stat, StatusBadge, useConfirm, useToast } from "@/components/ui";

export default function AdminAdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const d = useFetch(() => api.get<AdminAdDetail>(`/api/admin/ads/${id}`).then((r) => r.data), [id]);

  if (d.loading && !d.data) return <Spinner />;
  if (d.error) return <ErrorState message={d.status === 404 ? "Advertisement not found." : d.error} onRetry={d.reload} />;
  const a = d.data!;
  const v = a.live_version;
  const openReports = a.reports.filter((r) => r.status === "open").length;
  const takenDown = a.admin_state === "taken_down";
  const canTakeDown = a.status === "published" && !["closed", "taken_down", "filled", "expired"].includes(a.admin_state);

  const takeDown = () => confirm({
    title: "Take this ad down?", tone: "danger", confirmLabel: "Take down",
    body: <>The ad closes immediately and farmers can no longer see or apply. The exporter can’t reopen it. All {openReports || "open"} report(s) are marked reviewed.</>,
    reason: { label: "Reason (the exporter will see this)", required: true },
    onConfirm: async (reason) => {
      try { await api.post(`/api/admin/ads/${id}/takedown`, { reason }); } catch (e) { throw new Error(parseError(e).message); }
      toast.success("Ad taken down"); d.reload();
    },
  });
  const restore = () => confirm({
    title: "Restore this ad?", confirmLabel: "Restore",
    body: "The ad goes live again if its published version hasn’t expired.",
    onConfirm: async () => {
      try { await api.post(`/api/admin/ads/${id}/restore`); } catch (e) { throw new Error(parseError(e).message); }
      toast.success("Ad restored"); d.reload();
    },
  });
  const report = async (rid: string, kind: "review" | "dismiss") => {
    try { await api.post(`/api/admin/ads/reports/${rid}/${kind}`, kind === "review" ? {} : undefined); toast.success(kind === "review" ? "Marked reviewed" : "Report dismissed"); d.reload(); }
    catch (e) { toast.error(parseError(e).message); }
  };

  return (
    <>
      <PageHeader
        back={{ href: "/admin/ads", label: "All ads" }}
        title={<span className="flex flex-wrap items-center gap-3">{v?.title?.en || "Untitled ad"}<StatusBadge status={a.admin_state} /></span>}
        subtitle={`${a.exporter.company_name} · ${CROP_LABEL[a.crop] ?? a.crop}`}
        actions={takenDown ? <Button onClick={restore}>Restore ad</Button> : canTakeDown ? <Button variant="danger" onClick={takeDown}>Take down</Button> : undefined}
      />
      {a.closed_reason && <div className="mb-5"><Alert tone={takenDown ? "bad" : "info"} title={takenDown ? "Taken down" : "Closed"}>{a.closed_reason.replace(/^taken_down:\s*/, "")}</Alert></div>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Views" value={a.stats.total_views} hint={`${a.stats.unique_viewers} unique`} />
        <Stat label="Applications" value={a.stats.total_accepts} hint={`${a.stats.active_accepts} active`} />
        <Stat label="Open reports" value={openReports} tone={openReports ? "bad" : undefined} />
        <Stat label="Versions" value={a.all_versions.length} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {v && (
          <Card>
            <h2 className="mb-4 text-lg font-semibold">Live version (v{v.version_number})</h2>
            <DefList items={[
              { label: "Quantity", value: fmtKg(v.quantity_kg) }, { label: "Price", value: fmtPrice(v) }, { label: "Grade", value: v.grade_tier },
              { label: "Collection", value: `${fmtDate(v.collection_window_start)} – ${fmtDate(v.collection_window_end)}` }, { label: "Expires", value: fmtDate(v.expires_at) }, { label: "Pickup", value: v.pickup_location },
              { label: "Districts", value: <Chips items={v.eligible_districts} empty="All districts" /> },
            ]} />
            {v.description?.en && <p className="mt-4 border-t border-line pt-4 text-sm whitespace-pre-wrap text-ink-soft">{v.description.en}</p>}
          </Card>
        )}
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Exporter</h2>
          <DefList items={[{ label: "Company", value: a.exporter.company_name }, { label: "Status", value: <StatusBadge status={a.exporter.status} /> }, { label: "Contact", value: a.exporter.contact_person }, { label: "Email", value: a.exporter.email }, { label: "Phone", value: a.exporter.phone }]} />
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Farmer reports</h2>
        {a.reports.length === 0 ? <p className="text-sm text-ink-soft">No one has reported this ad.</p> : (
          <ul className="space-y-3">
            {a.reports.map((r) => (
              <li key={r.id} className="rounded-xl border border-line bg-surface p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold">{titleCase(r.reason)}<StatusBadge status={r.status} /></p>
                    {r.details && <p className="mt-1 text-sm text-ink-soft">{r.details}</p>}
                    <p className="mt-1 text-xs text-ink-mute">{r.farmer?.name || "A farmer"}{r.farmer?.district ? ` · ${r.farmer.district}` : ""} · {fmtDateTime(r.created_at)}</p>
                  </div>
                  {r.status === "open" && (
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" onClick={() => report(r.id, "dismiss")}>Dismiss</Button>
                      <Button variant="soft" size="sm" onClick={() => report(r.id, "review")}>Mark reviewed</Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Moderation log</h2>
        {a.moderation_log.length === 0 ? <p className="text-sm text-ink-soft">No moderation actions yet.</p> : (
          <ol className="relative space-y-4 border-l-2 border-line pl-6">
            {a.moderation_log.map((m) => (
              <li key={m.id} className="relative">
                <span className={`absolute top-1.5 -left-[31px] h-3 w-3 rounded-full border-2 border-paper ${m.action === "takedown" ? "bg-danger-600" : "bg-leaf-500"}`} />
                <p className="text-sm font-medium">{titleCase(m.action)}</p>
                {m.reason && <p className="text-sm text-ink-soft">“{m.reason}”</p>}
                <p className="text-xs text-ink-mute">{fmtDateTime(m.created_at)} · {m.admin_user?.email || m.admin_user?.name || "Admin"}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
      {dialog}
    </>
  );
}
