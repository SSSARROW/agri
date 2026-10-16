"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAd, SRI_LANKA_DISTRICTS, AdCreatePayload } from "@/lib/adsApi";
import { fetchStandards, StandardData, VersionSummary } from "@/lib/standardsApi";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ChevronRightIcon } from "@/components/ui/icons";

function SectionNumber({ n }: { n: number }) {
  return (
    <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
      {n}
    </span>
  );
}

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
    <div className="max-w-5xl mx-auto">
      <div className="mb-2">
        <Link
          href="/exporter/ads"
          className="text-xs font-semibold text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 transition-colors"
        >
          <ChevronRightIcon className="w-3.5 h-3.5 rotate-180" /> Back to Advertisements
        </Link>
      </div>

      <PageHeader
        title="Create Buy Request Advertisement"
        subtitle="Step 1: Set crop and bind to an approved quality standard, then configure pricing and schedule."
      />

      {errorMessage && (
        <div className="mb-6">
          <Alert tone="danger" title="Validation error">
            {errorMessage}
          </Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Crop & Standard Linkage */}
        <Card className="space-y-5">
          <h2 className="font-display text-base font-semibold text-ink-900 flex items-center gap-2.5">
            <SectionNumber n={1} />
            Target Crop & Quality Standard
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Crop Type" required>
              <Select value={crop} onChange={(e) => setCrop(e.target.value)}>
                <option value="tea">Tea</option>
                <option value="cinnamon">Cinnamon</option>
              </Select>
            </Field>

            <Field label="Linked Quality Standard (Published)" required>
              {standardsLoading ? (
                <div className="px-3.5 py-2.5 rounded-lg bg-paper-sunken border border-border text-xs text-ink-500">
                  Loading standards…
                </div>
              ) : publishedStandardOptions.length > 0 ? (
                <Select
                  value={selectedStandardVersionId}
                  onChange={(e) => setSelectedStandardVersionId(e.target.value)}
                >
                  {publishedStandardOptions.map((opt) => (
                    <option key={opt.versionId} value={opt.versionId}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="p-3 rounded-lg bg-warning-bg border border-warning-border text-warning text-xs">
                  No published standards found for {crop}.{" "}
                  <Link
                    href="/exporter/standards"
                    className="underline font-semibold"
                    target="_blank"
                  >
                    Publish a standard first →
                  </Link>
                </div>
              )}
            </Field>
          </div>
        </Card>

        {/* Section 2: Multilingual Content */}
        <Card className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-display text-base font-semibold text-ink-900 flex items-center gap-2.5">
              <SectionNumber n={2} />
              Advertisement Title & Description
            </h2>

            {/* Language Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-paper-sunken border border-border text-xs">
              {[
                { id: "en", label: "English *" },
                { id: "si", label: "සිංහල" },
                { id: "ta", label: "தமிழ்" },
              ].map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setLangTab(t.id as any)}
                  className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                    langTab === t.id
                      ? "bg-paper-raised text-brand-700 shadow-sm"
                      : "text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {langTab === "en" && (
            <div className="space-y-4">
              <Field label="Title (English)" required>
                <Input
                  type="text"
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="e.g. Sourcing 5,000kg Pure BOPF High Grown Tea"
                />
              </Field>
              <Field label="Description & Specifications (English)" required>
                <Textarea
                  rows={4}
                  value={descEn}
                  onChange={(e) => setDescEn(e.target.value)}
                  placeholder="Describe your purchase requirements, quality expectations, packaging and collection details..."
                />
              </Field>
            </div>
          )}

          {langTab === "si" && (
            <div className="space-y-4">
              <Field label="Title (Sinhala - විකල්ප)">
                <Input
                  type="text"
                  value={titleSi}
                  onChange={(e) => setTitleSi(e.target.value)}
                  placeholder="උදා: උසස් තත්ත්වයේ තේ මිලදී ගැනීමේ දැන්වීම..."
                />
              </Field>
              <Field label="Description (Sinhala - විකල්ප)">
                <Textarea
                  rows={4}
                  value={descSi}
                  onChange={(e) => setDescSi(e.target.value)}
                  placeholder="ගොවීන් සඳහා විස්තරය..."
                />
              </Field>
            </div>
          )}

          {langTab === "ta" && (
            <div className="space-y-4">
              <Field label="Title (Tamil - விருப்பத்தேர்வு)">
                <Input
                  type="text"
                  value={titleTa}
                  onChange={(e) => setTitleTa(e.target.value)}
                  placeholder="உதாரணம்: தரமான தேயிலை கொள்முதல் விளம்பரம்..."
                />
              </Field>
              <Field label="Description (Tamil - விருப்பத்தேர்வு)">
                <Textarea
                  rows={4}
                  value={descTa}
                  onChange={(e) => setDescTa(e.target.value)}
                  placeholder="விவசாயிகளுக்கான கொள்முதல் விவரங்கள்..."
                />
              </Field>
            </div>
          )}
        </Card>

        {/* Section 3: Quantity, Grade & Pricing */}
        <Card className="space-y-5">
          <h2 className="font-display text-base font-semibold text-ink-900 flex items-center gap-2.5">
            <SectionNumber n={3} />
            Volume, Grade & Pricing
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Target Quantity (kg)" required>
              <Input
                type="number"
                min="1"
                step="any"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                placeholder="e.g. 5000"
              />
            </Field>

            <Field label="Grade / Tier Specification">
              <Input
                type="text"
                value={gradeTier}
                onChange={(e) => setGradeTier(e.target.value)}
                placeholder="e.g. BOPF, BOP, Alba, C5 Special"
              />
            </Field>
          </div>

          {/* Pricing Mode */}
          <div className="pt-4 border-t border-border">
            <label className="block text-xs font-semibold text-ink-700 mb-2">
              Pricing Structure <span className="text-danger ml-0.5">*</span>
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
                <input
                  type="radio"
                  name="priceType"
                  value="fixed"
                  checked={priceType === "fixed"}
                  onChange={() => setPriceType("fixed")}
                  className="accent-brand-700"
                />
                Fixed Price (LKR / kg)
              </label>
              <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
                <input
                  type="radio"
                  name="priceType"
                  value="range"
                  checked={priceType === "range"}
                  onChange={() => setPriceType("range")}
                  className="accent-brand-700"
                />
                Price Range (Min – Max LKR / kg)
              </label>
            </div>

            <div className="mt-4">
              {priceType === "fixed" ? (
                <div className="max-w-xs">
                  <Field label="Fixed Price (LKR per kg)">
                    <Input
                      type="number"
                      min="1"
                      step="0.01"
                      value={priceFixed}
                      onChange={(e) => setPriceFixed(e.target.value)}
                      placeholder="e.g. 1250.00"
                    />
                  </Field>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
                  <Field label="Min Price (LKR / kg)">
                    <Input
                      type="number"
                      min="1"
                      step="0.01"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      placeholder="e.g. 1100.00"
                    />
                  </Field>
                  <Field label="Max Price (LKR / kg)">
                    <Input
                      type="number"
                      min="1"
                      step="0.01"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      placeholder="e.g. 1350.00"
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Section 4: Timeline & Dates */}
        <Card className="space-y-5">
          <h2 className="font-display text-base font-semibold text-ink-900 flex items-center gap-2.5">
            <SectionNumber n={4} />
            Collection Timeline & Advertisement Expiry
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Field label="Collection Window Start" required>
              <Input
                type="date"
                value={collectionStart}
                onChange={(e) => setCollectionStart(e.target.value)}
              />
            </Field>

            <Field label="Collection Window End" required>
              <Input
                type="date"
                value={collectionEnd}
                onChange={(e) => setCollectionEnd(e.target.value)}
              />
            </Field>

            <Field label="Ad Expiration Date" required hint="Must be on or before collection window end.">
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </Field>
          </div>
        </Card>

        {/* Section 5: Logistics & Districts */}
        <Card className="space-y-5">
          <h2 className="font-display text-base font-semibold text-ink-900 flex items-center gap-2.5">
            <SectionNumber n={5} />
            Logistics & Eligible Districts
          </h2>

          <Field label="Pickup / Drop-off Location">
            <Input
              type="text"
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              placeholder="e.g. Nuwara Eliya Factory Gate or Colombo Port Depot"
            />
          </Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-ink-700">
                Eligible Districts ({selectedDistricts.length} selected)
              </label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedDistricts([...SRI_LANKA_DISTRICTS])}
                  className="text-brand-700 font-semibold hover:underline"
                >
                  Select All
                </button>
                <span className="text-ink-300">|</span>
                <button
                  type="button"
                  onClick={() => setSelectedDistricts([])}
                  className="text-ink-500 font-semibold hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-3 rounded-lg bg-paper-sunken border border-border">
              {SRI_LANKA_DISTRICTS.map((district) => {
                const checked = selectedDistricts.includes(district);
                return (
                  <label
                    key={district}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-colors ${
                      checked
                        ? "bg-brand-50 text-brand-700 font-semibold"
                        : "text-ink-500 hover:bg-paper-raised hover:text-ink-900"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDistrict(district)}
                      className="accent-brand-700 rounded"
                    />
                    {district}
                  </label>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Section 6: Terms & Conditions */}
        <Card className="space-y-5">
          <h2 className="font-display text-base font-semibold text-ink-900 flex items-center gap-2.5">
            <SectionNumber n={6} />
            Commercial Terms & Conditions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Payment Timing">
              <Input
                type="text"
                value={paymentTiming}
                onChange={(e) => setPaymentTiming(e.target.value)}
                placeholder="e.g. Cash upon quality verification, Within 7 business days"
              />
            </Field>

            <Field label="Rejection Handling">
              <Input
                type="text"
                value={rejectionHandling}
                onChange={(e) => setRejectionHandling(e.target.value)}
                placeholder="e.g. Returned at seller expense, Negotiated downgrade"
              />
            </Field>

            <Field label="Packaging Specs (Optional)">
              <Input
                type="text"
                value={packaging}
                onChange={(e) => setPackaging(e.target.value)}
                placeholder="e.g. Food-grade jute sacks, 50kg per bag"
              />
            </Field>

            <Field label="Transport Responsibility (Optional)">
              <Input
                type="text"
                value={transportResponsibility}
                onChange={(e) => setTransportResponsibility(e.target.value)}
                placeholder="e.g. Farmer delivers to depot, Exporter arranges pickup"
              />
            </Field>
          </div>
        </Card>

        {/* Action Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button href="/exporter/ads" variant="secondary">
            Cancel
          </Button>

          <Button type="submit" disabled={saving}>
            {saving ? "Creating Draft…" : "Save as Draft & Continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}
