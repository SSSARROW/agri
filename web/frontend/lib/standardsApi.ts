import { getAuthToken } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface MultilingualText {
  en: string;
  si?: string;
  ta?: string;
}

export interface MultilingualList {
  en: string[];
  si?: string[];
  ta?: string[];
}

export interface BannedInputItem {
  name: string;
  min_days_before_harvest: number;
}

export interface RequiredProofSpec {
  photo_count: number;
  photo_descriptions: string[];
  quick_fields: string[];
}

export interface StageData {
  id?: string;
  version_id?: string;
  position: number;
  name: string;
  timing_type: "one_time" | "recurring";
  start_offset_days: number;
  repeat_interval_days?: number | null;
  end_offset_days?: number | null;
  instructions: MultilingualText;
  dos: MultilingualList;
  donts: MultilingualList;
  allowed_inputs: string[];
  banned_inputs: BannedInputItem[];
  required_proof: RequiredProofSpec;
  created_at?: string;
}

export interface VersionSummary {
  id: string;
  standard_id: string;
  version_number: number;
  name: string;
  status: "draft" | "published";
  grade_spec: Record<string, any>;
  published_at?: string | null;
  created_at: string;
}

export interface VersionDetail extends VersionSummary {
  stages: StageData[];
}

export interface StandardData {
  id: string;
  exporter_profile_id: string;
  crop: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  versions: VersionSummary[];
}

export interface StandardListResponse {
  items: StandardData[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

async function authFetch(url: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: "Network request failed" }));
    const error: any = new Error(data.detail || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.detail = data.detail;
    throw error;
  }

  return res.json();
}

export async function fetchStandards(params: {
  crop?: string;
  is_archived?: boolean;
  page?: number;
  page_size?: number;
}): Promise<StandardListResponse> {
  const q = new URLSearchParams();
  if (params.crop) q.set("crop", params.crop);
  if (params.is_archived !== undefined) q.set("is_archived", String(params.is_archived));
  if (params.page) q.set("page", String(params.page));
  if (params.page_size) q.set("page_size", String(params.page_size));

  return authFetch(`/api/exporter/standards?${q.toString()}`);
}

export async function createStandard(data: {
  crop: string;
  name: string;
  grade_spec?: Record<string, any>;
  stages?: StageData[];
}): Promise<StandardData> {
  return authFetch("/api/exporter/standards", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchStandard(id: string): Promise<StandardData> {
  return authFetch(`/api/exporter/standards/${id}`);
}

export async function fetchVersion(id: string, versionNumber: number): Promise<VersionDetail> {
  return authFetch(`/api/exporter/standards/${id}/versions/${versionNumber}`);
}

export async function updateDraftVersion(
  id: string,
  versionNumber: number,
  data: {
    name: string;
    grade_spec: Record<string, any>;
    stages: StageData[];
  }
): Promise<VersionDetail> {
  return authFetch(`/api/exporter/standards/${id}/versions/${versionNumber}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function publishVersion(id: string, versionNumber: number): Promise<VersionDetail> {
  return authFetch(`/api/exporter/standards/${id}/versions/${versionNumber}/publish`, {
    method: "POST",
  });
}

export async function createNewDraft(id: string): Promise<VersionDetail> {
  return authFetch(`/api/exporter/standards/${id}/versions`, {
    method: "POST",
  });
}

export async function duplicateStandard(id: string): Promise<StandardData> {
  return authFetch(`/api/exporter/standards/${id}/duplicate`, {
    method: "POST",
  });
}

export async function archiveStandard(id: string): Promise<StandardData> {
  return authFetch(`/api/exporter/standards/${id}/archive`, {
    method: "POST",
  });
}

export async function unarchiveStandard(id: string): Promise<StandardData> {
  return authFetch(`/api/exporter/standards/${id}/unarchive`, {
    method: "POST",
  });
}
