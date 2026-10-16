"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createNotice } from "@/lib/plantingNoticesApi";
import { fetchStandards, StandardData, VersionSummary } from "@/lib/standardsApi";
import { SRI_LANKA_DISTRICTS } from "@/lib/adsApi";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";

const LANG_LABEL: Record<"en" | "si" | "ta", string> = {
  en: "English",
  si: "සිංහල",
  ta: "தமிழ்",
};

export default function NewPlantingNoticePage() {
  const router = useRouter();

  // Form state
  const [crop, setCrop] = useState<"tea" | "cinnamon">("tea");
  const [standardVersionId, setStandardVersionId] = useState<string>("");
  const [targetMonth, setTargetMonth] = useState<string>("");
  const [volumeNeededKg, setVolumeNeededKg] = useState<string>("");
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);

  // Multilingual text
  const [activeLangTab, setActiveLangTab] = useState<"en" | "si" | "ta">("en");
  const [title, setTitle] = useState({ en: "", si: "", ta: "" });
  const [message, setMessage] = useState({ en: "", si: "", ta: "" });

  // Standards available
  const [standards, setStandards] = useState<StandardData[]>([]);
  const [loadingStandards, setLoadingStandards] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute minimum future month (next month)
  const now = new Date();
  const nextMonthYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const nextMonthNum = now.getMonth() === 11 ? 1 : now.getMonth() + 2;
  const minMonth = `${nextMonthYear}-${String(nextMonthNum).padStart(2, "0")}`;

  useEffect(() => {
    // Set default target month to next month
    if (!targetMonth) {
      setTargetMonth(minMonth);
    }
  }, [minMonth, targetMonth]);

  useEffect(() => {
    async function loadStandards() {
      setLoadingStandards(true);
      try {
        const res = await fetchStandards({ is_archived: false });
        setStandards(res.items || []);
      } catch (e: any) {
        console.error("Failed to load standards", e);
      } finally {
        setLoadingStandards(false);
      }
    }
    loadStandards();
  }, []);

  // Filter published standard versions for current crop
  const publishedVersions: { id: string; name: string; versionNumber: number }[] = [];
  standards
    .filter((s) => s.crop.toLowerCase() === crop.toLowerCase() && !s.is_archived)
    .forEach((s) => {
      (s.versions || []).forEach((v: VersionSummary) => {
        if (v.status === "published") {
          publishedVersions.push({
            id: v.id,
            name: `${v.name} (v${v.version_number})`,
            versionNumber: v.version_number,
          });
        }
      });
    });

  // Automatically select first published version when crop changes
  useEffect(() => {
    if (publishedVersions.length > 0) {
      if (!publishedVersions.some((v) => v.id === standardVersionId)) {
        setStandardVersionId(publishedVersions[0].id);
      }
    } else {
      setStandardVersionId("");
    }
  }, [crop, standards]);

  const toggleDistrict = (district: string) => {
    setSelectedDistricts((prev) =>
      prev.includes(district) ? prev.filter((d) => d !== district) : [...prev, district]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.en.trim()) {
      setError("English title is required.");
      return;
    }
    if (!message.en.trim()) {
      setError("English message is required.");
      return;
    }
    if (!standardVersionId) {
      setError("Please select a published quality standard version.");
      return;
    }
    const vol = parseFloat(volumeNeededKg);
    if (isNaN(vol) || vol <= 0) {
      setError("Target volume must be greater than 0 kg.");
      return;
    }
    if (!targetMonth) {
      setError("Target planting month is required.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createNotice({
        crop,
        standard_version_id: standardVersionId,
        target_month: `${targetMonth}-01`,
        volume_needed_kg: vol,
        eligible_districts: selectedDistricts,
        title: {
          en: title.en.trim(),
          si: title.si.trim() || undefined,
          ta: title.ta.trim() || undefined,
        },
        message: {
          en: message.en.trim(),
          si: message.si.trim() || undefined,
          ta: message.ta.trim() || undefined,
        },
      });

      router.push(`/exporter/planting-notices/${created.id}`);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to create planting notice.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        eyebrow="Planting Notices"
        title="Create Planting Notice"
        subtitle="Draft a new forecast notice for upcoming harvest requirements. You can review and publish it when ready."
        action={
          <Link
            href="/exporter/planting-notices"
            className="text-xs font-semibold text-brand-700 hover:text-brand-800"
          >
            ← Back to Planting Notices
          </Link>
        }
      />

      <div className="space-y-6">
        {error && <Alert tone="danger" title={error} />}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader title="1. Crop & Standard Specification" />
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Crop Selector */}
                <Field label="Target Crop" required>
                  <div className="grid grid-cols-2 gap-3">
                    {(["tea", "cinnamon"] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCrop(c)}
                        className={`py-2.5 px-3 rounded-lg text-xs font-bold border transition-colors ${
                          crop === c
                            ? "bg-brand-50 border-brand-500 text-brand-700 ring-2 ring-brand-500/15"
                            : "bg-paper-sunken border-border text-ink-500 hover:bg-paper-raised"
                        }`}
                      >
                        {c === "tea" ? "Tea" : "Cinnamon"}
                      </button>
                    ))}
                  </div>
                </Field>

                {/* Quality Standard Version */}
                <Field label="Quality Standard Version" required>
                  {loadingStandards ? (
                    <div className="text-xs text-ink-400 py-2">Loading standards...</div>
                  ) : publishedVersions.length === 0 ? (
                    <Alert tone="warning" title={`No published standards found for ${crop}.`}>
                      Please publish a standard version first.
                    </Alert>
                  ) : (
                    <Select
                      value={standardVersionId}
                      onChange={(e) => setStandardVersionId(e.target.value)}
                      required
                    >
                      {publishedVersions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Target Planting Month */}
                <Field
                  label="Target Planting Month"
                  required
                  hint="Must be at least next month. Farmer replies will lock on the 1st day of this month."
                >
                  <Input
                    type="month"
                    min={minMonth}
                    value={targetMonth}
                    onChange={(e) => setTargetMonth(e.target.value)}
                    required
                  />
                </Field>

                {/* Target Volume Needed */}
                <Field
                  label="Total Volume Needed (kg)"
                  required
                  hint="Expected harvest supply required from approved farmers."
                >
                  <Input
                    type="number"
                    min="1"
                    step="any"
                    placeholder="e.g. 5000"
                    value={volumeNeededKg}
                    onChange={(e) => setVolumeNeededKg(e.target.value)}
                    required
                  />
                </Field>
              </div>
            </div>
          </Card>

          {/* Eligible Districts */}
          <Card>
            <CardHeader
              title="2. Eligible Districts"
              subtitle="Leave empty to make notice visible to approved farmers in all districts."
              action={
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedDistricts([...SRI_LANKA_DISTRICTS])}
                    className="text-xs text-brand-700 hover:underline font-semibold"
                  >
                    Select All
                  </button>
                  <span className="text-border-strong">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedDistricts([])}
                    className="text-xs text-ink-500 hover:underline font-semibold"
                  >
                    Clear
                  </button>
                </div>
              }
            />

            <div className="flex flex-wrap gap-2">
              {SRI_LANKA_DISTRICTS.map((d) => {
                const isSelected = selectedDistricts.includes(d);
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() => toggleDistrict(d)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                      isSelected
                        ? "bg-brand-700 border-brand-700 text-white font-semibold"
                        : "bg-paper-sunken border-border text-ink-700 hover:bg-paper-raised"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-ink-400 mt-3">
              {selectedDistricts.length === 0
                ? "Notice will be broadcast to approved farmers across all 25 districts."
                : `Selected ${selectedDistricts.length} of 25 districts.`}
            </p>
          </Card>

          {/* Notice Message Content */}
          <Card>
            <CardHeader
              title="3. Title & Message"
              subtitle="Provide details for your farmers."
              action={
                <div className="flex items-center gap-1 bg-paper-sunken p-1 rounded-lg">
                  {(["en", "si", "ta"] as const).map((lang) => (
                    <button
                      type="button"
                      key={lang}
                      onClick={() => setActiveLangTab(lang)}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                        activeLangTab === lang
                          ? "bg-paper-raised text-brand-700 shadow-sm"
                          : "text-ink-500 hover:text-ink-900"
                      }`}
                    >
                      {lang === "en" ? "English *" : LANG_LABEL[lang]}
                    </button>
                  ))}
                </div>
              }
            />

            <div className="space-y-5">
              {/* Title input */}
              <Field
                label={`Notice Title (${activeLangTab.toUpperCase()})`}
                required={activeLangTab === "en"}
              >
                <Input
                  type="text"
                  placeholder={
                    activeLangTab === "en"
                      ? "e.g. Sourcing High-Grown Tea Harvest"
                      : activeLangTab === "si"
                      ? "උදා. උසස් තත්ත්වයේ තේ අස්වැන්න"
                      : "எ.கா. உயர் ரக தேயிலை அறுவடை"
                  }
                  value={title[activeLangTab]}
                  onChange={(e) => setTitle({ ...title, [activeLangTab]: e.target.value })}
                />
              </Field>

              {/* Message input */}
              <Field
                label={`Notice Message / Instructions (${activeLangTab.toUpperCase()})`}
                required={activeLangTab === "en"}
              >
                <Textarea
                  rows={4}
                  placeholder={
                    activeLangTab === "en"
                      ? "Describe cultivation expectations, standard adherence requirements, and schedule..."
                      : activeLangTab === "si"
                      ? "වගා උපදෙස් සහ තත්ත්ව ප්‍රමිතීන් පිළිබඳ විස්තර..."
                      : "பயிர்ச்செய்கை மற்றும் தர விவரங்கள்..."
                  }
                  value={message[activeLangTab]}
                  onChange={(e) => setMessage({ ...message, [activeLangTab]: e.target.value })}
                />
              </Field>
            </div>
          </Card>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" href="/exporter/planting-notices">
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || publishedVersions.length === 0}>
              {submitting ? "Saving Draft..." : "Save Draft Notice"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
