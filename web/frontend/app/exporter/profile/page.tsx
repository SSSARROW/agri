"use client";

import React, { useEffect, useState } from "react";
import {
  fetchExporterProfile,
  updateExporterProfile,
  ExporterProfile,
  ExporterProfileUpdate,
} from "@/lib/exporterApi";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { SectionSpinner } from "@/components/ui/spinner";

const CERTIFICATION_OPTIONS = [
  { value: "organic", label: "Organic" },
  { value: "rainforest_alliance", label: "Rainforest Alliance" },
  { value: "fairtrade", label: "Fairtrade" },
  { value: "other", label: "Other" },
];

const SRI_LANKA_DISTRICTS = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo",
  "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara",
  "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar",
  "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya",
  "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya",
];

// ── Small helper components ─────────────────────────────────────────────────

// Toggle-style multi-select for districts and certifications
function MultiToggle({
  options,
  selected,
  onChange,
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (val: string) => {
    onChange(
      selected.includes(val)
        ? selected.filter((s) => s !== val)
        : [...selected, val]
    );
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggle(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              active
                ? "bg-brand-50 border-brand-300 text-brand-700"
                : "bg-paper-raised border-border text-ink-500 hover:border-border-strong hover:text-ink-700"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ExporterProfilePage() {
  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Controlled form state
  const [form, setForm] = useState<ExporterProfileUpdate>({});

  useEffect(() => {
    fetchExporterProfile()
      .then((p) => {
        setProfile(p);
        setForm({
          company_name: p.company_name ?? "",
          business_reg_no: p.business_reg_no ?? "",
          export_licence_no: p.export_licence_no ?? "",
          contact_person: p.contact_person ?? "",
          phone: p.phone ?? "",
          email: p.email ?? "",
          description: p.description ?? "",
          districts_served: p.districts_served ?? [],
          crops_bought: p.crops_bought ?? ["tea", "cinnamon"],
          certifications: p.certifications ?? [],
        });
      })
      .catch(() => setError("Failed to load profile. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  const handleText = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Basic validation
    if (!form.company_name?.trim()) {
      setError("Company name is required.");
      return;
    }
    if (!form.business_reg_no?.trim()) {
      setError("Business registration number is required.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateExporterProfile(form);
      setProfile(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        "Failed to save profile. Please try again.";
      setError(typeof msg === "string" ? msg : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Loading / Error ──
  if (loading) return <SectionSpinner />;

  if (error && !profile) {
    return <Alert tone="danger" title={error} />;
  }

  const districtOptions = SRI_LANKA_DISTRICTS.map((d) => ({
    value: d,
    label: d,
  }));

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Exporter Portal"
        title="Company Profile"
        subtitle="Manage your business information and export details."
        action={profile && <StatusBadge status={profile.status} />}
      />

      <div className="space-y-6">
        {/* Rejection reason (if any) */}
        {profile?.status === "rejected" && profile.rejection_reason && (
          <Alert tone="danger" title="Application rejected">
            {profile.rejection_reason}
          </Alert>
        )}

        {/* Success message */}
        {success && <Alert tone="success" title="Profile saved successfully." />}

        {/* Form-level error */}
        {error && <Alert tone="danger" title={error} />}

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Section: Company Identity */}
          <Card>
            <CardHeader title="Company Identity" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Company Name" required>
                <Input
                  name="company_name"
                  value={form.company_name ?? ""}
                  onChange={handleText}
                  placeholder="Lanka Agri Exports Ltd"
                  required
                />
              </Field>
              <Field label="Business Reg. No" required>
                <Input
                  name="business_reg_no"
                  value={form.business_reg_no ?? ""}
                  onChange={handleText}
                  placeholder="PV-123456"
                  required
                />
              </Field>
              <Field label="Export Licence No">
                <Input
                  name="export_licence_no"
                  value={form.export_licence_no ?? ""}
                  onChange={handleText}
                  placeholder="EXP-2026-987"
                />
              </Field>
              <Field label="Contact Person">
                <Input
                  name="contact_person"
                  value={form.contact_person ?? ""}
                  onChange={handleText}
                  placeholder="Nimal Silva"
                />
              </Field>
              <Field label="Contact Phone">
                <Input
                  name="phone"
                  type="tel"
                  value={form.phone ?? ""}
                  onChange={handleText}
                  placeholder="+94 11 234 5678"
                />
              </Field>
              <Field label="Business Email">
                <Input
                  name="email"
                  type="email"
                  value={form.email ?? ""}
                  onChange={handleText}
                  placeholder="exports@company.lk"
                />
              </Field>
            </div>
            <div className="mt-5">
              <Field label="Company Description">
                <Textarea
                  name="description"
                  value={form.description ?? ""}
                  onChange={handleText}
                  placeholder="Brief description of your company and what you export…"
                  rows={3}
                />
              </Field>
            </div>
          </Card>

          {/* Section: Operations */}
          <Card>
            <CardHeader title="Operations" />
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold text-ink-700 mb-1.5">
                  Districts Served
                </p>
                <MultiToggle
                  options={districtOptions}
                  selected={form.districts_served ?? []}
                  onChange={(next) => setForm({ ...form, districts_served: next })}
                />
                {(form.districts_served ?? []).length === 0 && (
                  <p className="text-ink-500 text-xs mt-2">
                    Select the districts you source from.
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold text-ink-700 mb-1.5">
                  Certifications Accepted
                </p>
                <MultiToggle
                  options={CERTIFICATION_OPTIONS}
                  selected={form.certifications ?? []}
                  onChange={(next) => setForm({ ...form, certifications: next })}
                />
              </div>
            </div>
          </Card>

          {/* Read-only section */}
          <Card className="bg-paper-sunken">
            <CardHeader
              title="Verification Status"
              subtitle="Read-only — managed by Paramparā administrators."
            />
            <div className="flex items-center gap-3">
              <StatusBadge status={profile?.status ?? "pending"} />
              {profile?.status === "pending" && (
                <p className="text-ink-500 text-xs">
                  Your account is awaiting review by the platform team.
                </p>
              )}
            </div>
          </Card>

          {/* Submit */}
          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={saving}>
              {saving ? "Saving…" : "Save Profile"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
