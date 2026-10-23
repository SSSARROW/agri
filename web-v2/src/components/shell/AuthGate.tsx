"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { homeFor, session, type Role } from "@/lib/api";
import { Spinner } from "@/components/ui";

/** Re-checks the stored session on entry and sends wrong-role visitors home. */
export function AuthGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const token = session.token;
    const role = session.role;
    if (!token || !role) {
      router.replace("/signin");
      return;
    }
    if (!roles.includes(role)) {
      router.replace(homeFor(role));
      return;
    }
    setOk(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ok) return <Spinner label="Checking your session…" />;
  return <>{children}</>;
}
