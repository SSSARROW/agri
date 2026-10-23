"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, parseError } from "@/lib/api";
import { CROP_LABEL } from "@/lib/constants";
import { fmtDateTime } from "@/lib/format";
import type { Standard } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { Badge, Button, Card, ErrorState, Icon, PageHeader, Spinner, StatusBadge, useConfirm, useToast } from "@/components/ui";
import { standardTitle } from "@/lib/standards";

export default function StandardDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const std = useFetch(() => api.get<Standard>(`/api/exporter/standards/${id}`).then((r) => r.data), [id]);

  if (std.loading && !std.data) return <Spinner />;
  if (std.error) {
    return <ErrorState message={std.status === 404 ? "This standard wasn’t found, or it belongs to another exporter." : std.error} onRetry={std.reload} />;
  }
  const s = std.data!;
  const versions = [...s.versions].sort((a, b) => b.version_number - a.version_number);
  const hasDraft = versions.some((v) => v.status === "draft");
  const hasPublished = versions.some((v) => v.status === "published");

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); toast.success(ok); std.reload(); } catch (e) { toast.error(parseError(e).message); }
  };

  const newDraft = async () => {
    try {
      const { data } = await api.post<{ version_number: number }>(`/api/exporter/standards/${id}/versions`);
      router.push(`/exporter/standards/${id}/versions/${data.version_number}`);
    } catch (e) { toast.error(parseError(e).message); }
  };

  const duplicate = async () => {
    try {
      const { data } = await api.post<Standard>(`/api/exporter/standards/${id}/duplicate`);
      toast.success("Standard duplicated");
      router.push(`/exporter/standards/${data.id}`);
    } catch (e) { toast.error(parseError(e).message); }
  };

  return (
    <>
      <PageHeader
        back={{ href: "/exporter/standards", label: "All standards" }}
        title={<span className="flex flex-wrap items-center gap-3">{standardTitle(s)}{s.is_archived && <Badge>Archived</Badge>}</span>}
        subtitle={`${CROP_LABEL[s.crop] ?? s.crop} standard · every change is a new version, and published versions never change.`}
        actions={
          <>
            <Button variant="secondary" onClick={duplicate}><Icon name="copy" size={16} /> Duplicate</Button>
            {s.is_archived ? (
              <Button variant="secondary" onClick={() => act(() => api.post(`/api/exporter/standards/${id}/unarchive`), "Standard restored")}>Unarchive</Button>
            ) : (
              <Button
                variant="secondary"
                onClick={() => confirm({ title: "Archive this standard?", body: "Archived standards can’t be used in new ads or notices. Existing ads keep working.", confirmLabel: "Archive", onConfirm: () => api.post(`/api/exporter/standards/${id}/archive`).then(() => { std.reload(); toast.success("Standard archived"); }).catch((e) => { throw new Error(parseError(e).message); }) })}
              >
                <Icon name="archive" size={16} /> Archive
              </Button>
            )}
            <Button onClick={newDraft} disabled={hasDraft || !hasPublished} title={hasDraft ? "Finish the current draft first" : !hasPublished ? "Publish a version first" : undefined}>
              <Icon name="plus" size={16} /> New draft version
            </Button>
          </>
        }
      />

      {hasDraft && hasPublished && <p className="mb-4 text-sm text-ink-mute">Only one draft can exist at a time. Publish or finish the current draft before starting another.</p>}

      <Card padded={false}>
        <ul className="divide-y divide-line">
          {versions.map((v) => (
            <li key={v.id}>
              <Link href={`/exporter/standards/${id}/versions/${v.version_number}`} className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-sunken/60">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sunken font-display text-sm font-semibold">v{v.version_number}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{v.name}</span>
                  <span className="text-sm text-ink-mute">{v.published_at ? `Published ${fmtDateTime(v.published_at)}` : `Created ${fmtDateTime(v.created_at)}`}</span>
                </span>
                <StatusBadge status={v.status} />
                <span className="inline-flex items-center gap-1 text-sm text-leaf-700">{v.status === "draft" ? "Edit" : "View"} <Icon name="chevronRight" size={14} /></span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      {dialog}
    </>
  );
}
