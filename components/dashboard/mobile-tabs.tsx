"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";
import { canAccessDirectories, canManageUsers } from "@/lib/capabilities";
import { canAccessRoundsModule } from "@/lib/rounds/permissions";

export function MobileTabs({ role }: { role: Role }) {
  const pathname = usePathname();
  const directoryHref: Route = canManageUsers(role) ? "/users" : "/directories/floors";
  const canOpenDirectories = canAccessDirectories(role);
  const tabs: Array<{ href: Route; label: string }> = [
    { href: "/my", label: "Мои" },
    { href: "/new", label: "Новые" },
    ...(canAccessRoundsModule(role) ? [{ href: "/rounds" as Route, label: "Обходы" }] : []),
    { href: "/archive", label: "Архив" },
    canOpenDirectories ? { href: directoryHref, label: "Справ." } : { href: "/profile", label: "Профиль" }
  ];

  return (
    <nav className="mobile-tabs">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link key={tab.href} href={tab.href} className={`mobile-tab${active ? " active" : ""}`}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
