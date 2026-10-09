"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  fetchStandard,
  createNewDraft,
  duplicateStandard,
  archiveStandard,
  unarchiveStandard,
  StandardData,
  VersionSummary,
} from "@/lib/standardsApi";

export default function ExporterStandardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [standard, setStandard] = useState<StandardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [actionLoading, setActionLoading] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadStandardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStandard(id);
      setStandard(data);
    } catch (err: any) {
      if (err.status === 404) {
        setError("Quality standard not found or access denied.");
      } else {
        setError(err.detail || err.message || "Failed to fetch standard details.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadStandardData();
    }
  }, [id, loadStandardData]);

  const handleCreateDraft = async () => {
    if (!standard) return;
    setActionLoading(true);
    try {
      const newVer = await createNewDraft(id);
      showToast(`Created new draft version v${newVer.version_number}`);
      router.push(`/exporter/standards/${id}/versions/${newVer.version_number}`);
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to create draft version", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!standard) return;
    setActionLoading(true);
    try {
      const duplicated = await duplicateStandard(id);
      showToast("Standard duplicated successfully!");
      router.push(`/exporter/standards/${duplicated.id}`);
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to duplicate standard", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleArchive = async () => {
    if (!standard) return;
    setActionLoading(true);
    try {
      if (standard.is_archived) {
        await unarchiveStandard(id);
        showToast("Standard unarchived.");
      } else {
        await archiveStandard(id);
        showToast("Standard archived.");
      }
      loadStandardData();
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to update archive status", "error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 py-20 text-center space-y-3 text-white">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-zinc-400 text-xs font-medium">Loading standard details...</p>
      </div>
    );
  }

  if (error || !standard) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4 text-white">
        <Link href="/exporter/standards" className="text-xs text-teal-400 hover:underline">
          ← Back to Quality Standards
        </Link>
        <div className="p-6 rounded-2xl bg-red-950/50 border border-red-500/30 text-red-300 text-sm">
          {error || "Standard not found"}
        </div>
      </div>
    );
  }

  const versions = standard.versions || [];
  const hasDraft = versions.some((v) => v.status === "draft");
  const hasPublished = versions.some((v) => v.status === "published");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-white">
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

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <Link href="/exporter/standards" className="text-xs text-zinc-400 hover:text-white transition-colors mb-2 inline-block">
            ← Back to Standards List
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{standard.crop === "tea" ? "🌱" : "🪵"}</span>
            <div>
              <h1 className="text-2xl font-black tracking-tight capitalize">
                {standard.crop} Quality Standard
              </h1>
              <p className="text-xs text-zinc-400">ID: {standard.id}</p>
            </div>
            {standard.is_archived && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                📦 Archived
              </span>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            disabled={actionLoading || hasDraft || !hasPublished}
            onClick={handleCreateDraft}
            title={
              hasDraft
                ? "A draft version already exists. Edit the current draft first."
                : !hasPublished
                ? "Must have at least one published version before creating a new draft."
                : "Create a new draft version by copying latest published version"
            }
            className="px-3.5 py-2 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-300 text-xs font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + New Draft Version
          </button>

          <button
            disabled={actionLoading}
            onClick={handleDuplicate}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all"
          >
            📋 Duplicate Standard
          </button>

          <button
            disabled={actionLoading}
            onClick={handleToggleArchive}
            className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-amber-300 text-xs font-semibold rounded-xl transition-all"
          >
            {standard.is_archived ? "🔓 Unarchive" : "📦 Archive"}
          </button>
        </div>
      </div>

      {/* Main Content: Versions Table / Timeline */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <span>📜</span> Versions History
          </h2>
          <span className="text-xs text-zinc-400">{versions.length} Total Versions</span>
        </div>

        {versions.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs">No version records found.</div>
        ) : (
          <div className="space-y-3">
            {versions.map((ver) => (
              <div
                key={ver.id}
                className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-zinc-700 transition-all"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-sm text-zinc-100">
                      Version {ver.version_number}: {ver.name}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        ver.status === "published"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {ver.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-zinc-500 flex items-center gap-4">
                    <span>Created: {new Date(ver.created_at).toLocaleString()}</span>
                    {ver.published_at && (
                      <span className="text-emerald-400">
                        Published: {new Date(ver.published_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Link
                    href={`/exporter/standards/${id}/versions/${ver.version_number}`}
                    className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all w-full sm:w-auto text-center border ${
                      ver.status === "draft"
                        ? "bg-teal-500 text-black hover:bg-teal-400 font-bold border-teal-500 shadow"
                        : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700"
                    }`}
                  >
                    {ver.status === "draft" ? "Edit Draft ✏️" : "View Read-Only Spec 👁️"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
