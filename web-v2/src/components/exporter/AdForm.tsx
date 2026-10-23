"use client";

import { useMemo } from "react";
import { api } from "@/lib/api";
import { CROPS, CROP_LABEL, DISTRICTS } from "@/lib/constants";
import { dateToIsoEnd, dateToIsoStart, isoToDateInput, todayPlus } from "@/lib/format";
import type { AdVersionDetail, Page, Standard } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { Alert, Card, ChipSelect, MultilingualField, SelectField, Spinner, TextField, TextAreaField } from "@/components/ui";
import Link from "next/link";

export interface AdFormState {
  crop: "tea" | "cinnamon";
  standard_version_id: string;
  title: { en: string; si: string; ta: string };
  description: { en: string; si: string; ta: string };
  grade_tier: string;
  quantity_kg: string;
  price_type: "fixed" | "range";
  price_fixed: string;
  price_min: string;
  price_max: string;
  window_start: string;
  window_end: string;
  expires: string;
  pickup_location: string;
  eligible_districts: string[];
  payment_timing: string;
  rejection_handling: string;
  other: string;
}

export const blankAd = (): AdFormState => ({
  crop: "tea",
  standard_version_id: "",
  title: { en: "", si: "", ta: "" },
  description: { en: "", si: "", ta: "" },
  grade_tier: "",
  quantity_kg: "",
  price_type: "fixed",
  price_fixed: "",
  price_min: "",
  price_max: "",
  window_start: todayPlus(7),
  window_end: todayPlus(21),
  expires: todayPlus(5),
  pickup_location: "",
  eligible_districts: [],
  payment_timing: "",
  rejection_handling: "",
  other: "",
});

export function adFromVersion(crop: string, v: AdVersionDetail): AdFormState {
  const ml = (m?: { en?: string; si?: string; ta?: string }) => ({ en: m?.en ?? "", si: m?.si ?? "", ta: m?.ta ?? "" });
  return {
    crop: crop as "tea" | "cinnamon",
    standard_version_id: v.standard_version_id,
    title: ml(v.title),
    description: ml(v.description),
    grade_tier: v.grade_tier ?? "",
    quantity_kg: String(v.quantity_kg ?? ""),
    price_type: v.price_type,
    price_fixed: v.price_fixed != null ? String(v.price_fixed) : "",
    price_min: v.price_min != null ? String(v.price_min) : "",
    price_max: v.price_max != null ? String(v.price_max) : "",
    window_start: isoToDateInput(v.collection_window_start),
    window_end: isoToDateInput(v.collection_window_end),
    expires: isoToDateInput(v.expires_at),
    pickup_location: v.pickup_location ?? "",
    eligible_districts: v.eligible_districts ?? [],
    payment_timing: v.terms?.payment_timing ?? "",
    rejection_handling: v.terms?.rejection_handling ?? "",
    other: v.terms?.other ?? "",
  };
}

/** Validates in the order a farmer would notice the gaps; returns the first problem per field. */
export function validateAd(f: AdFormState, forPublish: boolean): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.standard_version_id) e.standard_version_id = "Choose a published quality standard.";
  if (!f.title.en.trim()) e.title = "An English title is required.";
  if (!f.description.en.trim()) e.description = "An English description is required.";
  if (!(Number(f.quantity_kg) > 0)) e.quantity_kg = "Enter a quantity above 0 kg.";
  if (f.price_type === "fixed") {
    if (!(Number(f.price_fixed) > 0)) e.price_fixed = "Enter a price above 0.";
  } else {
    if (!(Number(f.price_min) > 0)) e.price_min = "Enter a minimum above 0.";
    if (!(Number(f.price_max) > 0)) e.price_max = "Enter a maximum above 0.";
    else if (Number(f.price_min) > Number(f.price_max)) e.price_max = "Maximum must be at least the minimum.";
  }
  if (!f.window_start) e.window_start = "Required";
  if (!f.window_end) e.window_end = "Required";
  if (!f.expires) e.expires = "Required";
  if (f.window_start && f.window_end && f.window_end < f.window_start) e.window_end = "Must be on or after the start.";
  if (f.expires && f.window_end && f.expires > f.window_end) e.expires = "The ad must expire on or before the collection window ends.";
  if (forPublish && f.expires && f.expires < todayPlus(0)) e.expires = "Expiry must be today or later.";
  return e;
}

export function adPayload(f: AdFormState) {
  return {
    standard_version_id: f.standard_version_id,
    title: f.title,
    description: f.description,
    grade_tier: f.grade_tier.trim(),
    quantity_kg: Number(f.quantity_kg),
    price_type: f.price_type,
    price_fixed: f.price_type === "fixed" ? Number(f.price_fixed) : null,
    price_min: f.price_type === "range" ? Number(f.price_min) : null,
    price_max: f.price_type === "range" ? Number(f.price_max) : null,
    collection_window_start: dateToIsoStart(f.window_start),
    collection_window_end: dateToIsoEnd(f.window_end),
    pickup_location: f.pickup_location.trim(),
    eligible_districts: f.eligible_districts,
    terms: { payment_timing: f.payment_timing, rejection_handling: f.rejection_handling, other: f.other },
    expires_at: dateToIsoEnd(f.expires),
  };
}

