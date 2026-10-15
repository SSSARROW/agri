"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchUserProfile, UserProfile, clearAuthToken } from "@/lib/api";
import {
  fetchAdminExporters,
  fetchAdminExporterDetails,
  approveExporter,
  rejectExporter,
  reopenExporter,
  ExporterAdminProfile,
} from "@/lib/adminExporterApi";

export default function AdminExporterVerificationPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // List State
  const [exporters, setExporters] = useState<ExporterAdminProfile[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Filters & Pagination
  const [activeTab, setActiveTab] = useState<"pending" | "verified" | "rejected" | "all">("pending");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [counts, setCounts] = useState({ pending: 0, verified: 0, rejected: 0 });

  // Drawer / Selection State
  const [selectedExporter, setSelectedExporter] = useState<ExporterAdminProfile | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Modal Dialog States
  const [confirmApproveModal, setConfirmApproveModal] = useState<ExporterAdminProfile | null>(null);
  const [confirmReopenModal, setConfirmReopenModal] = useState<ExporterAdminProfile | null>(null);
  const [rejectModal, setRejectModal] = useState<ExporterAdminProfile | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  // Toast Helper
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // 1. Authenticate user
  useEffect(() => {
    async function loadUser() {
      try {
        const profile = await fetchUserProfile();
        if (profile.role !== "admin") {
          router.push("/dashboard");
          return;
        }
        setCurrentUser(profile);
      } catch (err) {
        clearAuthToken();
        router.push("/");
      } finally {
        setLoadingAuth(false);
      }
    }
    loadUser();
  }, [router]);

  // 2. Load exporters list
  const loadExporters = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetchAdminExporters({
        status: activeTab,
        search: searchTerm,
        page,
        pageSize: 10,
      });
      setExporters(res.items);
      setTotalPages(res.total_pages);
      setTotalItems(res.total);
      setCounts(res.counts);
    } catch (err: any) {
      setError(err.message || "Failed to load exporter applications.");
    } finally {
      setLoadingList(false);
    }
  }, [activeTab, searchTerm, page]);

  useEffect(() => {
    if (!loadingAuth && currentUser) {
      loadExporters();
    }
  }, [loadingAuth, currentUser, loadExporters]);

  // Inspect details
  const handleSelectExporter = async (id: string) => {
    setLoadingDetails(true);
    try {
      const details = await fetchAdminExporterDetails(id);
      setSelectedExporter(details);
    } catch (err: any) {
      showToast(err.message || "Failed to fetch detailed profile", "error");
    } finally {
      setLoadingDetails(false);
    }
  };

  // Actions
  const handleApprove = async () => {
    if (!confirmApproveModal) return;
    setSubmittingAction(true);
    try {
      await approveExporter(confirmApproveModal.id);
      showToast(`Approved ${confirmApproveModal.company_name || "Exporter"}`);
      setConfirmApproveModal(null);
      if (selectedExporter?.id === confirmApproveModal.id) {
        handleSelectExporter(confirmApproveModal.id);
      }
      loadExporters();
    } catch (err: any) {
      showToast(err.message || "Approve failed", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) {
      showToast("Please provide a rejection reason.", "error");
      return;
    }
    setSubmittingAction(true);
    try {
      await rejectExporter(rejectModal.id, rejectReason.trim());
      showToast(`Rejected ${rejectModal.company_name || "Exporter"}`);
      setRejectModal(null);
      setRejectReason("");
      if (selectedExporter?.id === rejectModal.id) {
        handleSelectExporter(rejectModal.id);
      }
      loadExporters();
    } catch (err: any) {
      showToast(err.message || "Reject failed", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleReopen = async () => {
    if (!confirmReopenModal) return;
    setSubmittingAction(true);
    try {
      await reopenExporter(confirmReopenModal.id);
      showToast(`Reopened verification for ${confirmReopenModal.company_name || "Exporter"}`);
      setConfirmReopenModal(null);
      if (selectedExporter?.id === confirmReopenModal.id) {
        handleSelectExporter(confirmReopenModal.id);
      }
      loadExporters();
    } catch (err: any) {
      showToast(err.message || "Reopen failed", "error");
    } finally {
      setSubmittingAction(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-400 text-sm font-medium">Verifying authorization...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white p-4 sm:p-8">
      {/* Toast Banner */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl border backdrop-blur-xl shadow-2xl text-xs font-semibold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 ${
            toast.type === "success"
              ? "bg-emerald-950/90 border-emerald-500/40 text-emerald-200"
              : "bg-red-950/90 border-red-500/40 text-red-200"
          }`}
        >
          <span>{toast.type === "success" ? "✅" : "⚠️"}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Navigation / Header */}
      <header className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-teal-500 flex items-center justify-center font-black text-xl text-black hover:opacity-90 transition-opacity"
          >
            P
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">Exporter Verification</h1>
              {counts.pending > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {counts.pending} Pending
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">Review, approve or reject exporter business applications</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/ads"
            className="px-4 py-2 bg-red-950/60 hover:bg-red-900/60 border border-red-800/40 text-red-300 text-xs font-semibold rounded-xl transition-all"
          >
            📢 Ads
          </Link>
          <Link
            href="/admin/users"
            className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold rounded-xl transition-all"
          >
            👥 Actor Registry
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: List & Controls */}
        <div className={`${selectedExporter ? "lg:col-span-7" : "lg:col-span-12"} space-y-6 transition-all duration-300`}>
          {/* Controls Bar: Tabs & Search */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 backdrop-blur-xl flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800/80 w-full md:w-auto overflow-x-auto">
              {(
                [
                  { key: "pending", label: "Pending", count: counts.pending, color: "text-amber-400" },
                  { key: "verified", label: "Verified", count: counts.verified, color: "text-emerald-400" },
                  { key: "rejected", label: "Rejected", count: counts.rejected, color: "text-red-400" },
                  { key: "all", label: "All", count: null, color: "text-zinc-400" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setPage(1);
                  }}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === tab.key
                      ? "bg-zinc-800 text-white shadow-lg border border-zinc-700"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span className={`text-[10px] px-1.5 py-0.2 bg-zinc-900 rounded-full font-bold ${tab.color}`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="w-full md:w-64 relative">
              <input
                type="text"
                placeholder="Search company, email, reg no..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="p-4 rounded-2xl bg-red-950/50 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
              <span>{error}</span>
              <button onClick={loadExporters} className="underline font-semibold hover:text-white">
                Retry
              </button>
            </div>
          )}

          {/* Exporters Table */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden backdrop-blur-xl">
            {loadingList ? (
              <div className="py-16 text-center">
                <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-zinc-400 text-xs">Loading exporters...</p>
              </div>
            ) : exporters.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <div className="text-3xl">📂</div>
                <p className="text-zinc-300 font-bold text-sm">No exporter applications found</p>
                <p className="text-zinc-500 text-xs max-w-sm mx-auto">
                  {searchTerm
                    ? `No matching records for "${searchTerm}".`
                    : `There are currently no exporter accounts with status '${activeTab}'.`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-semibold uppercase tracking-wider text-[11px]">
                      <th className="py-3.5 px-4">Company</th>
                      <th className="py-3.5 px-4">Reg / Licence</th>
                      <th className="py-3.5 px-4">Contact</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {exporters.map((item) => {
                      const isSelected = selectedExporter?.id === item.id;
                      return (
                        <tr
                          key={item.id}
                          onClick={() => handleSelectExporter(item.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? "bg-amber-500/10 hover:bg-amber-500/15" : "hover:bg-zinc-800/50"
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-zinc-100">{item.company_name || "(No Company Name)"}</div>
                            <div className="text-[11px] text-zinc-400">{item.email || item.users?.email || "—"}</div>
                          </td>

                          <td className="py-3.5 px-4 text-zinc-300 font-mono text-[11px]">
                            <div>Reg: {item.business_reg_no || "—"}</div>
                            <div className="text-zinc-500">Lic: {item.export_licence_no || "—"}</div>
                          </td>

                          <td className="py-3.5 px-4 text-zinc-300">
                            <div>{item.contact_person || item.users?.name || "—"}</div>
                            <div className="text-zinc-500 text-[11px]">{item.phone || item.users?.phone || "—"}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
                                item.status === "verified"
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : item.status === "rejected"
                                  ? "bg-red-500/15 text-red-400 border-red-500/30"
                                  : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectExporter(item.id);
                              }}
                              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition-all border border-zinc-700"
                            >
                              View →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 bg-zinc-950/40">
                <span>
                  Showing page {page} of {totalPages} ({totalItems} total)
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-700"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Detailed Drawer / Inspection View */}
        {selectedExporter && (
          <div className="lg:col-span-5 bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 backdrop-blur-xl flex flex-col justify-between space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between pb-4 border-b border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">
                      {selectedExporter.company_name || "Exporter Details"}
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        selectedExporter.status === "verified"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : selectedExporter.status === "rejected"
                          ? "bg-red-500/15 text-red-400 border-red-500/30"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {selectedExporter.status}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">ID: {selectedExporter.id}</p>
                </div>
                <button
                  onClick={() => setSelectedExporter(null)}
                  className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              {loadingDetails ? (
                <div className="py-12 text-center">
                  <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">Fetching detailed records...</p>
                </div>
              ) : (
                <div className="space-y-5 text-xs text-zinc-300">
                  {/* Rejection notice if rejected */}
                  {selectedExporter.status === "rejected" && (
                    <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/30 text-red-300 space-y-1">
                      <p className="font-bold text-xs">Rejection Reason</p>
                      <p className="text-red-400 font-medium">{selectedExporter.rejection_reason || "No reason specified."}</p>
                    </div>
                  )}

                  {/* Company Info Grid */}
                  <div className="grid grid-cols-2 gap-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                    <div>
                      <p className="text-zinc-500 text-[10px] uppercase font-bold">Business Reg No</p>
                      <p className="font-mono font-medium">{selectedExporter.business_reg_no || "—"}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-[10px] uppercase font-bold">Export Licence No</p>
                      <p className="font-mono font-medium">{selectedExporter.export_licence_no || "—"}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-[10px] uppercase font-bold">Contact Person</p>
                      <p className="font-medium">{selectedExporter.contact_person || selectedExporter.users?.name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500 text-[10px] uppercase font-bold">Phone</p>
                      <p className="font-medium">{selectedExporter.phone || selectedExporter.users?.phone || "—"}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-zinc-500 text-[10px] uppercase font-bold">Email</p>
                      <p className="font-medium">{selectedExporter.email || selectedExporter.users?.email || "—"}</p>
                    </div>
                  </div>

                  {/* Description */}
                  {selectedExporter.description && (
                    <div>
                      <p className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Company Overview</p>
                      <p className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-zinc-300 leading-relaxed">
                        {selectedExporter.description}
                      </p>
                    </div>
                  )}

                  {/* Operational Tags */}
                  <div className="space-y-3">
                    <div>
                      <p className="text-zinc-500 text-[10px] uppercase font-bold mb-1.5">Crops Bought</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedExporter.crops_bought && selectedExporter.crops_bought.length > 0 ? (
                          selectedExporter.crops_bought.map((crop) => (
                            <span key={crop} className="px-2 py-0.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-300 text-[11px] capitalize">
                              🌱 {crop}
                            </span>
                          ))
                        ) : (
                          <span className="text-zinc-500 text-[11px]">None listed</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-zinc-500 text-[10px] uppercase font-bold mb-1.5">Districts Served</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedExporter.districts_served && selectedExporter.districts_served.length > 0 ? (
                          selectedExporter.districts_served.map((district) => (
                            <span key={district} className="px-2 py-0.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[11px] capitalize">
                              📍 {district}
                            </span>
                          ))
                        ) : (
                          <span className="text-zinc-500 text-[11px]">None listed</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-zinc-500 text-[10px] uppercase font-bold mb-1.5">Certifications</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedExporter.certifications && selectedExporter.certifications.length > 0 ? (
                          selectedExporter.certifications.map((cert) => (
                            <span key={cert} className="px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] capitalize">
                              📜 {cert.replace("_", " ")}
                            </span>
                          ))
                        ) : (
                          <span className="text-zinc-500 text-[11px]">None uploaded</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Verification History Log */}
                  <div className="pt-2 border-t border-zinc-800">
                    <p className="text-zinc-400 text-xs font-bold mb-3 flex items-center gap-1.5">
                      <span>📜</span> Verification Audit History
                    </p>
                    {selectedExporter.history && selectedExporter.history.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedExporter.history.map((log) => (
                          <div key={log.id} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold capitalize text-amber-300">
                                Action: {log.action}
                              </span>
                              <span className="text-zinc-500 text-[10px]">
                                {new Date(log.created_at).toLocaleString()}
                              </span>
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              Status: <span className="text-zinc-300 font-mono">{log.previous_status} → {log.new_status}</span>
                            </div>
                            {log.reason && (
                              <div className="text-[11px] text-red-400 italic">
                                Reason: "{log.reason}"
                              </div>
                            )}
                            <div className="text-[10px] text-zinc-500">
                              By Admin: {log.admin_user?.email || log.admin_user_id || "System / CLI"}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-zinc-500 text-xs italic">No verification actions recorded yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons Footer */}
            {!loadingDetails && selectedExporter && (
              <div className="pt-4 border-t border-zinc-800 flex items-center gap-3">
                {selectedExporter.status === "pending" && (
                  <>
                    <button
                      onClick={() => setConfirmApproveModal(selectedExporter)}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-950"
                    >
                      ✓ Approve Exporter
                    </button>
                    <button
                      onClick={() => setRejectModal(selectedExporter)}
                      className="flex-1 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 font-bold text-xs rounded-xl transition-all"
                    >
                      ✕ Reject...
                    </button>
                  </>
                )}

                {selectedExporter.status === "verified" && (
                  <>
                    <button
                      onClick={() => setRejectModal(selectedExporter)}
                      className="flex-1 py-2.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 font-bold text-xs rounded-xl transition-all"
                    >
                      ✕ Revoke / Reject...
                    </button>
                    <button
                      onClick={() => setConfirmReopenModal(selectedExporter)}
                      className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl transition-all"
                    >
                      ↺ Reopen
                    </button>
                  </>
                )}

                {selectedExporter.status === "rejected" && (
                  <>
                    <button
                      onClick={() => setConfirmApproveModal(selectedExporter)}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-black font-bold text-xs rounded-xl transition-all shadow-lg"
                    >
                      ✓ Re-Approve Exporter
                    </button>
                    <button
                      onClick={() => setConfirmReopenModal(selectedExporter)}
                      className="py-2.5 px-4 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-300 font-semibold text-xs rounded-xl transition-all"
                    >
                      ↺ Reopen to Pending
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── APPROVE CONFIRM MODAL ── */}
      {confirmApproveModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-emerald-400">Approve Exporter Account</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to approve{" "}
              <span className="font-bold text-white">{confirmApproveModal.company_name}</span>?
              This will set their status to <span className="text-emerald-400 font-bold">verified</span> and unlock export features.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={submittingAction}
                onClick={() => setConfirmApproveModal(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                disabled={submittingAction}
                onClick={handleApprove}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-black text-xs font-bold rounded-xl flex items-center gap-2"
              >
                {submittingAction ? "Processing..." : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REJECT DIALOG MODAL ── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-red-400">Reject Exporter Application</h3>
            <p className="text-xs text-zinc-300">
              Please specify the reason for rejecting{" "}
              <span className="font-bold text-white">{rejectModal.company_name}</span>. The exporter will see this message in their account banner.
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Invalid export licence number provided..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-red-500"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={submittingAction}
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason("");
                }}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                disabled={submittingAction || !rejectReason.trim()}
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl disabled:opacity-50 flex items-center gap-2"
              >
                {submittingAction ? "Processing..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REOPEN CONFIRM MODAL ── */}
      {confirmReopenModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-amber-400">Reopen Verification</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to reset status for{" "}
              <span className="font-bold text-white">{confirmReopenModal.company_name}</span> back to{" "}
              <span className="text-amber-400 font-bold">pending</span>?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={submittingAction}
                onClick={() => setConfirmReopenModal(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                disabled={submittingAction}
                onClick={handleReopen}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black text-xs font-bold rounded-xl flex items-center gap-2"
              >
                {submittingAction ? "Processing..." : "Confirm Reopen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
