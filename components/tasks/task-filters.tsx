"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import type { ObjectItem } from "@/lib/types";

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
  };
  showCreateButton?: boolean;
  createHref?: Route;
  listHref?: Route;
};

export function TaskFilters({
  objects,
  assignees,
  initial,
  showCreateButton = false,
  createHref = "/tasks/create",
  listHref = "/my"
}: Props) {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const hasAdvancedFilters = useMemo(
    () =>
      (initial.status ?? "all") !== "all" ||
      (initial.priority ?? "all") !== "all" ||
      (initial.object ?? "all") !== "all" ||
      (initial.assignee ?? "all") !== "all" ||
      (initial.teamMember ?? "all") !== "all" ||
      (initial.due ?? "all") !== "all" ||
      (initial.sort ?? "due_asc") !== "due_asc",
    [initial]
  );

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
    Object.entries(overrides).forEach(([key, value]) => params.set(key, value));
    return `${listHref}?${params.toString()}` as Route;
  }

  const quickChips: Array<{ key: string; label: string; href: Route; active: boolean }> = [
    {
      key: "all",
      label: "Все",
      href: buildHref({ status: "all", due: "all" }),
      active: (initial.status ?? "all") === "all" && (initial.due ?? "all") === "all"
    },
    {
      key: "new",
      label: "Новые",
      href: buildHref({ status: "new", due: "all" }),
      active: (initial.status ?? "all") === "new" && (initial.due ?? "all") === "all"
    },
    {
      key: "in_progress",
      label: "В работе",
      href: buildHref({ status: "in_progress", due: "all" }),
      active: (initial.status ?? "all") === "in_progress" && (initial.due ?? "all") === "all"
    },
    {
      key: "paused",
      label: "Пауза",
      href: buildHref({ status: "paused", due: "all" }),
      active: (initial.status ?? "all") === "paused" && (initial.due ?? "all") === "all"
    },
    {
      key: "done",
      label: "Выполненные",
      href: buildHref({ status: "done", due: "all" }),
      active: (initial.status ?? "all") === "done" && (initial.due ?? "all") === "all"
    },
    {
      key: "overdue",
      label: "Просроченные",
      href: buildHref({ status: "all", due: "overdue" }),
      active: (initial.status ?? "all") === "all" && (initial.due ?? "all") === "overdue"
    }
  ];

  return (
    <>
      <div className="section-card grid">
        <div className="task-toolbar">
          <form className="task-search-form" action="">
            <input className="input" name="q" defaultValue={initial.q ?? ""} placeholder="Поиск по названию задачи" />
            <input type="hidden" name="status" value={initial.status ?? "all"} />
            <input type="hidden" name="priority" value={initial.priority ?? "all"} />
            <input type="hidden" name="object" value={initial.object ?? "all"} />
            <input type="hidden" name="assignee" value={initial.assignee ?? "all"} />
            <input type="hidden" name="team_member" value={initial.teamMember ?? "all"} />
            <input type="hidden" name="due" value={initial.due ?? "all"} />
            <input type="hidden" name="sort" value={initial.sort ?? "due_asc"} />
            <button className="btn btn-ghost" type="submit">
              Поиск
            </button>
          </form>

          <div className="row">
            {showCreateButton ? (
              <Link className="btn btn-accent" href={createHref}>
                + Новая задача
              </Link>
            ) : null}
            <button className="btn" type="button" onClick={() => setIsFiltersOpen(true)}>
              Фильтры
            </button>
          </div>
        </div>
        <div className="filter-chips-row">
          {quickChips.map((chip) => (
            <Link key={chip.key} href={chip.href} className={`filter-chip${chip.active ? " active" : ""}`}>
              {chip.label}
            </Link>
          ))}
        </div>
        {hasAdvancedFilters ? (
          <div className="text-soft task-advanced-hint">
            Применены расширенные фильтры
          </div>
        ) : null}
      </div>

      {isFiltersOpen ? (
        <div className="filters-overlay" onClick={() => setIsFiltersOpen(false)} role="presentation">
          <aside className="filters-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Фильтры</h2>
              <button className="btn btn-ghost" type="button" onClick={() => setIsFiltersOpen(false)}>
                Закрыть
              </button>
            </div>
            <p className="text-soft filters-drawer-hint">
              Уточните список по объекту, исполнителю, участнику команды, приоритету и сроку.
            </p>
            <form className="grid" action="">
              <input type="hidden" name="q" value={initial.q ?? ""} />
              <input type="hidden" name="status" value={initial.status ?? "all"} />
              <input type="hidden" name="sort" value={initial.sort ?? "due_asc"} />

              <select className="select" name="object" defaultValue={initial.object ?? "all"}>
                <option value="all">Любой объект</option>
                {objects.map((obj) => (
                  <option key={obj.id} value={obj.id}>
                    {obj.name}
                  </option>
                ))}
              </select>
              <select className="select" name="assignee" defaultValue={initial.assignee ?? "all"}>
                <option value="all">Любой ответственный</option>
                {assignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.full_name}
                  </option>
                ))}
              </select>
              <select className="select" name="team_member" defaultValue={initial.teamMember ?? "all"}>
                <option value="all">Любой участник команды</option>
                {assignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.full_name}
                  </option>
                ))}
              </select>
              <select className="select" name="priority" defaultValue={initial.priority ?? "all"}>
                <option value="all">Любой приоритет</option>
                <option value="low">Низкий</option>
                <option value="medium">Средний</option>
                <option value="high">Высокий</option>
                <option value="critical">Критический</option>
              </select>
              <select className="select" name="due" defaultValue={initial.due ?? "all"}>
                <option value="all">Любой срок</option>
                <option value="overdue">Просрочено</option>
                <option value="today">Сегодня</option>
                <option value="week">Ближайшая неделя</option>
              </select>
              <div className="row filters-actions">
                <button className="btn btn-accent" type="submit">
                  Применить
                </button>
                <Link className="btn" href={listHref}>
                  Сбросить
                </Link>
              </div>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}
