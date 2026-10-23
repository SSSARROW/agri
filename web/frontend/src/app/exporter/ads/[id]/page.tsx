"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, parseError } from "@/lib/api";
import { CROP_LABEL } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import type { AdDetail, AdVersionDetail } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { AdForm, adFromVersion, adPayload, blankAd, validateAd, type AdFormState } from "@/components/exporter/AdForm";
import { Applicants } from "@/components/exporter/Applicants";
import { AdStatsPanel } from "@/components/exporter/AdStats";
import { useExporter, VerificationNote } from "@/components/shell/ExporterContext";
import { Alert, Badge, Button, ErrorState, Icon, PageHeader, SelectField, Spinner, StatusBadge, Tabs, useConfirm, useToast } from "@/components/ui";

type Tab = "details" | "applicants" | "performance";

export default function AdDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { verified } = useExporter();
  const { confirm, dialog } = useConfirm();

  const ad = useFetch(() => api.get<AdDetail>(`/api/exporter/ads/${id}`).then((r) => r.data), [id]);
  const [tab, setTab] = useState<Tab>("details");
  const [vn, setVn] = useState<number | null>(null);

  useEffect(() => {
    if (!ad.data || vn !== null) return;
    const vs = ad.data.versions;
    const draft = vs.find((v) => v.status === "draft");
    setVn(draft?.version_number ?? Math.max(...vs.map((v) => v.version_number)));
  }, [ad.data, vn]);

  const ver = useFetch(() => (vn ? api.get<AdVersionDetail>(`/api/exporter/ads/${id}/versions/${vn}`).then((r) => r.data) : Promise.resolve(null)), [id, vn]);

  const [form, setForm] = useState<AdFormState>(blankAd);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "publish" | null>(null);
  const loaded = useRef("");

  useEffect(() => {
    if (!ver.data || !ad.data) return;
    const key = `${ver.data.id}:${ver.data.status}:${ver.data.published_at}`;
    if (loaded.current === key) return;
    loaded.current = key;
    setForm(adFromVersion(ad.data.crop, ver.data));
    setErrors({});
    setDirty(false);
  }, [ver.data, ad.data]);

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  if ((ad.loading && !ad.data) || (vn && ver.loading && !ver.data)) return <Spinner />;
  if (ad.error) return <ErrorState message={ad.status === 404 ? "This buy request wasn’t found, or it belongs to another exporter." : ad.error} onRetry={ad.reload} />;
  if (ver.error) return <ErrorState message={ver.error} onRetry={ver.reload} />;

  const a = ad.data!;
  const v = ver.data;
  const takenDown = a.closed_reason?.startsWith("taken_down:");
  const closed = a.computed_status === "closed";
  const isDraft = v?.status === "draft";
  const editable = isDraft && !closed;
  const hasDraft = a.versions.some((x) => x.status === "draft");
  const hasPublished = a.versions.some((x) => x.status === "published");
  const title = form.title.en || "Untitled buy request";

  const save = async (silent = false): Promise<boolean> => {
    const e = validateAd(form, false);
    setErrors(e);
    if (Object.keys(e).length) { if (!silent) toast.error("Please fix the highlighted fields."); return false; }
    setBusy("save");
    try {
      const { data } = await api.put<AdVersionDetail>(`/api/exporter/ads/${id}/versions/${vn}`, adPayload(form));
      ver.setData(data);
      loaded.current = `${data.id}:${data.status}:${data.published_at}`;
      setDirty(false);
      if (!silent) toast.success("Draft saved");
      return true;
    } catch (err) {
      const p = parseError(err, "Couldn’t save the draft.");
      toast.error(p.message);
      return false;
    } finally { setBusy(null); }
  };

  const publish = () => {
    const e = validateAd(form, true);
    setErrors(e);
    if (Object.keys(e).length) { toast.error("Please fix the highlighted fields before publishing."); return; }
    confirm({
      title: `Publish version ${vn}?`,
      body: <>Farmers in {form.eligible_districts.length ? `${form.eligible_districts.length} district(s)` : "every district"} will see this at once. A published version is <strong>immutable</strong>, so farmers who apply are protected by the exact terms they saw. To change anything later you’ll publish a new version.</>,
      confirmLabel: "Publish",
      onConfirm: async () => {
        if (dirty && !(await save(true))) throw new Error("Couldn’t save your latest changes first.");
        try { await api.post(`/api/exporter/ads/${id}/versions/${vn}/publish`); } catch (err) { throw new Error(parseError(err).message); }
        toast.success("Buy request is live");
        loaded.current = ""; ver.reload(); ad.reload();
      },
    });
  };

  const newVersion = async () => {
    try {
      const { data } = await api.post<AdVersionDetail>(`/api/exporter/ads/${id}/versions`);
      await ad.reload(); loaded.current = ""; setVn(data.version_number); setTab("details");
      toast.success(`Draft v${data.version_number} created from your latest published version`);
    } catch (e) { toast.error(parseError(e).message); }
  };

  const duplicate = async () => {
    try { const { data } = await api.post<{ id: string }>(`/api/exporter/ads/${id}/duplicate`); toast.success("Duplicated as a new draft"); router.push(`/exporter/ads/${data.id}`); }
    catch (e) { toast.error(parseError(e).message); }
  };

  const close = () =>
    confirm({
      title: "Close this buy request?", tone: "danger", confirmLabel: "Close request",
      body: "Farmers will no longer see it or apply. Existing approvals stay in place.",
      reason: { label: "Reason", defaultValue: "Sourcing quota fulfilled" },
      onConfirm: async (reason) => {
        try { await api.post(`/api/exporter/ads/${id}/close`, { reason: reason || "Closed by exporter" }); } catch (e) { throw new Error(parseError(e).message); }
        toast.success("Buy request closed"); ad.reload();
      },
    });

  return (
    <>
      <PageHeader
        back={{ href: "/exporter/ads", label: "All buy requests" }}
        title={<span className="flex flex-wrap items-center gap-3">{title}<StatusBadge status={a.computed_status} /></span>}
        subtitle={`${CROP_LABEL[a.crop] ?? a.crop} · created ${fmtDateTime(a.created_at)}`}
        actions={
          <>
            <Button variant="secondary" onClick={duplicate}><Icon name="copy" size={16} /> Duplicate</Button>
            {!closed && hasPublished && <Button variant="secondary" disabled={!verified} onClick={close}>Close request</Button>}
          </>
        }
      />

      {takenDown && (
        <div className="mb-5"><Alert tone="bad" title="Taken down by an administrator">{a.closed_reason?.replace(/^taken_down:\s*/, "")} This request can’t be reopened, republished or versioned. Contact support if you think this is a mistake.</Alert></div>
      )}
      {closed && !takenDown && <div className="mb-5"><Alert tone="info" title="This request is closed">{a.closed_reason || "Closed by exporter"}. It is now read-only.</Alert></div>}

      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { value: "details", label: "Details" },
        { value: "applicants", label: "Applicants" },
        ...(hasPublished ? [{ value: "performance" as Tab, label: "Performance" }] : []),
      ]} />

      {tab === "details" && v && (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="w-56">
              <SelectField aria-label="Version" value={vn ?? ""} onChange={(e) => { if (dirty && !window.confirm("Discard your unsaved changes?")) return; loaded.current = ""; setVn(Number(e.target.value)); }}>
                {[...a.versions].sort((x, y) => y.version_number - x.version_number).map((x) => (
                  <option key={x.id} value={x.version_number}>Version {x.version_number} · {x.status}</option>
                ))}
              </SelectField>
            </div>
            {!closed && !takenDown && (
              <Button variant="secondary" size="sm" onClick={newVersion} disabled={hasDraft || !hasPublished}
                title={hasDraft ? "Only one draft at a time" : !hasPublished ? "Publish first" : undefined}>
                <Icon name="plus" size={14} /> New version
              </Button>
            )}
            {dirty && <Badge tone="warn" dot>Unsaved changes</Badge>}
          </div>

          {!isDraft && !closed && <div className="mb-5"><Alert tone="info" title="Published versions can’t be edited">This protects farmers who applied under these terms. Start a new version to change anything.</Alert></div>}

          <AdForm value={form} crop={a.crop} readOnly={!editable} errors={errors} onChange={(f) => { setForm(f); setDirty(true); }} />

          {editable && (
            <div className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-line bg-surface/95 p-3 shadow-pop backdrop-blur">
              {!verified && <div className="mr-auto pl-2"><VerificationNote action="publish" /></div>}
              <Button variant="secondary" onClick={() => save()} loading={busy === "save"} disabled={!dirty}>Save draft</Button>
              <Button onClick={publish} disabled={!verified}>Publish</Button>
            </div>
          )}
        </>
      )}

      {tab === "applicants" && <Applicants adId={id} onChanged={ad.reload} />}
      {tab === "performance" && <AdStatsPanel adId={id} />}
      {dialog}
    </>
  );
}
