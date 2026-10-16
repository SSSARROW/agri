/**
 * stageProofsApi.ts
 * API client for Exporter-side Stage Proof review queue (/api/exporter/stage-proofs)
 */
import { getAuthToken } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface MultilingualText {
  en: string;
  si?: string;
  ta?: string;
}

export interface SubmissionListItem {
  id: string;
  link_id: string;
  farmer_id: string;
  farmer_name: string;
  stage_id: string;
  stage_name: string;
  plot_name?: string | null;
  photo_count: number;
  status: SubmissionStatus;
  submitted_at: string;
  needs_attention: boolean;
}

export interface PaginatedSubmissionsResponse {
  items: SubmissionListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  pending_count: number;
}

export interface SubmissionDetail {
  id: string;
  link_id: string;
  farmer_id: string;
  farmer_name: string;
  stage_id: string;
  stage_name: string;
  stage_instructions: MultilingualText;
  plot_name?: string | null;
  photo_urls: string[];
  quick_field_answers: Record<string, string>;
  note?: string | null;
  status: SubmissionStatus;
  submitted_at: string;
  reviewed_at?: string | null;
  review_notes?: string | null;
  reopened_at?: string | null;
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

export async function fetchSubmissions(params: {
  status?: SubmissionStatus | "all";
  page?: number;
  page_size?: number;
}): Promise<PaginatedSubmissionsResponse> {
  const q = new URLSearchParams();
  if (params.status && params.status !== "all") q.set("status", params.status);
  if (params.status === "all") q.set("status", "");
  if (params.page) q.set("page", String(params.page));
  if (params.page_size) q.set("page_size", String(params.page_size));

  return authFetch(`/api/exporter/stage-proofs?${q.toString()}`);
}

export async function fetchSubmissionDetail(id: string): Promise<SubmissionDetail> {
  return authFetch(`/api/exporter/stage-proofs/${id}`);
}

export async function approveSubmission(id: string, notes?: string): Promise<SubmissionDetail> {
  return authFetch(`/api/exporter/stage-proofs/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ notes: notes || undefined }),
  });
}

export async function rejectSubmission(id: string, notes: string): Promise<SubmissionDetail> {
  return authFetch(`/api/exporter/stage-proofs/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export async function reopenSubmission(id: string): Promise<SubmissionDetail> {
  return authFetch(`/api/exporter/stage-proofs/${id}/reopen`, {
    method: "POST",
  });
}
