"use client";

import React, { useState } from "react";
import Link from "next/link";
import { MenuIcon, LogoutIcon, ChevronRightIcon } from "./icons";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
  disabledLabel?: string;
};

// The one sidebar-shell layout shared by the exporter portal and the
// admin console — previously each hand-rolled its own near-identical
// zinc-950 sidebar, which was both the biggest source of the "generic
// template" look and the biggest source of drift between the two (a
// change to one never reached the other).
export function DashboardShell({
  brandLabel,
  brandSubtitle,
  navItems,
  activeHref,
  headerBadge,
  headerLabel,
  onLogout,
  children,
}: {
  brandLabel: string;
  brandSubtitle: string;
  navItems: NavItem[];
  activeHref: string;
  headerBadge?: React.ReactNode;
  headerLabel?: string;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-paper text-ink-900 flex">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-paper-raised border-r border-border
          flex flex-col transform transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0 lg:static lg:flex`}
      >
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            {/* origo-mark.svg is dark-green-on-transparent, made for a light
                background - origo-app-icon.svg is the white-on-dark-green
                variant with its own rounded-square bg already baked in,
                which is what this dark badge actually needs. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/origo-app-icon.svg"
              alt=""
              className="w-9 h-9 rounded-lg shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-display font-semibold text-ink-900 leading-tight">
                {brandLabel}
              </p>
              <p className="text-[11px] text-ink-500 truncate">{brandSubtitle}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isCurrent = item.href === activeHref;
            if (item.disabled) {
              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-ink-300 cursor-not-allowed select-none"
                >
                  <span className="flex items-center gap-2.5 text-sm">
                    {item.icon}
                    {item.label}
                  </span>
                  <span className="text-[10px] font-bold bg-paper-sunken text-ink-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {item.disabledLabel ?? "Soon"}
                  </span>
                </div>
              );
            }
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isCurrent
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-700 hover:bg-paper-sunken"
                }`}
              >
                {item.icon}
                {item.label}
                {isCurrent && <ChevronRightIcon className="w-3.5 h-3.5 ml-auto" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          {headerBadge && <div className="px-1">{headerBadge}</div>}
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold text-ink-500 hover:text-danger hover:bg-danger-bg rounded-lg transition-colors"
          >
            <LogoutIcon className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink-900/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-paper/90 backdrop-blur border-b border-border px-5 sm:px-8 py-3 flex items-center justify-between lg:justify-end">
          <button
            className="lg:hidden p-2 -ml-2 rounded-lg text-ink-500 hover:bg-paper-sunken transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
          {headerLabel && (
            <span className="text-sm text-ink-700 font-medium truncate max-w-[220px]">
              {headerLabel}
            </span>
          )}
        </header>

        <main className="flex-1 p-5 sm:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
