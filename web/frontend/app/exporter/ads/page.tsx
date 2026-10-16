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
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select, Textarea, Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionSpinner } from "@/components/ui/spinner";
import { Toast, ToastState } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/table";
import { MegaphoneIcon } from "@/components/ui/icons";

export default function ExporterAdsListPage() {
  const router = useRouter();

  const [ads, setAds] = useState<AdListItem[]>([]);
  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

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

  const STATUS_TABS = [
    { id: "", label: "All" },
    { id: "live", label: "Live" },
    { id: "draft", label: "Draft" },
    { id: "expired", label: "Expired" },
    { id: "closed", label: "Closed" },
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <Toast toast={toast} />

      <PageHeader
        eyebrow="Buy Requests"
        title="Advertisements"
        subtitle="Publish harvest purchase requests bound to your approved quality standards."
        action={
          <Button href="/exporter/ads/new">
            <span className="text-base leading-none">+</span> Create Advertisement
          </Button>
        }
      />

      {profile && profile.status !== "verified" && (
        <div className="mb-6">
          <Alert tone="warning" title="Account verification pending">
            You can draft advertisements, but publishing them to farmers
            requires a verified exporter profile. Your profile is currently{" "}
            <span className="font-semibold capitalize">{profile.status}</span>.
          </Alert>
        </div>
      )}

      {/* Filters & Search */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center mb-6">
        <div className="md:col-span-5">
          <Input
            type="text"
            placeholder="Search by title, location or crop..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="md:col-span-3">
          <Select
            value={cropFilter}
            onChange={(e) => {
              setCropFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Crops</option>
            <option value="tea">Tea</option>
            <option value="cinnamon">Cinnamon</option>
          </Select>
        </div>

        <div className="md:col-span-4 flex items-center gap-1.5 p-1 rounded-lg bg-paper-sunken border border-border text-xs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`flex-1 py-1.5 rounded-md font-semibold transition-colors ${
                statusFilter === tab.id
                  ? "bg-paper-raised text-brand-700 shadow-sm"
                  : "text-ink-500 hover:text-ink-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <SectionSpinner />
      ) : error ? (
        <Card className="text-center">
          <p className="text-danger font-semibold mb-2">Error loading ads</p>
          <p className="text-ink-500 text-sm mb-4">{error}</p>
          <Button variant="secondary" size="sm" onClick={loadAdsData}>
            Retry
          </Button>
        </Card>
      ) : ads.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<MegaphoneIcon className="w-6 h-6" />}
            title="No advertisements found"
            description={
              searchQuery || cropFilter || statusFilter
                ? "No advertisements match your current filter settings. Try resetting filters."
                : "You have not created any purchase request advertisements yet. Create one to publish your harvest sourcing requirements to farmers."
            }
            action={<Button href="/exporter/ads/new">Create Your First Advertisement</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {ads.map((ad) => {
            const verNum = ad.latest_version_number ?? (ad as any).current_version_number ?? 1;
            const pType = ad.latest_price_type ?? (ad as any).price_type ?? "fixed";
            const pFixed = ad.latest_price_fixed ?? (ad as any).price_fixed;
            const pMin = ad.latest_price_min ?? (ad as any).price_min;
            const pMax = ad.latest_price_max ?? (ad as any).price_max;
            const rawExpires = ad.latest_expires_at ?? (ad as any).expires_at;
            const rawStart = ad.latest_collection_start ?? (ad as any).collection_window_start;
            const rawEnd = ad.latest_collection_end ?? (ad as any).collection_window_end;
            const adTitle = ad.latest_title?.en || (ad as any).title?.en || "Untitled Buy Request";

            const priceDisplay =
              pType === "fixed"
                ? `LKR ${Number(pFixed || 0).toLocaleString()} / kg`
                : `LKR ${Number(pMin || 0).toLocaleString()} – ${Number(
                    pMax || 0
                  ).toLocaleString()} / kg`;

            const expiryDate = rawExpires
              ? new Date(rawExpires).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "N/A";

            return (
              <Card key={ad.id} className="flex flex-col justify-between hover:border-border-strong transition-colors">
                <div>
                  {/* Top Bar: Crop + Status + Version */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider bg-paper-sunken text-ink-700 border border-border">
                        {ad.crop}
                      </span>
                      <span className="text-xs font-mono text-ink-400">v{verNum}</span>
                    </div>
                    <StatusBadge status={ad.computed_status} />
                  </div>

                  {/* Title */}
                  <Link
                    href={`/exporter/ads/${ad.id}/versions/${verNum}`}
                    className="block hover:text-brand-700 transition-colors"
                  >
                    <h3 className="font-display text-base font-semibold text-ink-900 line-clamp-1">
                      {adTitle}
                    </h3>
                  </Link>

                  {/* Standard reference */}
                  <p className="mt-1 text-xs text-ink-500 flex items-center gap-1">
                    <span>Standard:</span>
                    <span className="truncate font-medium text-ink-700">
                      {ad.latest_standard_name || "Custom Standard"}
                    </span>
                  </p>

                  {/* Key Metrics */}
                  <div className="mt-4 pt-3 border-t border-border grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-ink-500 block">Target Qty</span>
                      <span className="font-semibold text-ink-900">
                        {Number(ad.latest_quantity_kg ?? (ad as any).quantity_kg ?? 0).toLocaleString()} kg
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-500 block">Pricing</span>
                      <span className="font-semibold text-brand-700">{priceDisplay}</span>
                    </div>
                    <div>
                      <span className="text-ink-500 block">Expires</span>
                      <span className="font-medium text-ink-700">{expiryDate}</span>
                    </div>
                    <div>
                      <span className="text-ink-500 block">Window</span>
                      <span className="font-medium text-ink-700">
                        {rawStart && rawEnd ? (
                          <>
                            {new Date(rawStart).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}{" "}
                            –{" "}
                            {new Date(rawEnd).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </>
                        ) : (
                          "Flexible"
                        )}
                      </span>
                    </div>
                  </div>

                  {ad.closed_reason && (
                    <div className="mt-3 p-2 rounded-lg bg-paper-sunken border border-border text-[11px] text-ink-500 italic">
                      Reason: {ad.closed_reason}
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    href={`/exporter/ads/${ad.id}/versions/${verNum}`}
                    variant="secondary"
                    size="sm"
                    className="flex-1"
                  >
                    View / Edit
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDuplicateAd(ad)}
                    disabled={duplicatingId === ad.id}
                    title="Duplicate as new draft"
                  >
                    {duplicatingId === ad.id ? "…" : "Copy"}
                  </Button>

                  {ad.status !== "closed" && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setClosingAd(ad);
                        setCloseReason("Sourcing quota fulfilled");
                      }}
                      title="Close advertisement"
                    >
                      Close
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            onChange={setPage}
          />
        </div>
      )}

      {/* Close Ad Modal */}
      <ConfirmModal
        open={!!closingAd}
        onClose={() => setClosingAd(null)}
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
            <Textarea
              rows={3}
              value={closeReason}
              onChange={(e) => setCloseReason(e.target.value)}
              placeholder="e.g. Sourcing quota fulfilled, seasonal collection ended..."
            />
          </Field>
        </div>
      </ConfirmModal>
    </div>
  );
}
