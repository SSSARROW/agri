"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchUserProfile, UserProfile, clearAuthToken } from "@/lib/api";
import {
  fetchAdminAds,
  fetchAdminAdDetail,
  takedownAd,
  restoreAd,
  AdminAdItem,
  AdminAdDetail,
} from "@/lib/adminAdsApi";

const ENABLE_AD_MODERATION =
  process.env.NEXT_PUBLIC_ENABLE_AD_MODERATION !== "false";

const STATE_TABS = [
  { key: "", label: "All" },
  { key: "live", label: "Live" },
  { key: "taken_down", label: "Taken Down" },
  { key: "expired", label: "Expired" },
  { key: "closed", label: "Closed" },
] as const;

function stateBadge(s: string) {
  if (s === "live") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (s === "taken_down") return "bg-red-500/15 text-red-400 border-red-500/30";
  if (s === "expired") return "bg-zinc-600/30 text-zinc-400 border-zinc-600/30";
  if (s === "draft") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-zinc-700/30 text-zinc-400 border-zinc-700/30";
}

function stateLabel(s: string) {
  if (s === "taken_down") return "Taken Down";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function AdminAdsPage() {
  if (!ENABLE_AD_MODERATION) return null;

  const router = useRouter();
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // List state
  const [ads, setAds] = useState<AdminAdItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [hasOpenReports, setHasOpenReports] = useState<boolean | null>(null);

  // Detail drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminAdDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Takedown dialog
  const [showTakedownDialog, setShowTakedownDialog] = useState(false);
  const [takedownReason, setTakedownReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Restore dialog
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Auth
  useEffect(() => {
    fetchUserProfile()
      .then((p) => {
        if (p.role !== "admin") { router.push("/dashboard"); return; }
        setCurrentUser(p);
      })
      .catch(() => { clearAuthToken(); router.push("/"); })
      .finally(() => setLoadingAuth(false));
  }, [router]);

  // List
  const loadAds = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetchAdminAds({
        state: activeTab || undefined,
        has_open_reports: hasOpenReports ?? undefined,
        search: searchTerm || undefined,
        page,
        page_size: 20,
      });
      setAds(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (e: any) {
      setError(e.message || "Failed to load ads.");
    } finally {
      setLoadingList(false);
    }
  }, [activeTab, hasOpenReports, searchTerm, page]);

  useEffect(() => {
    if (!loadingAuth && currentUser) loadAds();
  }, [loadingAuth, currentUser, loadAds]);

  // Detail
  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const d = await fetchAdminAdDetail(id);
      setDetail(d);
    } catch (e: any) {
      showToast(e.message || "Failed to load ad detail.", "error");
      setSelectedId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleTakedown = async () => {
    if (!selectedId || !takedownReason.trim()) return;
    setSubmitting(true);
    try {
      await takedownAd(selectedId, takedownReason.trim());
      showToast("Advertisement taken down.");
      setShowTakedownDialog(false);
      setTakedownReason("");
      await openDetail(selectedId);
      loadAds();
    } catch (e: any) {
      showToast(e.message || "Takedown failed.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      await restoreAd(selectedId);
      showToast("Advertisement restored.");
      setShowRestoreDialog(false);
      await openDetail(selectedId);
      loadAds();
    } catch (e: any) {
      showToast(e.message || "Restore failed.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isTakenDown = detail?.admin_state === "taken_down";
  const isLive = detail?.admin_state === "live";

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white">
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
      <header className="max-w-7xl mx-auto px-6 py-8 border-b border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center font-black text-xl text-white hover:opacity-90 transition-opacity"
          >
            P
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Ad Moderation</h1>
            <p className="text-xs text-zinc-400">Review, takedown and restore advertisements</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/exporters"
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all"
          >
            Exporters
          </Link>
          <Link
            href="/admin/users"
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all"
          >
            Users
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 flex gap-6">
        {/* ── Left: list ── */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Filter bar */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-3">
            {/* State tabs */}
            <div className="flex gap-1 flex-wrap">
              {STATE_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setActiveTab(t.key); setPage(1); }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === t.key
                      ? "bg-red-500/20 text-red-300 border border-red-500/30"
                      : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <button
                onClick={() => { setHasOpenReports(hasOpenReports === true ? null : true); setPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ml-auto ${
                  hasOpenReports === true
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                🚩 With Reports
              </button>
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search by exporter company or ad title…"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500/50"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-950/40 border border-red-900/50 p-4 rounded-xl text-red-400 text-xs">{error}</div>
          )}

          {/* Table */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-950/60 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                  <tr>
                    <th className="px-5 py-4">Ad / Exporter</th>
                    <th className="px-5 py-4">Crop</th>
                    <th className="px-5 py-4">State</th>
                    <th className="px-5 py-4">Reports</th>
                    <th className="px-5 py-4">Views</th>
                    <th className="px-5 py-4">Accepts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {loadingList ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-zinc-500 text-xs">
                        <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        Loading ads…
                      </td>
                    </tr>
                  ) : ads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-zinc-500 text-xs">
                        No advertisements found.
                      </td>
                    </tr>
                  ) : (
                    ads.map((ad) => (
                      <tr
                        key={ad.id}
                        onClick={() => openDetail(ad.id)}
                        className={`hover:bg-zinc-800/40 transition-colors cursor-pointer group ${
                          selectedId === ad.id ? "bg-zinc-800/30" : ""
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="font-semibold text-white group-hover:text-red-300 transition-colors truncate max-w-[220px]">
                            {ad.title?.en || "Untitled"}
                          </div>
                          <div className="text-xs text-zinc-500 truncate">{ad.exporter_company}</div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs font-semibold uppercase bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-md">{ad.crop}</span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${stateBadge(ad.admin_state)}`}>
                            {stateLabel(ad.admin_state)}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {ad.open_report_count > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              {ad.open_report_count}
                            </span>
                          ) : (
                            <span className="text-zinc-600 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-xs text-zinc-400">{ad.total_views}</td>
                        <td className="px-5 py-4 text-xs text-zinc-400">{ad.total_accepts}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-5 py-4 bg-zinc-950/60 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <span>
                Showing <span className="text-white font-medium">{ads.length}</span> of{" "}
                <span className="text-white font-medium">{total}</span> ads
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1 || loadingList}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-700 rounded-lg transition-colors"
                >
                  Previous
                </button>
                <span className="font-mono text-zinc-300">Page {page} of {totalPages}</span>
                <button
                  disabled={page >= totalPages || loadingList}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 border border-zinc-700 rounded-lg transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: detail drawer ── */}
        {selectedId && (
          <div className="w-[420px] shrink-0">
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 space-y-5 sticky top-6 max-h-[calc(100vh-120px)] overflow-y-auto">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : detail ? (
                <>
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${stateBadge(detail.admin_state)}`}>
                        {stateLabel(detail.admin_state)}
                      </span>
                      <h2 className="mt-2 text-base font-bold text-zinc-100 leading-snug">
                        {detail.live_version?.title?.en || "Untitled"}
                      </h2>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {detail.exporter?.company_name || "Unknown Exporter"} · {detail.crop.toUpperCase()}
                      </p>
                    </div>
                    <button onClick={() => { setSelectedId(null); setDetail(null); }} className="text-zinc-500 hover:text-zinc-300 text-lg transition-colors shrink-0">✕</button>
                  </div>

                  {/* Takedown banner */}
                  {detail.admin_state === "taken_down" && (
                    <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/40 text-xs text-red-300">
                      <p className="font-semibold text-red-200">⛔ Taken down by administrator</p>
                      <p className="mt-0.5 text-red-400/90">
                        {detail.closed_reason?.replace("taken_down: ", "") || "No reason provided"}
                      </p>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Views", value: detail.stats.total_views },
                      { label: "Unique Viewers", value: detail.stats.unique_viewers },
                      { label: "Accepts", value: detail.stats.total_accepts },
                      { label: "Active", value: detail.stats.active_accepts },
                    ].map((s) => (
                      <div key={s.label} className="bg-zinc-950/60 rounded-xl p-3 border border-zinc-800">
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{s.label}</p>
                        <p className="text-xl font-bold text-zinc-100 mt-0.5">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Reports */}
                  {detail.reports.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                        Reports ({detail.reports.filter((r) => r.status === "open").length} open)
                      </h3>
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {detail.reports.map((r) => (
                          <div key={r.id} className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-zinc-200 capitalize">{r.reason.replace(/_/g, " ")}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                r.status === "open" ? "bg-amber-500/20 text-amber-300" : "bg-zinc-700/40 text-zinc-400"
                              }`}>{r.status}</span>
                            </div>
                            {r.details && <p className="text-zinc-400">{r.details}</p>}
                            <p className="text-zinc-600">{r.farmer?.name || "Farmer"} · {new Date(r.created_at).toLocaleDateString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Moderation history */}
                  {detail.moderation_log.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Moderation History</h3>
                      <div className="space-y-2">
                        {detail.moderation_log.map((m) => (
                          <div key={m.id} className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold capitalize ${m.action === "takedown" ? "text-red-400" : "text-emerald-400"}`}>
                                {m.action}
                              </span>
                              <span className="text-zinc-500">by {m.admin_user?.name || m.admin_user?.email || "Admin"}</span>
                            </div>
                            {m.reason && <p className="text-zinc-400 mt-0.5">{m.reason}</p>}
                            <p className="text-zinc-600 mt-0.5">{new Date(m.created_at).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exporter info */}
                  <div className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 text-xs space-y-1">
                    <h3 className="font-semibold text-zinc-300">Exporter</h3>
                    <p className="text-zinc-400">{detail.exporter?.company_name}</p>
                    <p className="text-zinc-500">{detail.exporter?.email}</p>
                    <p className="text-zinc-500">{detail.exporter?.phone}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-1 border-t border-zinc-800">
                    {isLive && (
                      <button
                        onClick={() => setShowTakedownDialog(true)}
                        className="flex-1 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all"
                        id="btn-takedown"
                      >
                        Take Down
                      </button>
                    )}
                    {isTakenDown && (
                      <button
                        onClick={() => setShowRestoreDialog(true)}
                        className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all"
                        id="btn-restore"
                      >
                        Restore
                      </button>
                    )}
                    <Link
                      href={`/exporter/ads/${detail.id}`}
                      target="_blank"
                      className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all"
                    >
                      View Ad ↗
                    </Link>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </main>

      {/* Takedown dialog */}
      {showTakedownDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-100">Take Down Advertisement</h3>
            <p className="mt-2 text-sm text-zinc-400">
              This ad will be immediately hidden from farmers. Provide a clear reason.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                id="takedown-reason"
                rows={3}
                value={takedownReason}
                onChange={(e) => setTakedownReason(e.target.value)}
                placeholder="e.g. Misleading pricing information reported by multiple farmers."
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-sm focus:outline-none focus:border-red-500/50"
              />
            </div>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowTakedownDialog(false); setTakedownReason(""); }}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleTakedown}
                disabled={submitting || !takedownReason.trim()}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold disabled:opacity-50"
              >
                {submitting ? "Taking down…" : "Confirm Takedown"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore dialog */}
      {showRestoreDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-100">Restore Advertisement</h3>
            <p className="mt-2 text-sm text-zinc-400">
              This will restore the ad to <strong className="text-emerald-400">published</strong> and make it visible to farmers again.
              Only possible if the published version has not expired.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowRestoreDialog(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
              >
                {submitting ? "Restoring…" : "Confirm Restore"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
