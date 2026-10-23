"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, parseError } from "@/lib/api";
import type { ExporterProfile } from "@/lib/types";
import { Alert, ErrorState, Spinner } from "@/components/ui";

interface Ctx {
  profile: ExporterProfile;
  verified: boolean;
  counts: { requests: number; proofs: number };
  reloadProfile: () => Promise<void>;
  reloadCounts: () => void;
  setProfile: (p: ExporterProfile) => void;
}

const ExporterCtx = createContext<Ctx | null>(null);

export function useExporter(): Ctx {
  const c = useContext(ExporterCtx);
  if (!c) throw new Error("useExporter must be used inside ExporterProvider");
  return c;
}

export function ExporterProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState({ requests: 0, proofs: 0 });

  const loadProfile = useCallback(async () => {
    try {
      const { data } = await api.get<ExporterProfile>("/api/exporter/me");
      setProfile(data);
      setError(null);
    } catch (e) {
      setError(parseError(e).message);
    }
  }, []);

  const loadCounts = useCallback(() => {
    Promise.allSettled([
      api.get("/api/exporter/farmers", { params: { status: "requested", page_size: 1 } }),
      api.get("/api/exporter/stage-proofs", { params: { status: "pending", page_size: 1 } }),
    ]).then(([f, p]) =>
      setCounts({
        requests: f.status === "fulfilled" ? f.value.data.pending_count ?? 0 : 0,
        proofs: p.status === "fulfilled" ? p.value.data.pending_count ?? 0 : 0,
      }),
    );
  }, []);

  useEffect(() => { loadProfile(); loadCounts(); }, [loadProfile, loadCounts]);

  const value = useMemo<Ctx | null>(
    () =>
      profile
        ? { profile, verified: profile.status === "verified", counts, reloadProfile: loadProfile, reloadCounts: loadCounts, setProfile }
        : null,
    [profile, counts, loadProfile, loadCounts],
  );

  if (error && !profile) return <div className="mx-auto max-w-md py-24 px-4"><ErrorState message={error} onRetry={loadProfile} /></div>;
  if (!value) return <Spinner label="Loading your workspace…" />;
  return <ExporterCtx.Provider value={value}>{children}</ExporterCtx.Provider>;
}

/** Explains why a gated action is disabled. Render next to the control. */
export function VerificationNote({ action = "do this" }: { action?: string }) {
  const { profile, verified } = useExporter();
  if (verified) return null;
  return (
    <p className="text-xs text-warn-600">
      {profile.status === "rejected"
        ? `Your account was rejected, so you can’t ${action}. See your company profile.`
        : `Available once an administrator verifies your account. You can’t ${action} yet.`}
    </p>
  );
}

/** Top-of-page banner shown while the account isn't verified. */
export function VerificationBanner() {
  const { profile, verified } = useExporter();
  if (verified) return null;
  if (profile.status === "rejected") {
    return (
      <div className="mb-6">
        <Alert tone="bad" title="Account rejected">
          {profile.rejection_reason ? <>Reason: “{profile.rejection_reason}”. </> : null}
          Update your company profile and contact the administrator to have your application reopened.
        </Alert>
      </div>
    );
  }
  return (
    <div className="mb-6">
      <Alert tone="warn" title="Pending verification">
        You can prepare standards, ads and notices now. Publishing, approving farmers and reviewing proof unlock once an administrator verifies your company, usually within 1–2 business days.
      </Alert>
    </div>
  );
}
