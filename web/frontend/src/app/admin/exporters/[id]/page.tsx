"use client";

import { useParams } from "next/navigation";
import { api, parseError } from "@/lib/api";
import { fmtDateTime, titleCase } from "@/lib/format";
import type { AdminExporterDetail } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { Alert, Button, Card, Chips, DefList, ErrorState, Icon, PageHeader, Spinner, StatusBadge, useConfirm, useToast } from "@/components/ui";

export default function ExporterReview() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const d = useFetch(() => api.get<AdminExporterDetail>(`/api/admin/exporters/${id}`).then((r) => r.data), [id]);

  if (d.loading && !d.data) return <Spinner />;
  if (d.error) return <ErrorState message={d.error} onRetry={d.reload} />;
  const e = d.data!;

  const run = async (kind: "approve" | "reject" | "reopen", reason?: string) => {
    try { await api.post(`/api/admin/exporters/${id}/${kind}`, kind === "reject" ? { reason } : undefined); } catch (err) { throw new Error(parseError(err).message); }
    toast.success({ approve: "Exporter verified", reject: "Exporter rejected", reopen: "Application reopened" }[kind]); d.reload();
  };

  const approve = () => confirm({ title: `Verify ${e.company_name}?`, confirmLabel: "Verify exporter", body: "They’ll immediately be able to publish standards, ads and notices and to decide on farmers.", onConfirm: () => run("approve") });
  const reject = () => confirm({ title: `Reject ${e.company_name}?`, tone: "danger", confirmLabel: "Reject", body: "The exporter will see your reason in their workspace.", reason: { label: "Reason", required: true, placeholder: "What should they fix or provide?" }, onConfirm: (r) => run("reject", r) });
  const reopen = () => confirm({ title: "Reopen this application?", confirmLabel: "Move back to pending", body: "Their publishing abilities are removed until you verify them again.", onConfirm: () => run("reopen") });

  return (
    <>
      <PageHeader
        back={{ href: "/admin/exporters", label: "All exporters" }}
        title={<span className="flex flex-wrap items-center gap-3">{e.company_name}<StatusBadge status={e.status} /></span>}
        subtitle={`Registration ${e.business_reg_no}`}
        actions={
          <>
            {e.status !== "rejected" && <Button variant="danger" onClick={reject}>{e.status === "verified" ? "Revoke" : "Reject"}</Button>}
            {e.status !== "verified" && <Button onClick={approve}><Icon name="check" size={16} /> {e.status === "rejected" ? "Re-approve" : "Verify"}</Button>}
            {e.status !== "pending" && <Button variant="secondary" onClick={reopen}>Reopen as pending</Button>}
          </>
        }
      />
      {e.status === "rejected" && <div className="mb-5"><Alert tone="bad" title="Rejected">{e.rejection_reason || "No reason recorded."}</Alert></div>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Company</h2>
          <DefList items={[
            { label: "Export licence", value: e.export_licence_no }, { label: "Contact person", value: e.contact_person }, { label: "Phone", value: e.phone }, { label: "Business email", value: e.email },
            { label: "Description", value: e.description }, { label: "Crops bought", value: <Chips items={e.crops_bought} /> },
            { label: "Certifications", value: <Chips items={e.certifications} empty="None declared" /> }, { label: "Districts served", value: <Chips items={e.districts_served} empty="Not specified" /> },
          ]} />
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Applicant account</h2>
          <DefList items={[{ label: "Name", value: e.users?.name }, { label: "Sign-in email", value: e.users?.email }, { label: "Phone", value: e.users?.phone }, { label: "Registered", value: fmtDateTime(e.users?.created_at) }]} />
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">History</h2>
        {e.history.length === 0 ? <p className="text-sm text-ink-soft">No decisions logged yet.</p> : (
          <ol className="relative space-y-4 border-l-2 border-line pl-6">
            {e.history.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute top-1.5 -left-[31px] h-3 w-3 rounded-full border-2 border-paper bg-leaf-500" />
                <p className="text-sm font-medium">{titleCase(h.action)}{h.previous_status && h.new_status ? <span className="font-normal text-ink-mute"> · {h.previous_status} → {h.new_status}</span> : null}</p>
                {h.reason && <p className="text-sm text-ink-soft">“{h.reason}”</p>}
                <p className="text-xs text-ink-mute">{fmtDateTime(h.created_at)} · {h.admin_user?.email || "System / CLI"}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
      {dialog}
    </>
  );
}
