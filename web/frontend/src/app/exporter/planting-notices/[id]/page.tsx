"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, parseError } from "@/lib/api";
import { CROP_LABEL } from "@/lib/constants";
import { fmtMonth } from "@/lib/format";
import type { NoticeDetail } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { blankNotice, NoticeForm, noticeFromDetail, noticePayload, validateNotice } from "@/components/exporter/NoticeForm";
import { NoticeRemindersPanel } from "@/components/exporter/NoticeReminders";
import { NoticeResponsesPanel } from "@/components/exporter/NoticeResponses";
import { useExporter, VerificationNote } from "@/components/shell/ExporterContext";
import { Alert, Badge, Button, DefList, Card, ErrorState, Icon, PageHeader, Spinner, StatusBadge, Tabs, useConfirm, useToast, Chips } from "@/components/ui";

type Tab = "overview" | "responses" | "reminders";

export default function NoticeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { verified } = useExporter();
  const { confirm, dialog } = useConfirm();
  const n = useFetch(() => api.get<NoticeDetail>(`/api/exporter/planting-notices/${id}`).then((r) => r.data), [id]);
  const [tab, setTab] = useState<Tab>("overview");
  const [form, setForm] = useState(blankNotice);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const loaded = useRef("");

  useEffect(() => {
    if (!n.data) return;
    const key = `${n.data.id}:${n.data.updated_at}`;
    if (loaded.current === key) return;
    loaded.current = key;
    setForm(noticeFromDetail(n.data));
    setDirty(false);
  }, [n.data]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  if (n.loading && !n.data) return <Spinner />;
  if (n.error) return <ErrorState message={n.status === 404 ? "This notice wasn’t found." : n.error} onRetry={n.reload} />;
  const d = n.data!;
  const isDraft = d.status === "draft";

  const save = async (silent = false): Promise<boolean> => {
    const e = validateNotice(form);
    setErrors(e);
    if (Object.keys(e).length) { if (!silent) toast.error(Object.values(e)[0]); return false; }
    setSaving(true);
    try {
      const { data } = await api.put<NoticeDetail>(`/api/exporter/planting-notices/${id}`, noticePayload(form));
      n.setData(data); loaded.current = `${data.id}:${data.updated_at}`; setDirty(false);
      if (!silent) toast.success("Draft saved");
      return true;
    } catch (err) { toast.error(parseError(err, "Couldn’t save the draft.").message); return false; }
    finally { setSaving(false); }
  };

  const publish = () => {
    const e = validateNotice(form);
    setErrors(e);
    if (Object.keys(e).length) { toast.error(Object.values(e)[0]); return; }
    confirm({
      title: "Publish this notice?",
      body: <>Eligible approved farmers will see it immediately and be reminded 30, 14 and 7 days before {fmtMonth(form.target_month)}. <strong>A published notice can’t be edited</strong>; you can only cancel it.</>,
      confirmLabel: "Publish notice",
      onConfirm: async () => {
        if (dirty && !(await save(true))) throw new Error("Couldn’t save your latest changes first.");
        try { await api.post(`/api/exporter/planting-notices/${id}/publish`); } catch (err) { throw new Error(parseError(err).message); }
        toast.success("Notice published"); loaded.current = ""; n.reload();
      },
    });
  };

  const cancel = () =>
    confirm({
      title: "Cancel this notice?", tone: "danger", confirmLabel: "Cancel notice",
      body: "Farmers’ plot commitments for this notice are released. This can’t be undone.",
      reason: { label: "Reason (optional)" },
      onConfirm: async (reason) => {
        try { await api.post(`/api/exporter/planting-notices/${id}/cancel`, { reason: reason || undefined }); } catch (e) { throw new Error(parseError(e).message); }
        toast.success("Notice cancelled"); loaded.current = ""; n.reload();
      },
    });

  const duplicate = async () => {
    try { const { data } = await api.post<{ id: string }>(`/api/exporter/planting-notices/${id}/duplicate`); toast.success("Duplicated as a new draft"); router.push(`/exporter/planting-notices/${data.id}`); }
    catch (e) { toast.error(parseError(e).message); }
  };

  return (
    <>
      <PageHeader
        back={{ href: "/exporter/planting-notices", label: "All notices" }}
        title={<span className="flex flex-wrap items-center gap-3">{d.title?.en || "Untitled notice"}<StatusBadge status={d.computed_state} /></span>}
        subtitle={`${CROP_LABEL[d.crop] ?? d.crop} · target ${fmtMonth(d.target_month)}`}
        actions={
          <>
            {dirty && <Badge tone="warn" dot>Unsaved changes</Badge>}
            <Button variant="secondary" onClick={duplicate}><Icon name="copy" size={16} /> Duplicate</Button>
            {d.status === "published" && <Button variant="secondary" disabled={!verified} onClick={cancel}>Cancel notice</Button>}
            {isDraft && <><Button variant="secondary" onClick={() => save()} loading={saving} disabled={!dirty}>Save draft</Button><Button onClick={publish} disabled={!verified}>Publish</Button></>}
          </>
        }
      />
      {(isDraft || d.status === "published") && !verified && <div className="-mt-3 mb-4 text-right"><VerificationNote action={isDraft ? "publish notices" : "cancel notices"} /></div>}
      {d.status === "cancelled" && <div className="mb-5"><Alert tone="info" title="This notice was cancelled">{d.cancelled_reason || "No reason was given."} Farmers’ plot commitments were released.</Alert></div>}

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ value: "overview", label: isDraft ? "Edit" : "Overview" }, { value: "responses", label: "Responses", badge: d.counts.no_reply && d.status === "published" ? undefined : undefined }, { value: "reminders", label: "Reminders" }]} />

      {tab === "overview" && (isDraft ? (
        <NoticeForm value={form} onChange={(f) => { setForm(f); setDirty(true); }} errors={errors} />
      ) : (
        <div className="space-y-5">
          <Alert tone="info" title="Published notices are read-only">Duplicate it to send a revised version.</Alert>
          <Card className="space-y-6">
            <DefList items={[
              { label: "Crop", value: CROP_LABEL[d.crop] ?? d.crop },
              { label: "Target month", value: fmtMonth(d.target_month) },
              { label: "Volume needed", value: `${d.volume_needed_kg.toLocaleString()} kg` },
              { label: "Standard", value: `${d.standard_name ?? "—"} v${d.standard_version_number ?? ""}` },
              { label: "Districts", value: <Chips items={d.eligible_districts} empty="All districts" /> },
            ]} />
            <div>
              <h3 className="text-xs font-medium tracking-wide text-ink-mute uppercase">Message to farmers</h3>
              <p className="mt-1 font-semibold">{d.title.en}</p>
              <p className="mt-1 text-sm whitespace-pre-wrap text-ink-soft">{d.message.en}</p>
              {(d.title.si || d.title.ta) && <p className="mt-2 text-xs text-ink-mute">Also provided in {[d.title.si && "Sinhala", d.title.ta && "Tamil"].filter(Boolean).join(" and ")}.</p>}
            </div>
          </Card>
        </div>
      ))}
      {tab === "responses" && <NoticeResponsesPanel noticeId={id} />}
      {tab === "reminders" && <NoticeRemindersPanel noticeId={id} published={d.status !== "draft"} />}
      {dialog}
    </>
  );
}
