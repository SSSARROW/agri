"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchUserProfile, clearAuthToken, UserProfile } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FullPageSpinner } from "@/components/ui/spinner";
import {
  UsersIcon,
  MegaphoneIcon,
  LogoutIcon,
  ChevronRightIcon,
} from "@/components/ui/icons";

function InfoRow({
  label,
  value,
  mono,
  capitalize,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-ink-500 text-xs">{label}</span>
      <span
        className={`text-sm font-medium ${
          mono ? "font-mono text-xs text-brand-700" : "text-ink-900"
        } ${capitalize ? "capitalize" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

const ROLE_TONE: Record<string, Tone> = {
  farmer: "brand",
  exporter: "info",
  admin: "gold",
};

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
    return <FullPageSpinner label="Verifying your session…" />;
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert tone="danger" title={error || "Access denied"}>
            Redirecting you to the sign-in page…
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-border bg-paper-raised">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-700 text-white flex items-center justify-center font-display font-semibold">
              P
            </div>
            <div>
              <p className="font-display font-semibold text-ink-900 text-sm leading-tight">
                Paramparā
              </p>
              <p className="text-xs text-ink-500">Authenticated portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            {user.role === "admin" && (
              <>
                <Button href="/admin/users" variant="secondary" size="sm">
                  <UsersIcon className="w-4 h-4" /> Actor Registry
                </Button>
                <Button href="/admin/exporters" variant="secondary" size="sm">
                  <MegaphoneIcon className="w-4 h-4" /> Exporters
                </Button>
              </>
            )}
            <Badge tone={ROLE_TONE[user.role] ?? "neutral"}>Role: {user.role}</Badge>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogoutIcon className="w-4 h-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <PageHeader
          eyebrow="Farmer Portal"
          title={
            <>
              Welcome, <span className="text-brand-700">{user.name || user.email}</span>
            </>
          }
          subtitle="Your account is verified and securely authenticated. You have active access to the Paramparā agriculture ecosystem."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader title="Profile information" />
            <div className="divide-y divide-border">
              <InfoRow label="User ID" value={user.id} mono />
              <InfoRow label="Email" value={user.email} />
              <InfoRow label="Account type" value={user.role} capitalize />
              {user.phone && <InfoRow label="Phone" value={user.phone} />}
              {user.district && <InfoRow label="District" value={user.district} />}
              {user.business_name && (
                <InfoRow label="Business name" value={user.business_name} />
              )}
            </div>
          </Card>

          <Card className="flex flex-col justify-between">
            <div>
              <CardHeader title="Platform actions" />
              <p className="text-ink-500 text-xs leading-relaxed mb-5">
                As a registered{" "}
                <span className="text-brand-700 font-semibold">{user.role}</span>, you
                have full authorization to manage listings, inspect digital
                certificates, and communicate across direct buyer-seller pipelines.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="JWT status" value="Active" tone="brand" />
                <StatTile label="OAuth connection" value="Verified" tone="brand" />
              </div>
            </div>

            {user.role === "admin" && (
              <div className="space-y-2 mt-5">
                <Button href="/admin/users" variant="secondary" className="w-full">
                  <span className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-2">
                      <UsersIcon className="w-4 h-4" /> Open Actor Registry Management
                    </span>
                    <ChevronRightIcon className="w-4 h-4" />
                  </span>
                </Button>
                <Button href="/admin/exporters" variant="secondary" className="w-full">
                  <span className="flex items-center justify-between w-full">
                    <span className="flex items-center gap-2">
                      <MegaphoneIcon className="w-4 h-4" /> Open Exporter Verification
                      Management
                    </span>
                    <ChevronRightIcon className="w-4 h-4" />
                  </span>
                </Button>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
