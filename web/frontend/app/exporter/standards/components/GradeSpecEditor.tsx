"use client";

/**
 * GradeSpecEditor.tsx  (Step 2C)
 *
 * Replaces the old generic key/value rows in the version editor.
 *
 * Design:
 *  - Renders per-crop "named" fields (from fieldDefs) for known keys.
 *  - Any key NOT in fieldDefs is shown under an "Other / Legacy" section
 *    with add/remove, matching the old free-form behaviour exactly.
 *  - Works in read-only mode (published versions).
 *  - Fully backwards compatible: if fieldDefs is [] (unknown crop or
 *    endpoint failure) every key falls through to "Other".
 *  - The parent component owns the gradeSpec state and passes callbacks;
 *    this component is purely presentational.
 */

import React from "react";
import type { GradeSpecFieldDef } from "@/lib/templatesApi";
import { Field, Input } from "@/components/ui/field";

// ── Types ──────────────────────────────────────────────────────────────────

export interface GradeSpecRow {
  key: string;
  value: string;
}

interface GradeSpecEditorProps {
  /** Per-crop field definitions from the templates endpoint. [] = all go to Other. */
  fieldDefs: GradeSpecFieldDef[];
  /** Current spec as a flat key/value pair array (same shape as before). */
  gradeSpec: GradeSpecRow[];
  /** Called whenever the spec changes; parent updates state. */
  onChange: (updated: GradeSpecRow[]) => void;
  /** True for published (read-only) versions. */
  readOnly?: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Split spec rows into named (known) and other (unknown/legacy). */
function splitRows(
  rows: GradeSpecRow[],
  fieldDefs: GradeSpecFieldDef[]
): {
  namedValues: Record<string, string>;
  otherRows: GradeSpecRow[];
} {
  const knownKeys = new Set(fieldDefs.map((f) => f.key));
  const namedValues: Record<string, string> = {};
  const otherRows: GradeSpecRow[] = [];

  // Seed named values from fieldDefs so all fields render even if absent in spec
  fieldDefs.forEach((f) => {
    namedValues[f.key] = "";
  });

  rows.forEach((row) => {
    if (knownKeys.has(row.key)) {
      namedValues[row.key] = row.value;
    } else {
      otherRows.push(row);
    }
  });

  return { namedValues, otherRows };
}

/** Merge named values + other rows back into a flat array. */
function mergeRows(
  namedValues: Record<string, string>,
  otherRows: GradeSpecRow[],
  fieldDefs: GradeSpecFieldDef[]
): GradeSpecRow[] {
  const named: GradeSpecRow[] = fieldDefs
    .map((f) => ({ key: f.key, value: namedValues[f.key] ?? "" }))
    .filter((r) => r.value.trim() !== ""); // omit empty named fields (keeps payload clean)
  return [...named, ...otherRows];
}

// ── Component ──────────────────────────────────────────────────────────────

export default function GradeSpecEditor({
  fieldDefs,
  gradeSpec,
  onChange,
  readOnly = false,
}: GradeSpecEditorProps) {
  const { namedValues, otherRows } = splitRows(gradeSpec, fieldDefs);

  // Update a named (known) field
  const handleNamedChange = (key: string, value: string) => {
    if (readOnly) return;
    const updated = { ...namedValues, [key]: value };
    onChange(mergeRows(updated, otherRows, fieldDefs));
  };

  // Update an "Other" row key or value
  const handleOtherChange = (
    idx: number,
    field: "key" | "value",
    val: string
  ) => {
    if (readOnly) return;
    const updatedOther = [...otherRows];
    updatedOther[idx] = { ...updatedOther[idx], [field]: val };
    onChange(mergeRows(namedValues, updatedOther, fieldDefs));
  };

  const handleAddOtherRow = () => {
    if (readOnly) return;
    onChange(mergeRows(namedValues, [...otherRows, { key: "", value: "" }], fieldDefs));
  };

  const handleRemoveOtherRow = (idx: number) => {
    if (readOnly) return;
    const updatedOther = otherRows.filter((_, i) => i !== idx);
    onChange(mergeRows(namedValues, updatedOther, fieldDefs));
  };

  const hasNamedFields = fieldDefs.length > 0;

  return (
    <div className="space-y-5">
      {/* ── Named (per-crop) fields ─────────────────────────────── */}
      {hasNamedFields && (
        <div className="space-y-4">
          {fieldDefs.map((def) => (
            <Field key={def.key} label={def.label} htmlFor={`grade-spec-${def.key}`}>
              <Input
                id={`grade-spec-${def.key}`}
                type="text"
                disabled={readOnly}
                placeholder={def.hint}
                value={namedValues[def.key] ?? ""}
                onChange={(e) => handleNamedChange(def.key, e.target.value)}
              />
            </Field>
          ))}
        </div>
      )}

      {/* ── Other / Legacy section ───────────────────────────────── */}
      <div className="space-y-2">
        {/* Section header — always shown so exporter knows extra keys exist */}
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wide">
            {hasNamedFields ? "Other / Additional Parameters" : "Grade Parameters"}
          </span>
          {!readOnly && (
            <button
              id="grade-spec-add-other"
              type="button"
              onClick={handleAddOtherRow}
              className="text-[11px] font-semibold text-brand-700 hover:text-brand-800 transition-colors"
            >
              + Add Parameter
            </button>
          )}
        </div>

        {otherRows.length === 0 ? (
          <p className="text-[11px] text-ink-400 italic py-1">
            {hasNamedFields
              ? "No additional parameters. Use the fields above for standard specs."
              : "No grade parameters defined yet."}
          </p>
        ) : (
          <div className="space-y-2">
            {otherRows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  id={`grade-spec-other-key-${idx}`}
                  type="text"
                  disabled={readOnly}
                  placeholder="Parameter name"
                  value={row.key}
                  onChange={(e) => handleOtherChange(idx, "key", e.target.value)}
                  className="flex-1"
                />
                <Input
                  id={`grade-spec-other-value-${idx}`}
                  type="text"
                  disabled={readOnly}
                  placeholder="Value"
                  value={row.value}
                  onChange={(e) => handleOtherChange(idx, "value", e.target.value)}
                  className="flex-1"
                />
                {!readOnly && (
                  <button
                    id={`grade-spec-other-remove-${idx}`}
                    type="button"
                    onClick={() => handleRemoveOtherRow(idx)}
                    className="w-9 h-9 rounded-lg bg-danger-bg text-danger hover:brightness-95 border border-danger-border
                               font-bold flex items-center justify-center shrink-0 transition-colors"
                    aria-label={`Remove parameter ${row.key || idx}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
