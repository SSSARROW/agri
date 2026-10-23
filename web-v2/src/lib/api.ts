import axios, { AxiosError } from "axios";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
export const FIELD_API_URL = process.env.NEXT_PUBLIC_FIELD_API_URL || "http://localhost:8000";

const TOKEN_KEY = "origo.token";
const ROLE_KEY = "origo.role";

export type Role = "farmer" | "exporter" | "admin" | "collector";

export const session = {
  get token(): string | null {
    if (typeof window === "undefined") return null;
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  get role(): Role | null {
    if (typeof window === "undefined") return null;
    try { return localStorage.getItem(ROLE_KEY) as Role | null; } catch { return null; }
  },
  set(token: string, role: Role) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(ROLE_KEY, role);
    } catch { /* storage unavailable */ }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ROLE_KEY);
    } catch { /* storage unavailable */ }
  },
};

export function homeFor(role?: Role | null): string {
  if (role === "exporter") return "/exporter";
  if (role === "admin") return "/admin";
  return "/account";
}

export const api = axios.create({ baseURL: API_URL, timeout: 20_000 });

api.interceptors.request.use((config) => {
  const token = session.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    const url = error.config?.url ?? "";
    const isAuthCall = url.startsWith("/auth/login") || url.startsWith("/auth/signup") || url.startsWith("/auth/google");
    if (error.response?.status === 401 && !isAuthCall && typeof window !== "undefined") {
      session.clear();
      window.location.assign("/signin?expired=1");
    }
    return Promise.reject(error);
  },
);

export interface ApiProblem {
  status?: number;
  message: string;
  /** Field-level problems, keyed by the last segment of the server's `loc`. */
  fields: Record<string, string>;
}

/** Turns any thrown value into one readable message plus field-level errors. */
export function parseError(err: unknown, fallback = "Something went wrong. Please try again."): ApiProblem {
  const e = err as AxiosError<{ detail?: unknown; error?: { message?: string } }>;
  if (!e?.isAxiosError) {
    return { message: err instanceof Error ? err.message : fallback, fields: {} };
  }
  if (!e.response) {
    return { message: "Can't reach the server. Check your connection and try again.", fields: {} };
  }
  const { status, data } = e.response;
  const detail = data?.detail;
  if (typeof detail === "string") return { status, message: detail, fields: {} };
  if (Array.isArray(detail)) {
    const fields: Record<string, string> = {};
    const lines: string[] = [];
    for (const d of detail as Array<{ msg?: string; loc?: Array<string | number> }>) {
      const msg = (d.msg ?? "Invalid value").replace(/^Value error, /, "");
      const key = d.loc ? String(d.loc[d.loc.length - 1]) : "";
      if (key && key !== "body" && !(key in fields)) fields[key] = msg;
      lines.push(key && key !== "body" ? `${key.replace(/_/g, " ")}: ${msg}` : msg);
    }
    return { status, message: lines.slice(0, 3).join(" · ") || fallback, fields };
  }
  if (data?.error?.message) return { status, message: data.error.message, fields: {} };
  if (status && status >= 500) return { status, message: "Something went wrong on our end. Please try again shortly.", fields: {} };
  return { status, message: fallback, fields: {} };
}

/** Photos may be absolute (object storage) or relative to the field API. */
export function assetUrl(url?: string | null): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${FIELD_API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}
