"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setAuthToken } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";

function GoogleSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const role = searchParams.get("role");

    if (token) {
      setAuthToken(token);
      if (role) {
        localStorage.setItem("role", role);
      }
      router.replace("/dashboard");
    } else {
      router.replace("/?error=Missing+access+token");
    }
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Spinner size={36} />
      <h2 className="font-display text-xl font-semibold text-ink-900">
        Completing Google sign in…
      </h2>
      <p className="text-sm text-ink-500">
        Authenticating session and preparing dashboard.
      </p>
    </div>
  );
}

export default function GoogleSuccessPage() {
  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-4 text-center">
            <Spinner size={36} />
            <h2 className="font-display text-xl font-semibold text-ink-900">
              Loading…
            </h2>
          </div>
        }
      >
        <GoogleSuccessContent />
      </Suspense>
    </div>
  );
}
