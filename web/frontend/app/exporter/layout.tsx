"use client";

/**
 * Exporter layout — wraps all /exporter/* pages.
 * Completely independent of the farmer layout and admin layout.
 * Handles:
 *   - Role guard: non-exporters are redirected to their own dashboard
 *   - Sidebar navigation (items disabled as "coming soon" in Step 1)
 *   - Company name & role label in the header
 */
import React, { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { clearAuthToken } from "@/lib/api";
import { fetchExporterProfile, ExporterProfile } from "@/lib/exporterApi";
import { DashboardShell, NavItem } from "@/components/ui/dashboard-shell";
import { Badge } from "@/components/ui/badge";
import { FullPageSpinner } from "@/components/ui/spinner";
import {
  HomeIcon,
  BuildingIcon,
  ClipboardIcon,
  MegaphoneIcon,
  SproutIcon,
  UsersIcon,
  ShieldCheckIcon,
} from "@/components/ui/icons";

const ENABLE_EXPORTER_ADS = process.env.NEXT_PUBLIC_ENABLE_EXPORTER_ADS !== "false";
const ENABLE_EXPORTER_FARMERS = process.env.NEXT_PUBLIC_ENABLE_EXPORTER_FARMERS !== "false";
const ENABLE_PLANTING_NOTICES = process.env.NEXT_PUBLIC_ENABLE_PLANTING_NOTICES !== "false";
const ENABLE_STAGE_PROOFS = process.env.NEXT_PUBLIC_ENABLE_STAGE_PROOFS !== "false";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: <HomeIcon />, href: "/exporter/dashboard" },
  { label: "Company Profile", icon: <BuildingIcon />, href: "/exporter/profile" },
  { label: "Quality Standards", icon: <ClipboardIcon />, href: "/exporter/standards" },
  {
    label: "Advertisements",
    icon: <MegaphoneIcon />,
    href: ENABLE_EXPORTER_ADS ? "/exporter/ads" : "#",
    disabled: !ENABLE_EXPORTER_ADS,
  },
  {
    label: "My Farmers",
    icon: <UsersIcon />,
    href: ENABLE_EXPORTER_FARMERS ? "/exporter/farmers" : "#",
    disabled: !ENABLE_EXPORTER_FARMERS,
  },
  {
    label: "Planting Notices",
    icon: <SproutIcon />,
    href: ENABLE_PLANTING_NOTICES ? "/exporter/planting-notices" : "#",
    disabled: !ENABLE_PLANTING_NOTICES,
  },
  {
    label: "Stage Proofs",
    icon: <ShieldCheckIcon />,
    href: ENABLE_STAGE_PROOFS ? "/exporter/stage-proofs" : "#",
    disabled: !ENABLE_STAGE_PROOFS,
  },
];

export default function ExporterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<ExporterProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = useCallback(() => {
    clearAuthToken();
    router.push("/");
  }, [router]);

  useEffect(() => {
    const role =
      typeof window !== "undefined" ? localStorage.getItem("role") : null;

    // Non-exporters are redirected away immediately (client-side guard)
    if (role && role !== "exporter") {
      router.replace(role === "admin" ? "/admin/users" : "/dashboard");
      return;
    }
    if (!role) {
      router.replace("/");
      return;
    }

    fetchExporterProfile()
      .then(setProfile)
      .catch(() => {
        clearAuthToken();
        router.replace("/");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return <FullPageSpinner label="Loading your workspace…" />;
  }

  const statusTone =
    profile?.status === "verified"
      ? "success"
      : profile?.status === "rejected"
      ? "danger"
      : "warning";
  const statusLabel =
    profile?.status === "verified"
      ? "Verified exporter"
      : profile?.status === "rejected"
      ? "Account rejected"
      : "Pending verification";

  return (
    <DashboardShell
      brandLabel="Origo"
      brandSubtitle={profile?.company_name || "Exporter Portal"}
      navItems={NAV_ITEMS}
      activeHref={pathname}
      onLogout={handleLogout}
      headerLabel={profile?.company_name || profile?.contact_person || "Exporter"}
      headerBadge={
        <Badge tone={statusTone} className="w-full justify-center">
          {statusLabel}
        </Badge>
      }
    >
      {children}
    </DashboardShell>
  );
}
