"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, homeFor, parseError, session, type Role } from "@/lib/api";
import { DISTRICTS } from "@/lib/constants";
import { Alert, Button, Segmented, SelectField, TextField } from "@/components/ui";

type Kind = "exporter" | "farmer";
type Form = Record<string, string>;

const EXPORTER_FIELDS = [
  { key: "name", label: "Your full name", autoComplete: "name" },
  { key: "email", label: "Work email", type: "email", autoComplete: "email" },
  { key: "password", label: "Password", type: "password", autoComplete: "new-password" },
  { key: "phone", label: "Contact phone", type: "tel", autoComplete: "tel" },
  { key: "business_name", label: "Company name" },
  { key: "business_reg_no", label: "Business registration number" },
  { key: "export_license_no", label: "Export licence number" },
  { key: "business_address", label: "Business address", wide: true },
] as const;

const FARMER_FIELDS = [
  { key: "name", label: "Full name", autoComplete: "name" },
  { key: "email", label: "Email", type: "email", autoComplete: "email" },
  { key: "password", label: "Password", type: "password", autoComplete: "new-password" },
  { key: "phone", label: "Phone", type: "tel", autoComplete: "tel" },
  { key: "nic", label: "NIC number", hint: "Stored only as a salted hash and never shown again." },
  { key: "district", label: "District", select: true },
  { key: "dsd", label: "Divisional Secretariat (DSD)" },
  { key: "gn_division", label: "GN division" },
  { key: "farm_address", label: "Farm address", wide: true },
  { key: "farm_size_ha", label: "Farm size (hectares)", type: "number", step: "0.1", min: "0.1" },
] as const;

export default function SignUpPage() {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>("exporter");
  const [form, setForm] = useState<Form>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const defs: ReadonlyArray<{ key: string; label: string; type?: string; autoComplete?: string; hint?: string; wide?: boolean; select?: boolean; step?: string; min?: string }> =
    kind === "exporter" ? EXPORTER_FIELDS : FARMER_FIELDS;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const missing: Record<string, string> = {};
    for (const d of defs) if (!form[d.key]?.trim()) missing[d.key] = "Required";
    if (kind === "farmer" && !(Number(form.farm_size_ha) >= 0.1)) missing.farm_size_ha = "Enter at least 0.1 hectares";
    if (Object.keys(missing).length) { setFields(missing); setError(null); return; }

    setBusy(true);
    setError(null);
    setFields({});
    const body: Record<string, unknown> = { ...form };
    if (kind === "farmer") body.farm_size_ha = Number(form.farm_size_ha);
    try {
      const { data } = await api.post<{ access_token: string; role: Role }>(`/auth/signup/${kind}`, body);
      session.set(data.access_token, data.role);
      router.replace(homeFor(data.role));
    } catch (err) {
      const p = parseError(err, "Registration failed. Please check the details and try again.");
      setFields(p.fields);
      setError(p.message);
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Create your account</h1>
      <p className="mt-1.5 text-sm text-ink-soft">
        {kind === "exporter"
          ? "Set quality standards, post buy requests and connect with farmers. An administrator verifies new exporters, usually within 1–2 business days."
          : "Farmers do their day-to-day work in the Origo Field app on Android. This account works there too."}
      </p>

      <div className="mt-6"><Segmented<Kind> label="Account type" value={kind} onChange={(k) => { setKind(k); setForm({}); setFields({}); setError(null); }} options={[{ value: "exporter", label: "I’m an exporter" }, { value: "farmer", label: "I’m a farmer" }]} /></div>

      {error && <div className="mt-5"><Alert tone="bad">{error}</Alert></div>}

      <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2" noValidate>
        {defs.map((d) => {
          const common = { label: d.label, value: form[d.key] ?? "", error: fields[d.key], hint: d.hint, required: true, wrapperClassName: d.wide ? "sm:col-span-2" : undefined };
          if (d.select) {
            return (
              <SelectField key={d.key} {...common} onChange={(e) => setForm({ ...form, [d.key]: e.target.value })}>
                <option value="">Select district…</option>
                {DISTRICTS.map((x) => <option key={x}>{x}</option>)}
              </SelectField>
            );
          }
          return (
            <TextField
              key={d.key} {...common} type={d.type} step={d.step} min={d.min} autoComplete={d.autoComplete}
              onChange={(e) => setForm({ ...form, [d.key]: e.target.value })}
            />
          );
        })}
        <div className="sm:col-span-2">
          <Button type="submit" size="lg" className="w-full" loading={busy}>Create {kind} account</Button>
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-ink-soft">
        Already registered? <Link href="/signin" className="font-medium text-leaf-700 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
