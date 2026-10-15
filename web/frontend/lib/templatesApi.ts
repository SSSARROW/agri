/**
 * templatesApi.ts
 * Client for GET /api/exporter/standards/templates (Step 2C).
 *
 * Design notes:
 *  - This is a READ-ONLY endpoint; no mutations go through this file.
 *  - If the endpoint fails the UI falls back to "Blank" — callers must
 *    handle the null/error case gracefully.
 */

import { getAuthToken } from "@/lib/api";
import type { StageData } from "@/lib/standardsApi";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────────────────

/** One grade-spec field definition returned by the backend. */
export interface GradeSpecFieldDef {
  key: string;
  label: string;
  hint: string;
  input_type: string;
}

/** A single crop template returned by the endpoint. */
export interface TemplateData {
  id: string;
  name: string;
  crop: string;
  description: string;
  grade_spec: Record<string, string>;
  stages: StageData[];
}

/** Full response from GET /api/exporter/standards/templates */
export interface TemplatesResponse {
  templates: TemplateData[];
  grade_spec_fields: Record<string, GradeSpecFieldDef[]>;
}

// ── Fetch helper ───────────────────────────────────────────────────────────

async function authFetch(url: string): Promise<Response> {
  const token = getAuthToken();
  return fetch(`${API_BASE}${url}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch crop templates and grade-spec field definitions.
 * Optionally pass `crop` to filter templates (grade_spec_fields is always full).
 *
 * Returns null on any network/auth error — callers should fall back to Blank.
 */
export async function fetchTemplates(
  crop?: string
): Promise<TemplatesResponse | null> {
  try {
    const qs = crop ? `?crop=${encodeURIComponent(crop)}` : "";
    const res = await authFetch(`/api/exporter/standards/templates${qs}`);
    if (!res.ok) {
      console.warn(`[templatesApi] fetchTemplates returned ${res.status}`);
      return null;
    }
    return res.json() as Promise<TemplatesResponse>;
  } catch (err) {
    console.warn("[templatesApi] fetchTemplates failed:", err);
    return null;
  }
}

/**
 * Convenience: get the single template object for a given crop from a
 * TemplatesResponse (or null if not found).
 */
export function getTemplateForCrop(
  response: TemplatesResponse,
  crop: string
): TemplateData | null {
  return response.templates.find((t) => t.crop === crop) ?? null;
}

/**
 * Convenience: get the grade-spec field definitions for a given crop.
 * Returns [] for unknown crops so callers get the "Other" section only.
 */
export function getFieldDefsForCrop(
  response: TemplatesResponse,
  crop: string
): GradeSpecFieldDef[] {
  return response.grade_spec_fields[crop] ?? [];
}
