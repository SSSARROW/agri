import { getAuthToken } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function authFetch(url: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: "Network error" }));
    const err: any = new Error(data.detail || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export interface MultilingualText {
  en: string;
  si?: string;
  ta?: string;
}

export interface NoticeListItem {
  id: string;
  exporter_profile_id: string;
  crop: "tea" | "cinnamon";
  status: "draft" | "published" | "cancelled";
  computed_state: "draft" | "upcoming" | "past" | "cancelled";
  standard_version_id: string;
  standard_name?: string | null;
  standard_version_number?: number | null;
  target_month: string;
  volume_needed_kg: number;
  total_expected_volume_kg: number;
  volume_percentage: number;
  eligible_districts: string[];
  title: Record<string, string>;
  created_at: string;
  published_at?: string | null;
  cancelled_at?: string | null;
  counts: {
    ready: number;
    cannot: number;
    no_reply: number;
    eligible_total: number;
  };
}

export interface PaginatedNoticesResponse {
  items: NoticeListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface NoticeDetail {
  id: string;
  exporter_profile_id: string;
  crop: "tea" | "cinnamon";
  status: "draft" | "published" | "cancelled";
  computed_state: "draft" | "upcoming" | "past" | "cancelled";
  standard_version_id: string;
  standard_name?: string | null;
  standard_version_number?: number | null;
  target_month: string;
  volume_needed_kg: number;
  eligible_districts: string[];
  title: Record<string, string>;
  message: Record<string, string>;
  published_at?: string | null;
  cancelled_at?: string | null;
  cancelled_reason?: string | null;
  created_at: string;
  updated_at: string;
  counts: {
    ready: number;
    cannot: number;
    no_reply: number;
    eligible_total: number;
  };
  total_expected_volume_kg: number;
  volume_percentage: number;
}

export interface FarmerResponseItem {
  farmer_id: string;
  farmer_name: string;
  district?: string | null;
  phone?: string | null;
  response: "ready" | "cannot" | "no_reply";
  expected_volume_kg?: number | null;
  plot_id?: string | null;
  plot_name?: string | null;
  plot_area_ha?: number | null;
  responded_at?: string | null;
}

export interface NoticeResponsesSummary {
  notice_id: string;
  volume_needed_kg: number;
  total_expected_volume_kg: number;
  volume_percentage: number;
  counts: {
    ready: number;
    cannot: number;
    no_reply: number;
    eligible_total: number;
  };
  items: FarmerResponseItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function fetchNotices(params: {
  crop?: string;
  state?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<PaginatedNoticesResponse> {
  const q = new URLSearchParams();
  if (params.crop) q.set("crop", params.crop);
  if (params.state) q.set("state", params.state);
  if (params.page) q.set("page", String(params.page));
  if (params.page_size) q.set("page_size", String(params.page_size));
  return authFetch(`/api/exporter/planting-notices?${q}`);
}

export async function fetchNoticeDetail(id: string): Promise<NoticeDetail> {
  return authFetch(`/api/exporter/planting-notices/${id}`);
}

export async function createNotice(payload: {
  crop: string;
  standard_version_id: string;
  target_month: string;
  volume_needed_kg: number;
  eligible_districts: string[];
  title: MultilingualText;
  message: MultilingualText;
}): Promise<NoticeDetail> {
  return authFetch("/api/exporter/planting-notices", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateDraftNotice(
  id: string,
  payload: Partial<{
    crop: string;
    standard_version_id: string;
    target_month: string;
    volume_needed_kg: number;
    eligible_districts: string[];
    title: MultilingualText;
    message: MultilingualText;
  }>
): Promise<NoticeDetail> {
  return authFetch(`/api/exporter/planting-notices/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function publishNotice(id: string): Promise<NoticeDetail> {
  return authFetch(`/api/exporter/planting-notices/${id}/publish`, {
    method: "POST",
  });
}

export async function cancelNotice(id: string, reason?: string): Promise<NoticeDetail> {
  return authFetch(`/api/exporter/planting-notices/${id}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function duplicateNotice(id: string): Promise<NoticeDetail> {
  return authFetch(`/api/exporter/planting-notices/${id}/duplicate`, {
    method: "POST",
  });
}

export async function fetchNoticeResponses(
  id: string,
  params: {
    response?: string;
    search?: string;
    page?: number;
    page_size?: number;
  } = {}
): Promise<NoticeResponsesSummary> {
  const q = new URLSearchParams();
  if (params.response) q.set("response", params.response);
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  if (params.page_size) q.set("page_size", String(params.page_size));
  return authFetch(`/api/exporter/planting-notices/${id}/responses?${q}`);
}
