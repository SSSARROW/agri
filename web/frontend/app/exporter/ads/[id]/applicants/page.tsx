"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import {
  fetchApplicants,
  approveApplicant,
  declineApplicant,
  ApplicantItem,
  AdApplicantsResponse,
} from "@/lib/adsApi";
import { fetchExporterProfile, ExporterProfile } from "@/lib/exporterApi";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function AdApplicantsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const adId = resolvedParams.id;

  const [data, setData] = useState<AdApplicantsResponse | null>(null);
  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Filters & Pagination
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  // Approve Modal State
  const [approvingApplicant, setApprovingApplicant] = useState<ApplicantItem | null>(null);
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Decline Modal State
  const [decliningApplicant, setDecliningApplicant] = useState<ApplicantItem | null>(null);
  const [declineReason, setDeclineReason] = useState<string>("Capacity fulfilled / ineligible");

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadApplicants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appsRes, profRes] = await Promise.all([
        fetchApplicants(adId, {
          status: statusFilter || undefined,
          search: searchQuery || undefined,
          page,
          page_size: 10,
        }),
        fetchExporterProfile().catch(() => null),
      ]);
      setData(appsRes);
      if (profRes) setProfile(profRes);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load advertisement applicants.");
    } finally {
      setLoading(false);
    }
  }, [adId, statusFilter, searchQuery, page]);

  useEffect(() => {
    loadApplicants();
  }, [loadApplicants]);

  const handleApprove = async () => {
    if (!approvingApplicant) return;
    setActionLoading(true);
    try {
      await approveApplicant(adId, approvingApplicant.acceptance_id);
      showToast(`Approved ${approvingApplicant.farmer_name} for ${approvingApplicant.supply_quantity_kg}kg.`);
      setApprovingApplicant(null);
      loadApplicants();
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to approve applicant.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!decliningApplicant) return;
    setActionLoading(true);
    try {
      await declineApplicant(adId, decliningApplicant.acceptance_id, declineReason);
      showToast(`Declined application from ${decliningApplicant.farmer_name}.`);
      setDecliningApplicant(null);
      loadApplicants();
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to decline applicant.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const isVerified = profile?.status === "verified";

  const getStatusBadge = (status: ApplicantItem["derived_status"]) => {
    switch (status) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Approved
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Pending Review
          </span>
        );
      case "declined":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            Declined
          </span>
        );
      case "withdrawn":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-700/40 text-zinc-400 border border-zinc-600/30">
            Withdrawn
          </span>
        );
      case "removed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">
            Removed
          </span>
        );
    }
  };

  const progressPercent = data && data.target_quantity_kg > 0
    ? Math.min(100, Math.round((data.approved_quantity_kg / data.target_quantity_kg) * 100))
    : 0;

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
      <div className="pb-6 border-b border-zinc-800">
        <Link
          href={`/exporter/ads/${adId}`}
          className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          ← Back to Advertisement
        </Link>

        <div className="mt-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                {data?.crop || "Ad"}
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
                Purchase Request Applicants
              </h1>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Review and approve supply proposals from local smallholder farmers.
            </p>
          </div>

          {data?.is_filled && (
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-600/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Target Capacity Fulfilled (100%)
            </div>
          )}
        </div>

        {/* Capacity Summary Progress Card */}
        {data && (
          <div className="mt-6 p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-zinc-500 block mb-0.5">Target Volume</span>
                <span className="text-base font-bold text-zinc-100">
                  {Number(data.target_quantity_kg).toLocaleString()} kg
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5">Approved Volume</span>
                <span className="text-base font-bold text-emerald-400">
                  {Number(data.approved_quantity_kg).toLocaleString()} kg
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5">Pending Proposals</span>
                <span className="text-base font-bold text-amber-400">
                  {Number(data.pending_quantity_kg).toLocaleString()} kg
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-0.5">Remaining Capacity</span>
                <span className="text-base font-bold text-teal-300">
                  {Number(data.remaining_quantity_kg).toLocaleString()} kg
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5 font-medium">
                <span>Progress: {progressPercent}% of target</span>
                <span>{Number(data.remaining_quantity_kg).toLocaleString()} kg remaining</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-zinc-950 overflow-hidden border border-zinc-800">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unverified Exporter Warning */}
      {!isVerified && profile && (
        <div className="mt-6 p-4 rounded-xl bg-amber-950/40 border border-amber-600/30 text-amber-200 text-xs flex items-start gap-3">
          <span className="text-base">⚠️</span>
          <div>
            <p className="font-semibold text-amber-100">
              Account Verification Required for Approvals
            </p>
            <p className="text-amber-300/90 mt-0.5">
              You can review applicant submissions in read-only mode. Approving supply commitments requires an approved and verified exporter profile.
            </p>
          </div>
        </div>
      )}

      {/* Filters & Tabs */}
      <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs overflow-x-auto">
          {[
            { id: "", label: "All Applicants" },
            { id: "pending", label: "Pending" },
            { id: "approved", label: "Approved" },
            { id: "declined", label: "Declined" },
            { id: "withdrawn", label: "Withdrawn" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? "bg-zinc-800 text-teal-400 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by farmer name..."
            className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-500 text-xs focus:outline-none focus:border-teal-500/50"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
          <p className="text-zinc-500 text-xs font-medium">Loading applicant proposals…</p>
        </div>
      ) : error ? (
        <div className="my-12 p-6 rounded-2xl bg-red-950/30 border border-red-900/50 text-center">
          <p className="text-red-300 font-semibold text-sm mb-2">Error Loading Applicants</p>
          <p className="text-zinc-400 text-xs mb-4">{error}</p>
          <button
            onClick={loadApplicants}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="my-12 p-12 rounded-2xl bg-zinc-900/40 border border-zinc-800 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center text-2xl mb-3">
            🌾
          </div>
          <h3 className="text-base font-semibold text-zinc-200 mb-1">No Applicants Found</h3>
          <p className="text-xs text-zinc-400 max-w-sm">
            {statusFilter || searchQuery
              ? "No applicants match your current filters. Try resetting status or search."
              : "No farmers have accepted this advertisement yet. Eligible farmers can accept via the farmer API."}
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {data.items.map((app) => {
            const isPending = app.derived_status === "pending";
            const acceptedDate = new Date(app.accepted_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            });

            return (
              <div
                key={app.acceptance_id}
                className="p-5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700/80 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Farmer Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-semibold text-zinc-100">
                        {app.farmer_name}
                      </h3>
                      {getStatusBadge(app.derived_status)}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                      <span>
                        <span className="text-zinc-500">District:</span>{" "}
                        <strong className="text-zinc-300">{app.farmer_district || "Not specified"}</strong>
                      </span>
                      {app.dsd && (
                        <span>
                          <span className="text-zinc-500">DSD:</span> {app.dsd}
                        </span>
                      )}
                      {app.farm_size_ha && (
                        <span>
                          <span className="text-zinc-500">Farm Size:</span> {app.farm_size_ha} ha
                        </span>
                      )}
                      <span>
                        <span className="text-zinc-500">Accepted:</span> {acceptedDate}
                      </span>
                    </div>

                    {/* Plots snippet */}
                    {app.plots.length > 0 && (
                      <div className="mt-2 text-xs text-zinc-400">
                        <span className="text-zinc-500">Plots:</span>{" "}
                        {app.plots.map((p) => `${p.name} (${p.area_ha ? p.area_ha + " ha" : "N/A"})`).join(", ")}
                      </div>
                    )}

                    {/* Phone Privacy Section */}
                    <div className="mt-3 text-xs">
                      {app.derived_status === "approved" ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-300 font-mono bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-800/30">
                          📞 {app.phone || "No phone on profile"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-zinc-500 bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-800">
                          🔒 Phone hidden until approved
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Supply Quantity & Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-zinc-800">
                    <div className="text-right">
                      <span className="text-zinc-500 text-xs block">Offered Supply</span>
                      <span className="text-lg font-bold text-teal-300">
                        {Number(app.supply_quantity_kg).toLocaleString()} kg
                      </span>
                    </div>

                    {/* Decision Actions */}
                    {isPending && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setDecliningApplicant(app)}
                          disabled={!isVerified || actionLoading}
                          className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => setApprovingApplicant(app)}
                          disabled={!isVerified || actionLoading}
                          className="px-4 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-bold transition-all shadow-md shadow-teal-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Approve Supply
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="mt-8 flex items-center justify-between border-t border-zinc-800 pt-4">
          <p className="text-xs text-zinc-500">
            Page <span className="font-semibold text-zinc-300">{page}</span> of{" "}
            <span className="font-semibold text-zinc-300">{data.total_pages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
              disabled={page >= data.total_pages}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Approve Confirmation Modal */}
      {approvingApplicant && data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-100">
              Confirm Supply Approval
            </h3>
            <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
              You are approving <strong className="text-zinc-200">{approvingApplicant.farmer_name}</strong> to supply{" "}
              <strong className="text-teal-300">{Number(approvingApplicant.supply_quantity_kg).toLocaleString()} kg</strong> of harvest.
              This will create an approved farmer link and disclose the farmer's contact phone number.
            </p>

            <div className="mt-4 p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Current Approved:</span>
                <span className="font-semibold text-zinc-200">{Number(data.approved_quantity_kg).toLocaleString()} kg</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>New Approval:</span>
                <span className="font-semibold text-teal-400">+{Number(approvingApplicant.supply_quantity_kg).toLocaleString()} kg</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-1 text-zinc-300 font-bold">
                <span>Remaining Capacity:</span>
                <span className="text-emerald-400">
                  {Math.max(0, data.remaining_quantity_kg - approvingApplicant.supply_quantity_kg).toLocaleString()} kg
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setApprovingApplicant(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                className="px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-bold transition-all shadow-md disabled:opacity-50"
              >
                {actionLoading ? "Approving…" : "Confirm & Approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Reason Modal */}
      {decliningApplicant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-zinc-100">
              Decline Application
            </h3>
            <p className="mt-2 text-xs text-zinc-400">
              Decline supply application from <strong className="text-zinc-200">{decliningApplicant.farmer_name}</strong>.
              You may provide an optional reason.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                Reason for Declining (Optional)
              </label>
              <textarea
                rows={3}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g. Sourcing capacity filled, logistics outside range..."
                className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-rose-500/50"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDecliningApplicant(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDecline}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
              >
                {actionLoading ? "Declining…" : "Confirm Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
