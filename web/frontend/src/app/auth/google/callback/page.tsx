"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { api, homeFor, parseError, session, type Role } from "@/lib/api";
import { Spinner } from "@/components/ui";

function Callback() {
  const router = useRouter();
  const params = useSearchParams();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = params.get("code");
    const denied = params.get("error");
    if (!code || denied) {
      router.replace(`/signin?google=${encodeURIComponent(denied ? "Access was not granted." : "No sign-in code was returned.")}`);
      return;
    }
    api
      .get<{ access_token: string; role: Role }>("/auth/google/callback", { params: { code } })
      .then(({ data }) => {
        session.set(data.access_token, data.role);
        router.replace(homeFor(data.role));
      })
      .catch((e) => router.replace(`/signin?google=${encodeURIComponent(parseError(e, "Google could not verify this sign-in.").message)}`));
  }, [params, router]);

  return <Spinner label="Finishing Google sign-in…" />;
}

export default function GoogleCallbackPage() {
  return <Suspense><Callback /></Suspense>;
}
