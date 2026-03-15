"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { generatePprMonthPlanAction, reschedulePprMonthPlanItemAction } from "@/app/actions/ppr-calendar-actions";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PprModal, PprFormGroup } from "@/components/ppr/ui/ppr-modal";
import { pprMonthPlanItemStatusMeta, pprTaskStatusMeta } from "@/lib/ppr/presentation";
import type { PprCalendarYearGroupOverviewRow, PprCalendarYearSystemOverviewRow } from "@/lib/ppr/queries";

type CalendarSystemGroupOption = {
  id: string;
  name: string;
  code: string;
};

type CalendarSystemOption = {
  id: string;
  object_id: string;
  system_group_id: string;
  name: string;
  responsible_user_id: string | null;
  object: { name: string } | Array<{ name: string }> | null;
  system_group: { name: string; code: string } | Array<{ name: string; code: string }> | null;
};

type MonthPlanRow = {
  id: string;
  object_id: string;
  system_id: string;
  plan_month: string;
  generated_at: string;
  object: { name: string } | Array<{ name: string }> | null;
  system: { name: string } | Array<{ name: string }> | null;
};

type MonthPlanItemRow = {
  id: string;
  object_id: string;
  month_plan_id: string;
  system_id: string;
  equipment_id: string;
  assignment_id: string;
  template_id: string;
  planned_for: string;
  source_due_date: string;
  is_overdue: boolean;
  is_carried_over: boolean;
  task_id: string | null;
  status: "pending" | "materialized" | "carried_over" | "closed" | "cancelled";
  month_plan: { plan_month: string } | Array<{ plan_month: string }> | null;
  equipment: { name: string; inventory_no: string } | Array<{ name: string; inventory_no: string }> | null;
  template: { name: string; norm_hours: number | null } | Array<{ name: string; norm_hours: number | null }> | null;
  system: { name: string } | Array<{ name: string }> | null;
  object: { name: string } | Array<{ name: string }> | null;
  task:
    | { id: string; status: "new" | "in_progress" | "done" | "closed" | "cancelled"; planned_for: string }
    | Array<{ id: string; status: "new" | "in_progress" | "done" | "closed" | "cancelled"; planned_for: string }>
    | null;
};

type CalendarFilters = {
  year: number;
  month: string;
  groupId?: string;
  systemId?: string;
};

type FilterPatch = {
  year?: number;
  month?: string;
  groupId?: string | null;
  systemId?: string | null;
};

type CalendarDayCell = {
  isoDate: string;
  dayNumber: number;
  items: MonthPlanItemRow[];
};

function resolveRelation<T>(raw: T | Array<T> | null | undefined) {
  return Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
}

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  return resolveRelation(raw)?.name ?? "—";
}

function resolveEquipment(raw: { name: string; inventory_no: string } | Array<{ name: string; inventory_no: string }> | null | undefined) {
  const item = resolveRelation(raw);
  if (!item) return "—";
  return `${item.name} (${item.inventory_no})`;
}

function resolveTemplate(raw: { name: string; norm_hours: number | null } | Array<{ name: string; norm_hours: number | null }> | null | undefined) {
  return resolveRelation(raw);
}

function resolveTask(
  raw:
    | { id: string; status: "new" | "in_progress" | "done" | "closed" | "cancelled"; planned_for: string }
    | Array<{ id: string; status: "new" | "in_progress" | "done" | "closed" | "cancelled"; planned_for: string }>
    | null
    | undefined
) {
  return resolveRelation(raw);
}

function formatMonthLabel(value: string, monthFormat: "long" | "short" = "long") {
  return new Date(`${value}-01T00:00:00.000Z`).toLocaleDateString("ru-RU", {
    month: monthFormat,
    year: monthFormat === "long" ? "numeric" : undefined,
  });
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("ru-RU");
}

function formatHours(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
}

function buildCalendarHref(current: CalendarFilters, patch: FilterPatch = {}) {
  const next: CalendarFilters = {
    year: patch.year ?? current.year,
    month: patch.month ?? current.month,
    groupId: patch.groupId === null ? undefined : patch.groupId ?? current.groupId,
    systemId: patch.systemId === null ? undefined : patch.systemId ?? current.systemId,
  };

  const params = new URLSearchParams();
  params.set("year", String(next.year));
  params.set("month", next.month);
  if (next.groupId) params.set("group", next.groupId);
  if (next.systemId) params.set("system", next.systemId);
  return `/ppr/calendar?${params.toString()}`;
}

