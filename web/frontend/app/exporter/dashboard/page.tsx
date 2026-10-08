"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { fetchExporterProfile, ExporterProfile } from "@/lib/exporterApi";

// ── Status Banner ──────────────────────────────────────────────────────────

function StatusBanner({ profile }: { profile: ExporterProfile }) {
  if (profile.status === "verified") {
    return (
      <div className="flex items-start gap-4 p-5 rounded-2xl bg-emerald-950/60 border border-emerald-500/30 backdrop-blur">
        <div className="text-2xl shrink-0">✅</div>
        <div>
          <p className="font-bold text-emerald-300 text-sm">Account Verified</p>
          <p className="text-zinc-400 text-xs mt-0.5">
            Your exporter account is verified. You have full access to the Paramparā platform.
          </p>
        </div>
      </div>
    );
  }

  if (profile.status === "rejected") {
    return (
      <div className="flex items-start gap-4 p-5 rounded-2xl bg-red-950/60 border border-red-500/30 backdrop-blur">
        <div className="text-2xl shrink-0">❌</div>
        <div>
          <p className="font-bold text-red-300 text-sm">Account Rejected</p>
          <p className="text-zinc-400 text-xs mt-1">
            Your application was not approved.{" "}
            {profile.rejection_reason ? (
              <>
                Reason:{" "}
                <span className="text-red-400 font-medium">{profile.rejection_reason}</span>
              </>
            ) : null}
          </p>
          <p className="text-zinc-500 text-xs mt-2">
            Please update your company profile and contact the platform administrator.
          </p>
        </div>
      </div>
    );
  }

  // pending (default)
  return (
    <div className="flex items-start gap-4 p-5 rounded-2xl bg-amber-950/60 border border-amber-500/30 backdrop-blur">
      <div className="text-2xl shrink-0 animate-pulse">⏳</div>
      <div>
        <p className="font-bold text-amber-300 text-sm">Awaiting Verification</p>
        <p className="text-zinc-400 text-xs mt-0.5">
          Your account is under review. The Paramparā team will verify your business
          registration and export licence. This usually takes 1–2 business days.
        </p>
        <Link
          href="/exporter/profile"
          className="inline-block mt-3 text-xs font-semibold text-teal-400 hover:text-teal-300 underline underline-offset-2 transition-colors"
        >
          Review your company profile →
        </Link>
      </div>
    </div>
  );
}

// ── Coming-Soon Card ───────────────────────────────────────────────────────

function ComingSoonCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 flex flex-col gap-2 overflow-hidden group">
      {/* Disabled overlay */}
      <div className="absolute inset-0 bg-zinc-950/50 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-2xl">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 bg-zinc-900 border border-zinc-700 px-3 py-1 rounded-full">
          Coming Soon
        </span>
      </div>
      <div className="text-2xl">{icon}</div>
      <p className="font-bold text-white text-sm">{title}</p>
      <p className="text-zinc-500 text-xs leading-relaxed">{description}</p>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export default function ExporterDashboardPage() {
  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExporterProfile()
      .then(setProfile)
      .catch(() => setError("Failed to load dashboard data. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="bg-red-950/40 border border-red-900/50 p-6 rounded-2xl max-w-sm text-center">
          <p className="text-red-400 font-semibold text-sm">{error || "No profile found."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Welcome header */}
      <div className="relative bg-gradient-to-br from-teal-950/80 to-zinc-900/80 border border-teal-500/20 rounded-3xl p-8 overflow-hidden">
        {/* Background glow */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <p className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-2">
            🚢 Exporter Portal
          </p>
          <h1 className="text-3xl font-extrabold text-white leading-tight">
            Welcome,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">
              {profile.company_name || profile.contact_person || "Exporter"}
            </span>
          </h1>
          <p className="text-zinc-400 text-sm mt-2 max-w-xl">
            Manage your export operations, connect with verified farmers, and track your agricultural supply chain on the Paramparā platform.
          </p>
        </div>
      </div>

      {/* Verification status banner */}
      <StatusBanner profile={profile} />

      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Account Status", value: profile.status.charAt(0).toUpperCase() + profile.status.slice(1), color: profile.status === "verified" ? "text-emerald-400" : profile.status === "rejected" ? "text-red-400" : "text-amber-400" },
          { label: "Crops Bought", value: profile.crops_bought.length, color: "text-teal-400" },
          { label: "Districts", value: profile.districts_served.length || "—", color: "text-indigo-400" },
          { label: "Certifications", value: profile.certifications.length || "—", color: "text-purple-400" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 text-center"
          >
            <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
            <p className="text-[11px] text-zinc-500 uppercase font-semibold mt-1 tracking-wide">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Feature grid — coming soon */}
      <div>
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">
          Platform Features
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ComingSoonCard
            icon="📋"
            title="Quality Standards"
            description="Define and publish the crop quality standards and certifications you accept from farmers."
          />
          <ComingSoonCard
            icon="📢"
            title="Advertisements"
            description="Post buying advertisements to notify farmers of your current crop requirements and prices."
          />
          <ComingSoonCard
            icon="🌾"
            title="My Farmers"
            description="Browse and connect with verified farmers in your districts who grow your required crops."
          />
          <ComingSoonCard
            icon="🌱"
            title="Planting Notices"
            description="View upcoming planting schedules and harvest forecasts from farmers in your network."
          />
        </div>
      </div>

      {/* Profile CTA */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="font-bold text-white text-sm">Complete Your Company Profile</p>
          <p className="text-zinc-400 text-xs mt-0.5">
            A complete profile speeds up verification and builds trust with farmers.
          </p>
        </div>
        <Link
          href="/exporter/profile"
          className="shrink-0 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-teal-900/30 text-center"
        >
          Edit Profile →
        </Link>
      </div>
    </div>
  );
}
