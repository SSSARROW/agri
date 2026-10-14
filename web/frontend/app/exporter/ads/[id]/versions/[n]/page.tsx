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
} from "@/lib/adsApi";
import { fetchStandards, StandardData, VersionSummary } from "@/lib/standardsApi";
import { fetchExporterProfile, ExporterProfile } from "@/lib/exporterApi";

const ENABLE_AD_ACCEPTANCE = process.env.NEXT_PUBLIC_ENABLE_AD_ACCEPTANCE !== "false";

interface PageProps {
  params: Promise<{
    id: string;
    n: string;
  }>;
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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

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
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
        <p className="text-zinc-500 text-sm font-medium">Loading advertisement version…</p>
      </div>
    );
  }

  if (!ad || !version) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400 font-semibold">Advertisement version not found.</p>
        <Link href="/exporter/ads" className="mt-4 inline-block text-xs text-teal-400 underline">
          Back to Advertisements
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border text-sm font-medium shadow-2xl backdrop-blur-md transition-all ${
            toast.type === "success"
              ? "bg-emerald-950/90 text-emerald-200 border-emerald-700/50"
              : "bg-red-950/90 text-red-200 border-red-700/50"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Top Header */}
      <div className="pb-6 border-b border-zinc-800">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/exporter/ads"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            ← Back to Advertisements
          </Link>

          <div className="flex items-center gap-2">
            {ENABLE_AD_ACCEPTANCE && (
              <Link
                href={`/exporter/ads/${adId}/applicants`}
                className="px-3.5 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                <span>Applicants</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-teal-500/20 text-teal-300">👥</span>
              </Link>
            )}
            <button
              onClick={handleDuplicate}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-all"
            >
              Duplicate Ad
            </button>
            {!isAdClosed && (
              <button
                onClick={() => setShowCloseModal(true)}
                className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 text-xs font-medium transition-all"
              >
                Close Ad
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                {ad.crop}
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                {version.title?.en || "Buy Request Advertisement"}
              </h1>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Ad ID: <span className="font-mono text-zinc-500">{ad.id}</span>
            </p>
          </div>

          {/* Ad Status Badge */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Ad State:</span>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-semibold border capitalize ${
                ad.computed_status === "live"
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : ad.computed_status === "draft"
                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  : ad.computed_status === "closed"
                  ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                  : "bg-zinc-700/40 text-zinc-400 border-zinc-600/30"
              }`}
            >
              {ad.computed_status}
            </span>
          </div>
        </div>

        {/* Version Switcher Bar */}
        <div className="mt-6 flex items-center justify-between border-t border-zinc-800/80 pt-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-zinc-500 mr-1 font-medium">Versions:</span>
            {ad.versions
              .sort((a, b) => a.version_number - b.version_number)
              .map((v) => {
                const isSelected = v.version_number === versionNum;
                return (
                  <Link
                    key={v.version_number}
                    href={`/exporter/ads/${adId}/versions/${v.version_number}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      isSelected
                        ? "bg-zinc-800 text-teal-400 border border-teal-500/40 shadow-sm"
                        : "bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800"
                    }`}
                  >
                    <span>v{v.version_number}</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        v.status === "published" ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                    />
                    <span className="capitalize text-[10px] opacity-75">({v.status})</span>
                  </Link>
                );
              })}
          </div>

          {/* New Draft Button if on published version and no draft exists */}
          {!isAdClosed && !hasExistingDraft && (
            <button
              onClick={handleCreateNewDraft}
              disabled={creatingDraft}
              className="px-3.5 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-semibold transition-all"
            >
              {creatingDraft ? "Creating Draft…" : "+ New Draft Version"}
            </button>
          )}
        </div>
      </div>

      {/* State Alerts */}
      {isAdClosed && (
        <div className="mt-6 p-4 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs flex items-center gap-3">
          <span className="text-base">🚫</span>
          <div>
            <p className="font-semibold text-rose-200">Advertisement Closed</p>
            <p className="text-rose-400/90 mt-0.5">
              This advertisement is closed and cannot be updated. Reason:{" "}
              <span className="italic font-medium">{ad.closed_reason || "None specified"}</span>.
            </p>
          </div>
        </div>
      )}

      {isPublished && !isAdClosed && (
        <div className="mt-6 p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-base">🔒</span>
            <div>
              <p className="font-semibold text-emerald-200">
                Version {versionNum} is Published (Immutable)
              </p>
              <p className="text-emerald-400/90 mt-0.5">
                Published versions cannot be modified to ensure integrity for contracted farmers.
                To adjust terms, create a new draft version.
              </p>
            </div>
          </div>

          {!hasExistingDraft && (
            <button
              onClick={handleCreateNewDraft}
              disabled={creatingDraft}
              className="px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-bold transition-all shadow-md shrink-0"
            >
              Create New Draft
            </button>
          )}
        </div>
      )}

      {/* Form Area */}
      <div className="mt-6 space-y-8">
        {/* Section 1: Standard Linkage */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-5">
          <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold">
              1
            </span>
            Target Crop & Quality Standard
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">Crop</label>
              <input
                type="text"
                disabled
                value={ad.crop.toUpperCase()}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-zinc-400 text-sm font-semibold cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Linked Quality Standard {isReadOnly && "(Locked)"}
              </label>
              {isReadOnly ? (
                <div className="px-3.5 py-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-sm text-zinc-300">
                  {version.standard_name || "Quality Standard"} (v{version.standard_version_number})
                </div>
              ) : (
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
              Titles & Descriptions
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
                  disabled={isReadOnly}
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Description (English) <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={4}
                  disabled={isReadOnly}
                  value={descEn}
                  onChange={(e) => setDescEn(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          )}

          {langTab === "si" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Title (Sinhala)
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={titleSi}
                  onChange={(e) => setTitleSi(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Description (Sinhala)
                </label>
                <textarea
                  rows={4}
                  disabled={isReadOnly}
                  value={descSi}
                  onChange={(e) => setDescSi(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          )}

          {langTab === "ta" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Title (Tamil)
                </label>
                <input
                  type="text"
                  disabled={isReadOnly}
                  value={titleTa}
                  onChange={(e) => setTitleTa(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Description (Tamil)
                </label>
                <textarea
                  rows={4}
                  disabled={isReadOnly}
                  value={descTa}
                  onChange={(e) => setDescTa(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
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
                disabled={isReadOnly}
                min="1"
                step="any"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Grade / Tier Specification
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={gradeTier}
                onChange={(e) => setGradeTier(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800/80">
            <label className="block text-xs font-semibold text-zinc-400 mb-2">
              Pricing Structure
            </label>
            {!isReadOnly && (
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="priceType"
                    value="fixed"
                    checked={priceType === "fixed"}
                    onChange={() => setPriceType("fixed")}
                    className="accent-teal-500"
                  />
                  Fixed Price
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
                  Price Range
                </label>
              </div>
            )}

            <div>
              {priceType === "fixed" ? (
                <div className="max-w-xs">
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Fixed Price (LKR per kg)
                  </label>
                  <input
                    type="number"
                    disabled={isReadOnly}
                    min="1"
                    step="0.01"
                    value={priceFixed}
                    onChange={(e) => setPriceFixed(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
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
                      disabled={isReadOnly}
                      min="1"
                      step="0.01"
                      value={priceMin}
                      onChange={(e) => setPriceMin(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                      Max Price (LKR / kg)
                    </label>
                    <input
                      type="number"
                      disabled={isReadOnly}
                      min="1"
                      step="0.01"
                      value={priceMax}
                      onChange={(e) => setPriceMax(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
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
            Collection Timeline & Expiry
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Collection Window Start
              </label>
              <input
                type="date"
                disabled={isReadOnly}
                value={collectionStart}
                onChange={(e) => setCollectionStart(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Collection Window End
              </label>
              <input
                type="date"
                disabled={isReadOnly}
                value={collectionEnd}
                onChange={(e) => setCollectionEnd(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Advertisement Expiry Date
              </label>
              <input
                type="date"
                disabled={isReadOnly}
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
              />
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
              disabled={isReadOnly}
              value={pickupLocation}
              onChange={(e) => setPickupLocation(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-zinc-400">
                Eligible Districts ({selectedDistricts.length} selected)
              </label>
              {!isReadOnly && (
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
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-3 rounded-xl bg-zinc-950 border border-zinc-800">
              {SRI_LANKA_DISTRICTS.map((district) => {
                const checked = selectedDistricts.includes(district);
                return (
                  <label
                    key={district}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      checked
                        ? "bg-teal-500/15 text-teal-300 font-medium"
                        : "text-zinc-400"
                    } ${isReadOnly ? "cursor-not-allowed opacity-75" : "cursor-pointer hover:bg-zinc-900"}`}
                  >
                    <input
                      type="checkbox"
                      disabled={isReadOnly}
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

        {/* Section 6: Terms */}
        <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-5">
          <h2 className="text-base font-semibold text-zinc-200 flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center text-xs font-bold">
              6
            </span>
            Commercial Terms
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Payment Timing
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={paymentTiming}
                onChange={(e) => setPaymentTiming(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Rejection Handling
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={rejectionHandling}
                onChange={(e) => setRejectionHandling(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Packaging
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={packaging}
                onChange={(e) => setPackaging(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Transport Responsibility
              </label>
              <input
                type="text"
                disabled={isReadOnly}
                value={transportResponsibility}
                onChange={(e) => setTransportResponsibility(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50 disabled:bg-zinc-950/60 disabled:cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions (Only visible in draft mode) */}
        {!isReadOnly && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saving || publishing}
              className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold transition-all disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Draft"}
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={saving || publishing}
              className="px-6 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 text-sm font-bold shadow-lg shadow-teal-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {publishing ? "Publishing…" : "Publish Version"}
            </button>
          </div>
        )}
      </div>

      {/* Close Modal */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-100">Close Advertisement</h3>
            <p className="mt-2 text-sm text-zinc-400">
              Closing this advertisement marks it as closed immediately. Farmers will no longer see it as active.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Closure Reason
              </label>
              <textarea
                rows={3}
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-rose-500/50"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCloseAd}
                disabled={closing}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
              >
                {closing ? "Closing…" : "Confirm Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
