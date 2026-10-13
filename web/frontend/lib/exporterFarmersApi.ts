/**
 * exporterFarmersApi.ts
 * API client for Exporter-side Farmer Links (/api/exporter/farmers)
 */
import axios from "axios";
import { getAuthToken } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface PlotSummary {
  id: string;
  name?: string | null;
  area_ha?: number | null;
  district?: string | null;
  dsd?: string | null;
  gn_division?: string | null;
  plot_type?: string | null;
  boundary_source?: string | null;
}

export interface FarmerSummary {
  id: string;
  name: string;
  district?: string | null;
  dsd?: string | null;
  gn_division?: string | null;
  farm_address?: string | null;
  farm_size_ha?: number | null;
  phone?: string | null; // ONLY present if status is 'approved'
  crops: string[];
  total_plots: number;
  total_plot_area_ha: number;
}

export interface FarmerLinkListItem {
  id: string;
  farmer_id: string;
  exporter_profile_id: string;
  status: "requested" | "approved" | "declined" | "removed" | "cancelled";
  requested_at: string;
  decided_at?: string | null;
  decision_reason?: string | null;
  farmer: FarmerSummary;
}

export interface PaginatedFarmerLinksResponse {
  items: FarmerLinkListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  pending_count: number;
}

export interface FarmerLinkDetail extends FarmerLinkListItem {
  plots: PlotSummary[];
}

function authHeader() {
  const token = getAuthToken();
  if (!token) throw new Error("No auth token found");
  return { Authorization: `Bearer ${token}` };
}

export interface FilterParams {
  status?: string;
  district?: string;
  crop?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchFarmerLinks(
  params: FilterParams = {}
): Promise<PaginatedFarmerLinksResponse> {
  const query = new URLSearchParams();
  if (params.status && params.status !== "all") query.append("status", params.status);
  if (params.status === "all") query.append("status", "all");
  if (params.district) query.append("district", params.district);
  if (params.crop) query.append("crop", params.crop);
  if (params.search) query.append("search", params.search);
  if (params.page) query.append("page", String(params.page));
  if (params.pageSize) query.append("page_size", String(params.pageSize));

  const url = `${API_BASE}/api/exporter/farmers?${query.toString()}`;
  const res = await axios.get<PaginatedFarmerLinksResponse>(url, {
    headers: authHeader(),
  });
  return res.data;
}

export async function fetchFarmerLinkDetail(id: string): Promise<FarmerLinkDetail> {
  const res = await axios.get<FarmerLinkDetail>(
    `${API_BASE}/api/exporter/farmers/${id}`,
    { headers: authHeader() }
  );
  return res.data;
}

export async function approveFarmerLink(id: string): Promise<FarmerLinkDetail> {
  const res = await axios.post<FarmerLinkDetail>(
    `${API_BASE}/api/exporter/farmers/${id}/approve`,
    {},
    { headers: authHeader() }
  );
  return res.data;
}

export async function declineFarmerLink(
  id: string,
  reason?: string
): Promise<FarmerLinkDetail> {
  const res = await axios.post<FarmerLinkDetail>(
    `${API_BASE}/api/exporter/farmers/${id}/decline`,
    { reason: reason || null },
    { headers: authHeader() }
  );
  return res.data;
}

export async function removeFarmerLink(
  id: string,
  reason?: string
): Promise<FarmerLinkDetail> {
  const res = await axios.post<FarmerLinkDetail>(
    `${API_BASE}/api/exporter/farmers/${id}/remove`,
    { reason: reason || null },
    { headers: authHeader() }
  );
  return res.data;
}
