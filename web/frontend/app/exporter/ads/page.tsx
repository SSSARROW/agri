"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchAds,
  closeAd,
  duplicateAd,
  AdListItem,
} from "@/lib/adsApi";
import { fetchExporterProfile, ExporterProfile } from "@/lib/exporterApi";

export default function ExporterAdsListPage() {
  const router = useRouter();

  const [ads, setAds] = useState<AdListItem[]>([]);
  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Filters & Pagination
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [cropFilter, setCropFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Close Modal State
  const [closingAd, setClosingAd] = useState<AdListItem | null>(null);
  const [closeReason, setCloseReason] = useState<string>("Sourcing quota fulfilled");
  const [closing, setClosing] = useState<boolean>(false);

  // Duplicating State
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadAdsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [adsRes, profRes] = await Promise.all([
        fetchAds({
          crop: cropFilter || undefined,
          status: statusFilter || undefined,
          search: searchQuery || undefined,
          page,
          page_size: 9,
        }),
        fetchExporterProfile().catch(() => null),
      ]);
      setAds(adsRes.items);
      setTotalPages(adsRes.total_pages);
      setTotalItems(adsRes.total);
      if (profRes) setProfile(profRes);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load advertisements.");
    } finally {
      setLoading(false);
    }
  }, [cropFilter, statusFilter, searchQuery, page]);

  useEffect(() => {
    loadAdsData();
  }, [loadAdsData]);

  const handleCloseAd = async () => {
    if (!closingAd) return;
    setClosing(true);
    try {
      await closeAd(closingAd.id, closeReason);
      showToast("Advertisement closed successfully.");
      setClosingAd(null);
      loadAdsData();
    } catch (err: any) {
      showToast(err.detail || "Failed to close advertisement.", "error");
    } finally {
      setClosing(false);
    }
  };

  const handleDuplicateAd = async (ad: AdListItem) => {
    setDuplicatingId(ad.id);
    try {
      const dup = await duplicateAd(ad.id);
      showToast("Advertisement duplicated as draft.");
      router.push(`/exporter/ads/${dup.id}/versions/1`);
    } catch (err: any) {
      showToast(err.detail || "Failed to duplicate advertisement.", "error");
    } finally {
      setDuplicatingId(null);
    }
  };

  const getStatusBadge = (status: AdListItem["computed_status"]) => {
    switch (status) {
      case "live":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        );
      case "draft":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Draft
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-700/40 text-zinc-400 border border-zinc-600/30">
            Expired
          </span>
        );
      case "closed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            Closed
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
              Advertisements
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
              Buy Requests
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Publish harvest purchase requests bound to your approved quality standards.
          </p>
        </div>

        <Link
          href="/exporter/ads/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold text-sm shadow-lg shadow-teal-500/15 transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="text-lg leading-none">+</span>
          Create Advertisement
        </Link>
      </div>

      {/* Unverified Exporter Warning Banner */}
      {profile && profile.status !== "verified" && (
        <div className="mt-6 p-4 rounded-xl bg-amber-950/40 border border-amber-600/30 text-amber-200 text-sm flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold text-amber-100">
              Account Verification Pending
            </p>
            <p className="text-amber-300/90 text-xs mt-0.5">
              You can draft advertisements, but publishing them to farmers requires a verified exporter profile. Your profile is currently <span className="font-semibold capitalize">{profile.status}</span>.
            </p>
          </div>
        </div>
      )}

      {/* Filters & Search */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        {/* Search */}
        <div className="md:col-span-5 relative">
          <input
            type="text"
            placeholder="Search by title, location or crop..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-500 text-sm focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50"
          />
        </div>

        {/* Crop Filter */}
        <div className="md:col-span-3">
          <select
            value={cropFilter}
            onChange={(e) => {
              setCropFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-teal-500/50"
          >
            <option value="">All Crops</option>
            <option value="tea">Tea</option>
            <option value="cinnamon">Cinnamon</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="md:col-span-4 flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
          {[
            { id: "", label: "All" },
            { id: "live", label: "Live" },
            { id: "draft", label: "Draft" },
            { id: "expired", label: "Expired" },
            { id: "closed", label: "Closed" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === tab.id
                  ? "bg-zinc-800 text-teal-400 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
          <p className="text-zinc-500 text-sm font-medium">Loading advertisements…</p>
        </div>
      ) : error ? (
        <div className="my-12 p-6 rounded-2xl bg-red-950/30 border border-red-900/50 text-center">
          <p className="text-red-300 font-semibold mb-2">Error Loading Ads</p>
          <p className="text-zinc-400 text-sm mb-4">{error}</p>
          <button
            onClick={loadAdsData}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-all"
          >
            Retry
          </button>
        </div>
      ) : ads.length === 0 ? (
        <div className="my-12 p-12 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center text-3xl mb-4">
            📢
          </div>
          <h3 className="text-lg font-semibold text-zinc-200 mb-1">
            No Advertisements Found
          </h3>
          <p className="text-sm text-zinc-400 max-w-md mb-6">
            {searchQuery || cropFilter || statusFilter
              ? "No advertisements match your current filter settings. Try resetting filters."
              : "You have not created any purchase request advertisements yet. Create one to publish your harvest sourcing requirements to farmers."}
          </p>
          <Link
            href="/exporter/ads/new"
            className="px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 text-sm font-semibold transition-all"
          >
            Create Your First Advertisement
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ads.map((ad) => {
            const versionNum = ad.latest_version_number || (ad as any).current_version_number || 1;
            const titleText = ad.latest_title?.en || (ad as any).title?.en || "Untitled Buy Request";
            const targetQty = ad.latest_quantity_kg ?? (ad as any).quantity_kg ?? 0;

            const priceDisplay =
              ad.latest_price_type === "fixed"
                ? `LKR ${Number(ad.latest_price_fixed || 0).toLocaleString()} / kg`
                : `LKR ${Number(ad.latest_price_min || 0).toLocaleString()} – ${Number(
                    ad.latest_price_max || 0
                  ).toLocaleString()} / kg`;

            const expiryDate = ad.latest_expires_at
              ? new Date(ad.latest_expires_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "N/A";

            return (
              <div
                key={ad.id}
                className="group relative flex flex-col justify-between rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700/80 transition-all duration-200 p-5 hover:shadow-xl hover:shadow-teal-950/20"
              >
                <div>
                  {/* Top Bar: Crop + Status + Version */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                        {ad.crop}
                      </span>
                      <span className="text-xs font-mono text-zinc-500">
                        v{versionNum}
                      </span>
                    </div>
                    {getStatusBadge(ad.computed_status)}
                  </div>

                  {/* Title */}
                  <Link
                    href={`/exporter/ads/${ad.id}/versions/${versionNum}`}
                    className="block group-hover:text-teal-400 transition-colors"
                  >
                    <h3 className="text-base font-semibold text-zinc-100 line-clamp-1">
                      {titleText}
                    </h3>
                  </Link>

                  {/* Standard reference */}
                  <p className="mt-1 text-xs text-zinc-400 flex items-center gap-1">
                    <span className="text-zinc-500">Standard:</span>
                    <span className="truncate font-medium text-zinc-300">
                      {ad.latest_standard_name || "Custom Standard"}
                    </span>
                  </p>

                  {/* Key Metrics */}
                  <div className="mt-4 pt-3 border-t border-zinc-800/80 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-zinc-500 block">Target Qty</span>
                      <span className="font-semibold text-zinc-200">
                        {Number(targetQty).toLocaleString()} kg
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Pricing</span>
                      <span className="font-semibold text-teal-300">
                        {priceDisplay}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Expires</span>
                      <span className="font-medium text-zinc-300">
                        {expiryDate}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Window</span>
                      <span className="font-medium text-zinc-300">
                        {ad.latest_collection_start
                          ? new Date(ad.latest_collection_start).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                          : "TBD"}{" "}
                        –{" "}
                        {ad.latest_collection_end
                          ? new Date(ad.latest_collection_end).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })
                          : "TBD"}
                      </span>
                    </div>
                  </div>

                  {ad.closed_reason && (
                    <div className="mt-3 p-2 rounded-lg bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-400 italic">
                      Reason: {ad.closed_reason}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <Link
                    href={`/exporter/ads/${ad.id}/versions/${versionNum}`}
                    className="flex-1 py-1.5 px-3 text-center rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-all"
                  >
                    View / Edit
                  </Link>

                  <button
                    onClick={() => handleDuplicateAd(ad)}
                    disabled={duplicatingId === ad.id}
                    className="py-1.5 px-3 rounded-xl bg-zinc-800/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-all"
                    title="Duplicate as new draft"
                  >
                    {duplicatingId === ad.id ? "…" : "Copy"}
                  </button>

                  {ad.status !== "closed" && (
                    <button
                      onClick={() => {
                        setClosingAd(ad);
                        setCloseReason("Sourcing quota fulfilled");
                      }}
                      className="py-1.5 px-3 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-rose-400 border border-rose-800/40 text-xs font-medium transition-all"
                      title="Close advertisement"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between border-t border-zinc-800 pt-4">
          <p className="text-xs text-zinc-500">
            Showing page <span className="font-semibold text-zinc-300">{page}</span> of{" "}
            <span className="font-semibold text-zinc-300">{totalPages}</span> ({totalItems} ads total)
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Close Ad Modal */}
      {closingAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-100">
              Close Advertisement
            </h3>
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
                placeholder="e.g. Sourcing quota fulfilled, seasonal collection ended..."
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-rose-500/50"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setClosingAd(null)}
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
