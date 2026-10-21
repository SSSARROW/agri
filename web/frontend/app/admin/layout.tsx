"use client";

/**
 * Admin layout — wraps all /admin/* pages with one shared sidebar shell
 * and one shared role guard, instead of every admin page re-implementing
 * its own zinc-950 header and its own "am I actually an admin" check.
 */
import React, { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { fetchUserProfile, UserProfile, clearAuthToken } from "@/lib/api";
import { DashboardShell, NavItem } from "@/components/ui/dashboard-shell";
import { FullPageSpinner } from "@/components/ui/spinner";
import { ShieldCheckIcon, UsersIcon, MegaphoneIcon } from "@/components/ui/icons";

const NAV_ITEMS: NavItem[] = [
  { label: "Exporter Verification", icon: <ShieldCheckIcon />, href: "/admin/exporters" },
  { label: "Users", icon: <UsersIcon />, href: "/admin/users" },
  { label: "Advertisements", icon: <MegaphoneIcon />, href: "/admin/ads" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const handleLogout = useCallback(() => {
    clearAuthToken();
    router.push("/");
  }, [router]);

  useEffect(() => {
    fetchUserProfile()
      .then((profile) => {
        if (profile.role !== "admin") {
          router.replace(profile.role === "exporter" ? "/exporter/dashboard" : "/dashboard");
          return;
        }
        setUser(profile);
      })
      .catch(() => {
        clearAuthToken();
        router.replace("/");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !user) {
    return <FullPageSpinner label="Loading admin console…" />;
  }

  // Active state matches by prefix so /admin/users/[id] still highlights
  // the "Users" nav item.
  const activeHref =
    NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.href ?? pathname;

  return (
    <DashboardShell
      brandLabel="Origo"
      brandSubtitle="Admin console"
      navItems={NAV_ITEMS}
      activeHref={activeHref}
      onLogout={handleLogout}
      headerLabel={user.name || user.email}
    >
      {children}
    </DashboardShell>
  );
}
