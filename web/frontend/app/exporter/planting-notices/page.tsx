"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchNotices,
  duplicateNotice,
  NoticeListItem,
} from "@/lib/plantingNoticesApi";
import { fetchExporterProfile, ExporterProfile } from "@/lib/exporterApi";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, Tone } from "@/components/ui/badge";
import { Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Toast, ToastState } from "@/components/ui/toast";
import { SectionSpinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { SproutIcon, ClipboardIcon } from "@/components/ui/icons";

const STATE_TABS: { label: string; value: string }[] = [
  { label: "All Notices", value: "" },
  { label: "Drafts", value: "draft" },
  { label: "Upcoming", value: "upcoming" },
  { label: "Past", value: "past" },
  { label: "Cancelled", value: "cancelled" },
];

const STATE_TONE: Record<string, Tone> = {
  draft: "warning",
  upcoming: "success",
  past: "neutral",
  cancelled: "danger",
};

const CROP_LABEL: Record<string, string> = {
  tea: "Tea",
  cinnamon: "Cinnamon",
};

export default function ExporterPlantingNoticesListPage() {
  const router = useRouter();

  const [notices, setNotices] = useState<NoticeListItem[]>([]);
  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  // Filters & Pagination
  const [cropFilter, setCropFilter] = useState<string>("");
  const [stateFilter, setStateFilter] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Duplicating State
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadNoticesData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, profRes] = await Promise.all([
        fetchNotices({
          crop: cropFilter || undefined,
          state: stateFilter || undefined,
          page,
          page_size: 9,
        }),
        fetchExporterProfile().catch(() => null),
      ]);
      setNotices(res.items);
      setTotalPages(res.total_pages);
      setTotalItems(res.total);
      if (profRes) setProfile(profRes);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load planting notices.");
    } finally {
      setLoading(false);
    }
  }, [cropFilter, stateFilter, page]);

  useEffect(() => {
    loadNoticesData();
  }, [loadNoticesData]);

  const handleDuplicate = async (notice: NoticeListItem) => {
    setDuplicatingId(notice.id);
    try {
      const dup = await duplicateNotice(notice.id);
      showToast("Planting notice duplicated as draft.");
      router.push(`/exporter/planting-notices/${dup.id}`);
    } catch (err: any) {
      showToast(err.detail || "Failed to duplicate notice.", "error");
    } finally {
      setDuplicatingId(null);
    }
  };

  const formatTargetMonth = (monthStr: string) => {
    if (!monthStr) return "";
    try {
      const d = new Date(monthStr);
      return d.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    } catch {
      return monthStr;
    }
  };

  const hasFilters = !!(stateFilter || cropFilter);

  return (
    <div className="max-w-7xl mx-auto">
      <Toast toast={toast} />

      <PageHeader
        eyebrow="Exporter Portal"
        title="Planting Notices"
        subtitle="Publish harvest forecasts to your approved farmers and secure early plot commitments."
        action={
          <div className="flex items-center gap-3">
            <Badge tone="brand">{totalItems} total</Badge>
            <Button href="/exporter/planting-notices/new">Create Notice</Button>
          </div>
        }
      />

      <div className="space-y-6">
        {/* Tabs & Filters */}
        <Card padded={false} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1 bg-paper-sunken p-1 rounded-lg border border-border">
              {STATE_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => {
                    setStateFilter(tab.value);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    stateFilter === tab.value
                      ? "bg-paper-raised text-brand-700 shadow-sm"
                      : "text-ink-500 hover:text-ink-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-ink-500">Crop:</span>
              <Select
                value={cropFilter}
                onChange={(e) => {
                  setCropFilter(e.target.value);
                  setPage(1);
                }}
                className="!w-auto text-xs py-1.5"
              >
                <option value="">All Crops</option>
                <option value="tea">Tea</option>
                <option value="cinnamon">Cinnamon</option>
              </Select>
            </div>
          </div>
        </Card>

        {/* Main Content Area */}
        {loading ? (
          <SectionSpinner />
        ) : error ? (
          <Alert tone="danger" title={error} />
        ) : notices.length === 0 ? (
          <Card>
            <EmptyState
              icon={<SproutIcon className="w-6 h-6" />}
              title="No planting notices found"
              description={
                hasFilters
                  ? "No notices match your selected filters. Try resetting the filters."
                  : "Get started by publishing your first notice to notify your approved farmers about upcoming crop demands."
              }
              action={
                hasFilters ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setStateFilter("");
                      setCropFilter("");
                      setPage(1);
                    }}
                  >
                    Clear Filters
                  </Button>
                ) : (
                  <Button href="/exporter/planting-notices/new">
                    Create Planting Notice
                  </Button>
                )
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {notices.map((n) => (
              <Card
                key={n.id}
                padded={false}
                className="flex flex-col justify-between overflow-hidden hover:border-border-strong transition-colors"
              >
                <div className="p-5 space-y-4">
                  {/* Top badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">{CROP_LABEL[n.crop] || n.crop}</Badge>
                      <Badge tone={STATE_TONE[n.computed_state] ?? "neutral"}>
                        {n.computed_state}
                      </Badge>
                    </div>
                    <span className="text-xs text-ink-400 font-medium">
                      {formatTargetMonth(n.target_month)}
                    </span>
                  </div>

                  {/* Title */}
                  <div>
                    <h3 className="font-display text-base font-semibold text-ink-900 line-clamp-2">
                      {n.title?.en || "Untitled Notice"}
                    </h3>
                    {n.standard_name && (
                      <p className="text-xs text-brand-700 font-medium mt-1">
                        Standard: {n.standard_name} (v{n.standard_version_number})
                      </p>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="bg-paper-sunken p-3 rounded-lg border border-border space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-ink-500">Committed Volume</span>
                      <span className="font-semibold text-ink-900">
                        {n.total_expected_volume_kg.toLocaleString()} / {n.volume_needed_kg.toLocaleString()} kg
                      </span>
                    </div>
                    <div className="w-full bg-paper-raised border border-border rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          n.volume_percentage >= 100
                            ? "bg-brand-700"
                            : n.volume_percentage >= 50
                            ? "bg-brand-500"
                            : "bg-gold-500"
                        }`}
                        style={{ width: `${Math.min(100, n.volume_percentage)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[11px] text-ink-500">
                      <span>{n.volume_percentage.toFixed(1)}% of target</span>
                      <span>{n.counts.eligible_total} eligible farmers</span>
                    </div>
                  </div>

                  {/* Response Breakdown Pills */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-success-bg border border-success-border py-1.5 px-2 rounded-lg">
                      <div className="text-xs font-bold text-success">{n.counts.ready}</div>
                      <div className="text-[10px] text-success font-medium">Ready</div>
                    </div>
                    <div className="bg-danger-bg border border-danger-border py-1.5 px-2 rounded-lg">
                      <div className="text-xs font-bold text-danger">{n.counts.cannot}</div>
                      <div className="text-[10px] text-danger font-medium">Cannot</div>
                    </div>
                    <div className="bg-paper-sunken border border-border py-1.5 px-2 rounded-lg">
                      <div className="text-xs font-bold text-ink-700">{n.counts.no_reply}</div>
                      <div className="text-[10px] text-ink-500 font-medium">Pending</div>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-3 bg-paper-sunken border-t border-border flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleDuplicate(n)}
                    disabled={duplicatingId === n.id}
                    className="text-xs text-ink-500 hover:text-ink-900 font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                    title="Duplicate as new draft"
                  >
                    <ClipboardIcon className="w-3.5 h-3.5" />
                    <span>{duplicatingId === n.id ? "Duplicating..." : "Duplicate"}</span>
                  </button>

                  <Link
                    href={`/exporter/planting-notices/${n.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-paper-raised border border-border text-ink-700 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 transition-colors"
                  >
                    {n.status === "draft" ? "Edit Draft" : "View Responses"}
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-xs text-ink-500 font-medium">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
