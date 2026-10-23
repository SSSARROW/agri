"use client";

import Link from "next/link";
import { useMemo } from "react";
import { api } from "@/lib/api";
import { CROPS, CROP_LABEL, DISTRICTS } from "@/lib/constants";
import { nextMonthValue } from "@/lib/format";
import type { NoticeDetail, Page, Standard } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { Alert, Card, ChipSelect, MultilingualField, SelectField, Spinner, TextField } from "@/components/ui";

export interface NoticeFormState {
  crop: "tea" | "cinnamon";
  standard_version_id: string;
  target_month: string;
  volume_needed_kg: string;
  eligible_districts: string[];
  title: { en: string; si: string; ta: string };
  message: { en: string; si: string; ta: string };
}

export const blankNotice = (): NoticeFormState => ({
  crop: "tea", standard_version_id: "", target_month: nextMonthValue(), volume_needed_kg: "", eligible_districts: [],
  title: { en: "", si: "", ta: "" }, message: { en: "", si: "", ta: "" },
});

export function noticeFromDetail(n: NoticeDetail): NoticeFormState {
  const ml = (m?: Record<string, string>) => ({ en: m?.en ?? "", si: m?.si ?? "", ta: m?.ta ?? "" });
  return {
    crop: n.crop as "tea" | "cinnamon",
    standard_version_id: n.standard_version_id,
    target_month: n.target_month.slice(0, 7),
    volume_needed_kg: String(n.volume_needed_kg),
    eligible_districts: n.eligible_districts ?? [],
    title: ml(n.title),
    message: ml(n.message),
  };
}

export function validateNotice(f: NoticeFormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.title.en.trim()) e.title = "English title is required.";
  if (!f.message.en.trim()) e.message = "English message is required.";
  if (!f.standard_version_id) e.standard_version_id = "Please select a published quality standard version.";
  if (!(Number(f.volume_needed_kg) > 0)) e.volume_needed_kg = "Target volume must be greater than 0 kg.";
  if (!f.target_month) e.target_month = "Target planting month is required.";
  else if (f.target_month < nextMonthValue()) e.target_month = "Choose next month or later.";
  return e;
}

export const noticePayload = (f: NoticeFormState) => ({
  crop: f.crop,
  standard_version_id: f.standard_version_id,
  target_month: f.target_month,
  volume_needed_kg: Number(f.volume_needed_kg),
  eligible_districts: f.eligible_districts,
  title: f.title,
  message: f.message,
});

export function NoticeForm({
  value, onChange, errors, readOnly,
}: { value: NoticeFormState; onChange: (v: NoticeFormState) => void; errors: Record<string, string>; readOnly?: boolean }) {
  const standards = useFetch(
    () => api.get<Page<Standard>>("/api/exporter/standards", { params: { crop: value.crop, is_archived: false, page_size: 100 } }).then((r) => r.data.items),
    [value.crop],
  );
  const options = useMemo(
    () => (standards.data ?? []).flatMap((s) => s.versions.filter((v) => v.status === "published").sort((a, b) => b.version_number - a.version_number).map((v) => ({ id: v.id, label: `${v.name} · v${v.version_number}` }))),
    [standards.data],
  );
  const set = <K extends keyof NoticeFormState>(k: K, v: NoticeFormState[K]) => onChange({ ...value, [k]: v });
  const orphan = value.standard_version_id && !options.some((o) => o.id === value.standard_version_id);

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">What you need</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Crop" disabled={readOnly} value={value.crop} onChange={(e) => onChange({ ...value, crop: e.target.value as "tea" | "cinnamon", standard_version_id: "" })}>
            {CROPS.map((c) => <option key={c} value={c}>{CROP_LABEL[c]}</option>)}
          </SelectField>
          <TextField label="Target planting month" required type="month" min={nextMonthValue()} disabled={readOnly} value={value.target_month} onChange={(e) => set("target_month", e.target.value)} error={errors.target_month} hint="Farmers can reply until this month begins." />
          <TextField label="Total volume needed (kg)" required type="number" min={0} step="any" disabled={readOnly} value={value.volume_needed_kg} onChange={(e) => set("volume_needed_kg", e.target.value)} error={errors.volume_needed_kg} />
        </div>
        {standards.loading ? <Spinner label="Loading standards…" /> : options.length === 0 && !orphan ? (
          <Alert tone="warn" title={`No published ${CROP_LABEL[value.crop].toLowerCase()} standard`}>Farmers need a standard to follow. <Link className="font-medium underline" href="/exporter/standards">Publish one first</Link>.</Alert>
        ) : (
          <SelectField label="Quality standard" required disabled={readOnly} value={value.standard_version_id} error={errors.standard_version_id} onChange={(e) => set("standard_version_id", e.target.value)}>
            <option value="">Select a published standard…</option>
            {orphan && <option value={value.standard_version_id}>Currently linked standard</option>}
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </SelectField>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">Message to farmers</h2>
        <MultilingualField label="Title" disabled={readOnly} value={value.title} onChange={(v) => set("title", v)} error={errors.title} />
        <MultilingualField label="Message" multiline rows={5} disabled={readOnly} value={value.message} onChange={(v) => set("message", v)} error={errors.message} hint="Explain what you’ll buy, why, and what you’d like farmers to commit." />
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold">Who gets it</h2>
        <p className="text-sm text-ink-soft">Only farmers you’ve approved are notified. Narrow it by district if you like.</p>
        <ChipSelect label="Eligible districts" options={DISTRICTS} value={value.eligible_districts} onChange={(v) => set("eligible_districts", v)} columns bulk hint={value.eligible_districts.length === 0 ? "None selected means every approved farmer." : `${value.eligible_districts.length} selected`} />
      </Card>
    </div>
  );
}
