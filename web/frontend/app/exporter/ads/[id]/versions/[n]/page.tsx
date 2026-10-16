"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchAd,
  fetchAdVersion,
  updateDraftAdVersion,
  publishAdVersion,
  createNewDraftAdVersion,
  closeAd,
  duplicateAd,
  SRI_LANKA_DISTRICTS,
  AdDetail,
  AdVersionDetail,
  AdVersionUpdatePayload,
  fetchAdStats,
  AdStats,
} from "@/lib/adsApi";
import { fetchStandards, StandardData, VersionSummary } from "@/lib/standardsApi";
import { fetchExporterProfile, ExporterProfile } from "@/lib/exporterApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { SectionSpinner } from "@/components/ui/spinner";
import { Toast, ToastState } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { ChevronRightIcon, UsersIcon } from "@/components/ui/icons";

const ENABLE_AD_STATS = process.env.NEXT_PUBLIC_ENABLE_AD_STATS !== "false";
const ENABLE_AD_ACCEPTANCE = process.env.NEXT_PUBLIC_ENABLE_AD_ACCEPTANCE !== "false";

interface PageProps {
  params: Promise<{
    id: string;
    n: string;
  }>;
}

function SectionNumber({ n }: { n: number }) {
  return (
    <span className="w-6 h-6 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">
      {n}
    </span>
  );
}

function ChartIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 3v18h18M7 16v-4m5 4V8m5 8v-6" />
    </svg>
  );
}

