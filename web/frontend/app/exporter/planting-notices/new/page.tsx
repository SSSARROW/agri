"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createNotice } from "@/lib/plantingNoticesApi";
import { fetchStandards, StandardData, VersionSummary } from "@/lib/standardsApi";
import { SRI_LANKA_DISTRICTS } from "@/lib/adsApi";

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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/exporter/planting-notices"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
        >
          <span>←</span>
          <span>Back to Planting Notices</span>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
        <h1 className="text-2xl font-bold text-gray-900">Create Planting Notice</h1>
        <p className="text-sm text-gray-500 mt-1">
          Draft a new forecast notice for upcoming harvest requirements. You can review and publish it when ready.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">
            1. Crop & Standard Specification
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Crop Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Target Crop <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCrop("tea")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    crop === "tea"
                      ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span>🍃</span>
                  <span>Tea</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCrop("cinnamon")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    crop === "cinnamon"
                      ? "bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-500/20"
                      : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <span>🪵</span>
                  <span>Cinnamon</span>
                </button>
              </div>
            </div>

            {/* Quality Standard Version */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Quality Standard Version <span className="text-rose-500">*</span>
              </label>
              {loadingStandards ? (
                <div className="text-xs text-gray-400 py-2">Loading standards...</div>
              ) : publishedVersions.length === 0 ? (
                <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                  No published standards found for {crop}. Please publish a standard version first.
                </div>
              ) : (
                <select
                  value={standardVersionId}
                  onChange={(e) => setStandardVersionId(e.target.value)}
                  required
                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {publishedVersions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            {/* Target Planting Month */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Target Planting Month <span className="text-rose-500">*</span>
              </label>
              <input
                type="month"
                min={minMonth}
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                required
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Must be at least next month. Farmer replies will lock on the 1st day of this month.
              </p>
            </div>

            {/* Target Volume Needed */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Total Volume Needed (kg) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="any"
                placeholder="e.g. 5000"
                value={volumeNeededKg}
                onChange={(e) => setVolumeNeededKg(e.target.value)}
                required
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Expected harvest supply required from approved farmers.
              </p>
            </div>
          </div>
        </div>

        {/* Eligible Districts */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">2. Eligible Districts</h2>
              <p className="text-xs text-gray-500">
                Leave empty to make notice visible to approved farmers in all districts.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedDistricts([...SRI_LANKA_DISTRICTS])}
                className="text-xs text-emerald-700 hover:underline font-medium"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={() => setSelectedDistricts([])}
                className="text-xs text-gray-500 hover:underline font-medium"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {SRI_LANKA_DISTRICTS.map((d) => {
              const isSelected = selectedDistricts.includes(d);
              return (
                <button
                  type="button"
                  key={d}
                  onClick={() => toggleDistrict(d)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    isSelected
                      ? "bg-emerald-600 border-emerald-600 text-white font-semibold"
                      : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-400">
            {selectedDistricts.length === 0
              ? "Notice will be broadcast to approved farmers across all 25 districts."
              : `Selected ${selectedDistricts.length} of 25 districts.`}
          </p>
        </div>

        {/* Notice Message Content */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">3. Title & Message</h2>
              <p className="text-xs text-gray-500">Provide details for your farmers.</p>
            </div>

            {/* Language tabs */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              {(["en", "si", "ta"] as const).map((lang) => (
                <button
                  type="button"
                  key={lang}
                  onClick={() => setActiveLangTab(lang)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    activeLangTab === lang
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {lang === "en" ? "English *" : lang === "si" ? "සිංහල" : "தமிழ்"}
                </button>
              ))}
            </div>
          </div>

          {/* Title input */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Notice Title ({activeLangTab.toUpperCase()}){" "}
              {activeLangTab === "en" && <span className="text-rose-500">*</span>}
            </label>
            <input
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
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Message input */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Notice Message / Instructions ({activeLangTab.toUpperCase()}){" "}
              {activeLangTab === "en" && <span className="text-rose-500">*</span>}
            </label>
            <textarea
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
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            href="/exporter/planting-notices"
            className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting || publishedVersions.length === 0}
            className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50"
          >
            {submitting ? "Saving Draft..." : "Save Draft Notice"}
          </button>
        </div>
      </form>
    </div>
  );
}
