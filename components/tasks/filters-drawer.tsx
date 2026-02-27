"use client";

import Link from "next/link";
import type { Route } from "next";
import type { ObjectItem } from "@/lib/types";

type DrawerProps = {
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
  listHref: Route;
  onClose: () => void;
};

export function FiltersDrawer({ objects, assignees, initial, listHref, onClose }: DrawerProps) {
  return (
    <div className="filters-overlay" onClick={onClose} role="presentation">
      <aside className="filters-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Фильтры и сортировка</h2>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Закрыть
          </button>
        </div>

        <form className="grid" action="">
          <input type="hidden" name="q" value={initial.q ?? ""} />
          <input type="hidden" name="status" value={initial.status ?? "all"} />

          <label className="tl-filter-label">Объект</label>
          <select className="select" name="object" defaultValue={initial.object ?? "all"}>
            <option value="all">Любой объект</option>
            {objects.map((obj) => (
              <option key={obj.id} value={obj.id}>{obj.name}</option>
            ))}
          </select>

          <label className="tl-filter-label">Ответственный</label>
          <select className="select" name="assignee" defaultValue={initial.assignee ?? "all"}>
            <option value="all">Любой ответственный</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </select>

          <label className="tl-filter-label">Участник команды</label>
          <select className="select" name="team_member" defaultValue={initial.teamMember ?? "all"}>
            <option value="all">Любой участник</option>
            {assignees.map((a) => (
              <option key={a.id} value={a.id}>{a.full_name}</option>
            ))}
          </select>

          <label className="tl-filter-label">Приоритет</label>
          <select className="select" name="priority" defaultValue={initial.priority ?? "all"}>
            <option value="all">Любой приоритет</option>
            <option value="low">Низкий</option>
            <option value="medium">Средний</option>
            <option value="high">Высокий</option>
            <option value="critical">Критический</option>
          </select>

          <label className="tl-filter-label">Срок</label>
          <select className="select" name="due" defaultValue={initial.due ?? "all"}>
            <option value="all">Любой срок</option>
            <option value="overdue">Просрочено</option>
            <option value="today">Сегодня</option>
            <option value="week">Ближайшая неделя</option>
          </select>

          <label className="tl-filter-label">Сортировка</label>
          <select className="select" name="client_sort" defaultValue={initial.clientSort ?? "smart"}>
            <option value="smart">Умная (рекомендуется)</option>
            <option value="due_asc">По дедлайну (ближайшие)</option>
            <option value="due_desc">По дедлайну (дальние)</option>
            <option value="created_desc">По дате создания</option>
          </select>

          <label className="tl-filter-label">Группировка</label>
          <select className="select" name="group_by" defaultValue={initial.groupBy ?? "none"}>
            <option value="none">Без группировки</option>
            <option value="object">По объекту</option>
            <option value="status">По статусу</option>
          </select>

          <input type="hidden" name="sort" value={initial.sort ?? "due_asc"} />

          <div className="row filters-actions">
            <button className="btn btn-accent" type="submit">Применить</button>
            <Link className="btn" href={listHref}>Сбросить</Link>
          </div>
        </form>
      </aside>
    </div>
  );
}
