"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleIcon } from "./GoogleIcon";
import { loginUser, getGoogleAuthUrl } from "@/lib/api";

export function AuthPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await loginUser({ email, password });
      router.push(result.role === "exporter" ? "/exporter/dashboard" : "/dashboard");
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Invalid email or password. Please try again.";
      setError(typeof msg === "string" ? msg : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const url = await getGoogleAuthUrl();
      window.location.href = url;
    } catch (err: any) {
      setError("Unable to initiate Google sign in. Please try again.");
      setGoogleLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-emerald-500/20 shadow-2xl rounded-3xl p-8 relative overflow-hidden">
      {/* Accent Light Glows */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-3">
          🌱 Paramparā Agriculture Platform
        </div>
        <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
          Welcome Back
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Access your farm management & export network
        </p>
      </div>

      {/* Tab Selector */}
      <div className="flex bg-zinc-100 dark:bg-zinc-800/60 p-1 rounded-xl mb-6">
        <button
          type="button"
          onClick={() => {
            setTab("login");
            setError(null);
          }}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            tab === "login"
              ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("signup");
            setError(null);
          }}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            tab === "signup"
              ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
          }`}
        >
          Register Account
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm font-medium flex items-center gap-2 animate-shake">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {tab === "login" ? (
        <>
          {/* Email / Password Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@farm.com"
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-600/30 hover:shadow-emerald-600/40 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 text-sm"
            >
              {loading ? "Signing in..." : "Sign In with Email"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-zinc-900 px-3 text-zinc-400 font-medium">
                Or continue with
              </span>
            </div>
          </div>

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-200 font-semibold text-sm transition-all shadow-sm hover:shadow active:scale-[0.98] disabled:opacity-50"
          >
            <GoogleIcon className="w-5 h-5" />
            <span>{googleLoading ? "Connecting Google..." : "Sign In with Google"}</span>
          </button>
        </>
      ) : (
        /* Registration Choice View */
        <div className="space-y-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium text-center mb-2">
            Select your account type to proceed with registration:
          </p>

          <button
            type="button"
            onClick={() => router.push("/signup/farmer")}
            className="w-full text-left p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white text-base group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  🌾 Farmer Account
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  For agricultural producers, land owners & crop growers.
                </p>
              </div>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xl group-hover:translate-x-1 transition-transform">
                →
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push("/signup/exporter")}
            className="w-full text-left p-4 rounded-2xl border border-teal-500/30 bg-teal-500/5 hover:bg-teal-500/10 dark:bg-teal-950/20 dark:hover:bg-teal-950/40 transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white text-base group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  🚢 Exporter Account
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  For licensed trading companies, buyers & international distributors.
                </p>
              </div>
              <span className="text-teal-600 dark:text-teal-400 font-semibold text-xl group-hover:translate-x-1 transition-transform">
                →
              </span>
            </div>
          </button>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-zinc-900 px-3 text-zinc-400 font-medium">
                Or quick signup with
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-zinc-50 dark:bg-zinc-800/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-700 dark:text-zinc-200 font-semibold text-sm transition-all shadow-sm hover:shadow active:scale-[0.98] disabled:opacity-50"
          >
            <GoogleIcon className="w-5 h-5" />
            <span>{googleLoading ? "Connecting Google..." : "Register with Google"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
