"use client";

import { useEffect, useState } from "react";
import { api, parseError } from "@/lib/api";
import { CERTIFICATIONS, CROPS, CROP_LABEL, DISTRICTS } from "@/lib/constants";
import type { ExporterProfile } from "@/lib/types";
import { useExporter } from "@/components/shell/ExporterContext";
import { Alert, Button, Card, ChipSelect, PageHeader, StatusBadge, TextAreaField, TextField, useToast } from "@/components/ui";

export default function ProfilePage() {
  const { profile, setProfile } = useExporter();
  const toast = useToast();
  const [f, setF] = useState<ExporterProfile>(profile);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => setF(profile), [profile]);
  const set = <K extends keyof ExporterProfile>(k: K, v: ExporterProfile[K]) => setF((p) => ({ ...p, [k]: v }));

  const dirty = JSON.stringify(f) !== JSON.stringify(profile);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.company_name.trim()) errs.company_name = "Company name is required";
    if (!f.business_reg_no.trim()) errs.business_reg_no = "Registration number is required";
    if (f.crops_bought.length === 0) errs.crops_bought = "Choose at least one crop you buy";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const { data } = await api.put<ExporterProfile>("/api/exporter/me", {
        company_name: f.company_name.trim(),
        business_reg_no: f.business_reg_no.trim(),
        export_licence_no: f.export_licence_no || null,
        contact_person: f.contact_person || null,
        phone: f.phone || null,
        email: f.email || null,
        description: f.description || null,
        logo_url: f.logo_url || null,
        districts_served: f.districts_served,
        crops_bought: f.crops_bought,
        certifications: f.certifications,
      });
      setProfile(data);
      toast.success("Profile saved");
    } catch (err) {
      const p = parseError(err, "Couldn’t save your profile.");
      setErrors(p.fields);
      toast.error(p.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Company profile"
        subtitle="What farmers see when they decide whether to follow your standard."
        actions={<StatusBadge status={profile.status} label={profile.status === "pending" ? "Pending verification" : profile.status === "rejected" ? "Rejected" : "Verified"} />}
      />

      {profile.status === "rejected" && (
        <div className="mb-6">
          <Alert tone="bad" title="Why your account was rejected">{profile.rejection_reason || "No reason was recorded."} Fix what’s needed below and contact the administrator to reopen your application.</Alert>
        </div>
      )}

      <form onSubmit={save} className="space-y-6" noValidate>
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Business details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Company name" required value={f.company_name} onChange={(e) => set("company_name", e.target.value)} error={errors.company_name} />
            <TextField label="Business registration no." required value={f.business_reg_no} onChange={(e) => set("business_reg_no", e.target.value)} error={errors.business_reg_no} hint="Must be unique on Origo." />
            <TextField label="Export licence no." value={f.export_licence_no ?? ""} onChange={(e) => set("export_licence_no", e.target.value)} error={errors.export_licence_no} />
            <TextField label="Logo URL" type="url" value={f.logo_url ?? ""} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://…" error={errors.logo_url} hint="Shown to farmers in the app." />
            <TextAreaField label="About your company" value={f.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={4} hint="A few sentences on what you buy and how you work with farmers." className="sm:col-span-2" />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">Contact</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField label="Contact person" value={f.contact_person ?? ""} onChange={(e) => set("contact_person", e.target.value)} />
            <TextField label="Phone" type="tel" value={f.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            <TextField label="Business email" type="email" value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} error={errors.email} />
          </div>
        </Card>

        <Card className="space-y-6">
          <div>
            <h2 className="mb-1 text-lg font-semibold">What you buy</h2>
            <p className="mb-4 text-sm text-ink-soft">Crops and certifications appear on your public exporter card.</p>
            <ChipSelect label="Crops bought" options={CROPS.map((c) => CROP_LABEL[c])} value={f.crops_bought.map((c) => CROP_LABEL[c] ?? c)} onChange={(v) => set("crops_bought", v.map((x) => x.toLowerCase()))} hint={errors.crops_bought} />
          </div>
          <ChipSelect label="Certifications" options={CERTIFICATIONS} value={f.certifications} onChange={(v) => set("certifications", v)} />
          <ChipSelect label="Districts you source from" options={DISTRICTS} value={f.districts_served} onChange={(v) => set("districts_served", v)} columns bulk hint="Select the districts you source from." />
        </Card>

        <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-xl border border-line bg-surface/95 p-3 shadow-pop backdrop-blur">
          {dirty && <span className="mr-auto pl-2 text-sm text-ink-mute">You have unsaved changes</span>}
          <Button type="button" variant="ghost" disabled={!dirty} onClick={() => setF(profile)}>Discard</Button>
          <Button type="submit" loading={busy} disabled={!dirty}>Save profile</Button>
        </div>
      </form>
    </>
  );
}
