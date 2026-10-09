"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { fetchExporterProfile, ExporterProfile } from "@/lib/exporterApi";
import {
  fetchVersion,
  updateDraftVersion,
  publishVersion,
  VersionDetail,
  StageData,
} from "@/lib/standardsApi";

export default function ExporterVersionEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const n = parseInt(params.n as string, 10);

  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [version, setVersion] = useState<VersionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Form States
  const [verName, setVerName] = useState("");
  const [gradeSpec, setGradeSpec] = useState<Array<{ key: string; value: string }>>([]);
  const [stages, setStages] = useState<StageData[]>([]);

  // Active Editors & UI
  const [activeStageIdx, setActiveStageIdx] = useState<number | null>(null);
  const [activeLangTab, setActiveLangTab] = useState<"en" | "si" | "ta">("en");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profData, verData] = await Promise.all([
        fetchExporterProfile(),
        fetchVersion(id, n),
      ]);
      setProfile(profData);
      setVersion(verData);

      setVerName(verData.name);
      // Map grade_spec dict to array of key-value pairs
      const gPairs = Object.entries(verData.grade_spec || {}).map(([k, v]) => ({
        key: k,
        value: String(v),
      }));
      setGradeSpec(gPairs);
      setStages(verData.stages || []);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      setError(err.detail || err.message || "Failed to load version details.");
    } finally {
      setLoading(false);
    }
  }, [id, n]);

  useEffect(() => {
    if (id && !isNaN(n)) {
      loadData();
    }
  }, [id, n, loadData]);

  const markDirty = () => {
    if (version?.status === "draft") {
      setHasUnsavedChanges(true);
    }
  };

  const isReadonly = version?.status === "published";
  const isExporterVerified = profile?.status === "verified";

  // Grade Spec Controls
  const handleAddGradeSpecRow = () => {
    if (isReadonly) return;
    setGradeSpec((prev) => [...prev, { key: "", value: "" }]);
    markDirty();
  };

  const handleRemoveGradeSpecRow = (idx: number) => {
    if (isReadonly) return;
    setGradeSpec((prev) => prev.filter((_, i) => i !== idx));
    markDirty();
  };

  const handleGradeSpecChange = (idx: number, field: "key" | "value", val: string) => {
    if (isReadonly) return;
    setGradeSpec((prev) => {
      const updated = [...prev];
      updated[idx][field] = val;
      return updated;
    });
    markDirty();
  };

  // Stage Reordering
  const handleMoveStage = (idx: number, dir: -1 | 1) => {
    if (isReadonly) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= stages.length) return;

    setStages((prev) => {
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      // Re-assign positions
      return copy.map((stg, i) => ({ ...stg, position: i + 1 }));
    });
    if (activeStageIdx === idx) setActiveStageIdx(targetIdx);
    else if (activeStageIdx === targetIdx) setActiveStageIdx(idx);
    markDirty();
  };

  const handleAddStage = () => {
    if (isReadonly) return;
    const newPos = stages.length + 1;
    const newStage: StageData = {
      position: newPos,
      name: `Stage ${newPos}`,
      timing_type: "one_time",
      start_offset_days: 0,
      repeat_interval_days: null,
      end_offset_days: null,
      instructions: { en: "", si: "", ta: "" },
      dos: { en: [], si: [], ta: [] },
      donts: { en: [], si: [], ta: [] },
      allowed_inputs: [],
      banned_inputs: [],
      required_proof: { photo_count: 0, photo_descriptions: [], quick_fields: [] },
    };
    setStages((prev) => [...prev, newStage]);
    setActiveStageIdx(stages.length);
    markDirty();
  };

  const handleRemoveStage = (idx: number) => {
    if (isReadonly) return;
    setStages((prev) =>
      prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, position: i + 1 }))
    );
    if (activeStageIdx === idx) setActiveStageIdx(null);
    else if (activeStageIdx !== null && activeStageIdx > idx) setActiveStageIdx(activeStageIdx - 1);
    markDirty();
  };

  const handleUpdateStage = (idx: number, updated: StageData) => {
    if (isReadonly) return;
    setStages((prev) => {
      const copy = [...prev];
      copy[idx] = updated;
      return copy;
    });
    markDirty();
  };

  // Validation before save / publish
  const validateForm = (): string | null => {
    if (!verName.trim()) return "Version name is required.";
    for (let i = 0; i < stages.length; i++) {
      const stg = stages[i];
      if (!stg.name.trim()) return `Stage ${i + 1} name is required.`;
      if (!stg.instructions.en?.trim()) return `Stage ${i + 1} instructions (English) are required.`;
      if (stg.timing_type === "recurring") {
        if (!stg.repeat_interval_days || stg.repeat_interval_days <= 0) {
          return `Stage ${i + 1} is recurring and requires repeat interval > 0.`;
        }
      }
      if (stg.end_offset_days !== null && stg.end_offset_days !== undefined) {
        if (stg.end_offset_days < stg.start_offset_days) {
          return `Stage ${i + 1} end offset must be >= start offset.`;
        }
      }
    }
    return null;
  };

  // Save Draft
  const handleSaveDraft = async () => {
    if (isReadonly) return;
    const valErr = validateForm();
    if (valErr) {
      showToast(valErr, "error");
      return;
    }

    setSaving(true);
    try {
      // Build grade_spec dict
      const specDict: Record<string, any> = {};
      gradeSpec.forEach((row) => {
        if (row.key.trim()) specDict[row.key.trim()] = row.value;
      });

      const updated = await updateDraftVersion(id, n, {
        name: verName.trim(),
        grade_spec: specDict,
        stages,
      });

      setVersion(updated);
      setHasUnsavedChanges(false);
      showToast("Draft saved successfully!");
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to save draft", "error");
    } finally {
      setSaving(false);
    }
  };

  // Publish Version
  const handlePublish = async () => {
    if (!isExporterVerified) {
      showToast("Only verified exporters can publish quality standards.", "error");
      return;
    }
    if (stages.length < 1) {
      showToast("At least one stage is required to publish.", "error");
      return;
    }

    const valErr = validateForm();
    if (valErr) {
      showToast(valErr, "error");
      return;
    }

    setPublishing(true);
    try {
      // Save draft first if dirty
      if (hasUnsavedChanges) {
        const specDict: Record<string, any> = {};
        gradeSpec.forEach((row) => {
          if (row.key.trim()) specDict[row.key.trim()] = row.value;
        });
        await updateDraftVersion(id, n, {
          name: verName.trim(),
          grade_spec: specDict,
          stages,
        });
      }

      const published = await publishVersion(id, n);
      setVersion(published);
      setShowPublishModal(false);
      setHasUnsavedChanges(false);
      showToast("Quality standard version published successfully! 🎉");
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to publish version", "error");
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 py-20 text-center space-y-3 text-white">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-zinc-400 text-xs font-medium">Loading version editor...</p>
      </div>
    );
  }

  if (error || !version) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4 text-white">
        <Link href={`/exporter/standards/${id}`} className="text-xs text-teal-400 hover:underline">
          ← Back to Standard Overview
        </Link>
        <div className="p-6 rounded-2xl bg-red-950/50 border border-red-500/30 text-red-300 text-sm">
          {error || "Version not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-white pb-24">
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

      {/* Editor Header Bar */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sticky top-16 z-30 shadow-2xl">
        <div>
          <Link href={`/exporter/standards/${id}`} className="text-[11px] text-zinc-400 hover:text-white transition-colors">
            ← Back to Version History
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
              <span>v{version.version_number}:</span>
              <input
                type="text"
                disabled={isReadonly}
                value={verName}
                onChange={(e) => {
                  setVerName(e.target.value);
                  markDirty();
                }}
                className="bg-transparent border-b border-transparent focus:border-teal-500 focus:outline-none font-bold text-teal-300 disabled:opacity-90"
              />
            </h1>

            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                isReadonly
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-400 border-amber-500/30"
              }`}
            >
              {version.status}
            </span>

            {hasUnsavedChanges && !isReadonly && (
              <span className="text-[10px] font-semibold text-amber-400 animate-pulse">
                ● Unsaved Changes
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {!isReadonly ? (
            <>
              <button
                disabled={saving || !hasUnsavedChanges}
                onClick={handleSaveDraft}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save Draft"}
              </button>

              <button
                disabled={!isExporterVerified}
                onClick={() => setShowPublishModal(true)}
                title={!isExporterVerified ? "Your exporter account is pending verification by Paramparā admins." : "Publish Version"}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-black text-xs font-bold rounded-xl transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                🚀 Publish Version...
              </button>
            </>
          ) : (
            <span className="text-xs text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-xl">
              ✓ Published & Immutable
            </span>
          )}
        </div>
      </div>

      {/* Banners */}
      {isReadonly && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3">
          <span className="text-xl">🔒</span>
          <div>
            <p className="font-bold">Published Version (Read-Only)</p>
            <p className="text-zinc-400 text-[11px] mt-0.5">
              This version has been published and cannot be modified. To make updates, create a new draft from the Version History page.
            </p>
          </div>
        </div>
      )}

      {!isExporterVerified && !isReadonly && (
        <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-3">
          <span className="text-xl">⏳</span>
          <div>
            <p className="font-bold">Verification Required to Publish</p>
            <p className="text-zinc-400 text-[11px] mt-0.5">
              You can build and save drafts anytime. However, publishing a quality standard requires an approved/verified exporter profile.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Grade Spec & Stage Editor (Left) + Farmer Sequence Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Spec & Stages Editor */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section 1: Grade Specifications */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <span>📊</span> Grade Specifications
                </h2>
                <p className="text-[11px] text-zinc-400">Custom parameters for moisture, leaf grades, oil percentage, etc.</p>
              </div>
              {!isReadonly && (
                <button
                  type="button"
                  onClick={handleAddGradeSpecRow}
                  className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg font-semibold border border-zinc-700"
                >
                  + Add Parameter
                </button>
              )}
            </div>

            {gradeSpec.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-2">No grade parameters defined yet.</p>
            ) : (
              <div className="space-y-2">
                {gradeSpec.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <input
                      type="text"
                      disabled={isReadonly}
                      placeholder="e.g. moisture_max_pct"
                      value={row.key}
                      onChange={(e) => handleGradeSpecChange(idx, "key", e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-zinc-200 focus:border-teal-500 focus:outline-none"
                    />
                    <input
                      type="text"
                      disabled={isReadonly}
                      placeholder="e.g. 5.0"
                      value={row.value}
                      onChange={(e) => handleGradeSpecChange(idx, "value", e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-zinc-200 focus:border-teal-500 focus:outline-none"
                    />
                    {!isReadonly && (
                      <button
                        type="button"
                        onClick={() => handleRemoveGradeSpecRow(idx)}
                        className="w-8 h-8 rounded-xl bg-red-950/40 text-red-400 hover:bg-red-900/60 font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Stages List & Reordering */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 backdrop-blur-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <span>🪜</span> Cultivation & Inspection Stages
                </h2>
                <p className="text-[11px] text-zinc-400">Order stages sequentially from day 0 to harvest</p>
              </div>
              {!isReadonly && (
                <button
                  type="button"
                  onClick={handleAddStage}
                  className="px-3.5 py-1.5 bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/30 text-teal-300 text-xs rounded-xl font-bold transition-all"
                >
                  + Add Stage
                </button>
              )}
            </div>

            {stages.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs text-zinc-500">No cultivation stages added to this version.</p>
                {!isReadonly && (
                  <button
                    onClick={handleAddStage}
                    className="px-3 py-1.5 bg-teal-600 text-black text-xs font-bold rounded-xl"
                  >
                    + Add Stage 1
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {stages.map((stage, idx) => {
                  const isExpanded = activeStageIdx === idx;
                  return (
                    <div
                      key={idx}
                      className={`border rounded-2xl overflow-hidden transition-all ${
                        isExpanded ? "border-teal-500/60 bg-zinc-950/90 shadow-xl" : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
                      }`}
                    >
                      {/* Stage Header Summary Bar */}
                      <div
                        onClick={() => setActiveStageIdx(isExpanded ? null : idx)}
                        className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-xl bg-zinc-800 border border-zinc-700 text-teal-400 font-bold text-xs flex items-center justify-center">
                            {stage.position}
                          </span>
                          <div>
                            <h3 className="text-xs font-bold text-zinc-100 flex items-center gap-2">
                              {stage.name || `Stage ${stage.position}`}
                              <span className="text-[10px] font-normal text-zinc-400">
                                ({stage.timing_type === "recurring" ? `Every ${stage.repeat_interval_days}d from Day ${stage.start_offset_days}` : `Day ${stage.start_offset_days}`})
                              </span>
                            </h3>
                            <p className="text-[11px] text-zinc-500 truncate max-w-sm">
                              {stage.instructions.en || "No instructions..."}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {!isReadonly && (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                disabled={idx === 0}
                                onClick={() => handleMoveStage(idx, -1)}
                                className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 disabled:opacity-30 hover:bg-zinc-700"
                              >
                                ↑
                              </button>
                              <button
                                disabled={idx === stages.length - 1}
                                onClick={() => handleMoveStage(idx, 1)}
                                className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 disabled:opacity-30 hover:bg-zinc-700"
                              >
                                ↓
                              </button>
                            </div>
                          )}

                          <span className="text-xs text-zinc-500 font-bold px-2">{isExpanded ? "▲" : "▼"}</span>
                        </div>
                      </div>

                      {/* Expanded Form Editor */}
                      {isExpanded && (
                        <div className="p-5 border-t border-zinc-800/80 bg-zinc-900/60 space-y-5 text-xs text-zinc-200">
                          {/* Top Basic Fields */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-zinc-400 font-semibold mb-1">Stage Name *</label>
                              <input
                                type="text"
                                disabled={isReadonly}
                                value={stage.name}
                                onChange={(e) => handleUpdateStage(idx, { ...stage, name: e.target.value })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-100 focus:border-teal-500 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-zinc-400 font-semibold mb-1">Timing Schedule Type</label>
                              <select
                                disabled={isReadonly}
                                value={stage.timing_type}
                                onChange={(e) =>
                                  handleUpdateStage(idx, {
                                    ...stage,
                                    timing_type: e.target.value as any,
                                    repeat_interval_days: e.target.value === "recurring" ? 7 : null,
                                  })
                                }
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-100 focus:border-teal-500 focus:outline-none"
                              >
                                <option value="one_time">One-Time Stage</option>
                                <option value="recurring">Recurring Stage</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-zinc-400 font-semibold mb-1">Start Offset (Days from Planting)</label>
                              <input
                                type="number"
                                disabled={isReadonly}
                                value={stage.start_offset_days}
                                onChange={(e) => handleUpdateStage(idx, { ...stage, start_offset_days: parseInt(e.target.value, 10) || 0 })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-100 focus:border-teal-500 focus:outline-none"
                              />
                            </div>

                            {stage.timing_type === "recurring" && (
                              <>
                                <div>
                                  <label className="block text-amber-400 font-semibold mb-1">Repeat Interval (Every N Days) *</label>
                                  <input
                                    type="number"
                                    disabled={isReadonly}
                                    value={stage.repeat_interval_days || ""}
                                    onChange={(e) => handleUpdateStage(idx, { ...stage, repeat_interval_days: parseInt(e.target.value, 10) || 0 })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-100 focus:border-teal-500 focus:outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="block text-zinc-400 font-semibold mb-1">End Offset (Optional End Day)</label>
                                  <input
                                    type="number"
                                    disabled={isReadonly}
                                    value={stage.end_offset_days ?? ""}
                                    onChange={(e) =>
                                      handleUpdateStage(idx, {
                                        ...stage,
                                        end_offset_days: e.target.value !== "" ? parseInt(e.target.value, 10) : null,
                                      })
                                    }
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-100 focus:border-teal-500 focus:outline-none"
                                  />
                                </div>
                              </>
                            )}
                          </div>

                          {/* Multilingual Content Tabs */}
                          <div className="space-y-3 pt-2 border-t border-zinc-800">
                            <div className="flex items-center justify-between">
                              <label className="text-zinc-400 font-semibold">Multilingual Guidance</label>
                              <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                                {(["en", "si", "ta"] as const).map((lang) => (
                                  <button
                                    key={lang}
                                    type="button"
                                    onClick={() => setActiveLangTab(lang)}
                                    className={`px-3 py-1 rounded text-[11px] font-bold uppercase transition-all ${
                                      activeLangTab === lang
                                        ? "bg-teal-500 text-black shadow"
                                        : "text-zinc-400 hover:text-white"
                                    }`}
                                  >
                                    {lang === "en" ? "English *" : lang === "si" ? "Sinhala" : "Tamil"}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="block text-zinc-400 text-[11px] font-semibold mb-1">
                                Instructions ({activeLangTab.toUpperCase()})
                              </label>
                              <textarea
                                rows={2}
                                disabled={isReadonly}
                                placeholder={activeLangTab === "en" ? "Describe stage instructions..." : "Alternative translation..."}
                                value={stage.instructions[activeLangTab] || ""}
                                onChange={(e) =>
                                  handleUpdateStage(idx, {
                                    ...stage,
                                    instructions: { ...stage.instructions, [activeLangTab]: e.target.value },
                                  })
                                }
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-100 focus:border-teal-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Allowed & Banned Inputs */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
                            <div>
                              <label className="block text-emerald-400 font-semibold mb-1">Allowed Inputs (Comma separated)</label>
                              <input
                                type="text"
                                disabled={isReadonly}
                                placeholder="e.g. Organic Compost, Neem Oil"
                                value={(stage.allowed_inputs || []).join(", ")}
                                onChange={(e) =>
                                  handleUpdateStage(idx, {
                                    ...stage,
                                    allowed_inputs: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                                  })
                                }
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-100 focus:border-teal-500 focus:outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-red-400 font-semibold mb-1">Banned Chemicals / Inputs</label>
                              <div className="space-y-2">
                                {(stage.banned_inputs || []).map((banned, bIdx) => (
                                  <div key={bIdx} className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      disabled={isReadonly}
                                      placeholder="Chemical name"
                                      value={banned.name}
                                      onChange={(e) => {
                                        const updatedBanned = [...stage.banned_inputs];
                                        updatedBanned[bIdx].name = e.target.value;
                                        handleUpdateStage(idx, { ...stage, banned_inputs: updatedBanned });
                                      }}
                                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-zinc-100"
                                    />
                                    <input
                                      type="number"
                                      disabled={isReadonly}
                                      placeholder="Min days before harvest"
                                      value={banned.min_days_before_harvest}
                                      onChange={(e) => {
                                        const updatedBanned = [...stage.banned_inputs];
                                        updatedBanned[bIdx].min_days_before_harvest = parseInt(e.target.value, 10) || 0;
                                        handleUpdateStage(idx, { ...stage, banned_inputs: updatedBanned });
                                      }}
                                      className="w-32 bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-zinc-100"
                                    />
                                    {!isReadonly && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updatedBanned = stage.banned_inputs.filter((_, i) => i !== bIdx);
                                          handleUpdateStage(idx, { ...stage, banned_inputs: updatedBanned });
                                        }}
                                        className="text-red-400 font-bold px-2"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                ))}
                                {!isReadonly && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedBanned = [...(stage.banned_inputs || []), { name: "", min_days_before_harvest: 30 }];
                                      handleUpdateStage(idx, { ...stage, banned_inputs: updatedBanned });
                                    }}
                                    className="text-[11px] text-red-400 font-semibold hover:underline"
                                  >
                                    + Add Banned Input Rule
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Delete Stage Button */}
                          {!isReadonly && (
                            <div className="pt-3 border-t border-zinc-800 flex justify-end">
                              <button
                                type="button"
                                onClick={() => handleRemoveStage(idx)}
                                className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-semibold rounded-xl border border-red-500/30"
                              >
                                Delete Stage {stage.position}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): Farmer Sequence Preview Panel */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 backdrop-blur-xl sticky top-36 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-teal-300 flex items-center gap-2">
                <span>📱</span> Farmer Preview Timeline
              </h2>
              <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full font-bold uppercase">
                Farmer App Sequence
              </span>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              This is how your farmers will experience this quality standard sequence in their Paramparā app:
            </p>

            {stages.length === 0 ? (
              <p className="text-xs text-zinc-500 italic py-6 text-center">No stages added yet.</p>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {stages
                  .slice()
                  .sort((a, b) => a.start_offset_days - b.start_offset_days)
                  .map((stg, i) => (
                    <div key={i} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-zinc-200">{stg.name}</span>
                        <span className="text-[10px] font-semibold text-teal-400 bg-teal-950/80 px-2 py-0.5 rounded-full border border-teal-500/30">
                          {stg.timing_type === "recurring"
                            ? `Every ${stg.repeat_interval_days}d from Day ${stg.start_offset_days}${stg.end_offset_days ? ` to ${stg.end_offset_days}` : ""}`
                            : `Day ${stg.start_offset_days}`}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-2">
                        {stg.instructions.en || "No instructions provided."}
                      </p>
                      {stg.allowed_inputs && stg.allowed_inputs.length > 0 && (
                        <div className="text-[10px] text-emerald-400">
                          Allowed: {stg.allowed_inputs.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── PUBLISH CONFIRM MODAL ── */}
      {showPublishModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4 animate-in zoom-in-95 text-white">
            <h3 className="text-lg font-bold text-emerald-400">Publish Quality Standard Version</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to publish <span className="font-bold text-white">{verName}</span>?
              <br /><br />
              <strong className="text-amber-400">Warning:</strong> Published versions are strictly <strong className="text-white">immutable</strong> and cannot be edited or deleted once published.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={publishing}
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                disabled={publishing}
                onClick={handlePublish}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-black text-xs font-bold rounded-xl flex items-center gap-2"
              >
                {publishing ? "Publishing..." : "Confirm & Publish Version"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
