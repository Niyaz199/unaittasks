"use client";

import type { Route } from "next";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import type { DailyChecklistTemplateProfile } from "@/lib/types";

export function ChecklistControlFilters({
  selectedDate,
  selectedRole,
  selectedProfileId,
  profiles,
}: {
  selectedDate: string;
  selectedRole: string;
  selectedProfileId: string;
  profiles: DailyChecklistTemplateProfile[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilter = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(name, value);
      } else {
        params.delete(name);
      }

      startTransition(() => {
        const nextHref = params.size ? `${pathname}?${params.toString()}` : pathname;
        router.replace(nextHref as Route);
      });
    },
    [pathname, router, searchParams]
  );

  return (
    <div 
      className="row" 
      style={{ 
        gap: "0.75rem", 
        flexWrap: "wrap", 
        alignItems: "flex-end", 
        marginBottom: "0.5rem",
        opacity: isPending ? 0.5 : 1,
        transition: "opacity 0.2s"
      }}
    >
      <label className="grid" style={{ gap: "0.25rem", flex: "1 1 140px" }}>
        <span className="text-soft" style={{ fontSize: "0.85rem" }}>Дата</span>
        <input 
          className="input" 
          type="date" 
          name="date" 
          value={selectedDate} 
          onChange={(e) => updateFilter("date", e.target.value)}
        />
      </label>

      <label className="grid" style={{ gap: "0.25rem", flex: "1 1 140px" }}>
        <span className="text-soft" style={{ fontSize: "0.85rem" }}>Роль</span>
        <select 
          className="select" 
          name="role" 
          value={selectedRole}
          onChange={(e) => updateFilter("role", e.target.value)}
        >
          <option value="all">Все роли</option>
          <option value="lead">Ведущий инженер</option>
          <option value="engineer">Инженер</option>
          <option value="object_engineer">Инженер объекта</option>
        </select>
      </label>

      <label className="grid" style={{ gap: "0.25rem", flex: "2 1 200px" }}>
        <span className="text-soft" style={{ fontSize: "0.85rem" }}>Сотрудник</span>
        <select 
          className="select" 
          name="profileId" 
          value={selectedProfileId}
          onChange={(e) => updateFilter("profileId", e.target.value)}
        >
          <option value="all">Все сотрудники</option>
          {profiles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.full_name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
