"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchUserProfile, clearAuthToken, UserProfile } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const profile = await fetchUserProfile();
        // Exporters have their own dashboard — redirect them there
        if (profile.role === "exporter") {
          router.replace("/exporter/dashboard");
          return;
        }
        setUser(profile);
      } catch (err: any) {
        clearAuthToken();
        setError("Session expired or invalid. Please sign in again.");
        setTimeout(() => {
          router.push("/");
        }, 1500);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [router]);

  const handleLogout = () => {
    clearAuthToken();
    router.push("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-400 text-sm font-medium">Verifying authorization token...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-red-950/40 border border-red-900/50 p-6 rounded-2xl max-w-md">
          <p className="text-red-400 font-semibold mb-2">{error || "Access Denied"}</p>
          <p className="text-zinc-400 text-xs">Redirecting to sign-in page...</p>
        </div>
      </div>
    );
  }

  const roleColors: Record<string, string> = {
    farmer: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    exporter: "bg-teal-500/20 text-teal-400 border-teal-500/30",
    admin: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white p-6 sm:p-10">
      {/* Top Navbar */}
      <header className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pb-8 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center font-black text-xl text-black">
            P
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Paramparā Platform</h1>
            <p className="text-xs text-zinc-400">Authenticated Portal</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {user.role === "admin" && (
            <Link
              href="/admin/users"
              className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5"
            >
              <span>👥</span> Actor Registry
            </Link>
          )}
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
              roleColors[user.role] || "bg-zinc-800 text-zinc-300 border-zinc-700"
            }`}
          >
            Role: {user.role}
          </span>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 text-xs font-semibold rounded-xl transition-all"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto mt-10 space-y-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-emerald-950/60 to-teal-950/60 border border-emerald-500/20 rounded-3xl p-8 backdrop-blur-xl relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl font-extrabold">
              Welcome, {user.name || user.email}! 👋
            </h2>
            <p className="text-zinc-300 text-sm mt-2 max-w-xl">
              Your account is verified and securely authenticated via JWT. You have active access to the Paramparā Agriculture Ecosystem.
            </p>
          </div>
        </div>

        {/* Profile Information Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Details Card */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 backdrop-blur-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" /> User Profile Information
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-zinc-800">
                <span className="text-zinc-400">User ID</span>
                <span className="font-mono text-xs text-emerald-400">{user.id}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-800">
                <span className="text-zinc-400">Email</span>
                <span className="font-medium text-white">{user.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-800">
                <span className="text-zinc-400">Account Type</span>
                <span className="capitalize font-semibold text-emerald-300">{user.role}</span>
              </div>
              {user.phone && (
                <div className="flex justify-between py-2 border-b border-zinc-800">
                  <span className="text-zinc-400">Phone</span>
                  <span className="font-medium text-white">{user.phone}</span>
                </div>
              )}
              {user.district && (
                <div className="flex justify-between py-2 border-b border-zinc-800">
                  <span className="text-zinc-400">District</span>
                  <span className="font-medium text-white">{user.district}</span>
                </div>
              )}
              {user.business_name && (
                <div className="flex justify-between py-2 border-b border-zinc-800">
                  <span className="text-zinc-400">Business Name</span>
                  <span className="font-medium text-white">{user.business_name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions / Role Features */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-6 backdrop-blur-xl flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-400" /> Platform Actions
              </h3>
              <p className="text-zinc-400 text-xs mb-6 leading-relaxed">
                As a registered <span className="text-emerald-400 font-semibold">{user.role}</span>, you have full authorization to manage listings, inspect digital certificates, and communicate across direct buyer-seller pipelines.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-4 bg-zinc-800/50 rounded-2xl border border-zinc-700/50 text-center">
                  <p className="text-2xl font-bold text-emerald-400">Active</p>
                  <p className="text-[11px] text-zinc-400 mt-1 uppercase font-semibold">JWT Status</p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-2xl border border-zinc-700/50 text-center">
                  <p className="text-2xl font-bold text-teal-400">Verified</p>
                  <p className="text-[11px] text-zinc-400 mt-1 uppercase font-semibold">OAuth Connection</p>
                </div>
              </div>

              {user.role === "admin" && (
                <Link
                  href="/admin/users"
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-600/30 to-indigo-600/30 hover:from-purple-600/40 hover:to-indigo-600/40 border border-purple-500/40 rounded-2xl text-xs font-bold text-purple-200 flex items-center justify-between transition-all"
                >
                  <span className="flex items-center gap-2">
                    <span>👥</span> Open Actor Registry Management
                  </span>
                  <span>→</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
