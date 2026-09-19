"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchActors, fetchUserProfile, Actor, UserProfile, clearAuthToken } from "@/lib/api";

export default function AdminUsersListPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [actors, setActors] = useState<Actor[]>([]);
  const [loadingActors, setLoadingActors] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Authenticate user
  useEffect(() => {
    async function loadUser() {
      try {
        const profile = await fetchUserProfile();
        setCurrentUser(profile);
      } catch (err) {
        clearAuthToken();
        router.push("/");
      } finally {
        setLoadingAuth(false);
      }
    }
    loadUser();
  }, [router]);

  // Fetch actors list
  const loadActors = useCallback(async () => {
    setLoadingActors(true);
    setError(null);
    try {
      const res = await fetchActors({
        search: searchTerm,
        role: selectedRole,
        page,
        page_size: 10,
      });
      setActors(res.items);
      setTotalPages(res.total_pages);
      setTotalItems(res.total);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load actor registry.");
    } finally {
      setLoadingActors(false);
    }
  }, [searchTerm, selectedRole, page]);

  useEffect(() => {
    if (!loadingAuth && currentUser) {
      loadActors();
    }
  }, [loadingAuth, currentUser, loadActors]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1);
  };

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRole(e.target.value);
    setPage(1);
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-400 text-sm font-medium">Verifying authorization...</p>
      </div>
    );
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "exporter":
        return "bg-teal-500/20 text-teal-400 border-teal-500/30";
      case "farmer":
      default:
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white p-6 sm:p-10">
      {/* Top Navigation / Header */}
      <header className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pb-8 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center font-black text-xl text-black hover:opacity-90 transition-opacity">
            P
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Actor Registry</h1>
            <p className="text-xs text-zinc-400">Manage platform users, roles, and account statuses</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition-all"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto mt-8 space-y-6">
        {/* Controls Bar: Search & Role Filter */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-80 relative">
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <label className="text-xs text-zinc-400 font-medium whitespace-nowrap">Filter Role:</label>
            <select
              value={selectedRole}
              onChange={handleRoleChange}
              className="bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="farmer">Farmer</option>
              <option value="exporter">Exporter</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-950/40 border border-red-900/50 p-4 rounded-xl text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Actors Table */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-950/60 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4 font-semibold">Actor / Name</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Phone</th>
                  <th className="px-6 py-4 font-semibold">District</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {loadingActors ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 text-xs font-medium">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      Fetching registry records...
                    </td>
                  </tr>
                ) : actors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 text-xs">
                      No matching actors found.
                    </td>
                  </tr>
                ) : (
                  actors.map((actor) => (
                    <tr
                      key={actor.id}
                      className="hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                      onClick={() => router.push(`/admin/users/${actor.id}`)}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                          {actor.name || actor.email}
                        </div>
                        <div className="text-xs text-zinc-500">{actor.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getRoleBadge(actor.role)}`}>
                          {actor.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono">
                        {actor.phone || <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {actor.district || <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${actor.is_active ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${actor.is_active ? "bg-emerald-400" : "bg-red-400"}`} />
                          {actor.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/users/${actor.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                        >
                          View Details →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-6 py-4 bg-zinc-950/60 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
            <div>
              Showing <span className="text-white font-medium">{actors.length}</span> of <span className="text-white font-medium">{totalItems}</span> actors
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1 || loadingActors}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 rounded-lg font-medium transition-colors"
              >
                Previous
              </button>
              <span className="px-2 font-mono text-zinc-300">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages || loadingActors}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 rounded-lg font-medium transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
