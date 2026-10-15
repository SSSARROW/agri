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

// ── Types ───────────────────────────────────────────────────────────────────

export interface AdminAdItem {
  id: string;
  crop: string;
  status: string;
  admin_state: "live" | "draft" | "expired" | "closed" | "taken_down" | "filled";
  closed_reason?: string | null;
  created_at: string;
  title: Record<string, string>;
  version_number?: number | null;
  expires_at?: string | null;
  exporter_profile_id: string;
  exporter_company: string;
  open_report_count: number;
  total_views: number;
  total_accepts: number;
}

export interface AdminAdListResponse {
  items: AdminAdItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdReport {
  id: string;
  ad_id: string;
  ad_version_id: string;
  farmer_id: string;
  reason: string;
  details?: string | null;
  status: "open" | "reviewed" | "dismissed";
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  farmer?: { id: string; name?: string | null; district?: string | null } | null;
}

export interface ModerationLogEntry {
  id: string;
  ad_id: string;
  admin_user_id: string;
  action: "takedown" | "restore";
  reason?: string | null;
  created_at: string;
  admin_user?: { id: string; name?: string | null; email: string } | null;
}

export interface AdminAdDetail {
  id: string;
  crop: string;
  status: string;
  admin_state: string;
  closed_reason?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
  live_version: any;
  all_versions: any[];
  exporter: any;
  stats: {
    total_views: number;
    unique_viewers: number;
    total_accepts: number;
    active_accepts: number;
  };
  reports: AdReport[];
  moderation_log: ModerationLogEntry[];
}

// ── API functions ────────────────────────────────────────────────────────────

export async function fetchAdminAds(params: {
  state?: string;
  has_open_reports?: boolean;
  crop?: string;
  search?: string;
  page?: number;
  page_size?: number;
}): Promise<AdminAdListResponse> {
  const q = new URLSearchParams();
  if (params.state) q.set("state", params.state);
  if (params.has_open_reports != null) q.set("has_open_reports", String(params.has_open_reports));
  if (params.crop) q.set("crop", params.crop);
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  if (params.page_size) q.set("page_size", String(params.page_size));
  return authFetch(`/api/admin/ads?${q}`);
}

export async function fetchAdminAdDetail(id: string): Promise<AdminAdDetail> {
  return authFetch(`/api/admin/ads/${id}`);
}

export async function takedownAd(id: string, reason: string): Promise<any> {
  return authFetch(`/api/admin/ads/${id}/takedown`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function restoreAd(id: string): Promise<any> {
  return authFetch(`/api/admin/ads/${id}/restore`, { method: "POST" });
}

export async function fetchAdminReports(params: {
  status?: string;
  ad_id?: string;
  page?: number;
}): Promise<{ items: AdReport[]; total: number }> {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.ad_id) q.set("ad_id", params.ad_id);
  if (params.page) q.set("page", String(params.page));
  return authFetch(`/api/admin/ads/reports?${q}`);
}

export async function dismissReport(reportId: string): Promise<any> {
  return authFetch(`/api/admin/ads/reports/${reportId}/dismiss`, { method: "POST" });
}

export async function reviewReport(reportId: string): Promise<any> {
  return authFetch(`/api/admin/ads/reports/${reportId}/review`, { method: "POST" });
}
