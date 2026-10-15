/**
 * exporterApi.ts
 * Exporter-specific API calls against the /api/exporter/* backend endpoints.
 * Import from "@/lib/exporterApi" — do not merge into the shared api.ts.
 */
import axios from "axios";
import { getAuthToken } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ExporterProfile {
  id: string;
  user_id: string;
  company_name: string;
  business_reg_no: string;
  export_licence_no?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  description?: string | null;
  logo_url?: string | null;
  districts_served: string[];
  crops_bought: string[];
  certifications: string[];
  status: "pending" | "verified" | "rejected";
  rejection_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExporterProfileUpdate {
  company_name?: string;
  business_reg_no?: string;
  export_licence_no?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  description?: string;
  logo_url?: string;
  districts_served?: string[];
  crops_bought?: string[];
  certifications?: string[];
}

function authHeader() {
  const token = getAuthToken();
  if (!token) throw new Error("No auth token found");
  return { Authorization: `Bearer ${token}` };
}

export async function fetchExporterProfile(): Promise<ExporterProfile> {
  const res = await axios.get<ExporterProfile>(`${API_BASE}/api/exporter/me`, {
    headers: authHeader(),
  });
  return res.data;
}

export async function updateExporterProfile(
  data: ExporterProfileUpdate
): Promise<ExporterProfile> {
  const res = await axios.put<ExporterProfile>(`${API_BASE}/api/exporter/me`, data, {
    headers: authHeader(),
  });
  return res.data;
}
