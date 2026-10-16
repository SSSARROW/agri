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
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { Toast, ToastState } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/modal";
import { SectionSpinner } from "@/components/ui/spinner";

function ChevronDownIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function ArrowUpIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-6 6m6-6l6 6" />
    </svg>
  );
}

function ArrowDownIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m0 0l6-6m-6 6l-6-6" />
    </svg>
  );
}

function RemoveIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

const LANG_LABEL: Record<"en" | "si" | "ta", string> = {
  en: "English *",
  si: "Sinhala",
  ta: "Tamil",
};

export default function ExporterVersionEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const n = parseInt(params.n as string, 10);

  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [version, setVersion] = useState<VersionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

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
      showToast("Quality standard version published successfully!");
    } catch (err: any) {
      showToast(err.detail || err.message || "Failed to publish version", "error");
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return <SectionSpinner />;
  }

  if (error || !version) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Link href={`/exporter/standards/${id}`} className="text-xs font-semibold text-brand-700 hover:text-brand-800">
          ← Back to Standard Overview
        </Link>
        <Alert tone="danger" title={error || "Version not found"} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-24">
      <Toast toast={toast} />

      {/* Editor Header Bar */}
      <Card className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sticky top-16 z-30 shadow-sm mb-6">
        <div>
          <Link
            href={`/exporter/standards/${id}`}
            className="text-[11px] font-semibold text-ink-500 hover:text-ink-900 transition-colors"
          >
            ← Back to Version History
          </Link>
          <div className="flex items-center gap-3 mt-1.5">
            <h1 className="font-display text-xl font-semibold tracking-tight text-ink-900 flex items-center gap-2">
              <span>v{version.version_number}:</span>
              <input
                type="text"
                disabled={isReadonly}
                value={verName}
                onChange={(e) => {
                  setVerName(e.target.value);
                  markDirty();
                }}
                className="bg-transparent border-b border-transparent focus:border-brand-500 focus:outline-none font-semibold text-brand-700 disabled:opacity-90"
              />
            </h1>

            <Badge tone={isReadonly ? "success" : "warning"}>{version.status}</Badge>

            {hasUnsavedChanges && !isReadonly && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gold-600">
                <span className="w-1.5 h-1.5 rounded-full bg-gold-500 animate-pulse" />
                Unsaved Changes
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          {!isReadonly ? (
            <>
              <Button
                variant="secondary"
                disabled={saving || !hasUnsavedChanges}
                onClick={handleSaveDraft}
              >
                {saving ? "Saving..." : "Save Draft"}
              </Button>

              <Button
                disabled={!isExporterVerified}
                onClick={() => setShowPublishModal(true)}
                title={!isExporterVerified ? "Your exporter account is pending verification by Paramparā admins." : "Publish Version"}
              >
                Publish Version...
              </Button>
            </>
          ) : (
            <Badge tone="success">Published &amp; Immutable</Badge>
          )}
        </div>
      </Card>

      <div className="space-y-6">
        {/* Banners */}
        {isReadonly && (
          <Alert tone="success" title="Published Version (Read-Only)">
            This version has been published and cannot be modified. To make updates, create a new
            draft from the Version History page.
          </Alert>
        )}

        {!isExporterVerified && !isReadonly && (
          <Alert tone="warning" title="Verification Required to Publish">
            You can build and save drafts anytime. However, publishing a quality standard requires
            an approved/verified exporter profile.
          </Alert>
        )}

        {/* Main Grid: Grade Spec & Stage Editor (Left) + Farmer Sequence Preview (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols): Spec & Stages Editor */}
          <div className="lg:col-span-8 space-y-6">
            {/* Section 1: Grade Specifications */}
            <Card>
              <CardHeader
                title="Grade Specifications"
                subtitle="Custom parameters for moisture, leaf grades, oil percentage, etc."
                action={
                  !isReadonly && (
                    <Button variant="secondary" size="sm" onClick={handleAddGradeSpecRow}>
                      + Add Parameter
                    </Button>
                  )
                }
              />

              {gradeSpec.length === 0 ? (
                <p className="text-sm text-ink-400 italic py-2">No grade parameters defined yet.</p>
              ) : (
                <div className="space-y-2">
                  {gradeSpec.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="text"
                        disabled={isReadonly}
                        placeholder="e.g. moisture_max_pct"
                        value={row.key}
                        onChange={(e) => handleGradeSpecChange(idx, "key", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="text"
                        disabled={isReadonly}
                        placeholder="e.g. 5.0"
                        value={row.value}
                        onChange={(e) => handleGradeSpecChange(idx, "value", e.target.value)}
                        className="flex-1"
                      />
                      {!isReadonly && (
                        <button
                          type="button"
                          onClick={() => handleRemoveGradeSpecRow(idx)}
                          className="w-9 h-9 rounded-lg bg-danger-bg text-danger hover:brightness-95 border border-danger-border flex items-center justify-center shrink-0 transition-colors"
                          aria-label="Remove parameter"
                        >
                          <RemoveIcon />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Section 2: Stages List & Reordering */}
            <Card>
              <CardHeader
                title="Cultivation & Inspection Stages"
                subtitle="Order stages sequentially from day 0 to harvest"
                action={
                  !isReadonly && (
                    <Button variant="secondary" size="sm" onClick={handleAddStage}>
                      + Add Stage
                    </Button>
                  )
                }
              />

              {stages.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <p className="text-sm text-ink-500">No cultivation stages added to this version.</p>
                  {!isReadonly && (
                    <Button size="sm" onClick={handleAddStage}>
                      + Add Stage 1
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {stages.map((stage, idx) => {
                    const isExpanded = activeStageIdx === idx;
                    return (
                      <div
                        key={idx}
                        className={`border rounded-xl overflow-hidden transition-colors ${
                          isExpanded
                            ? "border-brand-300 bg-paper-raised shadow-sm"
                            : "border-border bg-paper-sunken hover:border-border-strong"
                        }`}
                      >
                        {/* Stage Header Summary Bar */}
                        <div
                          onClick={() => setActiveStageIdx(isExpanded ? null : idx)}
                          className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-8 h-8 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 font-bold text-xs flex items-center justify-center shrink-0">
                              {stage.position}
                            </span>
                            <div className="min-w-0">
                              <h3 className="text-sm font-semibold text-ink-900 flex items-center gap-2">
                                {stage.name || `Stage ${stage.position}`}
                                <span className="text-xs font-normal text-ink-400">
                                  ({stage.timing_type === "recurring" ? `Every ${stage.repeat_interval_days}d from Day ${stage.start_offset_days}` : `Day ${stage.start_offset_days}`})
                                </span>
                              </h3>
                              <p className="text-xs text-ink-500 truncate max-w-sm">
                                {stage.instructions.en || "No instructions..."}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {!isReadonly && (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  disabled={idx === 0}
                                  onClick={() => handleMoveStage(idx, -1)}
                                  className="w-7 h-7 rounded-lg bg-paper-raised border border-border text-ink-700 disabled:opacity-30 hover:bg-paper-sunken flex items-center justify-center transition-colors"
                                  aria-label="Move stage up"
                                >
                                  <ArrowUpIcon />
                                </button>
                                <button
                                  disabled={idx === stages.length - 1}
                                  onClick={() => handleMoveStage(idx, 1)}
                                  className="w-7 h-7 rounded-lg bg-paper-raised border border-border text-ink-700 disabled:opacity-30 hover:bg-paper-sunken flex items-center justify-center transition-colors"
                                  aria-label="Move stage down"
                                >
                                  <ArrowDownIcon />
                                </button>
                              </div>
                            )}

                            <ChevronDownIcon
                              className={`w-4 h-4 text-ink-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </div>
                        </div>

                        {/* Expanded Form Editor */}
                        {isExpanded && (
                          <div className="p-5 border-t border-border bg-paper-raised space-y-5">
                            {/* Top Basic Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <Field label="Stage Name" required>
                                <Input
                                  type="text"
                                  disabled={isReadonly}
                                  value={stage.name}
                                  onChange={(e) => handleUpdateStage(idx, { ...stage, name: e.target.value })}
                                />
                              </Field>

                              <Field label="Timing Schedule Type">
                                <Select
                                  disabled={isReadonly}
                                  value={stage.timing_type}
                                  onChange={(e) =>
                                    handleUpdateStage(idx, {
                                      ...stage,
                                      timing_type: e.target.value as any,
                                      repeat_interval_days: e.target.value === "recurring" ? 7 : null,
                                    })
                                  }
                                >
                                  <option value="one_time">One-Time Stage</option>
                                  <option value="recurring">Recurring Stage</option>
                                </Select>
                              </Field>

                              <Field label="Start Offset (Days from Planting)">
                                <Input
                                  type="number"
                                  disabled={isReadonly}
                                  value={stage.start_offset_days}
                                  onChange={(e) => handleUpdateStage(idx, { ...stage, start_offset_days: parseInt(e.target.value, 10) || 0 })}
                                />
                              </Field>

                              {stage.timing_type === "recurring" && (
                                <>
                                  <Field label="Repeat Interval (Every N Days)" required>
                                    <Input
                                      type="number"
                                      disabled={isReadonly}
                                      value={stage.repeat_interval_days || ""}
                                      onChange={(e) => handleUpdateStage(idx, { ...stage, repeat_interval_days: parseInt(e.target.value, 10) || 0 })}
                                    />
                                  </Field>
                                  <Field label="End Offset (Optional End Day)">
                                    <Input
                                      type="number"
                                      disabled={isReadonly}
                                      value={stage.end_offset_days ?? ""}
                                      onChange={(e) =>
                                        handleUpdateStage(idx, {
                                          ...stage,
                                          end_offset_days: e.target.value !== "" ? parseInt(e.target.value, 10) : null,
                                        })
                                      }
                                    />
                                  </Field>
                                </>
                              )}
                            </div>

                            {/* Multilingual Content Tabs */}
                            <div className="space-y-3 pt-4 border-t border-border">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-ink-700">Multilingual Guidance</label>
                                <div className="flex items-center gap-1 bg-paper-sunken p-1 rounded-lg border border-border">
                                  {(["en", "si", "ta"] as const).map((lang) => (
                                    <button
                                      key={lang}
                                      type="button"
                                      onClick={() => setActiveLangTab(lang)}
                                      className={`px-3 py-1 rounded-md text-[11px] font-bold uppercase transition-colors ${
                                        activeLangTab === lang
                                          ? "bg-paper-raised text-brand-700 shadow-sm"
                                          : "text-ink-500 hover:text-ink-900"
                                      }`}
                                    >
                                      {LANG_LABEL[lang]}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <Field label={`Instructions (${activeLangTab.toUpperCase()})`}>
                                <Textarea
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
                                />
                              </Field>
                            </div>

                            {/* Allowed & Banned Inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
                              <Field label="Allowed Inputs (Comma separated)">
                                <Input
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
                                />
                              </Field>

                              <div>
                                <label className="block text-xs font-semibold text-danger mb-1.5">
                                  Banned Chemicals / Inputs
                                </label>
                                <div className="space-y-2">
                                  {(stage.banned_inputs || []).map((banned, bIdx) => (
                                    <div key={bIdx} className="flex items-center gap-2">
                                      <Input
                                        type="text"
                                        disabled={isReadonly}
                                        placeholder="Chemical name"
                                        value={banned.name}
                                        onChange={(e) => {
                                          const updatedBanned = [...stage.banned_inputs];
                                          updatedBanned[bIdx].name = e.target.value;
                                          handleUpdateStage(idx, { ...stage, banned_inputs: updatedBanned });
                                        }}
                                        className="flex-1"
                                      />
                                      <Input
                                        type="number"
                                        disabled={isReadonly}
                                        placeholder="Min days before harvest"
                                        value={banned.min_days_before_harvest}
                                        onChange={(e) => {
                                          const updatedBanned = [...stage.banned_inputs];
                                          updatedBanned[bIdx].min_days_before_harvest = parseInt(e.target.value, 10) || 0;
                                          handleUpdateStage(idx, { ...stage, banned_inputs: updatedBanned });
                                        }}
                                        className="w-36"
                                      />
                                      {!isReadonly && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updatedBanned = stage.banned_inputs.filter((_, i) => i !== bIdx);
                                            handleUpdateStage(idx, { ...stage, banned_inputs: updatedBanned });
                                          }}
                                          className="text-danger hover:brightness-90 font-bold px-1 shrink-0"
                                          aria-label="Remove banned input"
                                        >
                                          <RemoveIcon />
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
                                      className="text-xs text-danger font-semibold hover:underline"
                                    >
                                      + Add Banned Input Rule
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Delete Stage Button */}
                            {!isReadonly && (
                              <div className="pt-4 border-t border-border flex justify-end">
                                <Button
                                  variant="danger"
                                  size="sm"
                                  type="button"
                                  onClick={() => handleRemoveStage(idx)}
                                >
                                  Delete Stage {stage.position}
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column (4 cols): Farmer Sequence Preview Panel */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="sticky top-36">
              <CardHeader
                title={<span className="text-brand-700">Farmer Preview Timeline</span>}
                action={<Badge tone="brand">Farmer App Sequence</Badge>}
              />

              <p className="text-xs text-ink-500 leading-relaxed mb-4">
                This is how your farmers will experience this quality standard sequence in their
                Paramparā app:
              </p>

              {stages.length === 0 ? (
                <p className="text-sm text-ink-400 italic py-6 text-center">No stages added yet.</p>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {stages
                    .slice()
                    .sort((a, b) => a.start_offset_days - b.start_offset_days)
                    .map((stg, i) => (
                      <div key={i} className="p-3 bg-paper-sunken rounded-lg border border-border space-y-1">
                        <div className="flex items-center justify-between text-xs gap-2">
                          <span className="font-semibold text-ink-900">{stg.name}</span>
                          <Badge tone="brand" className="whitespace-nowrap">
                            {stg.timing_type === "recurring"
                              ? `Every ${stg.repeat_interval_days}d from Day ${stg.start_offset_days}${stg.end_offset_days ? ` to ${stg.end_offset_days}` : ""}`
                              : `Day ${stg.start_offset_days}`}
                          </Badge>
                        </div>
                        <p className="text-xs text-ink-500 line-clamp-2">
                          {stg.instructions.en || "No instructions provided."}
                        </p>
                        {stg.allowed_inputs && stg.allowed_inputs.length > 0 && (
                          <div className="text-[11px] text-success">
                            Allowed: {stg.allowed_inputs.join(", ")}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* ── PUBLISH CONFIRM MODAL ── */}
      <ConfirmModal
        open={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        onConfirm={handlePublish}
        title="Publish Quality Standard Version"
        confirmLabel="Confirm & Publish Version"
        loading={publishing}
      >
        <p>
          Are you sure you want to publish <span className="font-semibold text-ink-900">{verName}</span>?
        </p>
        <p className="mt-3">
          <strong className="text-warning">Warning:</strong> Published versions are strictly{" "}
          <strong className="text-ink-900">immutable</strong> and cannot be edited or deleted once
          published.
        </p>
      </ConfirmModal>
    </div>
  );
}
