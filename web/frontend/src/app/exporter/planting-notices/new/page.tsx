"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, parseError } from "@/lib/api";
import { blankNotice, NoticeForm, noticePayload, validateNotice } from "@/components/exporter/NoticeForm";
import { Button, PageHeader, useToast } from "@/components/ui";

export default function NewNotice() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(blankNotice);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const e = validateNotice(form);
    setErrors(e);
    if (Object.keys(e).length) { toast.error(Object.values(e)[0]); return; }
    setBusy(true);
    try {
      const { data } = await api.post<{ id: string }>("/api/exporter/planting-notices", noticePayload(form));
      toast.success("Draft saved");
      router.push(`/exporter/planting-notices/${data.id}`);
    } catch (err) { toast.error(parseError(err, "Couldn’t save the notice.").message); setBusy(false); }
  };

  return (
    <>
      <PageHeader back={{ href: "/exporter/planting-notices", label: "All notices" }} title="New planting notice" subtitle="Ask your farmers to commit a plot and an expected volume for a future month." />
      <NoticeForm value={form} onChange={setForm} errors={errors} />
      <div className="sticky bottom-4 z-10 mt-6 flex justify-end gap-3 rounded-xl border border-line bg-surface/95 p-3 shadow-pop backdrop-blur">
        <Button variant="secondary" onClick={() => router.push("/exporter/planting-notices")} disabled={busy}>Cancel</Button>
        <Button onClick={create} loading={busy}>Save draft</Button>
      </div>
    </>
  );
}
