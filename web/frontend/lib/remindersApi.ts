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

export interface SlotStats {
  slot: number;
  scheduled_date: string;
  sent: number;
  failed: number;
  skipped: number;
  skipped_reasons: Record<string, number>;
  pending: number;
}

export interface DeliveryItem {
  id: string;
  farmer_name: string;
  reminder_slot: number;
  channel: string;
  status: "pending" | "sending" | "sent" | "failed" | "skipped" | "read";
  skip_reason?: string | null;
  sent_at?: string | null;
  attempts: number;
  last_error?: string | null;
  created_at: string;
}

export interface NoticeRemindersResponse {
  notice_id: string;
  provider: string;
  slots: SlotStats[];
  deliveries: DeliveryItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface RetryFailedResponse {
  notice_id: string;
  retried_count: number;
  message: string;
}

export async function fetchNoticeReminders(
  noticeId: string,
  params: {
    slot?: number;
    status?: string;
    page?: number;
    pageSize?: number;
  } = {}
): Promise<NoticeRemindersResponse> {
  const qs = new URLSearchParams();
  if (params.slot) qs.set("slot", String(params.slot));
  if (params.status) qs.set("status", params.status);
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("page_size", String(params.pageSize));

  const query = qs.toString() ? `?${qs.toString()}` : "";
  return authFetch(`/api/exporter/planting-notices/${noticeId}/reminders${query}`);
}

export async function retryFailedReminders(noticeId: string): Promise<RetryFailedResponse> {
  return authFetch(`/api/exporter/planting-notices/${noticeId}/reminders/retry-failed`, {
    method: "POST",
  });
}
