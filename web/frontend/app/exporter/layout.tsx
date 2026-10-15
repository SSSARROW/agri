"use client";

/**
 * Exporter layout — wraps all /exporter/* pages.
 * Completely independent of the farmer layout and admin layout.
 * Handles:
 *   - Role guard: non-exporters are redirected to their own dashboard
 *   - Sidebar navigation (items disabled as "coming soon" in Step 1)
 *   - Company name & role label in the header
 */
import React, { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { clearAuthToken } from "@/lib/api";
import { fetchExporterProfile, ExporterProfile } from "@/lib/exporterApi";

const ENABLE_EXPORTER_ADS = process.env.NEXT_PUBLIC_ENABLE_EXPORTER_ADS !== "false";
const ENABLE_EXPORTER_FARMERS = process.env.NEXT_PUBLIC_ENABLE_EXPORTER_FARMERS !== "false";

const NAV_ITEMS = [
  { label: "Dashboard", icon: "🏠", href: "/exporter/dashboard", active: true },
  { label: "Company Profile", icon: "🏢", href: "/exporter/profile", active: true },
  { label: "Quality Standards", icon: "📋", href: "/exporter/standards", active: true },
  {
    label: "Advertisements",
    icon: "📢",
    href: ENABLE_EXPORTER_ADS ? "/exporter/ads" : "#",
    active: ENABLE_EXPORTER_ADS,
    soon: !ENABLE_EXPORTER_ADS,
  },
  {
    label: "My Farmers",
    icon: "🌾",
    href: ENABLE_EXPORTER_FARMERS ? "/exporter/farmers" : "#",
    active: ENABLE_EXPORTER_FARMERS,
    soon: !ENABLE_EXPORTER_FARMERS,
  },
  { label: "Planting Notices", icon: "🌱", href: "#", active: false, soon: true },
];

export default function ExporterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = useCallback(() => {
    clearAuthToken();
    router.push("/");
  }, [router]);

  useEffect(() => {
    const role =
      typeof window !== "undefined" ? localStorage.getItem("role") : null;

    // Non-exporters are redirected away immediately (client-side guard)
    if (role && role !== "exporter") {
      router.replace(role === "admin" ? "/admin/users" : "/dashboard");
      return;
    }
    if (!role) {
      router.replace("/");
      return;
    }

    fetchExporterProfile()
      .then(setProfile)
      .catch(() => {
        clearAuthToken();
        router.replace("/");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
          <p className="text-zinc-400 text-sm font-medium">Loading your workspace…</p>
        </div>
      </div>
    );
  }

  const statusColor =
    profile?.status === "verified"
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : profile?.status === "rejected"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : "bg-amber-500/20 text-amber-400 border-amber-500/30";

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-zinc-900 border-r border-zinc-800
          flex flex-col transform transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:flex
        `}
      >
        {/* Sidebar Header */}
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center font-black text-lg text-black shrink-0">
              P
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-teal-400 uppercase tracking-widest">
                Paramparā
              </p>
              <p className="text-[11px] text-zinc-500 truncate">
                {profile?.company_name || "Exporter Portal"}
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isCurrent = item.href !== "#" && pathname === item.href;
            if (!item.active || item.soon) {
              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-zinc-600 cursor-not-allowed select-none"
                >
                  <span className="flex items-center gap-2 text-sm">
                    <span>{item.icon}</span>
                    {item.label}
                  </span>
                  <span className="text-[10px] font-bold bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Soon
                  </span>
                </div>
              );
            }
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isCurrent
                    ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-zinc-800 space-y-2">
          <div className={`px-3 py-1.5 rounded-lg border text-xs font-semibold text-center ${statusColor}`}>
            {profile?.status === "verified"
              ? "✓ Verified Exporter"
              : profile?.status === "rejected"
              ? "✗ Account Rejected"
              : "⏳ Pending Verification"}
          </div>
          <button
            onClick={handleLogout}
            className="w-full px-3 py-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-xl transition-all text-center"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main content area ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-zinc-950/90 backdrop-blur border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
          <button
            className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <span className="hidden sm:block text-sm text-zinc-400 font-medium truncate max-w-[200px]">
              {profile?.company_name || profile?.contact_person || "Exporter"}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-teal-500/20 text-teal-400 border-teal-500/30">
              Exporter
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 lg:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
