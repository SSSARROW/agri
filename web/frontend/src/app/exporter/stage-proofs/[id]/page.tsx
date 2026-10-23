"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { api, assetUrl, parseError } from "@/lib/api";
import { fmtDateTime, titleCase } from "@/lib/format";
import type { ProofDetail } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { useExporter, VerificationNote } from "@/components/shell/ExporterContext";
import { Alert, Button, Card, ErrorState, Icon, Modal, PageHeader, Spinner, StatusBadge, useConfirm, useToast } from "@/components/ui";

export default function ProofDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { verified, reloadCounts } = useExporter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const d = useFetch(() => api.get<ProofDetail>(`/api/exporter/stage-proofs/${id}`).then((r) => r.data), [id]);
  const [zoom, setZoom] = useState<string | null>(null);

  if (d.loading && !d.data) return <Spinner />;
  if (d.error) return <ErrorState message={d.status === 404 ? "This submission wasn’t found." : d.error} onRetry={d.reload} />;
  const s = d.data!;

  const run = async (kind: "approve" | "reject" | "reopen", notes?: string) => {
    try {
      await api.post(`/api/exporter/stage-proofs/${id}/${kind}`, kind === "reopen" ? undefined : { notes: notes || undefined });
    } catch (e) { throw new Error(parseError(e).message); }
    toast.success({ approve: "Approved", reject: "Sent back to the farmer", reopen: "Reopened for resubmission" }[kind]);
    d.reload(); reloadCounts();
  };

  return (
    <>
      <PageHeader
        back={{ href: "/exporter/stage-proofs", label: "All submissions" }}
        title={<span className="flex flex-wrap items-center gap-3">{s.stage_name}<StatusBadge status={s.status} /></span>}
        subtitle={`${s.farmer_name} · ${s.plot_name || "No plot linked"} · submitted ${fmtDateTime(s.submitted_at)}`}
        actions={
          s.status === "pending" ? (
            <>
              <Button variant="danger" disabled={!verified} onClick={() => confirm({ title: "Send this back?", tone: "danger", confirmLabel: "Reject", body: "The farmer sees your reason. They can’t resubmit until you reopen the stage.", reason: { label: "Reason for the farmer", required: true, placeholder: "e.g. Photo is blurry. Please show the whole row." }, onConfirm: (r) => run("reject", r) })}>Reject</Button>
              <Button disabled={!verified} onClick={() => confirm({ title: "Approve this proof?", confirmLabel: "Approve", body: "Approval is final.", reason: { label: "Note to the farmer (optional)" }, onConfirm: (r) => run("approve", r) })}><Icon name="check" size={16} /> Approve</Button>
            </>
          ) : s.status === "rejected" && !s.reopened_at ? (
            <Button disabled={!verified} onClick={() => confirm({ title: "Reopen for resubmission?", confirmLabel: "Reopen", body: "The farmer will be able to submit new photos for this stage.", onConfirm: () => run("reopen") })}>Reopen for resubmission</Button>
          ) : undefined
        }
      />
      {s.status === "pending" && !verified && <div className="-mt-3 mb-4 text-right"><VerificationNote action="review proof" /></div>}
      {s.status === "rejected" && (
        <div className="mb-5">
          <Alert tone={s.reopened_at ? "info" : "bad"} title={s.reopened_at ? "Reopened. Waiting for the farmer to resubmit" : "Rejected"}>
            {s.review_notes ? <>Reason given: “{s.review_notes.replace(/[.\s]+$/, "")}.” </> : null}
            {!s.reopened_at && "The farmer is blocked from resubmitting until you reopen this stage."}
          </Alert>
        </div>
      )}
      {s.status === "approved" && <div className="mb-5"><Alert tone="good" title="Approved">{s.review_notes ? `Note: “${s.review_notes}”. ` : ""}Reviewed {fmtDateTime(s.reviewed_at)}. This decision is final.</Alert></div>}

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Photo evidence <span className="text-sm font-normal text-ink-mute">({s.photo_urls.length})</span></h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {s.photo_urls.map((u, i) => (
              <button key={u + i} onClick={() => setZoom(assetUrl(u))} className="group relative aspect-square overflow-hidden rounded-lg bg-sunken" aria-label={`Open photo ${i + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetUrl(u)} alt={`Evidence photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              </button>
            ))}
          </div>
        </Card>
        <div className="space-y-5">
          {Object.keys(s.quick_field_answers ?? {}).length > 0 && (
            <Card>
              <h2 className="mb-3 text-lg font-semibold">Farmer’s answers</h2>
              <dl className="space-y-2.5 text-sm">
                {Object.entries(s.quick_field_answers).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-line pb-2 last:border-0"><dt className="text-ink-mute">{titleCase(k)}</dt><dd className="text-right font-medium">{String(v)}</dd></div>
                ))}
              </dl>
            </Card>
          )}
          {s.note && <Card><h2 className="mb-2 text-lg font-semibold">Note</h2><p className="text-sm whitespace-pre-wrap text-ink-soft">{s.note}</p></Card>}
          <Card>
            <h2 className="mb-2 text-lg font-semibold">What this stage asks for</h2>
            <p className="text-sm whitespace-pre-wrap text-ink-soft">{s.stage_instructions?.en || "No instructions."}</p>
          </Card>
        </div>
      </div>

      <Modal open={!!zoom} onClose={() => setZoom(null)} title="Photo" wide>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {zoom && <img src={zoom} alt="Full-size evidence" className="max-h-[70dvh] w-full rounded-lg object-contain" />}
      </Modal>
      {dialog}
    </>
  );
}