export default function AdVersionEditorPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const adId = resolvedParams.id;
  const versionNum = parseInt(resolvedParams.n, 10);

  // Data State
  const [ad, setAd] = useState<AdDetail | null>(null);
  const [version, setVersion] = useState<AdVersionDetail | null>(null);
  const [standards, setStandards] = useState<StandardData[]>([]);
  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [stats, setStats] = useState<AdStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  // Form Fields (editable when version is draft)
  const [selectedStandardVersionId, setSelectedStandardVersionId] = useState<string>("");
  const [titleEn, setTitleEn] = useState<string>("");
  const [titleSi, setTitleSi] = useState<string>("");
  const [titleTa, setTitleTa] = useState<string>("");

  const [descEn, setDescEn] = useState<string>("");
  const [descSi, setDescSi] = useState<string>("");
  const [descTa, setDescTa] = useState<string>("");

  const [langTab, setLangTab] = useState<"en" | "si" | "ta">("en");

  const [gradeTier, setGradeTier] = useState<string>("");
  const [quantityKg, setQuantityKg] = useState<number | string>("");

  const [priceType, setPriceType] = useState<"fixed" | "range">("fixed");
  const [priceFixed, setPriceFixed] = useState<number | string>("");
  const [priceMin, setPriceMin] = useState<number | string>("");
  const [priceMax, setPriceMax] = useState<number | string>("");

  const [collectionStart, setCollectionStart] = useState<string>("");
  const [collectionEnd, setCollectionEnd] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  const [pickupLocation, setPickupLocation] = useState<string>("");
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);

  const [paymentTiming, setPaymentTiming] = useState<string>("");
  const [rejectionHandling, setRejectionHandling] = useState<string>("");
  const [packaging, setPackaging] = useState<string>("");
  const [transportResponsibility, setTransportResponsibility] = useState<string>("");

  // Close Modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] = useState("Sourcing quota fulfilled");
  const [closing, setClosing] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (isNaN(versionNum)) {
        router.replace(`/exporter/ads/${adId}`);
        return;
      }

      const [adData, verData, profData] = await Promise.all([
        fetchAd(adId),
        fetchAdVersion(adId, versionNum),
        fetchExporterProfile().catch(() => null),
      ]);

      setAd(adData);
      setVersion(verData);
      if (profData) setProfile(profData);

      // Populate form
      setSelectedStandardVersionId(verData.standard_version_id || "");
      setTitleEn(verData.title?.en || "");
      setTitleSi(verData.title?.si || "");
      setTitleTa(verData.title?.ta || "");

      setDescEn(verData.description?.en || "");
      setDescSi(verData.description?.si || "");
      setDescTa(verData.description?.ta || "");

      setGradeTier(verData.grade_tier || "");
      setQuantityKg(verData.quantity_kg || "");

      setPriceType(verData.price_type || "fixed");
      setPriceFixed(verData.price_fixed ?? "");
      setPriceMin(verData.price_min ?? "");
      setPriceMax(verData.price_max ?? "");

      const toDateInput = (iso?: string | null) =>
        iso ? new Date(iso).toISOString().split("T")[0] : "";
      setCollectionStart(toDateInput(verData.collection_window_start));
      setCollectionEnd(toDateInput(verData.collection_window_end));
      setExpiresAt(toDateInput(verData.expires_at));

      setPickupLocation(verData.pickup_location || "");
      setSelectedDistricts(verData.eligible_districts || []);

      setPaymentTiming(verData.terms?.payment_timing || "");
      setRejectionHandling(verData.terms?.rejection_handling || "");
      setPackaging(verData.terms?.packaging || "");
      setTransportResponsibility(verData.terms?.transport_responsibility || "");

      // Fetch standards for crop
      if (adData.crop) {
        const stdRes = await fetchStandards({ crop: adData.crop, is_archived: false, page_size: 50 });
        setStandards(stdRes.items);
      }

      if (ENABLE_AD_STATS && adData.computed_status !== "draft") {
        try {
          const s = await fetchAdStats(adId);
          setStats(s);
        } catch {
          // stats failure is non-fatal
        }
      }
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to load advertisement data.", "error");
    } finally {
      setLoading(false);
    }
  }, [adId, versionNum]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isPublished = version?.status === "published";
  const isAdClosed = ad?.status === "closed";
  const isReadOnly = isPublished || isAdClosed;

  // Check if there is already a draft version on this ad
  const hasExistingDraft = ad?.versions.some((v) => v.status === "draft");

  const publishedStandardOptions = standards.flatMap((std) =>
    (std.versions || [])
      .filter((v: VersionSummary) => v.status === "published")
      .map((v: VersionSummary) => ({
        versionId: v.id,
        label: `${v.name || "Standard"} (v${v.version_number})`,
      }))
  );

  const toggleDistrict = (district: string) => {
    if (isReadOnly) return;
    setSelectedDistricts((prev) =>
      prev.includes(district) ? prev.filter((d) => d !== district) : [...prev, district]
    );
  };

  const handleSaveDraft = async () => {
    if (isReadOnly) return;
    setSaving(true);
    try {
      const payload: AdVersionUpdatePayload = {
        standard_version_id: selectedStandardVersionId || undefined,
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
        quantity_kg: quantityKg ? Number(quantityKg) : undefined,
        price_type: priceType,
        price_fixed: priceType === "fixed" ? Number(priceFixed) || undefined : undefined,
        price_min: priceType === "range" ? Number(priceMin) || undefined : undefined,
        price_max: priceType === "range" ? Number(priceMax) || undefined : undefined,
        collection_window_start: collectionStart ? new Date(collectionStart).toISOString() : undefined,
        collection_window_end: collectionEnd ? new Date(collectionEnd).toISOString() : undefined,
        pickup_location: pickupLocation.trim() || undefined,
        eligible_districts: selectedDistricts,
        terms: {
          payment_timing: paymentTiming.trim() || undefined,
          rejection_handling: rejectionHandling.trim() || undefined,
          packaging: packaging.trim() || undefined,
          transport_responsibility: transportResponsibility.trim() || undefined,
        },
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      };

      const updated = await updateDraftAdVersion(adId, versionNum, payload);
      setVersion(updated);
      showToast("Draft changes saved successfully.");
      // Refresh ad summary
      const freshAd = await fetchAd(adId);
      setAd(freshAd);
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to save draft.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (isReadOnly) return;
    if (profile && profile.status !== "verified") {
      showToast("Publishing requires a verified exporter profile.", "error");
      return;
    }

    setPublishing(true);
    try {
      // First save draft changes
      await handleSaveDraft();
      // Now publish
      const published = await publishAdVersion(adId, versionNum);
      setVersion(published);
      const freshAd = await fetchAd(adId);
      setAd(freshAd);
      showToast(`Version ${versionNum} published! It is now live to farmers.`);
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to publish version.", "error");
    } finally {
      setPublishing(false);
    }
  };

  const handleCreateNewDraft = async () => {
    setCreatingDraft(true);
    try {
      const newDraft = await createNewDraftAdVersion(adId);
      showToast(`Created new draft v${newDraft.version_number}`);
      router.push(`/exporter/ads/${adId}/versions/${newDraft.version_number}`);
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to create new draft.", "error");
      setCreatingDraft(false);
    }
  };

  const handleCloseAd = async () => {
    setClosing(true);
    try {
      const closed = await closeAd(adId, closeReason);
      setAd(closed);
      setShowCloseModal(false);
      showToast("Advertisement closed.");
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to close ad.", "error");
    } finally {
      setClosing(false);
    }
  };

  const handleDuplicate = async () => {
    try {
      const dup = await duplicateAd(adId);
      showToast("Duplicated advertisement as draft.");
      router.push(`/exporter/ads/${dup.id}/versions/1`);
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to duplicate.", "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <SectionSpinner />
        <p className="text-ink-500 text-sm font-medium">Loading advertisement version…</p>
      </div>
    );
  }

  if (!ad || !version) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center">
        <p className="text-danger font-semibold">Advertisement version not found.</p>
        <Link href="/exporter/ads" className="mt-4 inline-block text-xs text-brand-700 font-semibold underline">
          Back to Advertisements
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <Toast toast={toast} />

      {/* Top Header */}
      <div className="pb-6 border-b border-border mb-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/exporter/ads"
            className="text-xs font-semibold text-ink-500 hover:text-ink-900 inline-flex items-center gap-1 transition-colors"
          >
            <ChevronRightIcon className="w-3.5 h-3.5 rotate-180" /> Back to Advertisements
          </Link>

          <div className="flex items-center gap-2">
            {ENABLE_AD_ACCEPTANCE && (
              <Button href={`/exporter/ads/${adId}/applicants`} variant="secondary" size="sm">
                <UsersIcon className="w-3.5 h-3.5" />
                Applicants
                {ENABLE_AD_STATS && stats && stats.pending_count > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-brand-700 text-white text-[10px] font-black flex items-center justify-center">
                    {stats.pending_count}
                  </span>
                )}
              </Button>
            )}
            <Button onClick={handleDuplicate} variant="secondary" size="sm">
              Duplicate Ad
            </Button>
            {!isAdClosed && (
              <Button onClick={() => setShowCloseModal(true)} variant="danger" size="sm">
                Close Ad
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider bg-paper-sunken text-ink-700 border border-border">
                {ad.crop}
              </span>
              <h1 className="font-display text-2xl font-semibold text-ink-900">
                {version.title?.en || "Buy Request Advertisement"}
              </h1>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Ad ID: <span className="font-mono text-ink-400">{ad.id}</span>
            </p>
          </div>

          {/* Ad Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500">Ad State:</span>
            <StatusBadge status={ad.computed_status} />
          </div>
        </div>

        {/* Version Switcher Bar */}
        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-ink-500 mr-1 font-medium">Versions:</span>
            {ad.versions
              .sort((a, b) => a.version_number - b.version_number)
              .map((v) => {
                const isSelected = v.version_number === versionNum;
                return (
                  <Link
                    key={v.version_number}
                    href={`/exporter/ads/${adId}/versions/${v.version_number}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      isSelected
                        ? "bg-brand-50 text-brand-700 border border-brand-200"
                        : "bg-paper-sunken text-ink-500 hover:text-ink-900 border border-border"
                    }`}
                  >
                    <span>v{v.version_number}</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        v.status === "published" ? "bg-success" : "bg-warning"
                      }`}
                    />
                    <span className="capitalize text-[10px] opacity-75">({v.status})</span>
                  </Link>
                );
              })}
          </div>

          {/* New Draft Button if on published version and no draft exists */}
          {!isAdClosed && !hasExistingDraft && (
            <Button onClick={handleCreateNewDraft} disabled={creatingDraft} variant="secondary" size="sm">
              {creatingDraft ? "Creating Draft…" : "+ New Draft Version"}
            </Button>
          )}
        </div>
      </div>

      {/* State Alerts */}
      <div className="space-y-4 mb-6">
        {ENABLE_AD_STATS && isAdClosed && ad.closed_reason?.startsWith("taken_down:") && (
          <Alert tone="danger" title="This ad was removed by an administrator">
            Reason:{" "}
            <span className="italic font-medium">
              {ad.closed_reason.replace("taken_down: ", "")}
            </span>
            <br />
            Close, new-version, and publish actions are disabled. Contact support if
            you believe this is an error.
          </Alert>
        )}

        {isAdClosed && (
          <Alert tone="danger" title="Advertisement closed">
            This advertisement is closed and cannot be updated. Reason:{" "}
            <span className="italic font-medium">{ad.closed_reason || "None specified"}</span>.
          </Alert>
        )}

        {isPublished && !isAdClosed && (
          <Alert
            tone="success"
            title={`Version ${versionNum} is published (immutable)`}
            action={
              !hasExistingDraft ? (
                <Button onClick={handleCreateNewDraft} disabled={creatingDraft} size="sm">
                  Create New Draft
                </Button>
              ) : undefined
            }
          >
            Published versions cannot be modified to ensure integrity for
            contracted farmers. To adjust terms, create a new draft version.
          </Alert>
        )}
      </div>

      {/* Stats card — shown for live/expired/closed published ads */}
      {ENABLE_AD_STATS && stats && (
        <Card className="mb-6 space-y-4">
          <h3 className="font-display text-sm font-semibold text-ink-900 flex items-center gap-2">
            <ChartIcon className="w-4 h-4 text-brand-700" />
            Ad Performance
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Views", value: stats.total_views },
              { label: "Unique Farmers", value: stats.unique_viewers },
              { label: "Accepts", value: stats.accepts.total },
              { label: "Accept Rate", value: `${stats.view_to_accept_rate.toFixed(1)}%` },
            ].map((s) => (
              <div key={s.label} className="bg-paper-sunken rounded-lg p-3 border border-border">
                <p className="text-[10px] text-ink-500 uppercase tracking-wider">{s.label}</p>
                <p className="text-lg font-display font-semibold text-ink-900 mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
          {/* Approved vs target progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-ink-500">
              <span>Approved quantity</span>
              <span>{stats.approved_quantity_kg.toFixed(0)} / {stats.target_quantity_kg.toFixed(0)} kg</span>
            </div>
            <div className="h-2 rounded-full bg-paper-sunken overflow-hidden border border-border">
              <div
                className="h-full rounded-full bg-brand-700 transition-all"
                style={{ width: `${Math.min(100, stats.filled_percentage)}%` }}
              />
            </div>
            <p className="text-[10px] text-ink-500">{stats.filled_percentage.toFixed(1)}% filled</p>
          </div>
        </Card>
      )}

      {/* Form Area */}
      <div className="space-y-6">
        {/* Section 1: Standard Linkage */}
        <Card className="space-y-5">
          <h2 className="font-display text-base font-semibold text-ink-900 flex items-center gap-2.5">
            <SectionNumber n={1} />
            Target Crop & Quality Standard
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Crop">
              <Input type="text" disabled value={ad.crop.toUpperCase()} className="font-semibold" />
            </Field>

            <Field label={`Linked Quality Standard ${isReadOnly ? "(Locked)" : ""}`}>
              {isReadOnly ? (
                <div className="px-3.5 py-2.5 rounded-lg bg-paper-sunken border border-border text-sm text-ink-700">
                  {version.standard_name || "Quality Standard"} (v{version.standard_version_number})
                </div>
              ) : (
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
              )}
            </Field>
          </div>
        </Card>

        {/* Section 2: Multilingual Content */}
        <Card className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-display text-base font-semibold text-ink-900 flex items-center gap-2.5">
              <SectionNumber n={2} />
              Titles & Descriptions
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
                  disabled={isReadOnly}
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                />
              </Field>
              <Field label="Description (English)" required>
                <Textarea
                  rows={4}
                  disabled={isReadOnly}
                  value={descEn}
                  onChange={(e) => setDescEn(e.target.value)}
                />
              </Field>
            </div>
          )}

          {langTab === "si" && (
            <div className="space-y-4">
              <Field label="Title (Sinhala)">
                <Input
                  type="text"
                  disabled={isReadOnly}
                  value={titleSi}
                  onChange={(e) => setTitleSi(e.target.value)}
                />
              </Field>
              <Field label="Description (Sinhala)">
                <Textarea
                  rows={4}
                  disabled={isReadOnly}
                  value={descSi}
                  onChange={(e) => setDescSi(e.target.value)}
                />
              </Field>
            </div>
          )}

          {langTab === "ta" && (
            <div className="space-y-4">
              <Field label="Title (Tamil)">
                <Input
                  type="text"
                  disabled={isReadOnly}
                  value={titleTa}
                  onChange={(e) => setTitleTa(e.target.value)}
                />
              </Field>
              <Field label="Description (Tamil)">
                <Textarea
                  rows={4}
                  disabled={isReadOnly}
                  value={descTa}
                  onChange={(e) => setDescTa(e.target.value)}
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
                disabled={isReadOnly}
                min="1"
                step="any"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
              />
            </Field>

            <Field label="Grade / Tier Specification">
              <Input
                type="text"
                disabled={isReadOnly}
                value={gradeTier}
                onChange={(e) => setGradeTier(e.target.value)}
              />
            </Field>
          </div>

          <div className="pt-4 border-t border-border">
            <label className="block text-xs font-semibold text-ink-700 mb-2">Pricing Structure</label>
            {!isReadOnly && (
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
                  <input
                    type="radio"
                    name="priceType"
                    value="fixed"
                    checked={priceType === "fixed"}
                    onChange={() => setPriceType("fixed")}
                    className="accent-brand-700"
                  />
                  Fixed Price
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
                  Price Range
                </label>
              </div>
            )}

            <div>
              {priceType === "fixed" ? (
                <div className="max-w-xs">
                  <Field label="Fixed Price (LKR per kg)">
                    <Input
                      type="number"
                      disabled={isReadOnly}
                      min="1"
                      step="0.01"
                      value={priceFixed}
                      onChange={(e) => setPriceFixed(e.target.value)}
                    />
                  </Field>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
                  <Field label="Min Price (LKR / kg)">
                    <Input
                      type="number"
                      disabled={isReadOnly}
                      min="1"
                      step="0.01"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                    />
                  </Field>
                  <Field label="Max Price (LKR / kg)">
                    <Input
                      type="number"
                      disabled={isReadOnly}
                      min="1"
                      step="0.01"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
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
            Collection Timeline & Expiry
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Field label="Collection Window Start">
              <Input
                type="date"
                disabled={isReadOnly}
                value={collectionStart}
                onChange={(e) => setCollectionStart(e.target.value)}
              />
            </Field>

            <Field label="Collection Window End">
              <Input
                type="date"
                disabled={isReadOnly}
                value={collectionEnd}
                onChange={(e) => setCollectionEnd(e.target.value)}
              />
            </Field>

            <Field label="Advertisement Expiry Date">
              <Input
                type="date"
                disabled={isReadOnly}
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
              disabled={isReadOnly}
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
            />
          </Field>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-ink-700">
                Eligible Districts ({selectedDistricts.length} selected)
              </label>
              {!isReadOnly && (
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
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-3 rounded-lg bg-paper-sunken border border-border">
              {SRI_LANKA_DISTRICTS.map((district) => {
                const checked = selectedDistricts.includes(district);
                return (
                  <label
                    key={district}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                      checked ? "bg-brand-50 text-brand-700 font-semibold" : "text-ink-500"
                    } ${isReadOnly ? "cursor-not-allowed opacity-75" : "cursor-pointer hover:bg-paper-raised"}`}
                  >
                    <input
                      type="checkbox"
                      disabled={isReadOnly}
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

        {/* Section 6: Terms */}
        <Card className="space-y-5">
          <h2 className="font-display text-base font-semibold text-ink-900 flex items-center gap-2.5">
            <SectionNumber n={6} />
            Commercial Terms
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Payment Timing">
              <Input
                type="text"
                disabled={isReadOnly}
                value={paymentTiming}
                onChange={(e) => setPaymentTiming(e.target.value)}
              />
            </Field>

            <Field label="Rejection Handling">
              <Input
                type="text"
                disabled={isReadOnly}
                value={rejectionHandling}
                onChange={(e) => setRejectionHandling(e.target.value)}
              />
            </Field>

            <Field label="Packaging">
              <Input
                type="text"
                disabled={isReadOnly}
                value={packaging}
                onChange={(e) => setPackaging(e.target.value)}
              />
            </Field>

            <Field label="Transport Responsibility">
              <Input
                type="text"
                disabled={isReadOnly}
                value={transportResponsibility}
                onChange={(e) => setTransportResponsibility(e.target.value)}
              />
            </Field>
          </div>
        </Card>

        {/* Footer Actions (Only visible in draft mode) */}
        {!isReadOnly && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={saving || publishing}
            >
              {saving ? "Saving…" : "Save Draft"}
            </Button>

            <Button type="button" onClick={handlePublish} disabled={saving || publishing}>
              {publishing ? "Publishing…" : "Publish Version"}
            </Button>
          </div>
        )}
      </div>

      {/* Close Modal */}
      <ConfirmModal
        open={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        onConfirm={handleCloseAd}
        title="Close Advertisement"
        confirmLabel="Confirm Close"
        confirmVariant="danger"
        loading={closing}
      >
        <p className="text-sm text-ink-700">
          Closing this advertisement marks it as closed immediately. Farmers
          will no longer see it as active.
        </p>
        <div className="mt-4">
          <Field label="Closure Reason">
            <Textarea rows={3} value={closeReason} onChange={(e) => setCloseReason(e.target.value)} />
          </Field>
        </div>
      </ConfirmModal>
    </div>
  );
}