function canRescheduleFromCalendar(item: MonthPlanItemRow) {
  const task = resolveTask(item.task);
  if (!task) {
    return item.status === "pending" || item.status === "carried_over";
  }
  return task.status === "new" || task.status === "in_progress";
}

function monthMetricTone(metrics: { overdue_count: number; carried_over_count: number; items_count: number }) {
  if (!metrics.items_count) return "neutral" as const;
  if (metrics.overdue_count > 0) return "danger" as const;
  if (metrics.carried_over_count > 0) return "warning" as const;
  return "info" as const;
}

function buildMonthCells(month: string, items: MonthPlanItemRow[]) {
  const [yearValue, monthValue] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(yearValue, monthValue, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(yearValue, monthValue - 1, 1)).getUTCDay() + 6) % 7;
  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const dayNumber = index + 1;
    const isoDate = `${month}-${String(dayNumber).padStart(2, "0")}`;
    return {
      isoDate,
      dayNumber,
      items: items.filter((item) => item.planned_for === isoDate),
    };
  });

  const cells: Array<CalendarDayCell | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...days,
  ];
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function countMonthHours(items: MonthPlanItemRow[]) {
  return items.reduce((accumulator, item) => accumulator + (resolveTemplate(item.template)?.norm_hours ?? 0), 0);
}

function MetricCell({
  href,
  metrics,
}: {
  href: string;
  metrics: {
    items_count: number;
    norm_hours_total: number;
    overdue_count: number;
    carried_over_count: number;
    materialized_count: number;
  };
}) {
  if (!metrics.items_count) {
    return <span className="text-soft">—</span>;
  }

  return (
    <a href={href} className="grid" style={{ gap: "0.25rem", color: "inherit", textDecoration: "none" }}>
      <div className="row" style={{ gap: "0.35rem", alignItems: "center", flexWrap: "wrap" }}>
        <strong>{metrics.items_count}</strong>
        <Badge tone={monthMetricTone(metrics)}>{formatHours(metrics.norm_hours_total)} ч</Badge>
      </div>
      <div className="text-soft" style={{ fontSize: "0.75rem" }}>
        {metrics.materialized_count ? `В задачах: ${metrics.materialized_count}` : "Плановые позиции"}
      </div>
    </a>
  );
}

