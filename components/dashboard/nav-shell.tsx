"use client";

import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";
import { MainNav } from "@/components/dashboard/main-nav";

export function NavShell({ role }: { role: Role }) {
  const pathname = usePathname();
  return <MainNav role={role} currentPath={pathname} />;
}
