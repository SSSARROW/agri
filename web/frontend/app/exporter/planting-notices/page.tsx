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

export default function ExporterPlantingNoticesListPage() {
  const router = useRouter();

  const [notices, setNotices] = useState<NoticeListItem[]>([]);
  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

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

  const getStateBadge = (state: string) => {
    switch (state) {
      case "draft":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Draft</span>;
      case "upcoming":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">Upcoming</span>;
      case "past":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">Past</span>;
      case "cancelled":
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">Cancelled</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{state}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-emerald-100">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Planting Notices</h1>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              {totalItems} Total
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Publish harvest forecasts to your approved farmers and secure early plot commitments.
          </p>
        </div>

        <Link
          href="/exporter/planting-notices/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
        >
          <span>🌱</span>
          <span>Create Notice</span>
        </Link>
      </div>

      {/* Tabs & Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* State Tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-gray-50 p-1 rounded-lg border border-gray-200">
            {[
              { label: "All Notices", value: "" },
              { label: "Drafts", value: "draft" },
              { label: "Upcoming", value: "upcoming" },
              { label: "Past", value: "past" },
              { label: "Cancelled", value: "cancelled" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setStateFilter(tab.value);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  stateFilter === tab.value
                    ? "bg-white text-emerald-700 shadow-sm font-semibold"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Crop Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Crop:</span>
            <select
              value={cropFilter}
              onChange={(e) => {
                setCropFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Crops</option>
              <option value="tea">Tea</option>
              <option value="cinnamon">Cinnamon</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-gray-100">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Loading planting notices...</p>
          </div>
        </div>
      ) : error ? (
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
          {error}
        </div>
      ) : notices.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-3xl">
            🌱
          </div>
          <h3 className="text-base font-semibold text-gray-900">No planting notices found</h3>
          <p className="text-sm text-gray-500 max-w-md mx-auto mt-1 mb-6">
            {stateFilter || cropFilter
              ? "No notices match your selected filters. Try resetting the filters."
              : "Get started by publishing your first notice to notify your approved farmers about upcoming crop demands."}
          </p>
          {stateFilter || cropFilter ? (
            <button
              onClick={() => {
                setStateFilter("");
                setCropFilter("");
                setPage(1);
              }}
              className="px-4 py-2 text-xs font-medium bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
            >
              Clear Filters
            </button>
          ) : (
            <Link
              href="/exporter/planting-notices/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              Create Planting Notice
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notices.map((n) => (
            <div
              key={n.id}
              className="bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
            >
              <div className="p-5 space-y-4">
                {/* Top badges */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                      {n.crop === "tea" ? "🍃 Tea" : "🪵 Cinnamon"}
                    </span>
                    {getStateBadge(n.computed_state)}
                  </div>
                  <span className="text-xs text-gray-400 font-medium">
                    {formatTargetMonth(n.target_month)}
                  </span>
                </div>

                {/* Title */}
                <div>
                  <h3 className="text-base font-bold text-gray-900 line-clamp-2">
                    {n.title?.en || "Untitled Notice"}
                  </h3>
                  {n.standard_name && (
                    <p className="text-xs text-emerald-700 font-medium mt-1">
                      Standard: {n.standard_name} (v{n.standard_version_number})
                    </p>
                  )}
                </div>

                {/* Progress bar */}
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Committed Volume</span>
                    <span className="font-semibold text-gray-900">
                      {n.total_expected_volume_kg.toLocaleString()} / {n.volume_needed_kg.toLocaleString()} kg
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        n.volume_percentage >= 100
                          ? "bg-emerald-600"
                          : n.volume_percentage >= 50
                          ? "bg-emerald-500"
                          : "bg-amber-500"
                      }`}
                      style={{ width: `${Math.min(100, n.volume_percentage)}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-gray-500">
                    <span>{n.volume_percentage.toFixed(1)}% of target</span>
                    <span>{n.counts.eligible_total} eligible farmers</span>
                  </div>
                </div>

                {/* Response Breakdown Pills */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-emerald-50 border border-emerald-100 py-1.5 px-2 rounded-lg">
                    <div className="text-xs font-bold text-emerald-800">{n.counts.ready}</div>
                    <div className="text-[10px] text-emerald-600 font-medium">Ready</div>
                  </div>
                  <div className="bg-rose-50 border border-rose-100 py-1.5 px-2 rounded-lg">
                    <div className="text-xs font-bold text-rose-800">{n.counts.cannot}</div>
                    <div className="text-[10px] text-rose-600 font-medium">Cannot</div>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 py-1.5 px-2 rounded-lg">
                    <div className="text-xs font-bold text-gray-700">{n.counts.no_reply}</div>
                    <div className="text-[10px] text-gray-500 font-medium">Pending</div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleDuplicate(n)}
                  disabled={duplicatingId === n.id}
                  className="text-xs text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1 disabled:opacity-50"
                  title="Duplicate as new draft"
                >
                  <span>📋</span>
                  <span>{duplicatingId === n.id ? "Duplicating..." : "Duplicate"}</span>
                </button>

                <Link
                  href={`/exporter/planting-notices/${n.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 shadow-sm transition-all"
                >
                  <span>{n.status === "draft" ? "Edit Draft" : "View Responses"}</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg text-gray-700 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500 font-medium">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg text-gray-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
