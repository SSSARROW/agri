"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  fetchAdminAds,
  fetchAdminAdDetail,
  takedownAd,
  restoreAd,
  AdminAdItem,
  AdminAdDetail,
} from "@/lib/adminAdsApi";
import {
  PageHeader,
  Alert,
  Badge,
  Button,
  Input,
  Textarea,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Pagination,
  EmptyState,
  SectionSpinner,
  Spinner,
  Toast,
  ToastState,
  Modal,
  ConfirmModal,
  MegaphoneIcon,
  SearchIcon,
} from "@/components/ui";
import { STATUS_TONE } from "@/components/ui/badge";

const ENABLE_AD_MODERATION =
  process.env.NEXT_PUBLIC_ENABLE_AD_MODERATION !== "false";

const STATE_TABS = [
  { key: "", label: "All" },
  { key: "live", label: "Live" },
  { key: "taken_down", label: "Taken Down" },
  { key: "expired", label: "Expired" },
  { key: "closed", label: "Closed" },
] as const;

function stateLabel(s: string) {
  if (s === "taken_down") return "Taken Down";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function StateBadge({ state }: { state: string }) {
  return <Badge tone={STATUS_TONE[state] ?? "neutral"}>{stateLabel(state)}</Badge>;
}

export default function AdminAdsPage() {
  if (!ENABLE_AD_MODERATION) return null;

  // List state
  const [ads, setAds] = useState<AdminAdItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<ToastState>(null);

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
    loadAds();
  }, [loadAds]);

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

  const isTakenDown = detail?.admin_state === "taken_down";
  const isLive = detail?.admin_state === "live";

  return (
    <div className="max-w-7xl mx-auto">
      <Toast toast={toast} />

      <PageHeader
        eyebrow="Admin"
        title="Ad Moderation"
        subtitle="Review, takedown and restore advertisements."
      />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left: list */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Filter bar */}
          <div className="bg-paper-raised border border-border rounded-xl p-4 space-y-3">
            <div className="flex gap-1.5 flex-wrap items-center">
              {STATE_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setActiveTab(t.key);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    activeTab === t.key
                      ? "bg-brand-50 text-brand-700 border border-brand-200"
                      : "text-ink-500 hover:text-ink-700 hover:bg-paper-sunken"
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <button
                onClick={() => {
                  setHasOpenReports(hasOpenReports === true ? null : true);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ml-auto ${
                  hasOpenReports === true
                    ? "bg-warning-bg text-warning border border-warning-border"
                    : "text-ink-500 hover:text-ink-700 hover:bg-paper-sunken"
                }`}
              >
                With reports
              </button>
            </div>

            <div className="relative">
              <SearchIcon className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                aria-label="Search ads"
                placeholder="Search by exporter company or ad title…"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>

          {error && <Alert tone="danger" title={error} />}

          {loadingList ? (
            <SectionSpinner />
          ) : ads.length === 0 ? (
            <EmptyState icon={<MegaphoneIcon className="w-6 h-6" />} title="No advertisements found" />
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>Ad / Exporter</Th>
                  <Th>Crop</Th>
                  <Th>State</Th>
                  <Th>Reports</Th>
                  <Th>Views</Th>
                  <Th>Accepts</Th>
                </tr>
              </Thead>
              <Tbody>
                {ads.map((ad) => (
                  <Tr
                    key={ad.id}
                    onClick={() => openDetail(ad.id)}
                    className={selectedId === ad.id ? "bg-brand-50" : ""}
                  >
                    <Td>
                      <div className="font-semibold text-ink-900 truncate max-w-[220px]">
                        {ad.title?.en || "Untitled"}
                      </div>
                      <div className="text-xs text-ink-500 truncate">{ad.exporter_company}</div>
                    </Td>
                    <Td>
                      <span className="text-xs font-semibold uppercase bg-paper-sunken text-ink-700 px-2 py-0.5 rounded-md">
                        {ad.crop}
                      </span>
                    </Td>
                    <Td>
                      <StateBadge state={ad.admin_state} />
                    </Td>
                    <Td>
                      {ad.open_report_count > 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-warning">
                          <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                          {ad.open_report_count}
                        </span>
                      ) : (
                        <span className="text-ink-400 text-xs">—</span>
                      )}
                    </Td>
                    <Td className="text-ink-500">{ad.total_views}</Td>
                    <Td className="text-ink-500">{ad.total_accepts}</Td>
                  </Tr>
                ))}
              </Tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="p-0">
                    <Pagination page={page} totalPages={totalPages} totalItems={total} onChange={setPage} />
                  </td>
                </tr>
              </tfoot>
            </Table>
          )}
        </div>

        {/* Right: detail drawer */}
        {selectedId && (
          <div className="w-full lg:w-[420px] shrink-0">
            <div className="bg-paper-raised border border-border rounded-xl p-5 space-y-5 lg:sticky lg:top-6 max-h-[calc(100vh-120px)] overflow-y-auto">
              {loadingDetail ? (
                <SectionSpinner />
              ) : detail ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <StateBadge state={detail.admin_state} />
                      <h2 className="mt-2 font-display text-base font-semibold text-ink-900 leading-snug">
                        {detail.live_version?.title?.en || "Untitled"}
                      </h2>
                      <p className="text-xs text-ink-500 mt-0.5">
                        {detail.exporter?.company_name || "Unknown Exporter"} · {detail.crop.toUpperCase()}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedId(null);
                        setDetail(null);
                      }}
                      aria-label="Close"
                      className="text-ink-400 hover:text-ink-700 transition-colors p-1 shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {detail.admin_state === "taken_down" && (
                    <Alert tone="danger" title="Taken down by administrator">
                      {detail.closed_reason?.replace("taken_down: ", "") || "No reason provided"}
                    </Alert>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Views", value: detail.stats.total_views },
                      { label: "Unique Viewers", value: detail.stats.unique_viewers },
                      { label: "Accepts", value: detail.stats.total_accepts },
                      { label: "Active", value: detail.stats.active_accepts },
                    ].map((s) => (
                      <div key={s.label} className="bg-paper-sunken rounded-xl p-3 border border-border">
                        <p className="text-[10px] text-ink-500 uppercase tracking-wider">{s.label}</p>
                        <p className="text-xl font-display font-semibold text-ink-900 mt-0.5">{s.value}</p>
                      </div>
                    ))}
                  </div>

                  {detail.reports.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-ink-700 uppercase tracking-wider mb-2">
                        Reports ({detail.reports.filter((r) => r.status === "open").length} open)
                      </h3>
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {detail.reports.map((r) => (
                          <div key={r.id} className="p-3 rounded-xl bg-paper-sunken border border-border text-xs space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-ink-900 capitalize">
                                {r.reason.replace(/_/g, " ")}
                              </span>
                              <Badge tone={r.status === "open" ? "warning" : "neutral"}>{r.status}</Badge>
                            </div>
                            {r.details && <p className="text-ink-700">{r.details}</p>}
                            <p className="text-ink-400">
                              {r.farmer?.name || "Farmer"} · {new Date(r.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail.moderation_log.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-ink-700 uppercase tracking-wider mb-2">
                        Moderation History
                      </h3>
                      <div className="space-y-2">
                        {detail.moderation_log.map((m) => (
                          <div key={m.id} className="p-3 rounded-xl bg-paper-sunken border border-border text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-bold capitalize ${
                                  m.action === "takedown" ? "text-danger" : "text-success"
                                }`}
                              >
                                {m.action}
                              </span>
                              <span className="text-ink-500">by {m.admin_user?.name || m.admin_user?.email || "Admin"}</span>
                            </div>
                            {m.reason && <p className="text-ink-700 mt-0.5">{m.reason}</p>}
                            <p className="text-ink-400 mt-0.5">{new Date(m.created_at).toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-paper-sunken border border-border text-xs space-y-1">
                    <h3 className="font-semibold text-ink-900">Exporter</h3>
                    <p className="text-ink-700">{detail.exporter?.company_name}</p>
                    <p className="text-ink-500">{detail.exporter?.email}</p>
                    <p className="text-ink-500">{detail.exporter?.phone}</p>
                  </div>

                  <div className="flex gap-2 pt-1 border-t border-border">
                    {isLive && (
                      <Button variant="danger" size="sm" className="flex-1" onClick={() => setShowTakedownDialog(true)}>
                        Take down
                      </Button>
                    )}
                    {isTakenDown && (
                      <Button variant="primary" size="sm" className="flex-1" onClick={() => setShowRestoreDialog(true)}>
                        Restore
                      </Button>
                    )}
                    <Button href={`/exporter/ads/${detail.id}`} target="_blank" variant="secondary" size="sm">
                      View ad ↗
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Takedown dialog */}
      <Modal
        open={showTakedownDialog}
        onClose={() => {
          setShowTakedownDialog(false);
          setTakedownReason("");
        }}
        title="Take Down Advertisement"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowTakedownDialog(false);
                setTakedownReason("");
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" disabled={submitting || !takedownReason.trim()} onClick={handleTakedown}>
              {submitting ? (
                <>
                  <Spinner size={14} /> Taking down…
                </>
              ) : (
                "Confirm takedown"
              )}
            </Button>
          </>
        }
      >
        <p className="mb-3">This ad will be immediately hidden from farmers. Provide a clear reason.</p>
        <Textarea
          rows={3}
          value={takedownReason}
          onChange={(e) => setTakedownReason(e.target.value)}
          placeholder="e.g. Misleading pricing information reported by multiple farmers."
        />
      </Modal>

      {/* Restore dialog */}
      <ConfirmModal
        open={showRestoreDialog}
        onClose={() => setShowRestoreDialog(false)}
        onConfirm={handleRestore}
        title="Restore Advertisement"
        confirmLabel="Confirm restore"
        confirmVariant="primary"
        loading={submitting}
      >
        This will restore the ad to <span className="font-semibold text-success">published</span> and make it
        visible to farmers again. Only possible if the published version has not expired.
      </ConfirmModal>
    </div>
  );
}