export function PprCalendarAdmin({
  systemGroups,
  systems,
  yearGroupOverview,
  yearSystemOverview,
  monthPlans,
  monthPlanItems,
  currentYear,
  currentMonthInput,
  selectedGroupId,
  selectedSystemId,
}: {
  systemGroups: CalendarSystemGroupOption[];
  systems: CalendarSystemOption[];
  yearGroupOverview: PprCalendarYearGroupOverviewRow[];
  yearSystemOverview: PprCalendarYearSystemOverviewRow[];
  monthPlans: MonthPlanRow[];
  monthPlanItems: MonthPlanItemRow[];
  currentYear: number;
  currentMonthInput: string;
  selectedGroupId?: string;
  selectedSystemId?: string;
}) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const editingItem = editingItemId ? monthPlanItems.find((item) => item.id === editingItemId) ?? null : null;
  const editingTask = resolveTask(editingItem?.task);
  const filters: CalendarFilters = {
    year: currentYear,
    month: currentMonthInput,
    groupId: selectedGroupId,
    systemId: selectedSystemId,
  };

  const filteredSystems = useMemo(() => {
    if (!selectedGroupId) return systems;
    return systems.filter((system) => system.system_group_id === selectedGroupId);
  }, [selectedGroupId, systems]);
  const selectedGroup = systemGroups.find((group) => group.id === selectedGroupId);
  const selectedSystem = systems.find((system) => system.id === selectedSystemId);
  const monthCells = useMemo(() => buildMonthCells(currentMonthInput, monthPlanItems), [currentMonthInput, monthPlanItems]);
  const monthTotals = useMemo(
    () => ({
      items: monthPlanItems.length,
      overdue: monthPlanItems.filter((item) => item.is_overdue).length,
      carried: monthPlanItems.filter((item) => item.is_carried_over).length,
      materialized: monthPlanItems.filter((item) => item.task_id !== null).length,
      hours: countMonthHours(monthPlanItems),
    }),
    [monthPlanItems]
  );

  if (!systems.length) {
    return (
      <EmptyState
        message="Календарь ППР пока недоступен"
        hint="Нет систем, доступных для управления календарем в рамках вашей роли."
      />
    );
  }

  return (
    <>
      <div className="section-card">
        <form method="get" className="row" style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
          <label className="grid" style={{ gap: "0.3rem" }}>
            <span className="text-soft">Год обзора</span>
            <input className="input" type="number" min={2024} max={2100} name="year" defaultValue={currentYear} />
          </label>
          <label className="grid" style={{ gap: "0.3rem" }}>
            <span className="text-soft">Месяц детализации</span>
            <input className="input" type="month" name="month" defaultValue={currentMonthInput} />
          </label>
          <label className="grid" style={{ gap: "0.3rem" }}>
            <span className="text-soft">Группа систем</span>
            <select className="select" name="group" defaultValue={selectedGroupId ?? ""}>
              <option value="">Все группы</option>
              {systemGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid" style={{ gap: "0.3rem" }}>
            <span className="text-soft">Система</span>
            <select className="select" name="system" defaultValue={selectedSystemId ?? ""}>
              <option value="">Все доступные системы</option>
              {filteredSystems.map((system) => (
                <option key={system.id} value={system.id}>
                  {resolveName(system.object)} / {system.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-ghost" type="submit">
            Показать
          </button>
          <Link href="/ppr/calendar" className="btn btn-ghost">
            Сбросить
          </Link>
        </form>
      </div>

      <div className="section-card grid" style={{ gap: "0.85rem" }}>
        <div className="grid" style={{ gap: "0.35rem" }}>
          <strong>Уровень 1. Годовой обзор по группам систем</strong>
          <span className="text-soft">
            Метрика ячейки: количество позиций month plan и суммарные нормо-часы за месяц. Красный акцент означает просрочку,
            желтый - carryover.
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1050px" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--line)" }}>Группа систем</th>
                {Array.from({ length: 12 }, (_, index) => {
                  const month = `${currentYear}-${String(index + 1).padStart(2, "0")}`;
                  return (
                    <th key={month} style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--line)" }}>
                      {formatMonthLabel(month, "short")}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {yearGroupOverview.map((row) => (
                <tr key={row.system_group_id}>
                  <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--line)" }}>
                    <div className="grid" style={{ gap: "0.35rem" }}>
                      <a
                        href={buildCalendarHref(filters, { groupId: row.system_group_id, systemId: null })}
                        style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}
                      >
                        {row.name}
                      </a>
                      <span className="text-soft">
                        {row.code} • систем: {row.systems_count} • позиций: {row.totals.items_count} • {formatHours(row.totals.norm_hours_total)} ч
                      </span>
                    </div>
                  </td>
                  {row.months.map((metrics) => (
                    <td key={`${row.system_group_id}-${metrics.month}`} style={{ padding: "0.75rem", borderBottom: "1px solid var(--line)" }}>
                      <MetricCell href={buildCalendarHref(filters, { groupId: row.system_group_id, month: metrics.month, systemId: null })} metrics={metrics} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedGroupId && yearSystemOverview.length ? (
        <div className="section-card grid" style={{ gap: "0.85rem" }}>
          <div className="grid" style={{ gap: "0.35rem" }}>
            <strong>Уровень 2. Годовой обзор по системам внутри группы</strong>
            <span className="text-soft">
              Выбрана группа: <strong>{selectedGroup?.name ?? "—"}</strong>. Клик по ячейке открывает дневной календарь выбранного месяца.
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1100px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--line)" }}>Система</th>
                  {Array.from({ length: 12 }, (_, index) => {
                    const month = `${currentYear}-${String(index + 1).padStart(2, "0")}`;
                    return (
                      <th key={month} style={{ textAlign: "left", padding: "0.75rem", borderBottom: "1px solid var(--line)" }}>
                        {formatMonthLabel(month, "short")}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {yearSystemOverview.map((row) => (
                  <tr key={row.system_id}>
                    <td style={{ padding: "0.75rem", borderBottom: "1px solid var(--line)" }}>
                      <div className="grid" style={{ gap: "0.35rem" }}>
                        <a
                          href={buildCalendarHref(filters, {
                            groupId: row.system_group_id,
                            systemId: row.system_id,
                          })}
                          style={{ color: "inherit", textDecoration: "none", fontWeight: 600 }}
                        >
                          {row.name}
                        </a>
                        <span className="text-soft">
                          {row.object_name} • позиций: {row.totals.items_count} • {formatHours(row.totals.norm_hours_total)} ч
                        </span>
                      </div>
                    </td>
                    {row.months.map((metrics) => (
                      <td key={`${row.system_id}-${metrics.month}`} style={{ padding: "0.75rem", borderBottom: "1px solid var(--line)" }}>
                        <MetricCell
                          href={buildCalendarHref(filters, {
                            groupId: row.system_group_id,
                            systemId: row.system_id,
                            month: metrics.month,
                          })}
                          metrics={metrics}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="section-card grid" style={{ gap: "0.85rem" }}>
        <div className="grid" style={{ gap: "0.35rem" }}>
          <strong>Уровень 3. Дневной календарь месяца</strong>
          <span className="text-soft">
            Месяц: <strong>{formatMonthLabel(currentMonthInput)}</strong>
            {selectedGroup ? <> • группа: <strong>{selectedGroup.name}</strong></> : null}
            {selectedSystem ? <> • система: <strong>{selectedSystem.name}</strong></> : null}
          </span>
          <span className="text-soft">
            Правило переноса зафиксировано: из календаря ППР работа двигается только внутри выбранного месяца. До materialization меняется
            `ppr_month_plan_item`, после materialization - связанная `ppr_task` с синхронизацией даты обратно в plan items.
          </span>
        </div>

        <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
          <Badge tone="info">Позиций: {monthTotals.items}</Badge>
          <Badge tone="violet">Нормо-часы: {formatHours(monthTotals.hours)}</Badge>
          {monthTotals.materialized ? <Badge tone="warning">В задачах: {monthTotals.materialized}</Badge> : null}
          {monthTotals.carried ? <Badge tone="warning">Carryover: {monthTotals.carried}</Badge> : null}
          {monthTotals.overdue ? <Badge tone="danger">Просрочено: {monthTotals.overdue}</Badge> : null}
        </div>
      </div>

      <div className="section-card">
        <form action={generatePprMonthPlanAction} className="row" style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
          <label className="grid" style={{ gap: "0.3rem" }}>
            <span className="text-soft">Сформировать план по системе</span>
            <select className="select" name="system_id" required defaultValue={selectedSystemId ?? ""}>
              <option value="" disabled>
                Выберите систему
              </option>
              {filteredSystems.map((system) => (
                <option key={system.id} value={system.id}>
                  {resolveName(system.object)} / {system.name}
                </option>
              ))}
            </select>
          </label>
          <input type="hidden" name="plan_month" value={currentMonthInput} />
          <button className="btn btn-accent" type="submit">
            Сформировать месяц
          </button>
        </form>
      </div>

      {!monthPlans.length ? (
        <EmptyState
          message="Месячный план ещё не сформирован"
          hint="Сформируйте план хотя бы для одной системы выбранной области и затем распределите работы по дням."
        />
      ) : (
        <div className="grid" style={{ gap: "0.75rem" }}>
          {monthPlans.map((plan) => (
            <div key={plan.id} className="section-card">
              <div className="grid" style={{ gap: "0.35rem" }}>
                <div>
                  <strong>{resolveName(plan.object)}</strong> / {resolveName(plan.system)}
                </div>
                <div className="text-soft">Месяц: {new Date(plan.plan_month).toLocaleDateString("ru-RU", { year: "numeric", month: "long" })}</div>
                <div className="text-soft">Сформирован: {new Date(plan.generated_at).toLocaleString("ru-RU")}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!monthPlanItems.length ? (
        <EmptyState
          message="Позиций month plan пока нет"
          hint="После формирования плана здесь появятся позиции по активным назначениям."
        />
      ) : (
        <>
          <div className="section-card desktop-only grid" style={{ gap: "0.75rem" }}>
            <div className="grid" style={{ gap: "0.35rem" }}>
              <strong>Календарная сетка по дням</strong>
              <span className="text-soft">Основной operational-слой: инженер распределяет реальную нагрузку по датам месяца.</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "0.6rem" }}>
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((label) => (
                <div key={label} className="text-soft" style={{ fontWeight: 600, padding: "0 0.25rem" }}>
                  {label}
                </div>
              ))}

              {monthCells.map((cell, index) =>
                cell ? (
                  <div
                    key={cell.isoDate}
                    style={{
                      minHeight: "180px",
                      display: "grid",
                      alignContent: "start",
                      gap: "0.45rem",
                      padding: "0.7rem",
                      borderRadius: "12px",
                      border: "1px solid var(--line)",
                      background: cell.items.length
                        ? "color-mix(in srgb, var(--panel-soft) 42%, transparent)"
                        : "color-mix(in srgb, var(--panel-soft) 20%, transparent)",
                    }}
                  >
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{cell.dayNumber}</strong>
                      {cell.items.length ? (
                        <Badge tone={cell.items.some((item) => item.is_overdue) ? "danger" : "info"}>{cell.items.length}</Badge>
                      ) : null}
                    </div>

                    {cell.items.length ? (
                      <div className="text-soft" style={{ fontSize: "0.75rem" }}>
                        {formatHours(countMonthHours(cell.items))} ч
                      </div>
                    ) : (
                      <div className="text-soft" style={{ fontSize: "0.78rem" }}>
                        Нет работ
                      </div>
                    )}

                    {cell.items.map((item) => {
                      const statusMeta = pprMonthPlanItemStatusMeta[item.status];
                      const task = resolveTask(item.task);
                      const template = resolveTemplate(item.template);
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: "grid",
                            gap: "0.35rem",
                            padding: "0.55rem",
                            borderRadius: "10px",
                            border: "1px solid color-mix(in srgb, var(--line-strong) 35%, transparent)",
                            background: "var(--panel)",
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{resolveEquipment(item.equipment)}</div>
                          {!selectedSystemId ? (
                            <div className="text-soft" style={{ fontSize: "0.75rem" }}>
                              {resolveName(item.system)}
                            </div>
                          ) : null}
                          <div className="text-soft" style={{ fontSize: "0.75rem" }}>
                            {template?.name ?? "—"}
                            {template?.norm_hours !== null && template?.norm_hours !== undefined ? ` • ${formatHours(template.norm_hours)} ч` : ""}
                          </div>
                          <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                            <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                            {task ? <Badge tone={pprTaskStatusMeta[task.status].tone}>{pprTaskStatusMeta[task.status].label}</Badge> : null}
                          </div>
                          <button
                            className="btn btn-ghost ppr-action-btn"
                            type="button"
                            disabled={!canRescheduleFromCalendar(item)}
                            onClick={() => setEditingItemId(item.id)}
                          >
                            Перенести
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div key={`empty-${index}`} style={{ minHeight: "120px" }} />
                )
              )}
            </div>
          </div>

          <div className="desktop-only">
            <DataTable
              columns={[
                { key: "system", label: "Система" },
                { key: "equipment", label: "Оборудование" },
                { key: "template", label: "Шаблон" },
                { key: "source", label: "Исходная дата" },
                { key: "planned", label: "Плановая дата" },
                { key: "status", label: "Статус" },
                { key: "actions", label: "Действия" },
              ]}
            >
              {monthPlanItems.map((item) => {
                const statusMeta = pprMonthPlanItemStatusMeta[item.status];
                const task = resolveTask(item.task);
                const template = resolveTemplate(item.template);
                return (
                  <tr key={item.id}>
                    <td>{resolveName(item.system)}</td>
                    <td>{resolveEquipment(item.equipment)}</td>
                    <td>
                      {template?.name ?? "—"}
                      {template?.norm_hours !== null && template?.norm_hours !== undefined ? (
                        <div className="text-soft">{formatHours(template.norm_hours)} ч</div>
                      ) : null}
                    </td>
                    <td>{formatDate(item.source_due_date)}</td>
                    <td>{formatDate(item.planned_for)}</td>
                    <td>
                      <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                        {item.is_carried_over ? <Badge tone="warning">Carryover</Badge> : null}
                        {task ? <Badge tone={pprTaskStatusMeta[task.status].tone}>{pprTaskStatusMeta[task.status].label}</Badge> : null}
                      </div>
                    </td>
                    <td>
                      <div className="ppr-table-actions">
                        <button
                          className="btn btn-ghost ppr-action-btn"
                          type="button"
                          disabled={!canRescheduleFromCalendar(item)}
                          onClick={() => setEditingItemId(item.id)}
                        >
                          Перенести
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          </div>

          <div className="mobile-cards mobile-only">
            {monthPlanItems.map((item) => {
              const statusMeta = pprMonthPlanItemStatusMeta[item.status];
              const task = resolveTask(item.task);
              const template = resolveTemplate(item.template);
              return (
                <div key={item.id} className="section-card mobile-card">
                  <div className="grid" style={{ gap: "0.45rem" }}>
                    <div>{resolveEquipment(item.equipment)}</div>
                    <div className="text-soft">Система: {resolveName(item.system)}</div>
                    <div className="text-soft">
                      Шаблон: {template?.name ?? "—"}
                      {template?.norm_hours !== null && template?.norm_hours !== undefined ? ` • ${formatHours(template.norm_hours)} ч` : ""}
                    </div>
                    <div className="text-soft">Исходная дата: {formatDate(item.source_due_date)}</div>
                    <div className="text-soft">Плановая дата: {formatDate(item.planned_for)}</div>
                    <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                      {task ? <Badge tone={pprTaskStatusMeta[task.status].tone}>{pprTaskStatusMeta[task.status].label}</Badge> : null}
                    </div>
                    <div className="ppr-table-actions">
                      <button
                        className="btn btn-ghost ppr-action-btn"
                        type="button"
                        disabled={!canRescheduleFromCalendar(item)}
                        onClick={() => setEditingItemId(item.id)}
                      >
                        Перенести
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <PprModal
        open={Boolean(editingItem)}
        onClose={() => {
          setEditingItemId(null);
          setIsDirty(false);
        }}
        title={editingTask ? "Перенос materialized ППР-заявки" : "Перенос позиции month plan"}
        isDirty={isDirty}
      >
        {editingItem ? (
          <form
            action={reschedulePprMonthPlanItemAction}
            onSubmit={() => {
              setEditingItemId(null);
              setIsDirty(false);
            }}
            onChange={() => setIsDirty(true)}
            className="ppr-modal-content"
          >
            <div className="ppr-modal-body grid">
              <input type="hidden" name="item_id" value={editingItem.id} />

              <div className="section-card" style={{ marginBottom: "1rem" }}>
                <div className="grid" style={{ gap: "0.35rem" }}>
                  <div className="text-soft">
                    <strong>Оборудование:</strong> {resolveEquipment(editingItem.equipment)}
                  </div>
                  <div className="text-soft">
                    <strong>Шаблон:</strong> {resolveTemplate(editingItem.template)?.name ?? "—"}
                  </div>
                  <div className="text-soft">
                    <strong>Месяц:</strong> {formatMonthLabel(currentMonthInput)}
                  </div>
                  <div className="text-soft">
                    <strong>Правило:</strong> перенос возможен только внутри выбранного месяца.
                  </div>
                </div>
              </div>

              <PprFormGroup label="Плановая дата">
                <input className="input" type="date" name="planned_for" defaultValue={editingItem.planned_for} />
              </PprFormGroup>

              {editingTask ? (
                <PprFormGroup label="Причина переноса">
                  <textarea
                    className="input"
                    name="reason"
                    rows={4}
                    minLength={3}
                    placeholder="Почему требуется сдвиг materialized заявки внутри месяца"
                  />
                </PprFormGroup>
              ) : null}
            </div>

            <div className="ppr-modal-footer">
              <button className="btn btn-accent" type="submit">
                Сохранить
              </button>
            </div>
          </form>
        ) : null}
      </PprModal>
    </>
  );
}
