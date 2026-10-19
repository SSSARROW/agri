"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  fetchNoticeDetail,
  updateDraftNotice,
  publishNotice,
  cancelNotice,
  duplicateNotice,
  fetchNoticeResponses,
  NoticeDetail,
  FarmerResponseItem,
} from "@/lib/plantingNoticesApi";
import { fetchExporterProfile, ExporterProfile } from "@/lib/exporterApi";
import { fetchStandards, StandardData, VersionSummary } from "@/lib/standardsApi";
import { SRI_LANKA_DISTRICTS } from "@/lib/adsApi";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, Tone } from "@/components/ui/badge";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Table, Thead, Tbody, Tr, Th, Td, Pagination } from "@/components/ui/table";
import { Alert } from "@/components/ui/alert";
import { Toast, ToastState } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { SectionSpinner } from "@/components/ui/spinner";
import { NoticeReminders } from "@/components/exporter/notice-reminders";

const STATE_TONE: Record<string, Tone> = {
  draft: "warning",
  upcoming: "success",
  past: "neutral",
  cancelled: "danger",
};

const RESPONSE_TONE: Record<string, Tone> = {
  ready: "success",
  cannot: "danger",
  no_reply: "neutral",
};

const RESPONSE_LABEL: Record<string, string> = {
  ready: "Ready",
  cannot: "Cannot",
  no_reply: "Pending",
};

const CROP_LABEL: Record<string, string> = {
  tea: "Tea",
  cinnamon: "Cinnamon",
};

