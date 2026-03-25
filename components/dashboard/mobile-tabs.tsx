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
  return pathname === "/my" || pathname === "/new" || pathname === "/archive" || pathname.startsWith("/tasks/");
}

export function MobileTabs({ role }: { role: Role }) {
  const pathname = usePathname();
  const directoryHref: Route = canManageUsers(role) ? "/users" : "/directories/floors";
  const canOpenDirectories = canAccessDirectories(role);
  const moduleLinks: Array<{ href: Route; label: string; isActive: (pathname: string) => boolean }> = [
    { href: "/my", label: "Задачи", isActive: isTasksModuleActive },
    ...(canAccessPprModule(role) ? [{ href: "/ppr" as Route, label: "ППР", isActive: (value: string) => isTabActive(value, "/ppr") }] : []),
    ...(canAccessRoundsModule(role) ? [{ href: "/rounds" as Route, label: "Обходы", isActive: (value: string) => isTabActive(value, "/rounds") }] : []),
  ];
  const tabs: Array<{ href: Route; label: string }> = [
    { href: "/my", label: "Мои" },
    { href: "/new", label: "Новые" },
    { href: "/archive", label: "Архив" },
    canOpenDirectories ? { href: directoryHref, label: "Справ." } : { href: "/profile", label: "Профиль" },
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
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
