"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, parseError } from "@/lib/api";
import { AdForm, adPayload, blankAd, validateAd } from "@/components/exporter/AdForm";
import { Button, PageHeader, useToast } from "@/components/ui";

export default function NewAd() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(blankAd);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const create = async () => {
    const e = validateAd(form, false);
    setErrors(e);
    if (Object.keys(e).length) { toast.error("Please fix the highlighted fields."); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setBusy(true);
    try {
      const { data } = await api.post<{ id: string }>("/api/exporter/ads", { crop: form.crop, ...adPayload(form) });
      toast.success("Draft saved. Review it, then publish.");
      router.push(`/exporter/ads/${data.id}`);
    } catch (err) {
      toast.error(parseError(err, "Couldn’t create the ad.").message);
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader back={{ href: "/exporter/ads", label: "All buy requests" }} title="New buy request" subtitle="Saved as a draft first. Nothing is visible to farmers until you publish it." />
      <AdForm value={form} onChange={setForm} errors={errors} />
      <div className="sticky bottom-4 z-10 mt-6 flex justify-end gap-3 rounded-xl border border-line bg-surface/95 p-3 shadow-pop backdrop-blur">
        <Button variant="secondary" onClick={() => router.push("/exporter/ads")} disabled={busy}>Cancel</Button>
        <Button onClick={create} loading={busy}>Save draft</Button>
      </div>
    </>
  );
}
