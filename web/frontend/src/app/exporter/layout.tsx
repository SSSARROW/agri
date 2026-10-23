"use client";

import type { ReactNode } from "react";
import { AuthGate } from "@/components/shell/AuthGate";
import { ExporterProvider, useExporter, VerificationBanner } from "@/components/shell/ExporterContext";
import { WorkspaceShell, type NavItem } from "@/components/shell/WorkspaceShell";
import { StatusBadge } from "@/components/ui";

function Shell({ children }: { children: ReactNode }) {
  const { profile, counts } = useExporter();
  const nav: NavItem[] = [
    { href: "/exporter", label: "Overview", icon: "home", exact: true },
    { href: "/exporter/farmers", label: "Farmer network", icon: "users", badge: counts.requests },
    { href: "/exporter/progress", label: "Farmer progress", icon: "leaf" },
    { href: "/exporter/ads", label: "Buy requests", icon: "tag" },
    { href: "/exporter/standards", label: "Quality standards", icon: "list" },
    { href: "/exporter/planting-notices", label: "Planting notices", icon: "calendar" },
    { href: "/exporter/stage-proofs", label: "Stage proof", icon: "camera", badge: counts.proofs },
    { href: "/exporter/profile", label: "Company profile", icon: "building" },
  ];
  return (
    <WorkspaceShell
      nav={nav}
      workspace="Exporter"
      identity={
        <div>
          <p className="truncate font-medium">{profile.company_name}</p>
          <div className="mt-1.5"><StatusBadge status={profile.status} label={profile.status === "pending" ? "Pending verification" : profile.status === "rejected" ? "Rejected" : "Verified"} /></div>
        </div>
      }
    >
      <VerificationBanner />
      {children}
    </WorkspaceShell>
  );
}

export default function ExporterLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate roles={["exporter"]}>
      <ExporterProvider>
        <Shell>{children}</Shell>
      </ExporterProvider>
    </AuthGate>
  );
}
