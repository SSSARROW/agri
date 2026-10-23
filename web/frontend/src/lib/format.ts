const TZ = "Asia/Colombo";

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ,
  });
}

/** "2026-11-01" or "2026-11" → "November 2026". */
export function fmtMonth(value?: string | null): string {
  if (!value) return "—";
  const [y, m] = value.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function fmtKg(n?: number | null): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return `${n.toLocaleString("en-GB", { maximumFractionDigits: 1 })} kg`;
}

export function fmtHa(n?: number | null): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (n < 0.01) return `${Math.round(n * 10000).toLocaleString("en-GB")} m²`;
  return `${n.toLocaleString("en-GB", { maximumFractionDigits: 2 })} ha`;
}

export function fmtLkr(n?: number | null): string {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return `LKR ${n.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
}

export function fmtPrice(v: {
  price_type?: string;
  price_fixed?: number | null;
  price_min?: number | null;
  price_max?: number | null;
}): string {
  if (v.price_type === "range") return `${fmtLkr(v.price_min)} – ${fmtLkr(v.price_max).replace("LKR ", "")} /kg`;
  return `${fmtLkr(v.price_fixed)} /kg`;
}

export function fmtPct(n?: number | null): string {
  if (n === null || n === undefined || isNaN(n)) return "0%";
  return `${Math.round(n)}%`;
}

export function titleCase(s?: string | null): string {
  if (!s) return "";
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return fmtDate(iso);
}

/* ── Date inputs ────────────────────────────────────────────────────────────
   Ad dates are chosen as calendar days in Sri Lanka. Starts are local midnight,
   ends and expiry are the last second of the chosen local day, so "expires on
   31 Dec" really means the end of 31 Dec in Sri Lanka rather than 5:30 a.m. */

export function dateToIsoStart(day: string): string {
  return `${day}T00:00:00+05:30`;
}

export function dateToIsoEnd(day: string): string {
  return `${day}T23:59:59+05:30`;
}

/** ISO timestamp → YYYY-MM-DD in Sri Lanka time, for <input type="date">. */
export function isoToDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export function todayPlus(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export function nextMonthValue(): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
