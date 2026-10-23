"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { api, parseError } from "@/lib/api";
import { fmtDateTime, fmtHa, titleCase } from "@/lib/format";
import type { FarmerLinkDetail } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { FarmerProgressPanel } from "@/components/exporter/FarmerProgressPanel";
import { useExporter, VerificationNote } from "@/components/shell/ExporterContext";
import { Alert, Button, Card, Chips, DefList, ErrorState, Icon, PageHeader, Spinner, StatusBadge, Tabs, useConfirm, useToast } from "@/components/ui";

export default function FarmerDetail() {
  const { linkId } = useParams<{ linkId: string }>();
  const { verified, reloadCounts } = useExporter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [tab, setTab] = useState<"progress" | "profile">("progress");
  const d = useFetch(() => api.get<FarmerLinkDetail>(`/api/exporter/farmers/${linkId}`).then((r) => r.data), [linkId]);

  if (d.loading && !d.data) return <Spinner />;
  if (d.error) return <ErrorState message={d.status === 404 ? "This farmer link wasn’t found." : d.error} onRetry={d.reload} />;
  const l = d.data!;
  const f = l.farmer;

  const act = (kind: "approve" | "decline" | "remove") =>
    confirm({
      title: { approve: `Approve ${f.name}?`, decline: `Decline ${f.name}?`, remove: `Remove ${f.name} from your network?` }[kind],
      tone: kind === "approve" ? "primary" : "danger",
      confirmLabel: { approve: "Approve farmer", decline: "Decline", remove: "Remove farmer" }[kind],
      body: kind === "approve" ? "Approving unlocks their phone number and lets them submit stage proof against your standards."
        : kind === "remove" ? "They’ll stop following your standard and won’t be able to submit further proof. The app doesn’t notify them of the reason, so consider calling them."
        : "They can then request another exporter.",
      reason: kind !== "approve" ? { label: "Reason (optional)", placeholder: "Recorded for your reference" } : undefined,
      onConfirm: async (reason) => {
        try { await api.post(`/api/exporter/farmers/${linkId}/${kind}`, kind === "approve" ? undefined : { reason: reason || undefined }); } catch (e) { throw new Error(parseError(e).message); }
        toast.success({ approve: "Farmer approved", decline: "Request declined", remove: "Farmer removed" }[kind]); d.reload(); reloadCounts();
      },
    });

  return (
    <>
      <PageHeader
        back={{ href: "/exporter/farmers", label: "Farmer network" }}
        title={<span className="flex flex-wrap items-center gap-3">{f.name}<StatusBadge status={l.status} /></span>}
        subtitle={[f.dsd, f.district].filter(Boolean).join(", ")}
        actions={
          l.status === "requested" ? (<><Button variant="secondary" disabled={!verified} onClick={() => act("decline")}>Decline</Button><Button disabled={!verified} onClick={() => act("approve")}><Icon name="check" size={16} /> Approve</Button></>)
          : l.status === "approved" ? (<Button variant="secondary" disabled={!verified} onClick={() => act("remove")}>Remove from network</Button>) : undefined
        }
      />
      {!verified && l.status !== "declined" && <div className="-mt-3 mb-4"><VerificationNote action="decide on farmers" /></div>}
      {!["requested", "approved"].includes(l.status) && <div className="mb-5"><Alert tone="info" title={`This link is archived (${l.status})`}>{l.decision_reason ? `Reason recorded: ${l.decision_reason}` : "No reason was recorded."}</Alert></div>}

      {l.status === "approved" && <Tabs value={tab} onChange={setTab} tabs={[{ value: "progress", label: "Progress" }, { value: "profile", label: "Farm and plots" }]} />}
      {l.status === "approved" && tab === "progress" ? <FarmerProgressPanel linkId={linkId} /> : (<>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Farm</h2>
          <DefList items={[
            { label: "Farm address", value: f.farm_address },
            { label: "Location", value: [f.gn_division, f.dsd, f.district].filter(Boolean).join(", ") },
            { label: "Declared farm size", value: fmtHa(f.farm_size_ha) },
            { label: "Mapped plots", value: `${f.total_plots} · ${fmtHa(f.total_plot_area_ha)}` },
            { label: "Crops", value: <Chips items={f.crops} empty="None recorded" /> },
            { label: "Phone", value: f.phone ? <a className="font-medium text-leaf-700 hover:underline" href={`tel:${f.phone}`}>{f.phone}</a> : <span className="text-ink-mute">Shown once approved</span> },
          ]} />
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Relationship</h2>
          <DefList items={[
            { label: "Requested", value: fmtDateTime(l.requested_at) },
            { label: "Decided", value: l.decided_at ? fmtDateTime(l.decided_at) : "—" },
            { label: "Reason", value: l.decision_reason },
          ]} />
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Plots</h2>
        {l.plots.length === 0 ? <p className="text-sm text-ink-soft">This farmer hasn’t mapped any plots yet.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {l.plots.map((p) => (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{p.name || "Unnamed plot"}</p>
                    <p className="text-sm text-ink-soft">{[p.gn_division, p.dsd, p.district].filter(Boolean).join(", ")}</p>
                  </div>
                  <span className="font-display text-lg font-semibold">{fmtHa(p.area_ha)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {p.plot_type && <span className="rounded-md bg-sunken px-2 py-0.5 text-ink-soft">{titleCase(p.plot_type)}</span>}
                  {p.boundary_source && (
                    <span className={`rounded-md px-2 py-0.5 ${p.boundary_source === "estimated_square" ? "bg-warn-50 text-warn-600" : "bg-leaf-50 text-leaf-800"}`}>
                      {p.boundary_source === "estimated_square" ? "Estimated boundary" : `Boundary ${p.boundary_source}`}
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
      </>)}
      {dialog}
    </>
  );
}
