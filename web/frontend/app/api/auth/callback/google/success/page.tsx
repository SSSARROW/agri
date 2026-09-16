"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setAuthToken } from "@/lib/api";

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
      <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      <h2 className="text-xl font-bold text-white">Completing Google Sign In...</h2>
      <p className="text-sm text-zinc-400">Authenticating session and preparing dashboard.</p>
    </div>
  );
}

export default function GoogleSuccessPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <h2 className="text-xl font-bold text-white">Loading...</h2>
          </div>
        }
      >
        <GoogleSuccessContent />
      </Suspense>
    </div>
  );
}
