import { getAuthToken } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface MultilingualText {
  en: string;
  si?: string;
  ta?: string;
}

export interface TermsSpec {
  payment_timing?: string;
  rejection_handling?: string;
  packaging?: string;
  transport_responsibility?: string;
  other?: string;
}

export interface AdListItem {
  id: string;
  exporter_profile_id: string;
  crop: string;
  status: "draft" | "closed";
  computed_status: "draft" | "live" | "expired" | "closed";
  closed_reason?: string | null;
  created_at: string;
  updated_at: string;
  latest_version_number: number;
  latest_title: MultilingualText;
  latest_quantity_kg: number;
  latest_price_type: "fixed" | "range";
  latest_price_fixed?: number | null;
  latest_price_min?: number | null;
  latest_price_max?: number | null;
  latest_collection_start: string;
  latest_collection_end: string;
  latest_expires_at: string;
  latest_standard_name?: string | null;
}

export interface AdVersionDetail {
  id: string;
  ad_id: string;
  version_number: number;
  status: "draft" | "published";
  standard_version_id: string;
  title: MultilingualText;
  description: MultilingualText;
  grade_tier?: string | null;
  quantity_kg: number;
  price_type: "fixed" | "range";
  price_fixed?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  collection_window_start: string;
  collection_window_end: string;
  pickup_location: string;
  eligible_districts: string[];
  terms: TermsSpec;
  expires_at: string;
  published_at?: string | null;
  created_at: string;
  standard_name?: string | null;
  standard_crop?: string | null;
  standard_version_number?: number | null;
}

export interface AdDetail {
  id: string;
  exporter_profile_id: string;
  crop: string;
  status: "draft" | "closed";
  computed_status: "draft" | "live" | "expired" | "closed";
  closed_reason?: string | null;
  created_at: string;
  updated_at: string;
  versions: AdVersionDetail[];
}

export interface PaginatedAdsResponse {
  items: AdListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdCreatePayload {
  crop: string;
  standard_version_id: string;
  title: MultilingualText;
  description: MultilingualText;
  grade_tier?: string;
  quantity_kg: number;
  price_type: "fixed" | "range";
  price_fixed?: number;
  price_min?: number;
  price_max?: number;
  collection_window_start: string;
  collection_window_end: string;
  pickup_location?: string;
  eligible_districts?: string[];
  terms?: TermsSpec;
  expires_at: string;
}

export interface AdVersionUpdatePayload {
  standard_version_id?: string;
  title?: MultilingualText;
  description?: MultilingualText;
  grade_tier?: string;
  quantity_kg?: number;
  price_type?: "fixed" | "range";
  price_fixed?: number;
  price_min?: number;
  price_max?: number;
  collection_window_start?: string;
  collection_window_end?: string;
  pickup_location?: string;
  eligible_districts?: string[];
  terms?: TermsSpec;
  expires_at?: string;
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

export async function fetchAds(params: {
  crop?: string;
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<PaginatedAdsResponse> {
  const q = new URLSearchParams();
  if (params.crop) q.set("crop", params.crop);
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  if (params.page_size) q.set("page_size", String(params.page_size));

  return authFetch(`/api/exporter/ads?${q.toString()}`);
}

export async function createAd(payload: AdCreatePayload): Promise<AdDetail> {
  return authFetch("/api/exporter/ads", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAd(id: string): Promise<AdDetail> {
  return authFetch(`/api/exporter/ads/${id}`);
}

export async function fetchAdVersion(id: string, versionNumber: number): Promise<AdVersionDetail> {
  return authFetch(`/api/exporter/ads/${id}/versions/${versionNumber}`);
}

export async function updateDraftAdVersion(
  id: string,
  versionNumber: number,
  payload: AdVersionUpdatePayload
): Promise<AdVersionDetail> {
  return authFetch(`/api/exporter/ads/${id}/versions/${versionNumber}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function publishAdVersion(
  id: string,
  versionNumber: number
): Promise<AdVersionDetail> {
  return authFetch(`/api/exporter/ads/${id}/versions/${versionNumber}/publish`, {
    method: "POST",
  });
}

export async function createNewDraftAdVersion(id: string): Promise<AdVersionDetail> {
  return authFetch(`/api/exporter/ads/${id}/versions`, {
    method: "POST",
  });
}

export async function closeAd(id: string, reason?: string): Promise<AdDetail> {
  return authFetch(`/api/exporter/ads/${id}/close`, {
    method: "POST",
    body: JSON.stringify({ reason: reason || "Closed by exporter" }),
  });
}

export async function duplicateAd(id: string): Promise<AdDetail> {
  return authFetch(`/api/exporter/ads/${id}/duplicate`, {
    method: "POST",
  });
}

export const SRI_LANKA_DISTRICTS = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo",
  "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara",
  "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar",
  "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya",
  "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya"
];