export default function PlantingNoticeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const noticeId = params.id as string;

  const [notice, setNotice] = useState<NoticeDetail | null>(null);
  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  // Draft editing state
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [editCrop, setEditCrop] = useState<"tea" | "cinnamon">("tea");
  const [editStandardVersionId, setEditStandardVersionId] = useState<string>("");
  const [editTargetMonth, setEditTargetMonth] = useState<string>("");
  const [editVolumeNeededKg, setEditVolumeNeededKg] = useState<string>("");
  const [editDistricts, setEditDistricts] = useState<string[]>([]);
  const [editTitle, setEditTitle] = useState({ en: "", si: "", ta: "" });
  const [editMessage, setEditMessage] = useState({ en: "", si: "", ta: "" });
  const [activeLangTab, setActiveLangTab] = useState<"en" | "si" | "ta">("en");
  const [savingDraft, setSavingDraft] = useState(false);

  // Standards for draft editing
  const [standards, setStandards] = useState<StandardData[]>([]);

  // Responses breakdown state
  const [responses, setResponses] = useState<FarmerResponseItem[]>([]);
  const [responseFilter, setResponseFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [respPage, setRespPage] = useState<number>(1);
  const [respTotalPages, setRespTotalPages] = useState<number>(1);
  const [respTotal, setRespTotal] = useState<number>(0);
  const [loadingResponses, setLoadingResponses] = useState(false);

  // Action modals
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const [duplicating, setDuplicating] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadNoticeData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [n, p] = await Promise.all([
        fetchNoticeDetail(noticeId),
        fetchExporterProfile().catch(() => null),
      ]);
      setNotice(n);
      if (p) setProfile(p);

      // Populate draft fields
      setEditCrop(n.crop as "tea" | "cinnamon");
      setEditStandardVersionId(n.standard_version_id);
      setEditTargetMonth(n.target_month.slice(0, 7));
      setEditVolumeNeededKg(String(n.volume_needed_kg));
      setEditDistricts(n.eligible_districts || []);
      setEditTitle({
        en: n.title?.en || "",
        si: n.title?.si || "",
        ta: n.title?.ta || "",
      });
      setEditMessage({
        en: n.message?.en || "",
        si: n.message?.si || "",
        ta: n.message?.ta || "",
      });
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load planting notice.");
    } finally {
      setLoading(false);
    }
  }, [noticeId]);

  const loadResponsesData = useCallback(async () => {
    setLoadingResponses(true);
    try {
      const res = await fetchNoticeResponses(noticeId, {
        response: responseFilter || undefined,
        search: searchQuery || undefined,
        page: respPage,
        page_size: 15,
      });
      setResponses(res.items);
      setRespTotalPages(res.total_pages);
      setRespTotal(res.total);
    } catch (err: any) {
      console.error("Failed to load responses", err);
    } finally {
      setLoadingResponses(false);
    }
  }, [noticeId, responseFilter, searchQuery, respPage]);

  useEffect(() => {
    loadNoticeData();
  }, [loadNoticeData]);

  useEffect(() => {
    loadResponsesData();
  }, [loadResponsesData]);

  useEffect(() => {
    // If draft, load standards for editing
    if (notice?.status === "draft") {
      fetchStandards({ is_archived: false })
        .then((res) => setStandards(res.items || []))
        .catch(console.error);
    }
  }, [notice?.status]);

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDraft(true);
    try {
      const updated = await updateDraftNotice(noticeId, {
        crop: editCrop,
        standard_version_id: editStandardVersionId,
        target_month: `${editTargetMonth}-01`,
        volume_needed_kg: parseFloat(editVolumeNeededKg),
        eligible_districts: editDistricts,
        title: {
          en: editTitle.en.trim(),
          si: editTitle.si.trim() || undefined,
          ta: editTitle.ta.trim() || undefined,
        },
        message: {
          en: editMessage.en.trim(),
          si: editMessage.si.trim() || undefined,
          ta: editMessage.ta.trim() || undefined,
        },
      });
      setNotice(updated);
      setIsEditingDraft(false);
      showToast("Draft notice updated successfully.");
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to update draft.", "error");
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const pub = await publishNotice(noticeId);
      setNotice(pub);
      setShowPublishModal(false);
      showToast("Planting notice published successfully!");
      loadResponsesData();
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to publish notice.", "error");
    } finally {
      setPublishing(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const can = await cancelNotice(noticeId, cancelReason);
      setNotice(can);
      setShowCancelModal(false);
      showToast("Planting notice has been cancelled. Active bindings released.");
      loadResponsesData();
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to cancel notice.", "error");
    } finally {
      setCancelling(false);
    }
  };

  const handleDuplicate = async () => {
    setDuplicating(true);
    try {
      const dup = await duplicateNotice(noticeId);
      showToast("Planting notice duplicated as draft.");
      router.push(`/exporter/planting-notices/${dup.id}`);
    } catch (err: any) {
      showToast(err.detail || "Failed to duplicate notice.", "error");
    } finally {
      setDuplicating(false);
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

  const isVerified = profile?.status === "verified";

  if (loading) {
    return <SectionSpinner />;
  }

  if (error || !notice) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Alert tone="danger" title={error || "Planting notice not found."} />
        <Link
          href="/exporter/planting-notices"
          className="text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          ← Back to Planting Notices
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <Toast toast={toast} />

      <div className="mb-4">
        <Link
          href="/exporter/planting-notices"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          ← Back to Planting Notices
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Badge tone="neutral">{CROP_LABEL[notice.crop] || notice.crop}</Badge>
        <Badge tone={STATE_TONE[notice.computed_state] ?? "neutral"}>
          {notice.computed_state}
        </Badge>
        <span className="text-xs text-ink-400">
          Target Month: {formatTargetMonth(notice.target_month)}
        </span>
      </div>

      <PageHeader
        title={notice.title?.en || "Planting Notice"}
        subtitle={
          notice.standard_name
            ? `Quality Standard: ${notice.standard_name} (v${notice.standard_version_number})`
            : undefined
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {notice.status === "draft" && !isEditingDraft && (
              <Button variant="secondary" onClick={() => setIsEditingDraft(true)}>
                Edit Draft
              </Button>
            )}
            {notice.status === "draft" && (
              <Button
                onClick={() => setShowPublishModal(true)}
                disabled={!isVerified}
                title={!isVerified ? "Company verification required" : ""}
              >
                Publish Notice
              </Button>
            )}
            {notice.status === "published" && (
              <Button
                variant="danger"
                onClick={() => setShowCancelModal(true)}
                disabled={!isVerified}
                title={!isVerified ? "Company verification required" : ""}
              >
                Cancel Notice
              </Button>
            )}
            <Button variant="ghost" onClick={handleDuplicate} disabled={duplicating}>
              {duplicating ? "Duplicating..." : "Duplicate"}
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        {notice.status === "cancelled" && notice.cancelled_reason && (
          <Alert tone="danger" title="Cancellation Reason">
            {notice.cancelled_reason}
          </Alert>
        )}

        {!isVerified && (
          <Alert
            tone="warning"
            title="Company verification required"
            action={
              <Link href="/exporter/profile" className="text-xs font-semibold text-warning underline">
                View Profile
              </Link>
            }
          >
            Your exporter account must be verified by an administrator before you can publish or
            cancel planting notices.
          </Alert>
        )}

        {/* Progress & Counters Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="md:col-span-2 space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-ink-700">Committed Supply Progress</span>
              <span className="font-bold text-ink-900">
                {notice.total_expected_volume_kg.toLocaleString()} / {notice.volume_needed_kg.toLocaleString()} kg
              </span>
            </div>
            <div className="w-full bg-paper-sunken border border-border rounded-full h-3 overflow-hidden">
              <div
                className={`h-3 rounded-full transition-all ${
                  notice.volume_percentage >= 100
                    ? "bg-brand-700"
                    : notice.volume_percentage >= 50
                    ? "bg-brand-500"
                    : "bg-gold-500"
                }`}
                style={{ width: `${Math.min(100, notice.volume_percentage)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-ink-500">
              <span>{notice.volume_percentage.toFixed(1)}% of required volume</span>
              <span>Target Month: {formatTargetMonth(notice.target_month)}</span>
            </div>
          </Card>

          <Card className="bg-success-bg border-success-border flex flex-col justify-between">
            <div className="text-xs font-semibold text-success">Ready Responses</div>
            <div className="text-2xl font-display font-semibold text-success mt-2">
              {notice.counts.ready}
            </div>
            <div className="text-[11px] text-success mt-1">
              {notice.total_expected_volume_kg.toLocaleString()} kg bound
            </div>
          </Card>

          <Card className="flex flex-col justify-between">
            <div className="text-xs font-semibold text-ink-500">Pending / Cannot</div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-display font-semibold text-ink-900">
                {notice.counts.no_reply}
              </span>
              <span className="text-xs text-ink-400">pending</span>
              <span className="text-xs text-danger font-semibold ml-auto">
                {notice.counts.cannot} cannot
              </span>
            </div>
            <div className="text-[11px] text-ink-500 mt-1">
              Out of {notice.counts.eligible_total} eligible approved farmers
            </div>
          </Card>
        </div>

        {/* Draft Editable Form (if editing draft) */}
        {isEditingDraft ? (
          <Card className="border-brand-200">
            <form onSubmit={handleSaveDraft} className="space-y-6">
              <CardHeader
                title="Edit Draft Details"
                action={
                  <button
                    type="button"
                    onClick={() => setIsEditingDraft(false)}
                    className="text-xs text-ink-500 hover:text-ink-900"
                  >
                    Cancel Edit
                  </button>
                }
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Field label="Target Volume (kg)" required>
                  <Input
                    type="number"
                    min="1"
                    value={editVolumeNeededKg}
                    onChange={(e) => setEditVolumeNeededKg(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Target Month" required>
                  <Input
                    type="month"
                    value={editTargetMonth}
                    onChange={(e) => setEditTargetMonth(e.target.value)}
                    required
                  />
                </Field>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-ink-700">
                    Multilingual Title & Message
                  </label>
                  <div className="flex gap-1 bg-paper-sunken p-1 rounded-md">
                    {(["en", "si", "ta"] as const).map((l) => (
                      <button
                        type="button"
                        key={l}
                        onClick={() => setActiveLangTab(l)}
                        className={`px-2.5 py-0.5 text-xs rounded font-semibold transition-colors ${
                          activeLangTab === l
                            ? "bg-paper-raised text-brand-700 shadow-sm"
                            : "text-ink-500"
                        }`}
                      >
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Title"
                    value={editTitle[activeLangTab]}
                    onChange={(e) => setEditTitle({ ...editTitle, [activeLangTab]: e.target.value })}
                  />
                  <Textarea
                    rows={3}
                    placeholder="Message"
                    value={editMessage[activeLangTab]}
                    onChange={(e) => setEditMessage({ ...editMessage, [activeLangTab]: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setIsEditingDraft(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingDraft}>
                  {savingDraft ? "Saving..." : "Save Draft"}
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          /* View Only Notice Details */
          <Card>
            <CardHeader
              title="Notice Specifications"
              action={
                notice.status !== "draft" ? (
                  <span className="text-[11px] text-ink-400 italic">
                    Content is immutable after publication.
                  </span>
                ) : undefined
              }
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-ink-400 block mb-0.5">Eligible Districts</span>
                <span className="font-medium text-ink-800">
                  {notice.eligible_districts && notice.eligible_districts.length > 0
                    ? notice.eligible_districts.join(", ")
                    : "All 25 Districts"}
                </span>
              </div>

              <div>
                <span className="text-ink-400 block mb-0.5">Created At</span>
                <span className="font-medium text-ink-800">
                  {new Date(notice.created_at).toLocaleDateString()}
                </span>
              </div>

              <div>
                <span className="text-ink-400 block mb-0.5">Published At</span>
                <span className="font-medium text-ink-800">
                  {notice.published_at ? new Date(notice.published_at).toLocaleString() : "Not published"}
                </span>
              </div>
            </div>

            <div className="pt-4 text-xs">
              <span className="text-ink-400 block mb-1">Notice Message</span>
              <p className="text-ink-700 bg-paper-sunken p-3.5 rounded-lg border border-border whitespace-pre-line">
                {notice.message?.en || "No message provided."}
              </p>
            </div>
          </Card>
        )}

        {/* Farmer Responses Breakdown Table */}
        <Card padded={false}>
          <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border">
            <div>
              <h2 className="font-display text-lg font-semibold text-ink-900">Farmer Responses</h2>
              <p className="text-sm text-ink-500 mt-0.5">
                Approved farmers eligible for this notice and their commitments.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="text"
                placeholder="Search farmer name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setRespPage(1);
                }}
                className="!w-auto"
              />
              <select
                value={responseFilter}
                onChange={(e) => {
                  setResponseFilter(e.target.value);
                  setRespPage(1);
                }}
                className="text-sm bg-paper-raised border border-border rounded-lg px-3.5 py-2.5 text-ink-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 cursor-pointer"
              >
                <option value="">All Responses</option>
                <option value="ready">Ready</option>
                <option value="cannot">Cannot</option>
                <option value="no_reply">Pending (No Reply)</option>
              </select>
            </div>
          </div>

          {/* Responses Table */}
          {loadingResponses ? (
            <SectionSpinner />
          ) : responses.length === 0 ? (
            <div className="py-12 text-center text-sm text-ink-500">
              No farmer responses found matching your criteria.
            </div>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Farmer</Th>
                  <Th>District</Th>
                  <Th>Phone</Th>
                  <Th>Status</Th>
                  <Th>Expected Volume</Th>
                  <Th>Plot Committed</Th>
                  <Th>Responded At</Th>
                </Tr>
              </Thead>
              <Tbody>
                {responses.map((r) => (
                  <Tr key={r.farmer_id}>
                    <Td className="font-semibold">{r.farmer_name}</Td>
                    <Td className="text-ink-700">{r.district || "—"}</Td>
                    <Td className="text-ink-700 font-mono">{r.phone || "—"}</Td>
                    <Td>
                      <Badge tone={RESPONSE_TONE[r.response] ?? "neutral"}>
                        {RESPONSE_LABEL[r.response] ?? r.response}
                      </Badge>
                    </Td>
                    <Td className="font-medium">
                      {r.expected_volume_kg ? `${r.expected_volume_kg.toLocaleString()} kg` : "—"}
                    </Td>
                    <Td className="text-ink-700">
                      {r.plot_name ? (
                        <span>
                          {r.plot_name}
                          {r.plot_area_ha ? ` (${r.plot_area_ha} ha)` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-ink-400">
                      {r.responded_at ? new Date(r.responded_at).toLocaleDateString() : "—"}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {/* Responses Pagination */}
          {respTotalPages > 1 && (
            <Pagination
              page={respPage}
              totalPages={respTotalPages}
              totalItems={respTotal}
              onChange={setRespPage}
            />
          )}
        </Card>

        <NoticeReminders noticeId={noticeId} isDraft={notice?.status === "draft"} />
      </div>

      {/* Publish Modal Confirmation */}
      <ConfirmModal
        open={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onConfirm={handlePublish}
        title="Publish Planting Notice?"
        confirmLabel="Confirm & Publish"
        loading={publishing}
      >
        Once published, this notice will be immediately visible to your approved farmers in the
        eligible districts. The notice parameters will become <strong>immutable</strong> and cannot
        be edited.
      </ConfirmModal>

      {/* Cancel Modal with Reason */}
      <ConfirmModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancel}
        title="Cancel Planting Notice"
        confirmLabel={cancelling ? "Cancelling..." : "Confirm Cancellation"}
        confirmVariant="danger"
        loading={cancelling}
      >
        <div className="space-y-4">
          <p>
            Cancelling this notice will mark it as cancelled and will automatically{" "}
            <strong>release all active plot bindings</strong> committed by your farmers for this
            notice.
          </p>
          <Field label="Reason for Cancellation (optional)">
            <Textarea
              rows={3}
              placeholder="e.g. Sourcing quota revised or market conditions changed..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </Field>
        </div>
      </ConfirmModal>
    </div>
  );
}
