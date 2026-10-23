"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api, homeFor, session } from "@/lib/api";
import type { User } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { AuthGate } from "@/components/shell/AuthGate";
import { Logo } from "@/components/shell/Logo";
import { Alert, Button, Card, DefList, ErrorState, Icon, Spinner, StatusBadge } from "@/components/ui";
import { titleCase } from "@/lib/format";

function Overview() {
  const router = useRouter();
  const me = useFetch(() => api.get<User>("/auth/me").then((r) => r.data), []);

  useEffect(() => {
    if (me.data?.role === "exporter") router.replace(homeFor("exporter"));
  }, [me.data, router]);

  const signOut = () => { session.clear(); router.replace("/signin"); };

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link href="/"><Logo /></Link>
          <Button variant="ghost" size="sm" onClick={signOut}><Icon name="logout" size={16} /> Sign out</Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-10">
        {me.loading && <Spinner />}
        {me.error && <ErrorState message={me.error} onRetry={me.reload} />}
        {me.data && (
          <>
            <div>
              <p className="text-sm text-ink-mute">Signed in as</p>
              <h1 className="font-display text-3xl font-semibold">{me.data.name || me.data.email}</h1>
              <div className="mt-2 flex items-center gap-2"><StatusBadge status="active" label={titleCase(me.data.role)} /></div>
            </div>

            {me.data.role === "admin" && (
              <Card>
                <h2 className="text-lg font-semibold">Administration</h2>
                <p className="mt-1 text-sm text-ink-soft">Verify exporters, manage accounts and moderate buy requests.</p>
                <div className="mt-4"><Link href="/admin" className="inline-flex h-10 items-center gap-2 rounded-lg bg-leaf-600 px-4 text-sm font-medium text-white hover:bg-leaf-700"><Icon name="shield" size={16} /> Open admin workspace</Link></div>
              </Card>
            )}

            {(me.data.role === "farmer" || me.data.role === "collector") && (
              <Alert tone="info" title="Your work happens in the Origo Field app">
                Register plots, record plantings and harvests, apply to buyer orders and answer planting notices from your Android phone. This page only shows your account details.
              </Alert>
            )}

            <Card>
              <h2 className="mb-4 text-lg font-semibold">Account</h2>
              <DefList
                items={[
                  { label: "Email", value: me.data.email },
                  { label: "Phone", value: me.data.phone },
                  { label: "District", value: me.data.district },
                  { label: "Business", value: me.data.business_name },
                  { label: "Account ID", value: <code className="text-xs break-all">{me.data.id}</code> },
                ]}
              />
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

export default function AccountPage() {
  return <AuthGate roles={["farmer", "collector", "admin", "exporter"]}><Overview /></AuthGate>;
}
