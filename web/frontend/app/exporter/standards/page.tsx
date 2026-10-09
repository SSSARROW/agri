"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchStandards,
  createStandard,
  StandardData,
} from "@/lib/standardsApi";

export default function ExporterStandardsListPage() {
  const router = useRouter();

  const [standards, setStandards] = useState<StandardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Filters & Pagination
  const [cropFilter, setCropFilter] = useState<string>("");
  const [archiveFilter, setArchiveFilter] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newCrop, setNewCrop] = useState<string>("tea");
  const [newName, setNewName] = useState<string>("v1 Premium Standard");
  const [creating, setCreating] = useState<boolean>(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadStandardsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStandards({
        crop: cropFilter || undefined,
        is_archived: archiveFilter,
        page,
        page_size: 9,
      });
      setStandards(res.items);
      setTotalPages(res.total_pages);
      setTotalItems(res.total);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load quality standards.");
    } finally {
      setLoading(false);
    }
  }, [cropFilter, archiveFilter, page]);

  useEffect(() => {
    loadStandardsData();
  }, [loadStandardsData]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      showToast("Standard name is required", "error");
      return;
    }
    setCreating(true);
    try {
      const newStd = await createStandard({
        crop: newCrop,
        name: newName.trim(),
        grade_spec: {},
        stages: [],
      });
      showToast(`Created new quality standard for ${newCrop}`);
      setShowCreateModal(false);
      // Navigate to version editor
      router.push(`/exporter/standards/${newStd.id}/versions/1`);
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to create quality standard", "error");
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (std: StandardData) => {
    const versions = std.versions || [];
    const publishedVer = versions.find((v) => v.status === "published");
    const draftVer = versions.find((v) => v.status === "draft");

    if (publishedVer && draftVer) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border bg-teal-500/15 text-teal-300 border-teal-500/30">
          v{publishedVer.version_number} Published (Draft v{draftVer.version_number})
        </span>
      );
    }
    if (publishedVer) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
          v{publishedVer.version_number} Published
        </span>
      );
    }
    if (draftVer) {
      return (
        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border bg-amber-500/15 text-amber-400 border-amber-500/30">
          v{draftVer.version_number} Draft
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border bg-zinc-800 text-zinc-400 border-zinc-700">
        No Versions
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto text-white">
      {/* Toast Notification */}
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <span>📋</span> Exporter Quality Standards
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Define crop grading specifications, cultivation stages, and proof requirements for your farmers
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-black font-bold text-xs rounded-xl shadow-lg shadow-teal-950 transition-all flex items-center gap-2"
        >
          <span>✨</span> Create New Standard
        </button>
      </div>

      {/* Filters & Controls */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Crop Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-full sm:w-auto">
          {[
            { key: "", label: "All Crops" },
            { key: "tea", label: "🌱 Tea" },
            { key: "cinnamon", label: "🪵 Cinnamon" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setCropFilter(tab.key);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all capitalize ${
                cropFilter === tab.key
                  ? "bg-zinc-800 text-white shadow border border-zinc-700"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Archive Toggle & Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setArchiveFilter(!archiveFilter);
              setPage(1);
            }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-all flex items-center gap-1.5 ${
              archiveFilter
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200"
            }`}
          >
            <span>📦</span> {archiveFilter ? "Showing Archived" : "View Archive"}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-950/50 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadStandardsData} className="underline font-semibold hover:text-white">
            Retry
          </button>
        </div>
      )}

      {/* Standards List / Grid */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400 text-xs font-medium">Loading quality standards...</p>
        </div>
      ) : standards.length === 0 ? (
        <div className="py-20 text-center space-y-3 bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 backdrop-blur">
          <div className="text-4xl">📋</div>
          <h3 className="text-base font-bold text-zinc-200">No Quality Standards Found</h3>
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            {archiveFilter
              ? "You do not have any archived quality standards."
              : cropFilter
              ? `No standards found for crop '${cropFilter}'. Create one to get started!`
              : "You haven't defined any crop quality standards yet. Click 'Create New Standard' to start."}
          </p>
          {!archiveFilter && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-black text-xs font-bold rounded-xl transition-all inline-block"
            >
              + Create First Standard
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {standards.map((std) => {
            const versions = std.versions || [];
            const latestVer = versions[0];
            return (
              <div
                key={std.id}
                className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-all flex flex-col justify-between space-y-4 group backdrop-blur"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{std.crop === "tea" ? "🌱" : "🪵"}</span>
                      <div>
                        <h3 className="font-bold text-sm text-zinc-100 group-hover:text-teal-300 transition-colors">
                          {latestVer?.name || `${std.crop.toUpperCase()} Standard`}
                        </h3>
                        <p className="text-[11px] text-zinc-500 capitalize">Crop: {std.crop}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">{getStatusBadge(std)}</div>

                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Versions count:</span>
                      <span className="font-bold text-zinc-300">{versions.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Created:</span>
                      <span className="text-zinc-300">{new Date(std.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                  <Link
                    href={`/exporter/standards/${std.id}`}
                    className="flex-1 text-center py-2 px-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all"
                  >
                    View Versions →
                  </Link>

                  {latestVer && (
                    <Link
                      href={`/exporter/standards/${std.id}/versions/${latestVer.version_number}`}
                      className="py-2 px-3 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-semibold rounded-xl transition-all"
                    >
                      {latestVer.status === "draft" ? "Edit Draft ✏️" : "View Spec 👁️"}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pt-4 flex items-center justify-between text-xs text-zinc-400">
          <span>
            Page {page} of {totalPages} ({totalItems} total)
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300 disabled:opacity-40 hover:bg-zinc-800"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-300 disabled:opacity-40 hover:bg-zinc-800"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ── CREATE STANDARD MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-5 animate-in zoom-in-95 text-white"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>✨</span> Create New Quality Standard
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Target Crop</label>
                <select
                  value={newCrop}
                  onChange={(e) => setNewCrop(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 focus:outline-none focus:border-teal-500 capitalize"
                >
                  <option value="tea">🌱 Tea</option>
                  <option value="cinnamon">🪵 Cinnamon</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 font-semibold mb-1">Standard Name (Draft v1)</label>
                <input
                  type="text"
                  placeholder="e.g. Export Grade A Black Tea Specification"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-200 focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                disabled={creating}
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newName.trim()}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-black text-xs font-bold rounded-xl disabled:opacity-50 flex items-center gap-2 shadow"
              >
                {creating ? "Creating..." : "Create & Open Editor →"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
