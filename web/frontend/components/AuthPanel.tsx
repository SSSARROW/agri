"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleIcon } from "./GoogleIcon";
import { loginUser, getGoogleAuthUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { ChevronRightIcon } from "@/components/ui/icons";

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
    <div className="w-full max-w-md mx-auto bg-paper-raised border border-border shadow-xl shadow-ink-900/5 rounded-2xl p-8">
      <div className="text-center mb-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/origo-logo-horizontal.svg"
          alt="Origo"
          className="h-9 mx-auto mb-5"
        />
        <h2 className="font-display text-2xl font-semibold text-ink-900">Welcome back</h2>
        <p className="text-sm text-ink-500 mt-1">
          Access your farm management &amp; export network
        </p>
      </div>

      <div className="flex bg-paper-sunken p-1 rounded-xl mb-6">
        {(["login", "signup"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === t
                ? "bg-paper-raised text-brand-700 shadow-sm"
                : "text-ink-500 hover:text-ink-900"
            }`}
          >
            {t === "login" ? "Sign In" : "Register Account"}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6">
          <Alert tone="danger" title={error} />
        </div>
      )}

      {tab === "login" ? (
        <>
          <form onSubmit={handleLogin} className="space-y-4">
            <Field label="Email address" required>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@farm.com"
              />
            </Field>
            <Field label="Password" required>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? "Signing in…" : "Sign in with email"}
            </Button>
          </form>

          <Divider label="Or continue with" />

          <Button
            variant="secondary"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full"
            size="lg"
          >
            <GoogleIcon className="w-5 h-5" />
            {googleLoading ? "Connecting Google…" : "Sign in with Google"}
          </Button>
        </>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-ink-500 font-medium text-center mb-2">
            Select your account type to proceed with registration:
          </p>

          <RoleChoiceCard
            title="Farmer account"
            description="For agricultural producers, land owners & crop growers."
            onClick={() => router.push("/signup/farmer")}
          />
          <RoleChoiceCard
            title="Exporter account"
            description="For licensed trading companies, buyers & international distributors."
            onClick={() => router.push("/signup/exporter")}
          />

          <Divider label="Or quick signup with" />

          <Button
            variant="secondary"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full"
            size="lg"
          >
            <GoogleIcon className="w-5 h-5" />
            {googleLoading ? "Connecting Google…" : "Register with Google"}
          </Button>
        </div>
      )}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-paper-raised px-3 text-ink-400 font-medium">{label}</span>
      </div>
    </div>
  );
}

function RoleChoiceCard({
  title,
  description,
  onClick,
}: {
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border border-border hover:border-brand-300 hover:bg-brand-50/50 transition-colors group cursor-pointer"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-semibold text-ink-900 text-base group-hover:text-brand-700 transition-colors">
            {title}
          </h3>
          <p className="text-xs text-ink-500 mt-1">{description}</p>
        </div>
        <ChevronRightIcon className="w-5 h-5 text-ink-300 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>
    </button>
  );
}
