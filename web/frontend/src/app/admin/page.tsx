"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import type { AdminAdRow, AdminExporterPage, Page } from "@/lib/types";
import { useFetch } from "@/hooks/useFetch";
import { Icon, PageHeader, Stat } from "@/components/ui";

export default function AdminOverview() {
  const d = useFetch(async () => {
    const [ex, ads, reported] = await Promise.allSettled([
      api.get<AdminExporterPage>("/api/admin/exporters", { params: { status: "all", page_size: 1 } }),
      api.get<Page<AdminAdRow>>("/api/admin/ads", { params: { state: "live", page_size: 1 } }),
      api.get<Page<AdminAdRow>>("/api/admin/ads", { params: { has_open_reports: true, page_size: 1 } }),
    ]);
    return {
      counts: ex.status === "fulfilled" ? ex.value.data.counts : null,
      live: ads.status === "fulfilled" ? ads.value.data.total : null,
      reported: reported.status === "fulfilled" ? reported.value.data.total : null,
    };
  }, []);

  const c = d.data?.counts;
  return (
    <>
      <PageHeader title="Administration" subtitle="Keep exporters trustworthy and buy requests fair." />
      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Exporters awaiting review" value={c?.pending ?? "—"} tone={c?.pending ? "warn" : undefined} />
        <Stat label="Verified exporters" value={c?.verified ?? "—"} />
        <Stat label="Live buy requests" value={d.data?.live ?? "—"} />
        <Stat label="Ads with open reports" value={d.data?.reported ?? "—"} tone={d.data?.reported ? "bad" : undefined} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { href: "/admin/exporters?status=pending", icon: "shield", title: "Verify exporters", body: "Approve, reject or reopen exporter applications. Approval unlocks publishing for them." },
          { href: "/admin/ads", icon: "flag", title: "Moderate ads", body: "Review farmer reports and take down or restore buy requests." },
          { href: "/admin/users", icon: "users", title: "Manage users", body: "Search accounts by name, phone or email, and set them active or inactive." },
        ].map((c2) => (
          <Link key={c2.href} href={c2.href} className="rounded-xl border border-line bg-surface p-5 shadow-card transition-colors hover:border-leaf-500/60">
            <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-leaf-50 text-leaf-600"><Icon name={c2.icon as "shield"} /></span>
            <h2 className="font-semibold">{c2.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{c2.body}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
