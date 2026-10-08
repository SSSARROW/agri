"use client";

import React, { useEffect, useState } from "react";
import {
  fetchExporterProfile,
  updateExporterProfile,
  ExporterProfile,
  ExporterProfileUpdate,
} from "@/lib/exporterApi";

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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
      {children}
    </label>
  );
}

function TextInput({
  name,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <input
      type={type}
      name={name}
      required={required}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
    />
  );
}

function TextareaInput({
  name,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-4 py-2.5 rounded-xl bg-zinc-800/80 border border-zinc-700 text-white placeholder-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all resize-none"
    />
  );
}

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
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              active
                ? "bg-teal-500/20 border-teal-500/50 text-teal-300"
                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Status chip ─────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const classes =
    status === "verified"
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : status === "rejected"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : "bg-amber-500/20 text-amber-400 border-amber-500/30";
  const labels: Record<string, string> = {
    pending: "⏳ Pending Verification",
    verified: "✅ Verified",
    rejected: "❌ Rejected",
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${classes}`}>
      {labels[status] ?? status}
    </span>
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
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (error && !profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-red-950/40 border border-red-900/50 p-6 rounded-2xl max-w-sm text-center">
          <p className="text-red-400 font-semibold text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const districtOptions = SRI_LANKA_DISTRICTS.map((d) => ({
    value: d,
    label: d,
  }));

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Company Profile</h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            Manage your business information and export details.
          </p>
        </div>
        {profile && <StatusChip status={profile.status} />}
      </div>

      {/* Rejection reason (if any) */}
      {profile?.status === "rejected" && profile.rejection_reason && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/50 text-red-400 text-sm">
          <span className="font-semibold">Rejection reason: </span>
          {profile.rejection_reason}
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-900/50 text-emerald-400 text-sm font-medium flex items-center gap-2">
          <span>✓</span> Profile saved successfully.
        </div>
      )}

      {/* Form-level error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/50 text-red-400 text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Section: Company Identity */}
        <section className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-xs font-bold text-teal-400 uppercase tracking-widest">
            Company Identity
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <FieldLabel>Company Name *</FieldLabel>
              <TextInput
                name="company_name"
                value={form.company_name ?? ""}
                onChange={handleText}
                placeholder="Lanka Agri Exports Ltd"
                required
              />
            </div>
            <div>
              <FieldLabel>Business Reg. No *</FieldLabel>
              <TextInput
                name="business_reg_no"
                value={form.business_reg_no ?? ""}
                onChange={handleText}
                placeholder="PV-123456"
                required
              />
            </div>
            <div>
              <FieldLabel>Export Licence No</FieldLabel>
              <TextInput
                name="export_licence_no"
                value={form.export_licence_no ?? ""}
                onChange={handleText}
                placeholder="EXP-2026-987"
              />
            </div>
            <div>
              <FieldLabel>Contact Person</FieldLabel>
              <TextInput
                name="contact_person"
                value={form.contact_person ?? ""}
                onChange={handleText}
                placeholder="Nimal Silva"
              />
            </div>
            <div>
              <FieldLabel>Contact Phone</FieldLabel>
              <TextInput
                name="phone"
                type="tel"
                value={form.phone ?? ""}
                onChange={handleText}
                placeholder="+94 11 234 5678"
              />
            </div>
            <div>
              <FieldLabel>Business Email</FieldLabel>
              <TextInput
                name="email"
                type="email"
                value={form.email ?? ""}
                onChange={handleText}
                placeholder="exports@company.lk"
              />
            </div>
          </div>
          <div>
            <FieldLabel>Company Description</FieldLabel>
            <TextareaInput
              name="description"
              value={form.description ?? ""}
              onChange={handleText}
              placeholder="Brief description of your company and what you export…"
              rows={3}
            />
          </div>
        </section>

        {/* Section: Operations */}
        <section className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-xs font-bold text-teal-400 uppercase tracking-widest">
            Operations
          </h2>

          <div>
            <FieldLabel>Districts Served</FieldLabel>
            <MultiToggle
              options={districtOptions}
              selected={form.districts_served ?? []}
              onChange={(next) => setForm({ ...form, districts_served: next })}
            />
            {(form.districts_served ?? []).length === 0 && (
              <p className="text-zinc-600 text-xs mt-2">
                Select the districts you source from.
              </p>
            )}
          </div>

          <div>
            <FieldLabel>Certifications Accepted</FieldLabel>
            <MultiToggle
              options={CERTIFICATION_OPTIONS}
              selected={form.certifications ?? []}
              onChange={(next) => setForm({ ...form, certifications: next })}
            />
          </div>
        </section>

        {/* Read-only section */}
        <section className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 space-y-3">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">
            Verification Status (read-only)
          </h2>
          <div className="flex items-center gap-3">
            <StatusChip status={profile?.status ?? "pending"} />
            {profile?.status === "pending" && (
              <p className="text-zinc-500 text-xs">
                Managed by Paramparā administrators only.
              </p>
            )}
          </div>
        </section>

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-teal-900/30 transition-all"
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
