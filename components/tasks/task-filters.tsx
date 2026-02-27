"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import type { Route } from "next";
import { useMemo, useState } from "react";
import type { ObjectItem, TaskItem } from "@/lib/types";
import { isOverdue, isDueToday } from "@/lib/task-sort";

// Шторка фильтров загружается лениво — пользователь видит её только после клика «Фильтры»
const FiltersDrawer = dynamic(
  () => import("@/components/tasks/filters-drawer").then((m) => m.FiltersDrawer),
  { ssr: false }
);

export type KpiData = {
  overdue: number;
  today: number;
  critical: number;
  inProgress: number;
  newCount: number;
};

type Props = {
  objects: ObjectItem[];
  assignees: Array<{ id: string; full_name: string }>;
  initial: {
    q?: string;
    status?: string;
    priority?: string;
    object?: string;
    assignee?: string;
    teamMember?: string;
    due?: string;
    sort?: string;
    clientSort?: string;
    groupBy?: string;
  };
  showCreateButton?: boolean;
  createHref?: Route;
  listHref?: Route;
  tasks?: TaskItem[];
  /** Полный список задач без фильтров — для KPI */
  allTasks?: TaskItem[];
};

export function TaskFilters({
  objects,
  assignees,
  initial,
  showCreateButton = false,
  createHref = "/tasks/create",
  listHref = "/my",
  tasks = [],
  allTasks
}: Props) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [kpiExpanded, setKpiExpanded] = useState(false);

  // KPI считается от полного списка (без фильтров), если он передан, иначе от текущего
  const kpiSource = allTasks ?? tasks;
  const kpi = useMemo<KpiData>(() => {
    const overdue = kpiSource.filter((t) => isOverdue(t)).length;
    const today = kpiSource.filter((t) => isDueToday(t)).length;
    const critical = kpiSource.filter((t) => t.priority === "critical" && t.status !== "done").length;
    const inProgress = kpiSource.filter((t) => t.status === "in_progress").length;
    const newCount = kpiSource.filter((t) => t.status === "new").length;
    return { overdue, today, critical, inProgress, newCount };
  }, [kpiSource]);

  // Индикатор "Фильтры" горит только от медленных фильтров шторки (объект/исполнитель/команда),
  // не от quick-чипов (status/priority/due) — они управляются через чипы и KPI.
  const hasAdvancedFilters = useMemo(
    () =>
      (initial.object ?? "all") !== "all" ||
      (initial.assignee ?? "all") !== "all" ||
      (initial.teamMember ?? "all") !== "all",
    [initial]
  );

  // Строит href, сохраняя ВСЕ текущие параметры и перезаписывая нужные.
  // Используется только для формы поиска.
  function buildHref(overrides: Record<string, string>): Route {
    const params = new URLSearchParams();
    params.set("q", initial.q ?? "");
    params.set("status", initial.status ?? "all");
    params.set("priority", initial.priority ?? "all");
    params.set("object", initial.object ?? "all");
    params.set("assignee", initial.assignee ?? "all");
    params.set("team_member", initial.teamMember ?? "all");
    params.set("due", initial.due ?? "all");
    params.set("sort", initial.sort ?? "due_asc");
    params.set("client_sort", initial.clientSort ?? "smart");
    params.set("group_by", initial.groupBy ?? "none");
    Object.entries(overrides).forEach(([key, value]) => params.set(key, value));
    return `${listHref}?${params.toString()}` as Route;
  }

  // Строит href для чипов и KPI-плиток: сбрасывает ВСЕ quick-параметры
  // (status/priority/due), сохраняет только "медленные" (object/assignee/team/sort/etc.)
  // и применяет только то, что явно передано.
  function buildQuickHref(quick: Record<string, string>): Route {
    const params = new URLSearchParams();
    params.set("q", initial.q ?? "");
    params.set("status", "all");
    params.set("priority", "all");
    params.set("due", "all");
    params.set("object", initial.object ?? "all");
    params.set("assignee", initial.assignee ?? "all");
    params.set("team_member", initial.teamMember ?? "all");
    params.set("sort", initial.sort ?? "due_asc");
    params.set("client_sort", initial.clientSort ?? "smart");
    params.set("group_by", initial.groupBy ?? "none");
    Object.entries(quick).forEach(([key, value]) => params.set(key, value));
    return `${listHref}?${params.toString()}` as Route;
  }

  const activeChip = useMemo(() => {
    const s = initial.status ?? "all";
    const p = initial.priority ?? "all";
    const d = initial.due ?? "all";
    if (d === "overdue") return "overdue";
    if (d === "today") return "today";
    if (p === "critical" && s === "all" && d === "all") return "critical";
    return s;
  }, [initial.status, initial.priority, initial.due]);

  const quickChips: Array<{ key: string; label: string; href: Route }> = [
    { key: "all",         label: "Все",          href: buildQuickHref({}) },
    { key: "overdue",     label: "Просрочено",   href: buildQuickHref({ due: "overdue" }) },
    { key: "today",       label: "Сегодня",      href: buildQuickHref({ due: "today" }) },
    { key: "in_progress", label: "В работе",     href: buildQuickHref({ status: "in_progress" }) },
    { key: "new",         label: "Новые",        href: buildQuickHref({ status: "new" }) },
    { key: "done",        label: "Выполненные",  href: buildQuickHref({ status: "done" }) },
  ];

  const kpiItems: Array<{ label: string; value: number; href: Route; accent?: string }> = [
    { label: "Просрочено",  value: kpi.overdue,    href: buildQuickHref({ due: "overdue" }),        accent: "danger" },
    { label: "Сегодня",     value: kpi.today,      href: buildQuickHref({ due: "today" }),          accent: "warning" },
    { label: "Критических", value: kpi.critical,   href: buildQuickHref({ priority: "critical" }),  accent: "critical" },
    { label: "В работе",    value: kpi.inProgress, href: buildQuickHref({ status: "in_progress" }), accent: "info" },
    { label: "Новых",       value: kpi.newCount,   href: buildQuickHref({ status: "new" }),          accent: "neutral" },
  ];

  return (
    <>
      <div className="tl-kpi-section">
        <div className={`tl-kpi-bar${kpiExpanded ? " tl-kpi-bar--expanded" : ""}`}>
          {kpiItems.map((item) => (
            <Link key={item.label} href={item.href} className={`tl-kpi-card tl-kpi-${item.accent}`}>
              <span className="tl-kpi-value">{item.value}</span>
              <span className="tl-kpi-label">{item.label}</span>
            </Link>
          ))}
        </div>
        <button
          className="tl-kpi-toggle"
          type="button"
          onClick={() => setKpiExpanded((v) => !v)}
          aria-expanded={kpiExpanded}
        >
          {kpiExpanded ? "Свернуть" : "Аналитика"}
        </button>
      </div>

      <div className="tl-sticky-bar">
        <div className="tl-search-row">
          <form className="tl-search-form" action="">
            <input className="input tl-search-input" name="q" defaultValue={initial.q ?? ""} placeholder="Поиск по задаче…" />
            <input type="hidden" name="status" value={initial.status ?? "all"} />
            <input type="hidden" name="priority" value={initial.priority ?? "all"} />
            <input type="hidden" name="object" value={initial.object ?? "all"} />
            <input type="hidden" name="assignee" value={initial.assignee ?? "all"} />
            <input type="hidden" name="team_member" value={initial.teamMember ?? "all"} />
            <input type="hidden" name="due" value={initial.due ?? "all"} />
            <input type="hidden" name="sort" value={initial.sort ?? "due_asc"} />
            <input type="hidden" name="client_sort" value={initial.clientSort ?? "smart"} />
            <input type="hidden" name="group_by" value={initial.groupBy ?? "none"} />
            <button className="btn tl-search-btn" type="submit" aria-label="Найти">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </button>
          </form>
          <div className="tl-toolbar-actions">
            {showCreateButton ? (
              <Link className="btn btn-accent tl-btn-new" href={createHref}>
                + Задача
              </Link>
            ) : null}
            <button
              className={`btn tl-btn-filters${hasAdvancedFilters ? " tl-btn-filters--active" : ""}`}
              type="button"
              onClick={() => setIsFiltersOpen(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
              Фильтры
              {hasAdvancedFilters ? <span className="tl-filters-dot" aria-hidden="true" /> : null}
            </button>
          </div>
        </div>

        <div className="tl-chips-scroll">
          {quickChips.map((chip) => (
            <Link key={chip.key} href={chip.href} className={`tl-chip${activeChip === chip.key ? " tl-chip--active" : ""}`}>
              {chip.label}
            </Link>
          ))}
        </div>
      </div>

      {isFiltersOpen ? (
        <FiltersDrawer
          objects={objects}
          assignees={assignees}
          initial={initial}
          listHref={listHref as Route}
          onClose={() => setIsFiltersOpen(false)}
        />
      ) : null}
    </>
  );
}