export function AdForm({
  value, onChange, errors, readOnly, crop,
}: {
  value: AdFormState;
  onChange: (v: AdFormState) => void;
  errors: Record<string, string>;
  readOnly?: boolean;
  /** Fixed crop (editing an existing ad). */
  crop?: string;
}) {
  const activeCrop = (crop ?? value.crop) as "tea" | "cinnamon";
  const standards = useFetch(
    () => api.get<Page<Standard>>("/api/exporter/standards", { params: { crop: activeCrop, is_archived: false, page_size: 100 } }).then((r) => r.data.items),
    [activeCrop],
  );

  const options = useMemo(
    () =>
      (standards.data ?? []).flatMap((s) =>
        s.versions.filter((v) => v.status === "published").sort((a, b) => b.version_number - a.version_number).map((v) => ({ id: v.id, label: `${v.name} · v${v.version_number}` })),
      ),
    [standards.data],
  );

  const set = <K extends keyof AdFormState>(k: K, v: AdFormState[K]) => onChange({ ...value, [k]: v });
  const orphan = value.standard_version_id && !options.some((o) => o.id === value.standard_version_id);

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">Product &amp; standard</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Crop" disabled={readOnly || !!crop} value={activeCrop} onChange={(e) => onChange({ ...value, crop: e.target.value as "tea" | "cinnamon", standard_version_id: "" })}>
            {CROPS.map((c) => <option key={c} value={c}>{CROP_LABEL[c]}</option>)}
          </SelectField>
          <TextField label="Grade / tier" disabled={readOnly} value={value.grade_tier} onChange={(e) => set("grade_tier", e.target.value)} placeholder={activeCrop === "tea" ? "e.g. BOPF" : "e.g. C5"} />
        </div>
        {standards.loading ? <Spinner label="Loading standards…" /> : options.length === 0 && !orphan ? (
          <Alert tone="warn" title={`You have no published ${CROP_LABEL[activeCrop].toLowerCase()} standard yet`}>
            Every ad is tied to a published quality standard so farmers know what they’re agreeing to. <Link className="font-medium underline" href="/exporter/standards">Create and publish one</Link> first.
          </Alert>
        ) : (
          <SelectField label="Quality standard" required disabled={readOnly} value={value.standard_version_id} error={errors.standard_version_id} onChange={(e) => set("standard_version_id", e.target.value)} hint="Farmers see this standard’s stages and proof requirements before applying.">
            <option value="">Select a published standard…</option>
            {orphan && <option value={value.standard_version_id}>Currently linked standard</option>}
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </SelectField>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">What farmers read</h2>
        <MultilingualField label="Title" disabled={readOnly} value={value.title} onChange={(v) => set("title", v)} error={errors.title} />
        <MultilingualField label="Description" multiline rows={5} disabled={readOnly} value={value.description} onChange={(v) => set("description", v)} error={errors.description} hint="What you’re buying, why, and anything farmers should know before applying." />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">Quantity &amp; price</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Target quantity (kg)" required type="number" min={0} step="any" disabled={readOnly} value={value.quantity_kg} onChange={(e) => set("quantity_kg", e.target.value)} error={errors.quantity_kg} />
          <SelectField label="Price type" disabled={readOnly} value={value.price_type} onChange={(e) => set("price_type", e.target.value as "fixed" | "range")}>
            <option value="fixed">Fixed price</option>
            <option value="range">Price range</option>
          </SelectField>
          {value.price_type === "fixed" ? (
            <TextField label="Price (LKR / kg)" required type="number" min={0} step="any" disabled={readOnly} value={value.price_fixed} onChange={(e) => set("price_fixed", e.target.value)} error={errors.price_fixed} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Min (LKR/kg)" required type="number" min={0} step="any" disabled={readOnly} value={value.price_min} onChange={(e) => set("price_min", e.target.value)} error={errors.price_min} />
              <TextField label="Max (LKR/kg)" required type="number" min={0} step="any" disabled={readOnly} value={value.price_max} onChange={(e) => set("price_max", e.target.value)} error={errors.price_max} />
            </div>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Dates &amp; pickup</h2>
          <p className="text-sm text-ink-soft">Dates are Sri Lanka time. “Expires” and “Collection ends” run to the end of that day.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Ad expires" required type="date" disabled={readOnly} value={value.expires} onChange={(e) => set("expires", e.target.value)} error={errors.expires} />
          <TextField label="Collection starts" required type="date" disabled={readOnly} value={value.window_start} onChange={(e) => set("window_start", e.target.value)} error={errors.window_start} />
          <TextField label="Collection ends" required type="date" disabled={readOnly} value={value.window_end} onChange={(e) => set("window_end", e.target.value)} error={errors.window_end} />
        </div>
        <TextField label="Pickup location" disabled={readOnly} value={value.pickup_location} onChange={(e) => set("pickup_location", e.target.value)} placeholder="Collection centre, town or address" />
        <ChipSelect label="Eligible districts" options={DISTRICTS} value={value.eligible_districts} onChange={(v) => set("eligible_districts", v)} columns bulk hint={value.eligible_districts.length === 0 ? "None selected means farmers in every district can see this ad." : `${value.eligible_districts.length} selected`} />
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Terms</h2>
          <p className="text-sm text-ink-soft">Farmers accept the exact terms of the version they applied to.</p>
        </div>
        <TextAreaField label="Payment timing" rows={2} disabled={readOnly} value={value.payment_timing} onChange={(e) => set("payment_timing", e.target.value)} placeholder="e.g. Paid by bank transfer within 7 days of delivery" />
        <TextAreaField label="If produce is rejected" rows={2} disabled={readOnly} value={value.rejection_handling} onChange={(e) => set("rejection_handling", e.target.value)} placeholder="e.g. Returned at the exporter’s cost; no payment for rejected lots" />
        <TextAreaField label="Other terms" rows={2} disabled={readOnly} value={value.other} onChange={(e) => set("other", e.target.value)} placeholder="Packaging, transport or anything else" />
      </Card>
    </div>
  );
}
