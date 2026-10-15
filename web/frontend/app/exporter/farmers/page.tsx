"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  fetchFarmerLinks,
  fetchFarmerLinkDetail,
  approveFarmerLink,
  declineFarmerLink,
  removeFarmerLink,
  FarmerLinkListItem,
  FarmerLinkDetail,
} from "@/lib/exporterFarmersApi";
import { fetchExporterProfile, ExporterProfile } from "@/lib/exporterApi";

const SRI_LANKA_DISTRICTS = [
  "All Districts",
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo",
  "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara",
  "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar",
  "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya",
  "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya",
];

const CROPS = ["All Crops", "Tea", "Cinnamon", "Pepper", "Coffee", "Cardamom"];

export default function ExporterFarmersPage() {
  const [profile, setProfile] = useState<ExporterProfile | null>(null);

  // Tab State: 'requested' (Requests), 'approved' (My Farmers), 'past' (Past: declined & removed)
  const [tab, setTab] = useState<"requested" | "approved" | "past">("requested");

  const [links, setLinks] = useState<FarmerLinkListItem[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [districtFilter, setDistrictFilter] = useState<string>("All Districts");
  const [cropFilter, setCropFilter] = useState<string>("All Crops");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Detail Modal / Drawer State
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [detail, setDetail] = useState<FarmerLinkDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Action Dialog States
  const [actionType, setActionType] = useState<"approve" | "decline" | "remove" | null>(null);
  const [actionReason, setActionReason] = useState<string>("");
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Exporter Profile to check verification status
  useEffect(() => {
    fetchExporterProfile()
      .then(setProfile)
      .catch((err) => console.error("Could not fetch profile:", err));
  }, []);

  const isVerified = profile?.status === "verified";

  // Load Links Data
  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let statusParam = tab === "past" ? "all" : tab;
      const res = await fetchFarmerLinks({
        status: statusParam,
        district: districtFilter !== "All Districts" ? districtFilter : undefined,
        crop: cropFilter !== "All Crops" ? cropFilter : undefined,
        search: searchTerm.trim() || undefined,
        page,
        pageSize: 10,
      });

      // Filter in past tab to show only declined and removed
      if (tab === "past") {
        const pastItems = res.items.filter(
          (item) => item.status === "declined" || item.status === "removed" || item.status === "cancelled"
        );
        setLinks(pastItems);
        setTotalItems(pastItems.length);
        setTotalPages(1);
      } else {
        setLinks(res.items);
        setTotalItems(res.total);
        setTotalPages(res.total_pages);
      }

      setPendingCount(res.pending_count);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || "Failed to load farmer links.");
    } finally {
      setLoading(false);
    }
  }, [tab, districtFilter, cropFilter, searchTerm, page]);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  // Open Detail Drawer
  const openDetail = async (id: string) => {
    setSelectedLinkId(id);
    setLoadingDetail(true);
    try {
      const data = await fetchFarmerLinkDetail(id);
      setDetail(data);
    } catch (err: any) {
      showToast(err?.response?.data?.detail || "Failed to load farmer details.", "error");
      setSelectedLinkId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedLinkId(null);
    setDetail(null);
    setActionType(null);
    setActionReason("");
  };

  // Execute Action (Approve, Decline, Remove)
  const handleActionConfirm = async () => {
    if (!selectedLinkId || !actionType) return;
    setActionSubmitting(true);
    try {
      if (actionType === "approve") {
        await approveFarmerLink(selectedLinkId);
        showToast("Farmer link successfully approved!");
      } else if (actionType === "decline") {
        await declineFarmerLink(selectedLinkId, actionReason);
        showToast("Farmer link request declined.");
      } else if (actionType === "remove") {
        await removeFarmerLink(selectedLinkId, actionReason);
        showToast("Farmer removed from your network.");
      }
      closeDetail();
      loadLinks();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Action failed. Please try again.";
      showToast(msg, "error");
    } finally {
      setActionSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-10">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium transition-all ${
            toast.type === "success"
              ? "bg-emerald-600/90 text-white border border-emerald-400/30"
              : "bg-red-600/90 text-white border border-red-400/30"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold uppercase tracking-wider mb-2">
              🌾 Supply Network
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">My Farmers</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Manage your connected growers, incoming connection requests, and crop supply details.
            </p>
          </div>

          {!isVerified && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-xs">
              <span className="text-base">⚠️</span>
              <span>Account unverified. Approvals and farmer management are disabled until verified.</span>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-8 border-b border-zinc-800 pb-1">
          <button
            onClick={() => { setTab("requested"); setPage(1); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              tab === "requested"
                ? "bg-zinc-800 text-teal-400 border border-teal-500/30 shadow-lg"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <span>Requests</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => { setTab("approved"); setPage(1); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              tab === "approved"
                ? "bg-zinc-800 text-teal-400 border border-teal-500/30 shadow-lg"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <span>My Farmers</span>
          </button>

          <button
            onClick={() => { setTab("past"); setPage(1); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
              tab === "past"
                ? "bg-zinc-800 text-teal-400 border border-teal-500/30 shadow-lg"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <span>Past</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-2.5 text-zinc-500 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search farmer by name..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-zinc-800/80 border border-zinc-700/80 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500"
            />
          </div>

          <select
            value={districtFilter}
            onChange={(e) => { setDistrictFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-zinc-800/80 border border-zinc-700/80 rounded-xl text-sm text-zinc-300 focus:outline-none focus:border-teal-500"
          >
            {SRI_LANKA_DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={cropFilter}
            onChange={(e) => { setCropFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 bg-zinc-800/80 border border-zinc-700/80 rounded-xl text-sm text-zinc-300 focus:outline-none focus:border-teal-500"
          >
            {CROPS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="text-xs text-zinc-400 whitespace-nowrap">
          Showing <span className="text-white font-medium">{links.length}</span> of {totalItems}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 gap-3">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Loading supply network...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-red-950/20 border border-red-500/20 rounded-2xl text-red-400">
          <p className="font-semibold">{error}</p>
          <button
            onClick={loadLinks}
            className="mt-4 px-4 py-1.5 bg-red-600/30 hover:bg-red-600/50 rounded-lg text-xs font-semibold text-white transition-all"
          >
            Retry
          </button>
        </div>
      ) : links.length === 0 ? (
        <div className="p-16 text-center bg-zinc-900/30 border border-zinc-800 rounded-3xl">
          <span className="text-4xl block mb-3">🌾</span>
          <h3 className="text-lg font-bold text-zinc-200">
            {tab === "requested" ? "No pending connection requests" : tab === "approved" ? "No connected farmers yet" : "No past links"}
          </h3>
          <p className="text-zinc-500 text-sm max-w-md mx-auto mt-1">
            {tab === "requested"
              ? "When farmers in your sourcing districts send requests, they will appear here for review."
              : tab === "approved"
              ? "Approve incoming farmer requests to start receiving their verified harvests."
              : "Previously declined or removed farmers will be logged here for your records."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {links.map((item) => (
            <div
              key={item.id}
              className="bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700 rounded-3xl p-6 transition-all hover:shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-white group-hover:text-teal-300">
                      {item.farmer.name}
                    </h3>
                    <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                      <span>📍</span> {item.farmer.district || "District not set"}
                      {item.farmer.gn_division ? ` · GN ${item.farmer.gn_division}` : ""}
                    </p>
                  </div>

                  {/* Status Pill */}
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                      item.status === "requested"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : item.status === "approved"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : item.status === "declined"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                {/* Plot & Crop Stats */}
                <div className="grid grid-cols-2 gap-2 my-4 p-3 bg-zinc-950/60 rounded-2xl border border-zinc-800/50 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Plots Recorded</span>
                    <span className="text-zinc-200 font-semibold">
                      {item.farmer.total_plots} ({item.farmer.total_plot_area_ha} ha)
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Phone</span>
                    <span className="text-zinc-200 font-semibold">
                      {item.farmer.phone ? `📞 ${item.farmer.phone}` : "🔒 Hidden"}
                    </span>
                  </div>
                </div>

                {/* Crop Badges */}
                <div className="mb-4">
                  <span className="text-xs text-zinc-500 block mb-1.5 font-medium">Crops:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.farmer.crops.length > 0 ? (
                      item.farmer.crops.map((c) => (
                        <span
                          key={c}
                          className="px-2.5 py-0.5 rounded-lg bg-teal-950/50 text-teal-300 border border-teal-800/40 text-xs font-medium"
                        >
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-600 italic">No batches yet</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-4 border-t border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500">
                <span>
                  {item.status === "requested"
                    ? `Requested: ${new Date(item.requested_at).toLocaleDateString()}`
                    : `Decided: ${item.decided_at ? new Date(item.decided_at).toLocaleDateString() : "-"}`}
                </span>

                <button
                  onClick={() => openDetail(item.id)}
                  className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-all hover:scale-105"
                >
                  View Detail →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 mt-10">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold transition-all"
          >
            ← Previous
          </button>
          <span className="text-xs text-zinc-400">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:pointer-events-none text-xs font-semibold transition-all"
          >
            Next →
          </button>
        </div>
      )}

      {/* Detail Modal / Drawer */}
      {selectedLinkId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-xl bg-zinc-900 border-l border-zinc-800 h-full overflow-y-auto p-6 md:p-8 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            {loadingDetail || !detail ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-zinc-500 text-sm">Loading details...</p>
              </div>
            ) : (
              <div>
                {/* Modal Header */}
                <div className="flex items-start justify-between border-b border-zinc-800 pb-5 mb-6">
                  <div>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-2 ${
                        detail.status === "requested"
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : detail.status === "approved"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : detail.status === "declined"
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                      }`}
                    >
                      Status: {detail.status}
                    </span>
                    <h2 className="text-2xl font-extrabold text-white">{detail.farmer.name}</h2>
                    <p className="text-sm text-zinc-400 mt-0.5">
                      {detail.farmer.district ? `District: ${detail.farmer.district}` : "No district"}
                      {detail.farmer.dsd ? ` · DSD: ${detail.farmer.dsd}` : ""}
                    </p>
                  </div>

                  <button
                    onClick={closeDetail}
                    className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 text-lg transition-all"
                  >
                    ✕
                  </button>
                </div>

                {/* Farmer Contact Info (Phone rules) */}
                <div className="bg-zinc-950/80 rounded-2xl border border-zinc-800 p-5 mb-6">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                    Contact & Privacy
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center py-1 border-b border-zinc-900">
                      <span className="text-zinc-500">Phone Number:</span>
                      {detail.farmer.phone ? (
                        <span className="font-mono text-emerald-400 font-bold flex items-center gap-1">
                          📞 {detail.farmer.phone}
                        </span>
                      ) : (
                        <span className="text-amber-400/80 text-xs italic flex items-center gap-1">
                          🔒 Hidden (Visible once approved)
                        </span>
                      )}
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-zinc-900">
                      <span className="text-zinc-500">Farm Address:</span>
                      <span className="text-zinc-200">{detail.farmer.farm_address || "Not provided"}</span>
                    </div>

                    <div className="flex justify-between items-center py-1">
                      <span className="text-zinc-500">Reported Farm Size:</span>
                      <span className="text-zinc-200">
                        {detail.farmer.farm_size_ha ? `${detail.farmer.farm_size_ha} ha` : "Not specified"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Crops Produced */}
                <div className="mb-6">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Verified Crops
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {detail.farmer.crops.length > 0 ? (
                      detail.farmer.crops.map((c) => (
                        <span
                          key={c}
                          className="px-3 py-1 rounded-xl bg-teal-950/60 border border-teal-800/50 text-teal-300 font-semibold text-xs"
                        >
                          🌿 {c}
                        </span>
                      ))
                    ) : (
                      <p className="text-xs text-zinc-500 italic">No batches registered on plots yet.</p>
                    )}
                  </div>
                </div>

                {/* Registered Plots List */}
                <div className="mb-6">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                    Registered Plots ({detail.plots.length})
                  </h4>

                  {detail.plots.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">No GPS plots registered by this farmer.</p>
                  ) : (
                    <div className="space-y-3">
                      {detail.plots.map((plot, idx) => (
                        <div
                          key={plot.id}
                          className="p-3.5 bg-zinc-950/50 rounded-xl border border-zinc-800/70 text-xs"
                        >
                          <div className="flex justify-between font-semibold text-zinc-200 mb-1">
                            <span>{plot.name || `Plot #${idx + 1}`}</span>
                            <span className="text-teal-400">{plot.area_ha ? `${plot.area_ha} ha` : "Area unknown"}</span>
                          </div>
                          <div className="text-zinc-500 space-x-2">
                            <span>{plot.district || "District unset"}</span>
                            {plot.gn_division && <span>· GN: {plot.gn_division}</span>}
                            {plot.plot_type && <span>· {plot.plot_type}</span>}
                            {plot.boundary_source && <span>· {plot.boundary_source}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Link History & Reason */}
                <div className="bg-zinc-950/40 rounded-2xl border border-zinc-800/50 p-4 mb-6 text-xs text-zinc-400 space-y-1">
                  <div>Requested on: {new Date(detail.requested_at).toLocaleString()}</div>
                  {detail.decided_at && <div>Decided on: {new Date(detail.decided_at).toLocaleString()}</div>}
                  {detail.decision_reason && (
                    <div className="text-amber-300 mt-2 font-medium">
                      Reason: "{detail.decision_reason}"
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions Footer inside Drawer */}
            {detail && (
              <div className="border-t border-zinc-800 pt-5 mt-auto">
                {!isVerified ? (
                  <div className="p-3 bg-zinc-950 rounded-xl text-center text-xs text-zinc-500 border border-zinc-800">
                    🔒 Verification required to perform approvals or remove farmers.
                  </div>
                ) : detail.status === "requested" ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => setActionType("approve")}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-sm text-white shadow-lg shadow-emerald-950/50 transition-all hover:scale-[1.02]"
                    >
                      ✓ Approve Link
                    </button>
                    <button
                      onClick={() => setActionType("decline")}
                      className="flex-1 py-3 rounded-xl bg-zinc-800 hover:bg-red-950 hover:text-red-300 border border-zinc-700 font-bold text-sm text-zinc-300 transition-all"
                    >
                      ✕ Decline
                    </button>
                  </div>
                ) : detail.status === "approved" ? (
                  <div>
                    <button
                      onClick={() => setActionType("remove")}
                      className="w-full py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 font-semibold text-xs text-red-300 transition-all"
                    >
                      Remove from Network
                    </button>
                  </div>
                ) : (
                  <div className="text-center text-xs text-zinc-600">
                    This link is archived ({detail.status}).
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation / Reason Modal */}
      {actionType && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-xl font-extrabold text-white mb-2">
              {actionType === "approve"
                ? "Approve Connection Request"
                : actionType === "decline"
                ? "Decline Connection Request"
                : "Remove Farmer from Network"}
            </h3>

            <p className="text-zinc-400 text-sm mb-5">
              {actionType === "approve"
                ? `Confirm connecting with ${detail?.farmer.name}? You will gain access to their verified phone number and supply tracing.`
                : actionType === "decline"
                ? `Are you sure you want to decline this request from ${detail?.farmer.name}?`
                : `Are you sure you want to remove ${detail?.farmer.name}? They will be notified and removed from your active supplier list.`}
            </p>

            {(actionType === "decline" || actionType === "remove") && (
              <div className="mb-5">
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Optional Reason:
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Sourcing capacity reached, out of region..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full p-3 bg-zinc-950 border border-zinc-700 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-teal-500"
                />
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                disabled={actionSubmitting}
                onClick={() => { setActionType(null); setActionReason(""); }}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300"
              >
                Cancel
              </button>

              <button
                disabled={actionSubmitting}
                onClick={handleActionConfirm}
                className={`px-5 py-2 rounded-xl font-bold text-xs text-white shadow-lg transition-all ${
                  actionType === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-red-600 hover:bg-red-500"
                }`}
              >
                {actionSubmitting ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
