"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";
import { canAccessDirectories, canManageUsers } from "@/lib/capabilities";
import { canAccessPprModule } from "@/lib/ppr/permissions";
import { canAccessRoundsModule } from "@/lib/rounds/permissions";

function isTabActive(pathname: string, href: Route) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isTasksModuleActive(pathname: string) {
  return (
    pathname === "/my" ||
    pathname === "/new" ||
    pathname === "/archive" ||
    pathname.startsWith("/tasks/") ||
    pathname === "/checklists" ||
    pathname.startsWith("/checklists/")
  );
}

export function MobileTabs({ role }: { role: Role }) {
  const pathname = usePathname();
  const directoryHref: Route = canManageUsers(role) ? "/users" : "/directories/floors";
  const canOpenDirectories = canAccessDirectories(role);
  const pprHref: Route = role === "tech" ? "/ppr/my" : "/ppr";
  const roundsHref: Route = role === "tech" ? "/rounds/scan" : "/rounds";
  const moduleLinks: Array<{ href: Route; label: string; isActive: (pathname: string) => boolean }> = [
    { href: "/my", label: "Задачи", isActive: isTasksModuleActive },
    ...(canAccessPprModule(role) ? [{ href: pprHref, label: "ППР", isActive: (value: string) => value === "/ppr" || value.startsWith("/ppr/") }] : []),
    ...(canAccessRoundsModule(role) ? [{ href: roundsHref, label: "\u041e\u0431\u0445\u043e\u0434\u044b", isActive: (value: string) => value === "/rounds" || value.startsWith("/rounds/") }] : []),
  ];
  const tabs: Array<{ href: Route; label: string; icon: React.ReactNode }> = [
    {
      href: "/my",
      label: "Мои",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
    {
      href: "/new",
      label: "Новые",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      ),
    },
    {
      href: "/archive",
      label: "Архив",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
        </svg>
      ),
    },
    canOpenDirectories
      ? {
          href: directoryHref,
          label: "Сервис",
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
          ),
        }
      : {
          href: "/profile",
          label: "Профиль",
          icon: (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          ),
        },
  ];

  return (
    <>
      {moduleLinks.length ? (
        <div className="mobile-module-launcher" aria-label="Быстрый вход в модули">
          <div className="mobile-module-launcher-shell">
            {moduleLinks.map((link) => {
              const active = link.isActive(pathname);
              return (
                <Link key={link.href} href={link.href} className={`mobile-module-link${active ? " active" : ""}`}>
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <nav className="mobile-tabs">
        {tabs.map((tab) => {
          const active = isTabActive(pathname, tab.href);
          return (
            <Link key={tab.href} href={tab.href} className={`mobile-tab${active ? " active" : ""}`}>
              <span className="mobile-tab-icon">{tab.icon}</span>
              <span className="mobile-tab-label">{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
