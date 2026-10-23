"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { session } from "@/lib/api";
import { cx, Icon, type IconName } from "@/components/ui";
import { Logo } from "./Logo";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
  /** Match only the exact path (for the overview entry). */
  exact?: boolean;
}

export function WorkspaceShell({
  nav, workspace, identity, children,
}: {
  nav: NavItem[];
  workspace: string;
  identity: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const signOut = () => {
    session.clear();
    router.replace("/signin");
  };

  const isActive = (n: NavItem) => (n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + "/"));

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-6 pb-5">
        <Link href="/" aria-label="Origo home"><Logo light /></Link>
        <p className="mt-1 pl-[54px] text-[11px] font-medium tracking-[0.14em] text-leaf-200 uppercase">{workspace}</p>
      </div>
      <nav className="flex-1 space-y-0.5 px-3" aria-label={`${workspace} navigation`}>
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={isActive(n) ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              isActive(n) ? "bg-white/12 text-white" : "text-leaf-100 hover:bg-white/8 hover:text-white",
            )}
          >
            <Icon name={n.icon} size={18} />
            <span className="flex-1">{n.label}</span>
            {!!n.badge && <span className="rounded-full bg-bark-500 px-2 py-0.5 text-[11px] font-semibold text-white">{n.badge}</span>}
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 text-sm text-white">{identity}</div>
        <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-leaf-100 hover:bg-white/8 hover:text-white">
          <Icon name="logout" size={16} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="sticky top-0 hidden h-dvh bg-leaf-900 lg:block">{sidebar}</aside>

      <div className="sticky top-0 z-30 flex items-center justify-between bg-leaf-900 px-4 py-3 lg:hidden">
        <Logo light size={36} />
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-md p-2 text-white hover:bg-white/10">
          <Icon name="menu" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-leaf-900 shadow-pop">{sidebar}</div>
        </div>
      )}

      <main className="min-w-0 px-4 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
