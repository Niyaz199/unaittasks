"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";

export function MobileTabs({ role }: { role: Role }) {
  const pathname = usePathname();
  const canManageDirectories = role === "admin" || role === "chief";
  const tabs: Array<{ href: Route; label: string }> = [
    { href: "/my", label: "Мои" },
    { href: "/new", label: "Новые" },
    { href: "/archive", label: "Архив" },
    canManageDirectories ? { href: "/users", label: "Справ." } : { href: "/profile", label: "Профиль" }
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
