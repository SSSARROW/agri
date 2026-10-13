"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAd, SRI_LANKA_DISTRICTS, AdCreatePayload } from "@/lib/adsApi";
import { fetchStandards, StandardData, VersionSummary } from "@/lib/standardsApi";

export default function CreateAdPage() {
  const router = useRouter();

  // Form State
  const [crop, setCrop] = useState<string>("tea");
  const [standards, setStandards] = useState<StandardData[]>([]);
  const [selectedStandardVersionId, setSelectedStandardVersionId] = useState<string>("");
  const [standardsLoading, setStandardsLoading] = useState<boolean>(true);

  // Multilingual content
  const [titleEn, setTitleEn] = useState<string>("");
  const [titleSi, setTitleSi] = useState<string>("");
  const [titleTa, setTitleTa] = useState<string>("");

  const [descEn, setDescEn] = useState<string>("");
  const [descSi, setDescSi] = useState<string>("");
  const [descTa, setDescTa] = useState<string>("");

  const [langTab, setLangTab] = useState<"en" | "si" | "ta">("en");

  // Specifications
  const [gradeTier, setGradeTier] = useState<string>("");
  const [quantityKg, setQuantityKg] = useState<number | string>("");

  // Pricing
  const [priceType, setPriceType] = useState<"fixed" | "range">("fixed");
  const [priceFixed, setPriceFixed] = useState<number | string>("");
  const [priceMin, setPriceMin] = useState<number | string>("");
  const [priceMax, setPriceMax] = useState<number | string>("");

  // Dates
  const [collectionStart, setCollectionStart] = useState<string>("");
  const [collectionEnd, setCollectionEnd] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  // Logistics
  const [pickupLocation, setPickupLocation] = useState<string>("");
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);

  // Terms
  const [paymentTiming, setPaymentTiming] = useState<string>("Within 7 days of delivery");
  const [rejectionHandling, setRejectionHandling] = useState<string>("Returned at seller cost");
  const [packaging, setPackaging] = useState<string>("");
  const [transportResponsibility, setTransportResponsibility] = useState<string>("");

  // UI state
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set default dates on mount: collection window in 7-21 days, expiry in 5 days
  useEffect(() => {
    const today = new Date();
    const plus5 = new Date(today.getTime() + 5 * 86400000);
    const plus7 = new Date(today.getTime() + 7 * 86400000);
    const plus21 = new Date(today.getTime() + 21 * 86400000);

    const fmt = (d: Date) => d.toISOString().split("T")[0];
    setExpiresAt(fmt(plus5));
    setCollectionStart(fmt(plus7));
    setCollectionEnd(fmt(plus21));
  }, []);

  // Fetch standards for the selected crop
  useEffect(() => {
    let active = true;
    setStandardsLoading(true);
    setSelectedStandardVersionId("");

    fetchStandards({ crop, is_archived: false, page_size: 50 })
      .then((res) => {
        if (!active) return;
        setStandards(res.items);

        // Pre-select first published standard version if available
        let foundVersionId = "";
        for (const std of res.items) {
          const pubVer = std.versions?.find((v: VersionSummary) => v.status === "published");
          if (pubVer) {
            foundVersionId = pubVer.id;
            break;
          }
        }
        setSelectedStandardVersionId(foundVersionId);
      })
      .catch(() => {
        if (active) setStandards([]);
      })
      .finally(() => {
        if (active) setStandardsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [crop]);

  // Available published versions
  const publishedStandardOptions = standards.flatMap((std) =>
    (std.versions || [])
      .filter((v: VersionSummary) => v.status === "published")
      .map((v: VersionSummary) => ({
        versionId: v.id,
        label: `${v.name || "Standard"} (v${v.version_number})`,
      }))
  );

  const toggleDistrict = (district: string) => {
    setSelectedDistricts((prev) =>
      prev.includes(district) ? prev.filter((d) => d !== district) : [...prev, district]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validations
    if (!selectedStandardVersionId) {
      setErrorMessage("Please select a published Quality Standard.");
      return;
    }
    if (!titleEn.trim()) {
      setErrorMessage("Title in English is required.");
      return;
    }
    if (!descEn.trim()) {
      setErrorMessage("Description in English is required.");
      return;
    }
    const qty = Number(quantityKg);
    if (isNaN(qty) || qty <= 0) {
      setErrorMessage("Please enter a valid target quantity (greater than 0).");
      return;
    }
    if (priceType === "fixed") {
      const pf = Number(priceFixed);
      if (isNaN(pf) || pf <= 0) {
        setErrorMessage("Please enter a valid fixed price per kg.");
        return;
      }
    } else {
      const pMin = Number(priceMin);
      const pMax = Number(priceMax);
      if (isNaN(pMin) || isNaN(pMax) || pMin <= 0 || pMax <= 0 || pMin > pMax) {
        setErrorMessage("Please enter valid minimum and maximum prices (minimum <= maximum).");
        return;
      }
    }
    if (!collectionStart || !collectionEnd || !expiresAt) {
      setErrorMessage("Please set valid dates for collection window and advertisement expiration.");
      return;
    }

    setSaving(true);

    const payload: AdCreatePayload = {
      crop,
      standard_version_id: selectedStandardVersionId,
      title: {
        en: titleEn.trim(),
        si: titleSi.trim() || undefined,
        ta: titleTa.trim() || undefined,
      },
      description: {
        en: descEn.trim(),
        si: descSi.trim() || undefined,
        ta: descTa.trim() || undefined,
      },
      grade_tier: gradeTier.trim() || undefined,
      quantity_kg: qty,
      price_type: priceType,
      price_fixed: priceType === "fixed" ? Number(priceFixed) : undefined,
      price_min: priceType === "range" ? Number(priceMin) : undefined,
      price_max: priceType === "range" ? Number(priceMax) : undefined,
      collection_window_start: new Date(collectionStart).toISOString(),
      collection_window_end: new Date(collectionEnd).toISOString(),
      pickup_location: pickupLocation.trim() || undefined,
      eligible_districts: selectedDistricts,
      terms: {
        payment_timing: paymentTiming.trim() || undefined,
        rejection_handling: rejectionHandling.trim() || undefined,
        packaging: packaging.trim() || undefined,
        transport_responsibility: transportResponsibility.trim() || undefined,
      },
      expires_at: new Date(expiresAt).toISOString(),
    };

    try {
      const newAd = await createAd(payload);
      router.push(`/exporter/ads/${newAd.id}/versions/1`);
    } catch (err: any) {
      setErrorMessage(err.detail || err.message || "Failed to create advertisement.");
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/exporter/ads"
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              ← Back to Advertisements
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-100">
            Create Buy Request Advertisement
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Step 1: Set crop and bind to an approved quality standard, then configure pricing and schedule.
          </p>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-6 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-sm flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div className="flex-1">
            <p className="font-semibold text-red-200">Validation Error</p>
            <p className="text-red-300 text-xs mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-8">
        {/* Section 1: Crop & Standard Linkage */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-5">
          <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold">
              1
            </span>
            Target Crop & Quality Standard
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Crop Type <span className="text-red-400">*</span>
              </label>
              <select
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
              >
                <option value="tea">Tea</option>
                <option value="cinnamon">Cinnamon</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Linked Quality Standard (Published) <span className="text-red-400">*</span>
              </label>
              {standardsLoading ? (
                <div className="px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-500">
                  Loading standards…
                </div>
              ) : publishedStandardOptions.length > 0 ? (
                <select
                  value={selectedStandardVersionId}
                  onChange={(e) => setSelectedStandardVersionId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
                >
                  {publishedStandardOptions.map((opt) => (
                    <option key={opt.versionId} value={opt.versionId}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-amber-300 text-xs">
                  No published standards found for {crop}.{" "}
                  <Link
                    href="/exporter/standards"
                    className="underline font-semibold hover:text-amber-200"
                    target="_blank"
                  >
                    Publish a standard first →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Multilingual Content */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold">
                2
              </span>
              Advertisement Title & Description
            </h2>

            {/* Language Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-950 border border-zinc-800 text-xs">
              {[
                { id: "en", label: "English *" },
                { id: "si", label: "සිංහල" },
                { id: "ta", label: "தமிழ்" },
              ].map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setLangTab(t.id as any)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    langTab === t.id
                      ? "bg-zinc-800 text-teal-400"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {langTab === "en" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Title (English) <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="e.g. Sourcing 5,000kg Pure BOPF High Grown Tea"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Description & Specifications (English) <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={4}
                  value={descEn}
                  onChange={(e) => setDescEn(e.target.value)}
                  placeholder="Describe your purchase requirements, quality expectations, packaging and collection details..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
                />
              </div>
            </div>
          )}

          {langTab === "si" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Title (Sinhala - විකල්ප)
                </label>
                <input
                  type="text"
                  value={titleSi}
                  onChange={(e) => setTitleSi(e.target.value)}
                  placeholder="උදා: උසස් තත්ත්වයේ තේ මිලදී ගැනීමේ දැන්වීම..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Description (Sinhala - විකල්ප)
                </label>
                <textarea
                  rows={4}
                  value={descSi}
                  onChange={(e) => setDescSi(e.target.value)}
                  placeholder="ගොවීන් සඳහා විස්තරය..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
                />
              </div>
            </div>
          )}

          {langTab === "ta" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Title (Tamil - விருப்பத்தேர்வு)
                </label>
                <input
                  type="text"
                  value={titleTa}
                  onChange={(e) => setTitleTa(e.target.value)}
                  placeholder="உதாரணம்: தரமான தேயிலை கொள்முதல் விளம்பரம்..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Description (Tamil - விருப்பத்தேர்வு)
                </label>
                <textarea
                  rows={4}
                  value={descTa}
                  onChange={(e) => setDescTa(e.target.value)}
                  placeholder="விவசாயிகளுக்கான கொள்முதல் விவரங்கள்..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Quantity, Grade & Pricing */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-5">
          <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold">
              3
            </span>
            Volume, Grade & Pricing
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Target Quantity (kg) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="any"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Grade / Tier Specification
              </label>
              <input
                type="text"
                value={gradeTier}
                onChange={(e) => setGradeTier(e.target.value)}
                placeholder="e.g. BOPF, BOP, Alba, C5 Special"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
              />
            </div>
          </div>

          {/* Pricing Mode */}
          <div className="pt-3 border-t border-zinc-800/80">
            <label className="block text-xs font-semibold text-zinc-400 mb-2">
              Pricing Structure <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="radio"
                  name="priceType"
                  value="fixed"
                  checked={priceType === "fixed"}
                  onChange={() => setPriceType("fixed")}
                  className="accent-teal-500"
                />
                Fixed Price (LKR / kg)
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="radio"
                  name="priceType"
                  value="range"
                  checked={priceType === "range"}
                  onChange={() => setPriceType("range")}
                  className="accent-teal-500"
                />
                Price Range (Min – Max LKR / kg)
              </label>
            </div>

            <div className="mt-4">
              {priceType === "fixed" ? (
                <div className="max-w-xs">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Fixed Price (LKR per kg)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={priceFixed}
                    onChange={(e) => setPriceFixed(e.target.value)}
                    placeholder="e.g. 1250.00"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      Min Price (LKR / kg)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      placeholder="e.g. 1100.00"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      Max Price (LKR / kg)
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      placeholder="e.g. 1350.00"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 4: Timeline & Dates */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-5">
          <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold">
              4
            </span>
            Collection Timeline & Advertisement Expiry
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Collection Window Start <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={collectionStart}
                onChange={(e) => setCollectionStart(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Collection Window End <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={collectionEnd}
                onChange={(e) => setCollectionEnd(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Ad Expiration Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
              />
              <span className="text-[11px] text-zinc-500 block mt-1">
                Must be on or before collection window end.
              </span>
            </div>
          </div>
        </div>

        {/* Section 5: Logistics & Districts */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-5">
          <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold">
              5
            </span>
            Logistics & Eligible Districts
          </h2>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Pickup / Drop-off Location
            </label>
            <input
              type="text"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              placeholder="e.g. Nuwara Eliya Factory Gate or Colombo Port Depot"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-zinc-400">
                Eligible Districts ({selectedDistricts.length} selected)
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedDistricts([...SRI_LANKA_DISTRICTS])}
                  className="text-teal-400 hover:underline"
                >
                  Select All
                </button>
                <span className="text-zinc-600">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedDistricts([])}
                  className="text-zinc-400 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-3 rounded-xl bg-zinc-950 border border-zinc-800">
              {SRI_LANKA_DISTRICTS.map((district) => {
                const checked = selectedDistricts.includes(district);
                return (
                  <label
                    key={district}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      checked
                        ? "bg-teal-500/15 text-teal-300 font-medium"
                        : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDistrict(district)}
                      className="accent-teal-500 rounded"
                    />
                    {district}
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 6: Terms & Conditions */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-5">
          <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold">
              6
            </span>
            Commercial Terms & Conditions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Payment Timing
              </label>
              <input
                type="text"
                value={paymentTiming}
                onChange={(e) => setPaymentTiming(e.target.value)}
                placeholder="e.g. Cash upon quality verification, Within 7 business days"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Rejection Handling
              </label>
              <input
                type="text"
                value={rejectionHandling}
                onChange={(e) => setRejectionHandling(e.target.value)}
                placeholder="e.g. Returned at seller expense, Negotiated downgrade"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Packaging Specs (Optional)
              </label>
              <input
                type="text"
                value={packaging}
                onChange={(e) => setPackaging(e.target.value)}
                placeholder="e.g. Food-grade jute sacks, 50kg per bag"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Transport Responsibility (Optional)
              </label>
              <input
                type="text"
                value={transportResponsibility}
                onChange={(e) => setTransportResponsibility(e.target.value)}
                placeholder="e.g. Farmer delivers to depot, Exporter arranges pickup"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
              />
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
          <Link
            href="/exporter/ads"
            className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-semibold transition-all"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 text-sm font-bold shadow-lg shadow-teal-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "Creating Draft…" : "Save as Draft & Continue"}
          </button>
        </div>
      </form>
    </div>
  );
}
