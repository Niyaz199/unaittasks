"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";
import { canAccessDirectories, canManageUsers, canAccessDailyChecklists, canReadDailyChecklistControl, canManageDailyChecklistTemplates } from "@/lib/capabilities";
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
    pathname.startsWith("/tasks/")
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
    ...(canAccessDailyChecklists(role) ? [{ href: "/checklists" as Route, label: "Чек-лист", isActive: (value: string) => value === "/checklists" || value.startsWith("/checklists/") }] : []),
    ...(canAccessPprModule(role) ? [{ href: pprHref, label: "ППР", isActive: (value: string) => value === "/ppr" || value.startsWith("/ppr/") }] : []),
    ...(canAccessRoundsModule(role) ? [{ href: roundsHref, label: "Обходы", isActive: (value: string) => value === "/rounds" || value.startsWith("/rounds/") }] : []),
  ];

  const isChecklistsActive = pathname === "/checklists" || pathname.startsWith("/checklists/");
  const isPprActive = pathname === "/ppr" || pathname.startsWith("/ppr/");
  const isRoundsActive = pathname === "/rounds" || pathname.startsWith("/rounds/");

  const serviceTab = canOpenDirectories
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
        href: "/profile" as Route,
        label: "Профиль",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        ),
      };

  let tabs: Array<{ href: Route; label: string; icon: React.ReactNode }> = [];

  if (isChecklistsActive) {
    tabs = [
      {
        href: "/checklists" as Route,
        label: "Мой день",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
        ),
      },
      ...(canReadDailyChecklistControl(role) ? [{
        href: "/checklists/control" as Route,
        label: "Контроль",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        ),
      }] : []),
      ...(canManageDailyChecklistTemplates(role) ? [{
        href: "/checklists/templates" as Route,
        label: "Шаблоны",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
          </svg>
        ),
      }] : []),
      serviceTab,
    ];
  } else if (isPprActive) {
    tabs = [
      {
        href: "/ppr/my" as Route,
        label: "Мои работы",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
          </svg>
        ),
      },
      {
        href: "/ppr/archive" as Route,
        label: "Архив",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
          </svg>
        ),
      },
      {
        href: "/ppr/calendar" as Route,
        label: "Календарь",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        ),
      },
      serviceTab,
    ];
  } else if (isRoundsActive) {
    tabs = [
      {
        href: "/rounds/today" as Route,
        label: "Сегодня",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        ),
      },
      {
        href: "/rounds/archive" as Route,
        label: "Архив",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>
          </svg>
        ),
      },
      {
        href: "/rounds/scan" as Route,
        label: "Сканер",
        icon: (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1" ry="1"/>
          </svg>
        ),
      },
      serviceTab,
    ];
  } else {
    tabs = [
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
      serviceTab,
    ];
  }

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
