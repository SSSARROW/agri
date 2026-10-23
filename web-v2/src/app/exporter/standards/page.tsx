"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, parseError } from "@/lib/api";
import { CROPS, CROP_LABEL } from "@/lib/constants";
import { fmtDate } from "@/lib/format";
import { standardTitle } from "@/lib/standards";
import type { Page, Standard } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import {
  Badge, Button, Checkbox, EmptyState, ErrorState, Icon, ListSkeleton, Modal, PageHeader, Pagination, Segmented, SelectField, StatusBadge, TextField, useToast,
} from "@/components/ui";

const PAGE_SIZE = 10;


export default function StandardsPage() {
  const router = useRouter();
  const toast = useToast();
  const [crop, setCrop] = useState<"all" | "tea" | "cinnamon">("all");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [newCrop, setNewCrop] = useState<"tea" | "cinnamon">("tea");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const list = useFetch(
    () =>
      api
        .get<Page<Standard>>("/api/exporter/standards", { params: { crop: crop === "all" ? undefined : crop, is_archived: archived, page, page_size: PAGE_SIZE } })
        .then((r) => r.data),
    [crop, archived, page],
  );

  const create = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post<Standard>("/api/exporter/standards", { crop: newCrop, name: newName.trim(), grade_spec: {}, stages: [] });
      toast.success("Standard created. Add its stages next.");
      router.push(`/exporter/standards/${data.id}/versions/${data.versions[0]?.version_number ?? 1}`);
    } catch (e) {
      toast.error(parseError(e, "Couldn’t create the standard.").message);
      setBusy(false);
    }
  };

  const filtered = crop !== "all" || archived;

  return (
    <>
      <PageHeader
        title="Quality standards"
        subtitle="A standard is the recipe farmers follow: the stages, timings, allowed inputs and the proof you need. Publish one, then attach it to ads and planting notices."
        actions={<Button onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New standard</Button>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <Segmented
          label="Crop" value={crop} onChange={(v) => { setCrop(v); setPage(1); }}
          options={[{ value: "all", label: "All crops" }, { value: "tea", label: "Tea" }, { value: "cinnamon", label: "Cinnamon" }]}
        />
        <Checkbox checked={archived} onChange={(v) => { setArchived(v); setPage(1); }}>Show archived</Checkbox>
      </div>

      {list.loading && !list.data ? <ListSkeleton /> : list.error ? <ErrorState message={list.error} onRetry={list.reload} /> : list.data && list.data.items.length === 0 ? (
        <EmptyState
          icon="list"
          title={filtered ? "No standards match these filters" : "No quality standards yet"}
          body={filtered ? "Try another crop or turn off “Show archived”." : "Create your first standard. You can start from a sample template, then publish it once your account is verified."}
          action={!filtered && <Button onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Create a standard</Button>}
        />
      ) : (
        <ul className="space-y-3">
          {list.data?.items.map((s) => {
            const draft = s.versions.find((v) => v.status === "draft");
            const pubs = s.versions.filter((v) => v.status === "published");
            const latestPub = pubs.sort((a, b) => b.version_number - a.version_number)[0];
            return (
              <li key={s.id}>
                <Link href={`/exporter/standards/${s.id}`} className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-leaf-500/60">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${s.crop === "tea" ? "bg-leaf-50 text-leaf-600" : "bg-bark-50 text-bark-600"}`}><Icon name="leaf" size={20} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{standardTitle(s)}</span>
                      {s.is_archived && <Badge>Archived</Badge>}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-mute">{CROP_LABEL[s.crop] ?? s.crop} · updated {fmtDate(s.updated_at)}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {latestPub && <StatusBadge status="published" label={`v${latestPub.version_number} published`} />}
                    {draft && <StatusBadge status="draft" label={`Draft v${draft.version_number}`} />}
                  </span>
                  <Icon name="chevronRight" className="text-ink-mute" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {list.data && <Pagination page={list.data.page} totalPages={list.data.total_pages} total={list.data.total} pageSize={PAGE_SIZE} onPage={setPage} />}

      <Modal
        open={creating} onClose={() => !busy && setCreating(false)} title="New quality standard"
        footer={<><Button variant="secondary" onClick={() => setCreating(false)} disabled={busy}>Cancel</Button><Button onClick={create} loading={busy} disabled={!newName.trim()}>Create &amp; edit</Button></>}
      >
        <div className="space-y-4">
          <SelectField label="Crop" value={newCrop} onChange={(e) => setNewCrop(e.target.value as "tea" | "cinnamon")}>
            {CROPS.map((c) => <option key={c} value={c}>{CROP_LABEL[c]}</option>)}
          </SelectField>
          <TextField label="Name" required value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Organic BOPF 2026" hint="Farmers see this name. You can rename it in each version." onKeyDown={(e) => e.key === "Enter" && create()} />
        </div>
      </Modal>
    </>
  );
}
