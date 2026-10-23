"use client";

import type { ReactNode } from "react";
import { AuthGate } from "@/components/shell/AuthGate";
import { WorkspaceShell, type NavItem } from "@/components/shell/WorkspaceShell";

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "home", exact: true },
  { href: "/admin/exporters", label: "Exporter verification", icon: "shield" },
  { href: "/admin/ads", label: "Ad moderation", icon: "flag" },
  { href: "/admin/users", label: "Users", icon: "users" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate roles={["admin"]}>
      <WorkspaceShell nav={NAV} workspace="Administration" identity={<p className="font-medium">Administrator</p>}>
        {children}
      </WorkspaceShell>
    </AuthGate>
  );
}
