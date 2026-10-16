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
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { Toast } from "@/components/ui/toast";
import { SearchIcon, ChevronRightIcon, SproutIcon, ShieldCheckIcon } from "@/components/ui/icons";

const SRI_LANKA_DISTRICTS = [
  "All Districts",
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo",
  "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara",
  "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar",
  "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya",
  "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya",
];

const CROPS = ["All Crops", "Tea", "Cinnamon", "Pepper", "Coffee", "Cardamom"];

// Maps the farmer-link status vocabulary to the badge tones used on this
// page — StatusBadge's generic map doesn't cover "requested"/"declined".
function linkStatusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "requested":
      return "warning";
    case "approved":
      return "success";
    case "declined":
      return "danger";
    default:
      return "neutral";
  }
}

const TABS = [
  { key: "requested" as const, label: "Requests" },
  { key: "approved" as const, label: "My Farmers" },
  { key: "past" as const, label: "Past" },
];

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

  const emptyCopy = {
    requested: {
      title: "No pending connection requests",
      description: "When farmers in your sourcing districts send requests, they will appear here for review.",
    },
    approved: {
      title: "No connected farmers yet",
      description: "Approve incoming farmer requests to start receiving their verified harvests.",
    },
    past: {
      title: "No past links",
      description: "Previously declined or removed farmers will be logged here for your records.",
    },
  }[tab];

  return (
    <div>
      <Toast toast={toast} />

      <PageHeader
        eyebrow="Supply Network"
        title="My Farmers"
        subtitle="Manage your connected growers, incoming connection requests, and crop supply details."
      />

      {!isVerified && (
        <div className="mb-6">
          <Alert tone="warning" title="Account unverified">
            Approvals and farmer management are disabled until your account is verified.
          </Alert>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                active
                  ? "text-brand-700 border-brand-700"
                  : "text-ink-500 border-transparent hover:text-ink-700"
              }`}
            >
              <span>{t.label}</span>
              {t.key === "requested" && pendingCount > 0 && (
                <Badge tone="gold">{pendingCount}</Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-paper-raised border border-border rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full">
          <div className="relative flex-1">
            <SearchIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search farmer by name..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-lg bg-paper-raised border border-border text-sm text-ink-900 placeholder-ink-400 transition-colors focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
            />
          </div>

          <Select
            value={districtFilter}
            onChange={(e) => { setDistrictFilter(e.target.value); setPage(1); }}
            className="sm:w-48"
          >
            {SRI_LANKA_DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>

          <Select
            value={cropFilter}
            onChange={(e) => { setCropFilter(e.target.value); setPage(1); }}
            className="sm:w-40"
          >
            {CROPS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>

        <div className="text-xs text-ink-500 whitespace-nowrap">
          Showing <span className="text-ink-900 font-semibold">{links.length}</span> of {totalItems}
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Spinner size={32} />
          <p className="text-ink-500 text-sm">Loading supply network…</p>
        </div>
      ) : error ? (
        <Alert
          tone="danger"
          title={error}
          action={
            <Button size="sm" variant="secondary" onClick={loadLinks}>
              Retry
            </Button>
          }
        />
      ) : links.length === 0 ? (
        <EmptyState
          icon={<SproutIcon className="w-6 h-6" />}
          title={emptyCopy.title}
          description={emptyCopy.description}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {links.map((item) => (
            <div
              key={item.id}
              className="bg-paper-raised border border-border hover:border-border-strong rounded-xl p-5 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-display font-semibold text-base text-ink-900">
                      {item.farmer.name}
                    </h3>
                    <p className="text-xs text-ink-500 mt-0.5">
                      {item.farmer.district || "District not set"}
                      {item.farmer.gn_division ? ` · GN ${item.farmer.gn_division}` : ""}
                    </p>
                  </div>

                  <Badge tone={linkStatusTone(item.status)}>{item.status}</Badge>
                </div>

                {/* Plot & Crop Stats */}
                <div className="grid grid-cols-2 gap-2 my-4 p-3 bg-paper-sunken rounded-lg border border-border text-xs">
                  <div>
                    <span className="text-ink-500 block">Plots Recorded</span>
                    <span className="text-ink-900 font-semibold">
                      {item.farmer.total_plots} ({item.farmer.total_plot_area_ha} ha)
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-500 block">Phone</span>
                    {item.farmer.phone ? (
                      <span className="text-brand-700 font-semibold">{item.farmer.phone}</span>
                    ) : (
                      <span className="text-ink-400 italic">Hidden</span>
                    )}
                  </div>
                </div>

                {/* Crop Badges */}
                <div className="mb-1">
                  <span className="text-xs text-ink-500 block mb-1.5 font-medium">Crops:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {item.farmer.crops.length > 0 ? (
                      item.farmer.crops.map((c) => (
                        <Badge key={c} tone="brand">{c}</Badge>
                      ))
                    ) : (
                      <span className="text-xs text-ink-400 italic">No batches yet</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs text-ink-500">
                <span>
                  {item.status === "requested"
                    ? `Requested: ${new Date(item.requested_at).toLocaleDateString()}`
                    : `Decided: ${item.decided_at ? new Date(item.decided_at).toLocaleDateString() : "-"}`}
                </span>

                <Button size="sm" variant="secondary" onClick={() => openDetail(item.id)}>
                  View Detail <ChevronRightIcon className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6">
          <Pagination page={page} totalPages={totalPages} totalItems={totalItems} onChange={setPage} />
        </div>
      )}

      {/* Detail Drawer */}
      {selectedLinkId && (
        <div className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px] flex justify-end">
          <div className="w-full max-w-xl bg-paper-raised border-l border-border h-full overflow-y-auto p-6 md:p-8 flex flex-col justify-between shadow-xl">
            {loadingDetail || !detail ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Spinner size={28} />
                <p className="text-ink-500 text-sm">Loading details…</p>
              </div>
            ) : (
              <div>
                {/* Drawer Header */}
                <div className="flex items-start justify-between border-b border-border pb-5 mb-6">
                  <div>
                    <div className="mb-2">
                      <Badge tone={linkStatusTone(detail.status)}>Status: {detail.status}</Badge>
                    </div>
                    <h2 className="font-display text-2xl font-semibold text-ink-900">{detail.farmer.name}</h2>
                    <p className="text-sm text-ink-500 mt-0.5">
                      {detail.farmer.district ? `District: ${detail.farmer.district}` : "No district"}
                      {detail.farmer.dsd ? ` · DSD: ${detail.farmer.dsd}` : ""}
                    </p>
                  </div>

                  <button
                    onClick={closeDetail}
                    aria-label="Close"
                    className="p-2 text-ink-400 hover:text-ink-700 rounded-lg hover:bg-paper-sunken transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Farmer Contact Info (Phone rules) */}
                <div className="bg-paper-sunken rounded-xl border border-border p-5 mb-6">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-3">
                    Contact &amp; Privacy
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center py-1.5 border-b border-border">
                      <span className="text-ink-500">Phone Number:</span>
                      {detail.farmer.phone ? (
                        <span className="font-mono text-brand-700 font-semibold">{detail.farmer.phone}</span>
                      ) : (
                        <span className="text-ink-400 text-xs italic">Hidden (visible once approved)</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center py-1.5 border-b border-border">
                      <span className="text-ink-500">Farm Address:</span>
                      <span className="text-ink-900">{detail.farmer.farm_address || "Not provided"}</span>
                    </div>

                    <div className="flex justify-between items-center py-1.5">
                      <span className="text-ink-500">Reported Farm Size:</span>
                      <span className="text-ink-900">
                        {detail.farmer.farm_size_ha ? `${detail.farmer.farm_size_ha} ha` : "Not specified"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Crops Produced */}
                <div className="mb-6">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-2">
                    Verified Crops
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {detail.farmer.crops.length > 0 ? (
                      detail.farmer.crops.map((c) => (
                        <Badge key={c} tone="brand">{c}</Badge>
                      ))
                    ) : (
                      <p className="text-xs text-ink-500 italic">No batches registered on plots yet.</p>
                    )}
                  </div>
                </div>

                {/* Registered Plots List */}
                <div className="mb-6">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-3">
                    Registered Plots ({detail.plots.length})
                  </h4>

                  {detail.plots.length === 0 ? (
                    <p className="text-xs text-ink-500 italic">No GPS plots registered by this farmer.</p>
                  ) : (
                    <div className="space-y-3">
                      {detail.plots.map((plot, idx) => (
                        <div
                          key={plot.id}
                          className="p-3.5 bg-paper-sunken rounded-lg border border-border text-xs"
                        >
                          <div className="flex justify-between font-semibold text-ink-900 mb-1">
                            <span>{plot.name || `Plot #${idx + 1}`}</span>
                            <span className="text-brand-700">{plot.area_ha ? `${plot.area_ha} ha` : "Area unknown"}</span>
                          </div>
                          <div className="text-ink-500 space-x-2">
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
                <div className="bg-paper-sunken rounded-lg border border-border p-4 mb-6 text-xs text-ink-500 space-y-1">
                  <div>Requested on: {new Date(detail.requested_at).toLocaleString()}</div>
                  {detail.decided_at && <div>Decided on: {new Date(detail.decided_at).toLocaleString()}</div>}
                  {detail.decision_reason && (
                    <div className="text-gold-700 mt-2 font-medium">
                      Reason: &quot;{detail.decision_reason}&quot;
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions Footer inside Drawer */}
            {detail && (
              <div className="border-t border-border pt-5 mt-auto">
                {!isVerified ? (
                  <div className="p-3 bg-paper-sunken rounded-lg border border-border flex items-center justify-center gap-2 text-center text-xs text-ink-500">
                    <ShieldCheckIcon className="w-4 h-4" />
                    Verification required to perform approvals or remove farmers.
                  </div>
                ) : detail.status === "requested" ? (
                  <div className="flex gap-3">
                    <Button variant="primary" className="flex-1" onClick={() => setActionType("approve")}>
                      Approve Link
                    </Button>
                    <Button variant="secondary" className="flex-1" onClick={() => setActionType("decline")}>
                      Decline
                    </Button>
                  </div>
                ) : detail.status === "approved" ? (
                  <Button variant="danger" className="w-full" onClick={() => setActionType("remove")}>
                    Remove from Network
                  </Button>
                ) : (
                  <div className="text-center text-xs text-ink-400">
                    This link is archived ({detail.status}).
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation / Reason Modal */}
      <Modal
        open={!!actionType}
        onClose={() => { setActionType(null); setActionReason(""); }}
        title={
          actionType === "approve"
            ? "Approve Connection Request"
            : actionType === "decline"
            ? "Decline Connection Request"
            : "Remove Farmer from Network"
        }
        footer={
          <>
            <Button
              variant="secondary"
              disabled={actionSubmitting}
              onClick={() => { setActionType(null); setActionReason(""); }}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === "approve" ? "primary" : "danger"}
              disabled={actionSubmitting}
              onClick={handleActionConfirm}
            >
              {actionSubmitting ? "Processing…" : "Confirm"}
            </Button>
          </>
        }
      >
        <p className="mb-4">
          {actionType === "approve"
            ? `Confirm connecting with ${detail?.farmer.name}? You will gain access to their verified phone number and supply tracing.`
            : actionType === "decline"
            ? `Are you sure you want to decline this request from ${detail?.farmer.name}?`
            : `Are you sure you want to remove ${detail?.farmer.name}? They will be notified and removed from your active supplier list.`}
        </p>

        {(actionType === "decline" || actionType === "remove") && (
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1.5">
              Optional Reason
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Sourcing capacity reached, out of region..."
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-paper-raised border border-border text-sm text-ink-900 placeholder-ink-400 transition-colors focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 resize-none"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
