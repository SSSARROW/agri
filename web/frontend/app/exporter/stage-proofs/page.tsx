"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  fetchSubmissions,
  fetchSubmissionDetail,
  approveSubmission,
  rejectSubmission,
  reopenSubmission,
  SubmissionListItem,
  SubmissionDetail,
  SubmissionStatus,
} from "@/lib/stageProofsApi";
import { PageHeader } from "@/components/ui/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge, Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { Toast, ToastState } from "@/components/ui/toast";
import { ClipboardIcon } from "@/components/ui/icons";

type TabKey = "pending" | "approved" | "rejected" | "all";

const TABS: { key: TabKey; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function statusTone(status: string): Tone {
  switch (status) {
    case "pending":
      return "warning";
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

const EMPTY_COPY: Record<TabKey, { title: string; description: string }> = {
  pending: {
    title: "No pending submissions",
    description: "When farmers submit stage photo proof for review, it will appear here.",
  },
  approved: {
    title: "No approved submissions yet",
    description: "Submissions you approve will be logged here for your records.",
  },
  rejected: {
    title: "No rejected submissions",
    description: "Submissions you reject, along with your feedback to the farmer, appear here.",
  },
  all: {
    title: "No stage proof submissions yet",
    description: "Once your connected farmers start submitting stage photo proof, it will show up here.",
  },
};

type ActionType = "approve" | "reject" | "reopen" | null;

export default function ExporterStageProofsPage() {
  const [tab, setTab] = useState<TabKey>("pending");

  const [items, setItems] = useState<SubmissionListItem[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Detail drawer state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Action modal state
  const [actionType, setActionType] = useState<ActionType>(null);
  const [actionNotes, setActionNotes] = useState<string>("");
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam: SubmissionStatus | "all" = tab;
      const res = await fetchSubmissions({ status: statusParam, page, page_size: 12 });
      setItems(res.items);
      setTotalItems(res.total);
      setTotalPages(res.total_pages);
      setPendingCount(res.pending_count);
    } catch (err: any) {
      setError(err?.detail || err?.message || "Failed to load stage proof submissions.");
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setLoadingDetail(true);
    try {
      const data = await fetchSubmissionDetail(id);
      setDetail(data);
    } catch (err: any) {
      showToast(err?.detail || err?.message || "Failed to load submission details.", "error");
      setSelectedId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setActionType(null);
    setActionNotes("");
  };

  const handleActionConfirm = async () => {
    if (!selectedId || !actionType) return;
    setActionSubmitting(true);
    try {
      if (actionType === "approve") {
        await approveSubmission(selectedId, actionNotes.trim() || undefined);
        showToast("Submission approved.");
      } else if (actionType === "reject") {
        await rejectSubmission(selectedId, actionNotes.trim());
        showToast("Submission rejected. The farmer will see your reason.");
      } else if (actionType === "reopen") {
        await reopenSubmission(selectedId);
        showToast("Submission reopened — the farmer can resubmit for this stage.");
      }
      closeDetail();
      loadSubmissions();
    } catch (err: any) {
      showToast(err?.detail || err?.message || "Action failed. Please try again.", "error");
    } finally {
      setActionSubmitting(false);
    }
  };

  const emptyCopy = EMPTY_COPY[tab];

  return (
    <div>
      <Toast toast={toast} />

      <PageHeader
        eyebrow="Supply Network"
        title="Stage Proofs"
        subtitle="Review the photo evidence farmers submit per stage of your quality standard, and approve or reject each submission."
      />

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
              {t.key === "pending" && pendingCount > 0 && (
                <Badge tone="gold">{pendingCount}</Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Spinner size={32} />
          <p className="text-ink-500 text-sm">Loading submissions…</p>
        </div>
      ) : error ? (
        <Alert
          tone="danger"
          title={error}
          action={
            <Button size="sm" variant="secondary" onClick={loadSubmissions}>
              Retry
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ClipboardIcon className="w-6 h-6" />}
          title={emptyCopy.title}
          description={emptyCopy.description}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => openDetail(item.id)}
              className={`bg-paper-raised border rounded-xl p-5 transition-colors flex flex-col justify-between cursor-pointer hover:border-border-strong ${
                item.needs_attention ? "border-danger-border" : "border-border"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="font-display font-semibold text-base text-ink-900">
                      {item.farmer_name}
                    </h3>
                    <p className="text-xs text-ink-500 mt-0.5">{item.stage_name}</p>
                  </div>
                  <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                </div>

                {item.needs_attention && (
                  <div className="mb-3">
                    <Badge tone="danger">Needs attention</Badge>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 my-3 p-3 bg-paper-sunken rounded-lg border border-border text-xs">
                  <div>
                    <span className="text-ink-500 block">Plot</span>
                    <span className="text-ink-900 font-semibold">
                      {item.plot_name || "No plot linked"}
                    </span>
                  </div>
                  <div>
                    <span className="text-ink-500 block">Photos</span>
                    <span className="text-ink-900 font-semibold">{item.photo_count}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-border flex items-center justify-between text-xs text-ink-500">
                <span>Submitted: {new Date(item.submitted_at).toLocaleDateString()}</span>
                <Button size="sm" variant="secondary" onClick={() => openDetail(item.id)}>
                  Review
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
      {selectedId && (
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
                    <div className="mb-2 flex items-center gap-2">
                      <Badge tone={statusTone(detail.status)}>{detail.status}</Badge>
                      {detail.status === "rejected" && !detail.reopened_at && (
                        <Badge tone="danger">Needs attention</Badge>
                      )}
                    </div>
                    <h2 className="font-display text-2xl font-semibold text-ink-900">{detail.farmer_name}</h2>
                    <p className="text-sm text-ink-500 mt-0.5">
                      {detail.stage_name}
                      {detail.plot_name ? ` · ${detail.plot_name}` : " · No plot linked"}
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

                {/* Stage Instructions */}
                <div className="bg-paper-sunken rounded-xl border border-border p-5 mb-6">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-2">
                    Stage Instructions
                  </h4>
                  <p className="text-sm text-ink-900 whitespace-pre-wrap">
                    {detail.stage_instructions?.en || "No instructions recorded."}
                  </p>
                </div>

                {/* Photos */}
                <div className="mb-6">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-3">
                    Photo Evidence ({detail.photo_urls.length})
                  </h4>
                  {detail.photo_urls.length === 0 ? (
                    <p className="text-xs text-ink-500 italic">No photos were submitted.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {detail.photo_urls.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setLightboxUrl(url)}
                          className="block overflow-hidden rounded-lg border border-border hover:border-border-strong transition-colors"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Stage proof photo ${idx + 1}`}
                            className="w-full h-28 object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick field answers */}
                <div className="mb-6">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-3">
                    Quick Field Answers
                  </h4>
                  {Object.keys(detail.quick_field_answers || {}).length === 0 ? (
                    <p className="text-xs text-ink-500 italic">No quick field answers recorded.</p>
                  ) : (
                    <div className="space-y-2 text-sm">
                      {Object.entries(detail.quick_field_answers).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-start py-1.5 border-b border-border last:border-b-0">
                          <span className="text-ink-500">{key.replace(/_/g, " ")}</span>
                          <span className="text-ink-900 font-semibold text-right ml-4">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Farmer's note */}
                {detail.note && (
                  <div className="mb-6">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-ink-500 mb-2">
                      Farmer&apos;s Note
                    </h4>
                    <p className="text-sm text-ink-900 bg-paper-sunken border border-border rounded-lg p-3">
                      &quot;{detail.note}&quot;
                    </p>
                  </div>
                )}

                {/* Review history */}
                {(detail.reviewed_at || detail.review_notes || detail.reopened_at) && (
                  <div className="bg-paper-sunken rounded-lg border border-border p-4 mb-6 text-xs text-ink-500 space-y-1">
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                      Review History
                    </div>
                    <div>Submitted on: {new Date(detail.submitted_at).toLocaleString()}</div>
                    {detail.reviewed_at && <div>Reviewed on: {new Date(detail.reviewed_at).toLocaleString()}</div>}
                    {detail.review_notes && (
                      <div className="text-gold-700 mt-2 font-medium">
                        Notes: &quot;{detail.review_notes}&quot;
                      </div>
                    )}
                    {detail.reopened_at && (
                      <div className="text-success mt-2 font-medium">
                        Reopened on: {new Date(detail.reopened_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Actions Footer */}
            {detail && (
              <div className="border-t border-border pt-5 mt-auto">
                {detail.status === "pending" ? (
                  <div className="flex gap-3">
                    <Button
                      variant="primary"
                      className="flex-1"
                      onClick={() => { setActionType("approve"); setActionNotes(""); }}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      onClick={() => { setActionType("reject"); setActionNotes(""); }}
                    >
                      Reject
                    </Button>
                  </div>
                ) : detail.status === "rejected" ? (
                  detail.reopened_at ? (
                    <div className="text-center text-xs text-ink-400">
                      Already reopened — waiting for the farmer to resubmit.
                    </div>
                  ) : (
                    <Button
                      variant="primary"
                      className="w-full"
                      onClick={() => { setActionType("reopen"); setActionNotes(""); }}
                    >
                      Reopen for Resubmission
                    </Button>
                  )
                ) : (
                  <div className="text-center text-xs text-ink-400">
                    This submission has been approved.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      <Modal
        open={!!actionType}
        onClose={() => { setActionType(null); setActionNotes(""); }}
        title={
          actionType === "approve"
            ? "Approve Submission"
            : actionType === "reject"
            ? "Reject Submission"
            : "Reopen Submission"
        }
        footer={
          <>
            <Button
              variant="secondary"
              disabled={actionSubmitting}
              onClick={() => { setActionType(null); setActionNotes(""); }}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === "reject" ? "danger" : "primary"}
              disabled={actionSubmitting || (actionType === "reject" && !actionNotes.trim())}
              onClick={handleActionConfirm}
            >
              {actionSubmitting ? "Processing…" : "Confirm"}
            </Button>
          </>
        }
      >
        <p className="mb-4">
          {actionType === "approve"
            ? `Approve this stage proof submission from ${detail?.farmer_name}?`
            : actionType === "reject"
            ? `Reject this submission from ${detail?.farmer_name}? Your reason will be shown to the farmer so they know what to fix.`
            : `Reopen this stage for ${detail?.farmer_name}? This clears the "needs attention" block and lets them submit again.`}
        </p>

        {actionType === "approve" && (
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1.5">
              Optional Notes
            </label>
            <Textarea
              rows={3}
              placeholder="e.g. Looks good, thanks!"
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              className="resize-none"
            />
          </div>
        )}

        {actionType === "reject" && (
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1.5">
              Reason <span className="text-danger">*</span>
            </label>
            <Textarea
              rows={3}
              placeholder="e.g. Photo doesn't clearly show the planting row spacing — please retake."
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              className="resize-none"
            />
            <p className="text-xs text-ink-500 mt-1.5">
              A reason is required — the farmer will see this note.
            </p>
          </div>
        )}
      </Modal>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] bg-ink-900/85 flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setLightboxUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Stage proof photo full size"
            className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxUrl(null)}
            aria-label="Close"
            className="absolute top-6 right-6 p-2 text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
