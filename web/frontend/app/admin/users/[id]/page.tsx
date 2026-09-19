"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchActorById, updateActorActiveStatus, fetchUserProfile, Actor, UserProfile, clearAuthToken } from "@/lib/api";

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const actorId = resolvedParams.id;
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [actor, setActor] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const profile = await fetchUserProfile();
        setCurrentUser(profile);

        const actorData = await fetchActorById(actorId);
        setActor(actorData);
      } catch (err: any) {
        if (err.response?.status === 401) {
          clearAuthToken();
          router.push("/");
        } else {
          setError(err.response?.data?.detail || "Failed to load actor profile.");
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [actorId, router]);

  const handleToggleActive = async () => {
    if (!actor) return;
    setUpdating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const updated = await updateActorActiveStatus(actor.id, !actor.is_active);
      setActor(updated);
      setSuccessMessage(`Actor status successfully set to ${updated.is_active ? "Active" : "Inactive"}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update actor status.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-400 text-sm font-medium">Fetching actor details...</p>
      </div>
    );
  }

  if (error && !actor) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-red-950/40 border border-red-900/50 p-6 rounded-2xl max-w-md">
          <p className="text-red-400 font-semibold mb-2">{error}</p>
          <Link href="/admin/users" className="text-xs text-zinc-400 hover:text-white underline mt-4 inline-block">
            ← Return to Actor Registry
          </Link>
        </div>
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin";

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white p-6 sm:p-10">
      {/* Top Header Navigation */}
      <header className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pb-8 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Link href="/admin/users" className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center font-black text-xl text-black hover:opacity-90 transition-opacity">
            P
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Actor Profile Detail</h1>
            <p className="text-xs text-zinc-400">ID: <span className="font-mono text-emerald-400">{actor?.id}</span></p>
          </div>
        </div>

        <Link
          href="/admin/users"
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all"
        >
          ← Back to Registry
        </Link>
      </header>

      {/* Main Profile View */}
      <main className="max-w-4xl mx-auto mt-8 space-y-6">
        {/* Status Alerts */}
        {error && (
          <div className="bg-red-950/40 border border-red-900/50 p-4 rounded-xl text-red-400 text-xs">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="bg-emerald-950/40 border border-emerald-900/50 p-4 rounded-xl text-emerald-400 text-xs font-medium">
            {successMessage}
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          {/* Header Banner inside card */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-2xl text-emerald-400">
                {(actor?.name || actor?.email || "U")[0].toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white">{actor?.name || "Unnamed Actor"}</h2>
                <p className="text-xs text-zinc-400">{actor?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                actor?.role === "admin"
                  ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                  : actor?.role === "exporter"
                  ? "bg-teal-500/20 text-teal-400 border-teal-500/30"
                  : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
              }`}>
                Role: {actor?.role}
              </span>

              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                actor?.is_active
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${actor?.is_active ? "bg-emerald-400" : "bg-red-400"}`} />
                {actor?.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          {/* Admin Control: is_active toggle */}
          {isAdmin && (
            <div className="my-6 p-4 bg-zinc-950/60 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Account Activation Control</h4>
                <p className="text-xs text-zinc-500 mt-0.5">Toggle actor access authorization across the Paramparā ecosystem</p>
              </div>

              <button
                onClick={handleToggleActive}
                disabled={updating}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  actor?.is_active
                    ? "bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30"
                    : "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {updating && <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {actor?.is_active ? "Deactivate Account" : "Activate Account"}
              </button>
            </div>
          )}

          {/* Core Profile Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Basic Information</h3>
              <div className="space-y-3 text-xs bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/80">
                <div className="flex justify-between py-1.5 border-b border-zinc-800">
                  <span className="text-zinc-400">Full Name</span>
                  <span className="font-semibold text-white">{actor?.name || "N/A"}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-800">
                  <span className="text-zinc-400">Email Address</span>
                  <span className="font-medium text-zinc-200">{actor?.email}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-800">
                  <span className="text-zinc-400">Phone Number</span>
                  <span className="font-mono text-emerald-400">{actor?.phone || "N/A"}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-zinc-800">
                  <span className="text-zinc-400">District</span>
                  <span className="font-medium text-zinc-200">{actor?.district || "N/A"}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-zinc-400">Registered Date</span>
                  <span className="font-medium text-zinc-300">
                    {actor?.created_at ? new Date(actor.created_at).toLocaleDateString() : "N/A"}
                  </span>
                </div>
              </div>
            </div>

            {/* Role Specific Details */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-400">Role Specific Details</h3>
              <div className="space-y-3 text-xs bg-zinc-950/40 p-4 rounded-2xl border border-zinc-800/80">
                {actor?.role === "farmer" && (
                  <>
                    <div className="flex justify-between py-1.5 border-b border-zinc-800">
                      <span className="text-zinc-400">DS Division</span>
                      <span className="font-medium text-zinc-200">{actor?.dsd || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-zinc-800">
                      <span className="text-zinc-400">GN Division</span>
                      <span className="font-medium text-zinc-200">{actor?.gn_division || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-zinc-800">
                      <span className="text-zinc-400">Farm Address</span>
                      <span className="font-medium text-zinc-200">{actor?.farm_address || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-zinc-400">Farm Size (ha)</span>
                      <span className="font-semibold text-emerald-400">{actor?.farm_size_ha ? `${actor.farm_size_ha} ha` : "N/A"}</span>
                    </div>
                  </>
                )}

                {actor?.role === "exporter" && (
                  <>
                    <div className="flex justify-between py-1.5 border-b border-zinc-800">
                      <span className="text-zinc-400">Business Name</span>
                      <span className="font-medium text-zinc-200">{actor?.business_name || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-zinc-800">
                      <span className="text-zinc-400">Reg. Number</span>
                      <span className="font-mono text-zinc-300">{actor?.business_reg_no || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-zinc-800">
                      <span className="text-zinc-400">Business Address</span>
                      <span className="font-medium text-zinc-200">{actor?.business_address || "N/A"}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-zinc-400">Export License No</span>
                      <span className="font-mono text-teal-400">{actor?.export_license_no || "N/A"}</span>
                    </div>
                  </>
                )}

                {actor?.role === "admin" && (
                  <div className="py-6 text-center text-zinc-500">
                    System Administrator account with full management privileges.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
