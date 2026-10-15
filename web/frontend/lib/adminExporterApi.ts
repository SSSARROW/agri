import { getAuthToken } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface UserSummary {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  district?: string | null;
  dsd?: string | null;
  gn_division?: string | null;
  created_at?: string;
}

export interface VerificationLogEntry {
  id: string;
  exporter_profile_id: string;
  admin_user_id: string | null;
  action: "approved" | "rejected" | "reopened";
  reason: string | null;
  previous_status: string;
  new_status: string;
  created_at: string;
  admin_user?: {
    email: string;
    name?: string | null;
  } | null;
}

export interface ExporterAdminProfile {
  id: string;
  user_id: string;
  company_name: string;
  business_reg_no: string;
  export_licence_no: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  logo_url: string | null;
  districts_served: string[];
  crops_bought: string[];
  certifications: string[];
  status: "pending" | "verified" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  users?: UserSummary | null;
  history?: VerificationLogEntry[];
}

export interface ExporterListResponse {
  items: ExporterAdminProfile[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  counts: {
    pending: number;
    verified: number;
    rejected: number;
  };
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
    const data = await res.json().catch(() => ({ detail: "Network response was not ok" }));
    throw new Error(data.detail || `Request failed with status ${res.status}`);
  }

  return res.json();
}

export async function fetchAdminExporters(params: {
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<ExporterListResponse> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", params.page.toString());
  if (params.pageSize) query.set("page_size", params.pageSize.toString());

  return authFetch(`/api/admin/exporters?${query.toString()}`);
}

export async function fetchAdminExporterDetails(id: string): Promise<ExporterAdminProfile> {
  return authFetch(`/api/admin/exporters/${id}`);
}

export async function approveExporter(id: string) {
  return authFetch(`/api/admin/exporters/${id}/approve`, {
    method: "POST",
  });
}

export async function rejectExporter(id: string, reason: string) {
  return authFetch(`/api/admin/exporters/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export async function reopenExporter(id: string) {
  return authFetch(`/api/admin/exporters/${id}/reopen`, {
    method: "POST",
  });
}
