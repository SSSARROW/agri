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

export default function PlantingNoticeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const noticeId = params.id as string;

  const [notice, setNotice] = useState<NoticeDetail | null>(null);
  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

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
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading planting notice details...</p>
        </div>
      </div>
    );
  }

  if (error || !notice) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-sm">
          {error || "Planting notice not found."}
        </div>
        <div className="mt-4">
          <Link href="/exporter/planting-notices" className="text-xs text-emerald-700 hover:underline">
            ← Back to Planting Notices
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Back link */}
      <div>
        <Link
          href="/exporter/planting-notices"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
        >
          <span>←</span>
          <span>Back to Planting Notices</span>
        </Link>
      </div>

      {/* Unverified Warning Banner */}
      {!isVerified && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span>
              <strong>Company Verification Required:</strong> Your exporter account must be verified by an administrator before you can publish or cancel planting notices.
            </span>
          </div>
          <Link href="/exporter/profile" className="font-semibold underline ml-2">
            View Profile
          </Link>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-700">
              {notice.crop === "tea" ? "🍃 Tea" : "🪵 Cinnamon"}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                notice.computed_state === "draft"
                  ? "bg-amber-100 text-amber-800"
                  : notice.computed_state === "upcoming"
                  ? "bg-emerald-100 text-emerald-800"
                  : notice.computed_state === "past"
                  ? "bg-gray-100 text-gray-700"
                  : "bg-rose-100 text-rose-800"
              }`}
            >
              {notice.computed_state.toUpperCase()}
            </span>
            <span className="text-xs text-gray-400">
              Target Month: {formatTargetMonth(notice.target_month)}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {notice.title?.en || "Planting Notice"}
          </h1>
          {notice.standard_name && (
            <p className="text-xs text-emerald-700 font-medium mt-1">
              Quality Standard: {notice.standard_name} (v{notice.standard_version_number})
            </p>
          )}
          {notice.status === "cancelled" && notice.cancelled_reason && (
            <p className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg mt-2 inline-block">
              Cancellation Reason: {notice.cancelled_reason}
            </p>
          )}
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {notice.status === "draft" && !isEditingDraft && (
            <button
              onClick={() => setIsEditingDraft(true)}
              className="px-4 py-2 text-xs font-medium rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            >
              Edit Draft
            </button>
          )}

          {notice.status === "draft" && (
            <button
              onClick={() => setShowPublishModal(true)}
              disabled={!isVerified}
              title={!isVerified ? "Company verification required" : ""}
              className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm disabled:opacity-40"
            >
              Publish Notice
            </button>
          )}

          {notice.status === "published" && (
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={!isVerified}
              title={!isVerified ? "Company verification required" : ""}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 disabled:opacity-40"
            >
              Cancel Notice
            </button>
          )}

          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            className="px-4 py-2 text-xs font-medium rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:opacity-50"
          >
            {duplicating ? "Duplicating..." : "Duplicate"}
          </button>
        </div>
      </div>

      {/* Progress & Counters Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Progress Bar Card */}
        <div className="md:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-gray-700">Committed Supply Progress</span>
            <span className="font-bold text-gray-900">
              {notice.total_expected_volume_kg.toLocaleString()} / {notice.volume_needed_kg.toLocaleString()} kg
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all ${
                notice.volume_percentage >= 100
                  ? "bg-emerald-600"
                  : notice.volume_percentage >= 50
                  ? "bg-emerald-500"
                  : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(100, notice.volume_percentage)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{notice.volume_percentage.toFixed(1)}% of required volume</span>
            <span>Target Month: {formatTargetMonth(notice.target_month)}</span>
          </div>
        </div>

        {/* Response Count Cards */}
        <div className="bg-emerald-50/80 border border-emerald-100 p-5 rounded-2xl flex flex-col justify-between">
          <div className="text-xs font-semibold text-emerald-800">Ready Responses</div>
          <div className="text-2xl font-bold text-emerald-900 mt-2">{notice.counts.ready}</div>
          <div className="text-[11px] text-emerald-700 mt-1">
            {notice.total_expected_volume_kg.toLocaleString()} kg bound
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200/80 p-5 rounded-2xl flex flex-col justify-between">
          <div className="text-xs font-semibold text-gray-600">Pending / Cannot</div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-gray-900">{notice.counts.no_reply}</span>
            <span className="text-xs text-gray-400">pending</span>
            <span className="text-xs text-rose-600 font-medium ml-auto">
              {notice.counts.cannot} cannot
            </span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            Out of {notice.counts.eligible_total} eligible approved farmers
          </div>
        </div>
      </div>

      {/* Draft Editable Form (if editing draft) */}
      {isEditingDraft ? (
        <form onSubmit={handleSaveDraft} className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-200 space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-base font-bold text-gray-900">Edit Draft Details</h2>
            <button
              type="button"
              onClick={() => setIsEditingDraft(false)}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              Cancel Edit
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Target Volume (kg)</label>
              <input
                type="number"
                min="1"
                value={editVolumeNeededKg}
                onChange={(e) => setEditVolumeNeededKg(e.target.value)}
                required
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Target Month</label>
              <input
                type="month"
                value={editTargetMonth}
                onChange={(e) => setEditTargetMonth(e.target.value)}
                required
                className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700">Multilingual Title & Message</label>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-md">
                {(["en", "si", "ta"] as const).map((l) => (
                  <button
                    type="button"
                    key={l}
                    onClick={() => setActiveLangTab(l)}
                    className={`px-2.5 py-0.5 text-xs rounded font-medium ${
                      activeLangTab === l ? "bg-white text-emerald-700 shadow-sm" : "text-gray-600"
                    }`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              placeholder="Title"
              value={editTitle[activeLangTab]}
              onChange={(e) => setEditTitle({ ...editTitle, [activeLangTab]: e.target.value })}
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 mb-2"
            />
            <textarea
              rows={3}
              placeholder="Message"
              value={editMessage[activeLangTab]}
              onChange={(e) => setEditMessage({ ...editMessage, [activeLangTab]: e.target.value })}
              className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditingDraft(false)}
              className="px-4 py-2 text-xs font-medium text-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingDraft}
              className="px-5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl"
            >
              {savingDraft ? "Saving..." : "Save Draft"}
            </button>
          </div>
        </form>
      ) : (
        /* View Only Notice Details */
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-base font-bold text-gray-900">Notice Specifications</h2>
            {notice.status !== "draft" && (
              <span className="text-[11px] text-gray-400 italic">
                Content is immutable after publication.
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-gray-400 block mb-0.5">Eligible Districts</span>
              <span className="font-medium text-gray-800">
                {notice.eligible_districts && notice.eligible_districts.length > 0
                  ? notice.eligible_districts.join(", ")
                  : "All 25 Districts"}
              </span>
            </div>

            <div>
              <span className="text-gray-400 block mb-0.5">Created At</span>
              <span className="font-medium text-gray-800">
                {new Date(notice.created_at).toLocaleDateString()}
              </span>
            </div>

            <div>
              <span className="text-gray-400 block mb-0.5">Published At</span>
              <span className="font-medium text-gray-800">
                {notice.published_at ? new Date(notice.published_at).toLocaleString() : "Not published"}
              </span>
            </div>
          </div>

          <div className="pt-2 text-xs">
            <span className="text-gray-400 block mb-1">Notice Message</span>
            <p className="text-gray-700 bg-gray-50 p-3.5 rounded-xl border border-gray-100 whitespace-pre-line">
              {notice.message?.en || "No message provided."}
            </p>
          </div>
        </div>
      )}

      {/* Farmer Responses Breakdown Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">Farmer Responses</h2>
            <p className="text-xs text-gray-500">
              Approved farmers eligible for this notice and their commitments.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <input
              type="text"
              placeholder="Search farmer name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setRespPage(1);
              }}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />

            {/* Filter by response status */}
            <select
              value={responseFilter}
              onChange={(e) => {
                setResponseFilter(e.target.value);
                setRespPage(1);
              }}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
          <div className="py-12 text-center text-xs text-gray-400">Loading responses...</div>
        ) : responses.length === 0 ? (
          <div className="py-12 text-center text-xs text-gray-500">
            No farmer responses found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50/80 text-gray-500 font-semibold uppercase text-[10px] tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-3 px-4">Farmer</th>
                  <th className="py-3 px-4">District</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Expected Volume</th>
                  <th className="py-3 px-4">Plot Committed</th>
                  <th className="py-3 px-4">Responded At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {responses.map((r) => (
                  <tr key={r.farmer_id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-gray-900">{r.farmer_name}</td>
                    <td className="py-3 px-4 text-gray-600">{r.district || "—"}</td>
                    <td className="py-3 px-4 text-gray-600 font-mono">
                      {r.phone || "—"}
                    </td>
                    <td className="py-3 px-4">
                      {r.response === "ready" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Ready
                        </span>
                      )}
                      {r.response === "cannot" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          Cannot
                        </span>
                      )}
                      {r.response === "no_reply" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-gray-900">
                      {r.expected_volume_kg ? `${r.expected_volume_kg.toLocaleString()} kg` : "—"}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {r.plot_name ? (
                        <span>
                          {r.plot_name}
                          {r.plot_area_ha ? ` (${r.plot_area_ha} ha)` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-400">
                      {r.responded_at ? new Date(r.responded_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Responses Pagination */}
        {respTotalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-xs">
            <span className="text-gray-500">
              Showing page {respPage} of {respTotalPages} ({respTotal} farmers)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setRespPage((p) => Math.max(1, p - 1))}
                disabled={respPage === 1}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setRespPage((p) => Math.min(respTotalPages, p + 1))}
                disabled={respPage === respTotalPages}
                className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Publish Modal Confirmation */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">Publish Planting Notice?</h3>
            <p className="text-xs text-gray-600">
              Once published, this notice will be immediately visible to your approved farmers in the eligible districts.
              The notice parameters will become <strong>immutable</strong> and cannot be edited.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 text-white rounded-xl shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {publishing ? "Publishing..." : "Confirm & Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal with Reason */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900 text-rose-700">Cancel Planting Notice</h3>
            <p className="text-xs text-gray-600">
              Cancelling this notice will mark it as cancelled and will automatically <strong>release all active plot bindings</strong> committed by your farmers for this notice.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Reason for Cancellation (optional)
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Sourcing quota revised or market conditions changed..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl"
              >
                Dismiss
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-5 py-2 text-xs font-semibold bg-rose-600 text-white rounded-xl shadow-sm hover:bg-rose-700 disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
