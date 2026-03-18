"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { generatePprMonthPlanAction, reschedulePprMonthPlanItemAction } from "@/app/actions/ppr-calendar-actions";
import { DirectorySummary } from "@/components/ppr/ui/directory-summary";
import { PprFormGroup, PprModal } from "@/components/ppr/ui/ppr-modal";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { pprMonthPlanItemStatusMeta, pprTaskStatusMeta } from "@/lib/ppr/presentation";
import type { PprCalendarYearGroupOverviewRow, PprCalendarYearSystemOverviewRow } from "@/lib/ppr/queries";

type BadgeTone = "neutral" | "info" | "warning" | "success" | "danger" | "violet";

type CalendarObjectOption = {
  id: string;
  name: string;
};

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

type RoomRelation = { name: string; floor: string | null };

type EquipmentRelation = {
  name: string;
  inventory_no: string | null;
  room: RoomRelation | Array<RoomRelation> | null;
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
  equipment: EquipmentRelation | Array<EquipmentRelation> | null;
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
  objectId?: string;
  groupId?: string;
  systemId?: string;
};

type FilterPatch = {
  year?: number;
  month?: string;
  objectId?: string | null;
  groupId?: string | null;
  systemId?: string | null;
  tab?: "year" | "month";
};

type MonthDay = {
  isoDate: string;
  dayNumber: number;
};

type DaySummary = {
  itemsCount: number;
  hours: number;
  hasOverdue: boolean;
  hasCarryover: boolean;
};

type EquipmentMonthRow = {
  equipmentId: string;
  equipmentName: string;
  inventoryNo: string;
  roomName: string;
  itemsCount: number;
  hours: number;
  itemsByDate: Map<string, MonthPlanItemRow[]>;
};

function resolveRelation<T>(raw: T | Array<T> | null | undefined) {
  return Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
}

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  return resolveRelation(raw)?.name ?? "—";
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

function resolveEquipmentInfo(raw: EquipmentRelation | Array<EquipmentRelation> | null | undefined) {
  const equipment = resolveRelation(raw);
  const room = resolveRelation(equipment?.room);
  const inventoryNo = equipment?.inventory_no?.trim() || "без инв.";
  return {
    equipmentName: equipment?.name ?? "—",
    inventoryNo,
    roomName: room?.name ?? "—",
    roomFloor: room?.floor ?? null,
  };
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

function formatTemplateLabel(name: string | undefined, limit = 18) {
  if (!name) return "Работа";
  return name.length > limit ? `${name.slice(0, limit - 1)}…` : name;
}

function buildCalendarHref(current: CalendarFilters, patch: FilterPatch = {}) {
  const next: CalendarFilters = {
    year: patch.year ?? current.year,
    month: patch.month ?? current.month,
    objectId: patch.objectId === null ? undefined : patch.objectId ?? current.objectId,
    groupId: patch.groupId === null ? undefined : patch.groupId ?? current.groupId,
    systemId: patch.systemId === null ? undefined : patch.systemId ?? current.systemId,
  };

  const params = new URLSearchParams();
  params.set("year", String(next.year));
  params.set("month", next.month);
  if (next.objectId) params.set("object", next.objectId);
  if (next.groupId) params.set("group", next.groupId);
  if (next.systemId) params.set("system", next.systemId);
  if (patch.tab) params.set("tab", patch.tab);
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

function getDayTone(summary: DaySummary): BadgeTone {
  if (summary.hasOverdue) return "danger";
  if (summary.hasCarryover) return "warning";
  if (!summary.itemsCount) return "neutral";
  if (summary.hours > 8) return "danger";
  if (summary.hours > 4) return "violet";
  return "info";
}

function getItemTone(item: MonthPlanItemRow): BadgeTone {
  const task = resolveTask(item.task);
  return task ? pprTaskStatusMeta[task.status].tone : pprMonthPlanItemStatusMeta[item.status].tone;
}

function buildMonthDays(month: string) {
  const [yearValue, monthValue] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(yearValue, monthValue, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const dayNumber = index + 1;
    return {
      isoDate: `${month}-${String(dayNumber).padStart(2, "0")}`,
      dayNumber,
    };
  });
}

function buildDaySummaries(days: MonthDay[], items: MonthPlanItemRow[]) {
  const summaryMap = new Map<string, DaySummary>();
  for (const day of days) {
    const dayItems = items.filter((item) => item.planned_for === day.isoDate);
    summaryMap.set(day.isoDate, {
      itemsCount: dayItems.length,
      hours: dayItems.reduce((sum, item) => sum + (resolveTemplate(item.template)?.norm_hours ?? 0), 0),
      hasOverdue: dayItems.some((item) => item.is_overdue),
      hasCarryover: dayItems.some((item) => item.is_carried_over),
    });
  }
  return summaryMap;
}

function countMonthHours(items: MonthPlanItemRow[]) {
  return items.reduce((sum, item) => sum + (resolveTemplate(item.template)?.norm_hours ?? 0), 0);
}

function buildEquipmentMonthRows(items: MonthPlanItemRow[]) {
  const rows = new Map<string, EquipmentMonthRow>();

  for (const item of items) {
    const equipment = resolveEquipmentInfo(item.equipment);
    const current = rows.get(item.equipment_id) ?? {
      equipmentId: item.equipment_id,
      equipmentName: equipment.equipmentName,
      inventoryNo: equipment.inventoryNo,
      roomName: equipment.roomName,
      itemsCount: 0,
      hours: 0,
      itemsByDate: new Map<string, MonthPlanItemRow[]>(),
    };

    current.itemsCount += 1;
    current.hours += resolveTemplate(item.template)?.norm_hours ?? 0;
    current.itemsByDate.set(item.planned_for, [...(current.itemsByDate.get(item.planned_for) ?? []), item]);
    rows.set(item.equipment_id, current);
  }

  return [...rows.values()].sort((left, right) => {
    const roomCompare = left.roomName.localeCompare(right.roomName, "ru");
    if (roomCompare !== 0) return roomCompare;
    return left.equipmentName.localeCompare(right.equipmentName, "ru");
  });
}

function shiftPlanMonth(month: string, delta: number) {
  const [yearValue, monthValue] = month.split("-").map(Number);
  const date = new Date(Date.UTC(yearValue, monthValue - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function AnnualMetricCell({
  href,
  metrics,
  maxHours,
}: {
  href: string;
  metrics: {
    items_count: number;
    norm_hours_total: number;
    overdue_count: number;
    carried_over_count: number;
    materialized_count: number;
  };
  maxHours: number;
}) {
  const tone = monthMetricTone(metrics);
  const isEmpty = metrics.items_count === 0;
  const intensity = Math.min(Math.max(metrics.norm_hours_total / Math.max(maxHours, 1), 0), 1);
  const opacityPercent = Math.round(8 + intensity * 30);

  return (
    <a
      href={href}
      title={[
        `Позиций: ${metrics.items_count}`,
        `Нормо-часы: ${formatHours(metrics.norm_hours_total)}`,
        metrics.materialized_count ? `В задачах: ${metrics.materialized_count}` : "",
        metrics.carried_over_count ? `Carryover: ${metrics.carried_over_count}` : "",
        metrics.overdue_count ? `Просрочено: ${metrics.overdue_count}` : "",
      ]
        .filter(Boolean)
        .join("\n")}
      style={{
        display: "grid",
        gap: "0.35rem",
        padding: "0.65rem",
        borderRadius: "10px",
        border: `1px solid ${isEmpty ? "var(--line)" : `color-mix(in srgb, var(--${tone}) 35%, var(--line))`}`,
        background: isEmpty ? "var(--panel)" : `color-mix(in srgb, var(--${tone}) ${opacityPercent}%, var(--panel))`,
        color: "inherit",
        textDecoration: "none",
        minHeight: "88px",
        alignContent: "space-between",
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" }}>
        <span style={{ fontSize: "1rem", fontWeight: 700 }}>{isEmpty ? "—" : `${formatHours(metrics.norm_hours_total)} ч`}</span>
        {!isEmpty ? (
          <span className="text-soft" style={{ fontSize: "0.72rem" }}>
            {metrics.items_count} поз.
          </span>
        ) : null}
      </div>

      <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
        {metrics.materialized_count ? <Badge tone="violet">В задачах {metrics.materialized_count}</Badge> : null}
        {metrics.carried_over_count ? <Badge tone="warning">Carry {metrics.carried_over_count}</Badge> : null}
        {metrics.overdue_count ? <Badge tone="danger">Проср. {metrics.overdue_count}</Badge> : null}
      </div>
    </a>
  );
}

function WorkChip({
  item,
  onOpen,
}: {
  item: MonthPlanItemRow;
  onOpen: (id: string) => void;
}) {
  const template = resolveTemplate(item.template);
  const task = resolveTask(item.task);
  const tone = getItemTone(item);
  const canReschedule = canRescheduleFromCalendar(item);

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      title={[
        template?.name ?? "Работа",
        `План: ${formatDate(item.planned_for)}`,
        task ? `Задача: ${pprTaskStatusMeta[task.status].label}` : `Позиция: ${pprMonthPlanItemStatusMeta[item.status].label}`,
        canReschedule ? "Клик: открыть и при необходимости перенести" : "Клик: открыть детали",
      ].join("\n")}
      style={{
        width: "100%",
        display: "grid",
        gap: "0.1rem",
        padding: "0.35rem 0.45rem 0.35rem 0.55rem",
        borderRadius: "8px",
        border: "1px solid color-mix(in srgb, var(--line) 80%, transparent)",
        background: `color-mix(in srgb, var(--${tone}) 14%, var(--panel))`,
        borderLeft: `4px solid var(--${tone})`,
        color: "inherit",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <span style={{ fontSize: "0.75rem", fontWeight: 600, lineHeight: 1.15 }}>{formatTemplateLabel(template?.name)}</span>
      <span className="text-soft" style={{ fontSize: "0.68rem", lineHeight: 1.1 }}>
        {template?.norm_hours ? `${formatHours(template.norm_hours)} ч` : "Без часов"}
        {task ? ` • ${pprTaskStatusMeta[task.status].label}` : ` • ${pprMonthPlanItemStatusMeta[item.status].label}`}
      </span>
    </button>
  );
}

function OperationalMonthGrid({
  month,
  items,
  onOpenItem,
}: {
  month: string;
  items: MonthPlanItemRow[];
  onOpenItem: (id: string) => void;
}) {
  const days = useMemo(() => buildMonthDays(month), [month]);
  const rows = useMemo(() => buildEquipmentMonthRows(items), [items]);
  const daySummaries = useMemo(() => buildDaySummaries(days, items), [days, items]);

  if (!rows.length) {
    return (
      <EmptyState
        message="План месяца пока пуст"
        hint="Сформируйте план по выбранной системе, чтобы увидеть operational-сетку по оборудованию."
      />
    );
  }

  return (
    <div className="section-card grid desktop-only" style={{ gap: "0.85rem" }}>
      <div className="grid" style={{ gap: "0.3rem" }}>
        <strong>Уровень 3. Operational-календарь по оборудованию</strong>
        <span className="text-soft">Строки показывают оборудование и помещение, а внутри дня доступны конкретные плановые работы с деталями и переносом.</span>
      </div>

      <div style={{ overflow: "auto", border: "1px solid var(--line)", borderRadius: "14px" }}>
        <table style={{ width: "100%", minWidth: `${570 + days.length * 88}px`, borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th
                style={{
                  position: "sticky",
                  top: 0,
                  left: 0,
                  zIndex: 5,
                  minWidth: "240px",
                  maxWidth: "240px",
                  background: "var(--panel)",
                  textAlign: "left",
                  padding: "0.8rem",
                  borderBottom: "1px solid var(--line)",
                  borderRight: "1px solid var(--line)",
                }}
              >
                Оборудование
              </th>
              <th
                style={{
                  position: "sticky",
                  top: 0,
                  left: 240,
                  zIndex: 5,
                  minWidth: "180px",
                  maxWidth: "180px",
                  background: "var(--panel)",
                  textAlign: "left",
                  padding: "0.8rem",
                  borderBottom: "1px solid var(--line)",
                  borderRight: "1px solid var(--line)",
                }}
              >
                Помещение
              </th>
              <th
                style={{
                  position: "sticky",
                  top: 0,
                  left: 420,
                  zIndex: 5,
                  minWidth: "150px",
                  maxWidth: "150px",
                  background: "var(--panel)",
                  textAlign: "left",
                  padding: "0.8rem",
                  borderBottom: "1px solid var(--line)",
                  borderRight: "1px solid var(--line)",
                }}
              >
                Итого
              </th>
              {days.map((day) => {
                const summary = daySummaries.get(day.isoDate) ?? { itemsCount: 0, hours: 0, hasOverdue: false, hasCarryover: false };
                const tone = getDayTone(summary);
                return (
                  <th
                    key={day.isoDate}
                    style={{
                      position: "sticky",
                      top: 0,
                      zIndex: 4,
                      minWidth: "88px",
                      background: `color-mix(in srgb, var(--${tone}) 10%, var(--panel))`,
                      textAlign: "center",
                      padding: "0.55rem 0.35rem",
                      borderBottom: "1px solid var(--line)",
                      borderRight: "1px solid var(--line)",
                    }}
                  >
                    <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>{day.dayNumber}</div>
                    <div className="text-soft" style={{ fontSize: "0.68rem" }}>
                      {summary.itemsCount ? `${summary.itemsCount} / ${formatHours(summary.hours)} ч` : "—"}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.equipmentId}>
                <td
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 3,
                    background: "var(--panel)",
                    padding: "0.75rem",
                    borderBottom: "1px solid var(--line)",
                    borderRight: "1px solid var(--line)",
                    verticalAlign: "top",
                    minWidth: "240px",
                    maxWidth: "240px",
                  }}
                >
                  <div className="grid" style={{ gap: "0.25rem" }}>
                    <strong style={{ fontSize: "0.88rem", lineHeight: 1.2 }}>{row.equipmentName}</strong>
                    <span className="text-soft" style={{ fontSize: "0.75rem" }}>
                      {row.inventoryNo}
                    </span>
                  </div>
                </td>
                <td
                  style={{
                    position: "sticky",
                    left: 240,
                    zIndex: 3,
                    background: "var(--panel)",
                    padding: "0.75rem",
                    borderBottom: "1px solid var(--line)",
                    borderRight: "1px solid var(--line)",
                    verticalAlign: "top",
                    minWidth: "180px",
                    maxWidth: "180px",
                  }}
                >
                  <span style={{ fontSize: "0.82rem", lineHeight: 1.3 }}>{row.roomName}</span>
                </td>
                <td
                  style={{
                    position: "sticky",
                    left: 420,
                    zIndex: 3,
                    background: "var(--panel)",
                    padding: "0.75rem",
                    borderBottom: "1px solid var(--line)",
                    borderRight: "1px solid var(--line)",
                    verticalAlign: "top",
                    minWidth: "150px",
                    maxWidth: "150px",
                  }}
                >
                  <div className="grid" style={{ gap: "0.2rem" }}>
                    <strong style={{ fontSize: "0.85rem" }}>{formatHours(row.hours)} ч</strong>
                    <span className="text-soft" style={{ fontSize: "0.74rem" }}>
                      {row.itemsCount} работ
                    </span>
                  </div>
                </td>
                {days.map((day) => {
                  const cellItems = row.itemsByDate.get(day.isoDate) ?? [];
                  const summary = daySummaries.get(day.isoDate) ?? { itemsCount: 0, hours: 0, hasOverdue: false, hasCarryover: false };
                  const tone = getDayTone(summary);
                  return (
                    <td
                      key={`${row.equipmentId}-${day.isoDate}`}
                      style={{
                        minWidth: "88px",
                        padding: "0.35rem",
                        verticalAlign: "top",
                        borderBottom: "1px solid var(--line)",
                        borderRight: "1px solid var(--line)",
                        background: cellItems.length ? `color-mix(in srgb, var(--${tone}) 6%, transparent)` : "transparent",
                      }}
                    >
                      {cellItems.length ? (
                        <div className="grid" style={{ gap: "0.25rem" }}>
                          {cellItems.map((item) => (
                            <WorkChip key={item.id} item={item} onOpen={onOpenItem} />
                          ))}
                        </div>
                      ) : (
                        <div className="text-soft" style={{ fontSize: "0.75rem", textAlign: "center", paddingTop: "0.25rem", opacity: 0.45 }}>
                          —
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CalendarItemDetails({
  item,
  currentMonthInput,
}: {
  item: MonthPlanItemRow;
  currentMonthInput: string;
}) {
  const task = resolveTask(item.task);
  const equipment = resolveEquipmentInfo(item.equipment);
  const template = resolveTemplate(item.template);
  const statusMeta = pprMonthPlanItemStatusMeta[item.status];
  const taskMeta = task ? pprTaskStatusMeta[task.status] : null;

  return (
    <div className="section-card" style={{ marginBottom: "1rem" }}>
      <div className="grid" style={{ gap: "0.4rem" }}>
        <div className="text-soft">
          <strong>Оборудование:</strong> {equipment.equipmentName} ({equipment.inventoryNo})
        </div>
        <div className="text-soft">
          <strong>Помещение:</strong> {equipment.roomName}
        </div>
        <div className="text-soft">
          <strong>Шаблон:</strong> {template?.name ?? "—"}
          {template?.norm_hours ? ` • ${formatHours(template.norm_hours)} ч` : ""}
        </div>
        <div className="text-soft">
          <strong>Плановая дата:</strong> {formatDate(item.planned_for)} • <strong>Исходная дата:</strong> {formatDate(item.source_due_date)}
        </div>
        <div className="text-soft">
          <strong>Месяц:</strong> {formatMonthLabel(currentMonthInput)} • <strong>Статус позиции:</strong> {statusMeta.label}
          {taskMeta ? ` • Статус задачи: ${taskMeta.label}` : ""}
        </div>
        <div className="row" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
          <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
          {item.is_carried_over ? <Badge tone="warning">Carryover</Badge> : null}
          {item.is_overdue ? <Badge tone="danger">Просрочена</Badge> : null}
          {taskMeta ? <Badge tone={taskMeta.tone}>{taskMeta.label}</Badge> : null}
        </div>
      </div>
    </div>
  );
}

export function PprCalendarAdmin({
  objects,
  systemGroups,
  systems,
  yearGroupOverview,
  yearSystemOverview,
  monthPlans,
  monthPlanItems,
  currentYear,
  currentMonthInput,
  selectedObjectId,
  selectedGroupId,
  selectedSystemId,
}: {
  objects: CalendarObjectOption[];
  systemGroups: CalendarSystemGroupOption[];
  systems: CalendarSystemOption[];
  yearGroupOverview: PprCalendarYearGroupOverviewRow[];
  yearSystemOverview: PprCalendarYearSystemOverviewRow[];
  monthPlans: MonthPlanRow[];
  monthPlanItems: MonthPlanItemRow[];
  currentYear: number;
  currentMonthInput: string;
  selectedObjectId?: string;
  selectedGroupId?: string;
  selectedSystemId?: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "month" ? "month" : "year";

  const [activeTab, setActiveTab] = useState<"year" | "month">(initialTab);
  const [monthView, setMonthView] = useState<"grid" | "list">("grid");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (tabParam === "month") {
      setActiveTab("month");
    } else if (tabParam === "year") {
      setActiveTab("year");
    }
  }, [tabParam]);

  const handleTabChange = (tab: "year" | "month") => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}` as never);
  };

  const editingItem = editingItemId ? monthPlanItems.find((item) => item.id === editingItemId) ?? null : null;
  const editingTask = resolveTask(editingItem?.task);
  const editingItemCanReschedule = editingItem ? canRescheduleFromCalendar(editingItem) : false;

  const filters: CalendarFilters = {
    year: currentYear,
    month: currentMonthInput,
    objectId: selectedObjectId,
    groupId: selectedGroupId,
    systemId: selectedSystemId,
  };

  const filteredSystems = useMemo(() => {
    if (!selectedGroupId) return systems;
    return systems.filter((system) => system.system_group_id === selectedGroupId);
  }, [selectedGroupId, systems]);

  const selectedObject = objects.find((item) => item.id === selectedObjectId);
  const selectedGroup = systemGroups.find((item) => item.id === selectedGroupId);
  const selectedSystem = systems.find((item) => item.id === selectedSystemId);

  const monthTotals = useMemo(
    () => ({
      items: monthPlanItems.length,
      overdue: monthPlanItems.filter((item) => item.is_overdue).length,
      carried: monthPlanItems.filter((item) => item.is_carried_over).length,
      materialized: monthPlanItems.filter((item) => item.task_id !== null).length,
      hours: countMonthHours(monthPlanItems),
      equipment: new Set(monthPlanItems.map((item) => item.equipment_id)).size,
    }),
    [monthPlanItems]
  );

  const yearSummary = useMemo(() => {
    const totalHours = yearGroupOverview.reduce((sum, row) => sum + row.totals.norm_hours_total, 0);
    const overdue = yearGroupOverview.reduce((sum, row) => sum + row.totals.overdue_count, 0);
    const carry = yearGroupOverview.reduce((sum, row) => sum + row.totals.carried_over_count, 0);
    const positions = yearGroupOverview.reduce((sum, row) => sum + row.totals.items_count, 0);
    return { totalHours, overdue, carry, positions };
  }, [yearGroupOverview]);

  const maxGroupHours = useMemo(
    () => Math.max(...yearGroupOverview.flatMap((row) => row.months.map((month) => month.norm_hours_total)), 1),
    [yearGroupOverview]
  );
  const maxSystemHours = useMemo(
    () => Math.max(...yearSystemOverview.flatMap((row) => row.months.map((month) => month.norm_hours_total)), 1),
    [yearSystemOverview]
  );
  const globalMaxHours = Math.max(maxGroupHours, maxSystemHours);

  if (!systems.length) {
    return (
      <EmptyState
        message="Календарь ППР пока недоступен"
        hint="Нет систем, доступных для управления календарем в рамках выбранных прав или объекта."
      />
    );
  }

  const previousMonthHref = buildCalendarHref(filters, { month: shiftPlanMonth(currentMonthInput, -1), tab: "month" });
  const nextMonthHref = buildCalendarHref(filters, { month: shiftPlanMonth(currentMonthInput, 1), tab: "month" });

  return (
    <>
      <div className="section-card sticky-toolbar" style={{ padding: "0.9rem", position: "sticky", top: "1rem", zIndex: 10 }}>
        <div className="grid" style={{ gap: "0.85rem" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="button" className={`btn ${activeTab === "year" ? "btn-accent" : "btn-ghost"}`} onClick={() => handleTabChange("year")}>
                Уровни 1-2
              </button>
              <button type="button" className={`btn ${activeTab === "month" ? "btn-accent" : "btn-ghost"}`} onClick={() => handleTabChange("month")}>
                Уровень 3
              </button>
            </div>
            <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
              <Badge tone="info">План</Badge>
              <Badge tone="warning">Carryover</Badge>
              <Badge tone="danger">Просрочка / перегруз</Badge>
              <Badge tone="violet">В задачах</Badge>
            </div>
          </div>

          <div className="row" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
            {selectedObject ? <Badge tone="neutral">Объект: {selectedObject.name}</Badge> : null}
            {selectedGroup ? <Badge tone="neutral">Группа: {selectedGroup.name}</Badge> : null}
            {selectedSystem ? <Badge tone="neutral">Система: {selectedSystem.name}</Badge> : null}
            <Badge tone={activeTab === "year" ? "info" : "violet"}>
              {activeTab === "year" ? "Обзор нагрузки" : `Operational-view • ${formatMonthLabel(currentMonthInput)}`}
            </Badge>
          </div>

          <form method="get" className="grid" style={{ gap: "0.75rem" }}>
            <input type="hidden" name="tab" value={activeTab} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
              <label className="grid" style={{ gap: "0.3rem" }}>
                <span className="text-soft" style={{ fontSize: "0.8rem" }}>
                  {activeTab === "year" ? "Год обзора" : "Месяц"}
                </span>
                {activeTab === "year" ? (
                  <input className="input" type="number" min={2024} max={2100} name="year" defaultValue={currentYear} />
                ) : (
                  <>
                    <input className="input" type="hidden" name="year" defaultValue={currentYear} />
                    <input className="input" type="month" name="month" defaultValue={currentMonthInput} />
                  </>
                )}
              </label>

              {activeTab === "year" ? <input type="hidden" name="month" value={currentMonthInput} /> : null}

              <label className="grid" style={{ gap: "0.3rem" }}>
                <span className="text-soft" style={{ fontSize: "0.8rem" }}>
                  Объект
                </span>
                <select className="select" name="object" defaultValue={selectedObjectId ?? ""}>
                  <option value="">Все объекты</option>
                  {objects.map((object) => (
                    <option key={object.id} value={object.id}>
                      {object.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid" style={{ gap: "0.3rem" }}>
                <span className="text-soft" style={{ fontSize: "0.8rem" }}>
                  Группа систем
                </span>
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
                <span className="text-soft" style={{ fontSize: "0.8rem" }}>
                  Система
                </span>
                <select className="select" name="system" defaultValue={selectedSystemId ?? ""}>
                  <option value="">Все системы</option>
                  {filteredSystems.map((system) => (
                    <option key={system.id} value={system.id}>
                      {system.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="row" style={{ gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
              <button className="btn btn-secondary" type="submit">
                Применить
              </button>
              <Link href={`/ppr/calendar?tab=${activeTab}`} className="btn btn-ghost">
                Сбросить
              </Link>
            </div>
          </form>
        </div>
      </div>

      {activeTab === "year" ? (
        <div className="grid" style={{ gap: "1rem" }}>
          <DirectorySummary
            metrics={[
              { label: "Групп в обзоре", value: yearGroupOverview.length, tone: "info" },
              { label: "Плановых позиций за год", value: yearSummary.positions, tone: "violet" },
              { label: "Суммарные нормо-часы", value: `${formatHours(yearSummary.totalHours)} ч`, tone: "info" },
              { label: "Carryover / просрочка", value: `${yearSummary.carry} / ${yearSummary.overdue}`, tone: yearSummary.overdue ? "danger" : "warning" },
            ]}
          />

          <div className="section-card grid" style={{ gap: "0.9rem" }}>
            <div className="grid" style={{ gap: "0.35rem" }}>
              <strong>Уровень 1. Годовой обзор по группам систем</strong>
              <span className="text-soft">Матрица показывает месячную нагрузку по группам. Клик по строке открывает уровень 2, клик по месяцу фиксирует нужный контекст.</span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: "1100px", borderCollapse: "separate", borderSpacing: "0 0.65rem" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0 0.75rem", color: "var(--text-soft)" }}>Группа систем</th>
                    {Array.from({ length: 12 }, (_, index) => {
                      const month = `${currentYear}-${String(index + 1).padStart(2, "0")}`;
                      return (
                        <th key={month} style={{ textAlign: "center", padding: "0 0.25rem", color: "var(--text-soft)" }}>
                          {formatMonthLabel(month, "short")}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {yearGroupOverview.map((row) => (
                    <tr key={row.system_group_id}>
                      <td style={{ padding: "0.5rem 0.75rem", verticalAlign: "middle" }}>
                        <div className="grid" style={{ gap: "0.25rem" }}>
                          <a
                            href={buildCalendarHref(filters, {
                              groupId: row.system_group_id,
                              systemId: null,
                              tab: "year",
                            })}
                            style={{ color: "inherit", textDecoration: "none", fontWeight: 700 }}
                          >
                            {row.name}
                          </a>
                          <span className="text-soft" style={{ fontSize: "0.8rem" }}>
                            {row.code} • {row.systems_count} систем • {formatHours(row.totals.norm_hours_total)} ч
                          </span>
                        </div>
                      </td>
                      {row.months.map((metrics) => (
                        <td key={`${row.system_group_id}-${metrics.month}`} style={{ padding: "0 0.25rem", height: "1px" }}>
                          <AnnualMetricCell
                            href={buildCalendarHref(filters, {
                              groupId: row.system_group_id,
                              systemId: null,
                              month: metrics.month,
                              tab: "year",
                            })}
                            metrics={metrics}
                            maxHours={globalMaxHours}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedGroupId && yearSystemOverview.length ? (
            <div className="section-card grid" style={{ gap: "0.9rem" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
                <div className="grid" style={{ gap: "0.35rem" }}>
                  <strong>Уровень 2. Годовой обзор по системам внутри группы</strong>
                  <span className="text-soft">
                    Выбрана группа: <strong>{selectedGroup?.name ?? "—"}</strong>. Здесь переход уже ведет в operational-view выбранного месяца.
                  </span>
                </div>
                <a href={buildCalendarHref(filters, { groupId: null, systemId: null, tab: "year" })} className="btn btn-ghost">
                  Сбросить группу
                </a>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: "1100px", borderCollapse: "separate", borderSpacing: "0 0.65rem" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "0 0.75rem", color: "var(--text-soft)" }}>Система</th>
                      {Array.from({ length: 12 }, (_, index) => {
                        const month = `${currentYear}-${String(index + 1).padStart(2, "0")}`;
                        return (
                          <th key={month} style={{ textAlign: "center", padding: "0 0.25rem", color: "var(--text-soft)" }}>
                            {formatMonthLabel(month, "short")}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {yearSystemOverview.map((row) => (
                      <tr key={row.system_id}>
                        <td style={{ padding: "0.5rem 0.75rem", verticalAlign: "middle" }}>
                          <div className="grid" style={{ gap: "0.25rem" }}>
                            <a
                              href={buildCalendarHref(filters, {
                                groupId: row.system_group_id,
                                systemId: row.system_id,
                                tab: "month",
                              })}
                              style={{ color: "inherit", textDecoration: "none", fontWeight: 700 }}
                            >
                              {row.name}
                            </a>
                            <span className="text-soft" style={{ fontSize: "0.8rem" }}>
                              {row.object_name} • {formatHours(row.totals.norm_hours_total)} ч
                            </span>
                          </div>
                        </td>
                        {row.months.map((metrics) => (
                          <td key={`${row.system_id}-${metrics.month}`} style={{ padding: "0 0.25rem", height: "1px" }}>
                            <AnnualMetricCell
                              href={buildCalendarHref(filters, {
                                groupId: row.system_group_id,
                                systemId: row.system_id,
                                month: metrics.month,
                                tab: "month",
                              })}
                              metrics={metrics}
                              maxHours={globalMaxHours}
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
        </div>
      ) : (
        <div className="grid" style={{ gap: "1rem" }}>
          <div className="section-card grid" style={{ gap: "0.9rem" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
              <div className="grid" style={{ gap: "0.35rem" }}>
                <strong>Operational-view месяца</strong>
                <span className="text-soft">
                  {selectedObject ? <>Объект: <strong>{selectedObject.name}</strong> • </> : null}
                  {selectedGroup ? <>Группа: <strong>{selectedGroup.name}</strong> • </> : null}
                  {selectedSystem ? <>Система: <strong>{selectedSystem.name}</strong> • </> : <>Выберите систему на уровне 2</>}
                  Месяц: <strong>{formatMonthLabel(currentMonthInput)}</strong>
                </span>
              </div>

              <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                <a href={previousMonthHref} className="btn btn-ghost">
                  ← Пред. месяц
                </a>
                <a href={nextMonthHref} className="btn btn-ghost">
                  След. месяц →
                </a>
                <div className="row desktop-only" style={{ gap: "0.35rem", background: "var(--panel-soft)", padding: "0.25rem", borderRadius: "10px" }}>
                  <button type="button" className={`btn ${monthView === "grid" ? "btn-secondary" : "btn-ghost"}`} onClick={() => setMonthView("grid")}>
                    Сетка
                  </button>
                  <button type="button" className={`btn ${monthView === "list" ? "btn-secondary" : "btn-ghost"}`} onClick={() => setMonthView("list")}>
                    Список
                  </button>
                </div>
              </div>
            </div>

            <DirectorySummary
              metrics={[
                { label: "Работ в месяце", value: monthTotals.items, tone: "info" },
                { label: "Нормо-часы", value: `${formatHours(monthTotals.hours)} ч`, tone: monthTotals.hours > 160 ? "danger" : "violet" },
                { label: "Единиц оборудования", value: monthTotals.equipment, tone: "neutral" },
                { label: "В задачах / carry", value: `${monthTotals.materialized} / ${monthTotals.carried}`, tone: monthTotals.carried ? "warning" : "violet" },
              ]}
            />

            <div className="row" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
              <Badge tone="info">Синий: плановая позиция</Badge>
              <Badge tone="warning">Желтый: carryover / внимание</Badge>
              <Badge tone="danger">Красный: просрочка или перегруз дня</Badge>
              <Badge tone="violet">Фиолетовый: materialized слой</Badge>
            </div>
          </div>

          <div className="section-card grid" style={{ gap: "0.85rem" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
              <div className="grid" style={{ gap: "0.35rem" }}>
                <strong>Действия месяца</strong>
                <span className="text-soft">Генерация плана не изменилась: UI только аккуратнее подает уже существующие операции и результаты.</span>
              </div>
              <a href={buildCalendarHref(filters, { tab: "year" })} className="btn btn-ghost">
                Вернуться к обзору
              </a>
            </div>

            <form action={generatePprMonthPlanAction} className="row" style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
              <label className="grid" style={{ gap: "0.3rem", minWidth: "280px" }}>
                <span className="text-soft">Система для генерации</span>
                <select className="select" name="system_id" required defaultValue={selectedSystemId ?? ""}>
                  <option value="" disabled>
                    Выберите систему
                  </option>
                  {filteredSystems.map((system) => (
                    <option key={system.id} value={system.id}>
                      {system.name}
                    </option>
                  ))}
                </select>
              </label>
              <input type="hidden" name="plan_month" value={currentMonthInput} />
              <button className="btn btn-accent" type="submit">
                Сформировать месяц
              </button>
            </form>

            {monthPlans.length ? (
              <div className="grid" style={{ gap: "0.5rem" }}>
                <strong style={{ fontSize: "0.88rem" }}>Сформированные планы</strong>
                <div className="grid" style={{ gap: "0.45rem" }}>
                  {monthPlans.map((plan) => (
                    <div key={plan.id} style={{ padding: "0.6rem 0.75rem", borderRadius: "10px", background: "var(--panel-soft)", border: "1px solid var(--line)" }}>
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                        <div className="grid" style={{ gap: "0.2rem" }}>
                          <strong style={{ fontSize: "0.88rem" }}>{resolveName(plan.system)}</strong>
                          <span className="text-soft" style={{ fontSize: "0.75rem" }}>
                            {resolveName(plan.object)} • сформирован {new Date(plan.generated_at).toLocaleString("ru-RU")}
                          </span>
                        </div>
                        <Badge tone="info">{formatMonthLabel(plan.plan_month)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <span className="text-soft" style={{ fontSize: "0.85rem" }}>
                Для выбранного месяца планы еще не сформированы.
              </span>
            )}
          </div>

          {!selectedSystem ? (
            <EmptyState
              message="Для monthly view нужно выбрать систему"
              hint="Провалитесь из уровня 2 по нужному месяцу или выберите систему через фильтр сверху."
            />
          ) : monthView === "grid" ? (
            <OperationalMonthGrid month={currentMonthInput} items={monthPlanItems} onOpenItem={setEditingItemId} />
          ) : (
            <div className="desktop-only">
              <DataTable
                columns={[
                  { key: "equipment", label: "Оборудование" },
                  { key: "room", label: "Помещение" },
                  { key: "template", label: "Работа" },
                  { key: "planned", label: "План" },
                  { key: "source", label: "Исходно" },
                  { key: "status", label: "Статус" },
                  { key: "actions", label: "Действия" },
                ]}
              >
                {monthPlanItems.map((item) => {
                  const equipment = resolveEquipmentInfo(item.equipment);
                  const template = resolveTemplate(item.template);
                  const task = resolveTask(item.task);
                  const statusMeta = pprMonthPlanItemStatusMeta[item.status];
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="grid" style={{ gap: "0.2rem" }}>
                          <strong>{equipment.equipmentName}</strong>
                          <span className="text-soft">{equipment.inventoryNo}</span>
                        </div>
                      </td>
                      <td>{equipment.roomName}</td>
                      <td>
                        {template?.name ?? "—"}
                        {template?.norm_hours ? <div className="text-soft">{formatHours(template.norm_hours)} ч</div> : null}
                      </td>
                      <td>{formatDate(item.planned_for)}</td>
                      <td>{formatDate(item.source_due_date)}</td>
                      <td>
                        <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                          <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                          {task ? <Badge tone={pprTaskStatusMeta[task.status].tone}>{pprTaskStatusMeta[task.status].label}</Badge> : null}
                        </div>
                      </td>
                      <td>
                        <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingItemId(item.id)}>
                          Открыть
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            </div>
          )}

          <div className="mobile-cards mobile-only">
            {monthPlanItems.map((item) => {
              const equipment = resolveEquipmentInfo(item.equipment);
              const template = resolveTemplate(item.template);
              const task = resolveTask(item.task);
              const statusMeta = pprMonthPlanItemStatusMeta[item.status];
              return (
                <div key={item.id} className="section-card mobile-card">
                  <div className="grid" style={{ gap: "0.45rem" }}>
                    <div style={{ fontWeight: 700 }}>{equipment.equipmentName}</div>
                    <div className="text-soft">Инвентарный: {equipment.inventoryNo}</div>
                    <div className="text-soft">Помещение: {equipment.roomName}</div>
                    <div className="text-soft">
                      Работа: {template?.name ?? "—"}
                      {template?.norm_hours ? ` • ${formatHours(template.norm_hours)} ч` : ""}
                    </div>
                    <div className="text-soft">План: {formatDate(item.planned_for)}</div>
                    <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                      {task ? <Badge tone={pprTaskStatusMeta[task.status].tone}>{pprTaskStatusMeta[task.status].label}</Badge> : null}
                    </div>
                    <button className="btn btn-ghost" type="button" onClick={() => setEditingItemId(item.id)}>
                      Открыть детали
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <PprModal
        open={Boolean(editingItem)}
        onClose={() => {
          setEditingItemId(null);
          setIsDirty(false);
        }}
        title={
          editingTask
            ? editingItemCanReschedule
              ? "Materialized заявка: детали и перенос"
              : "Materialized заявка: только просмотр"
            : editingItemCanReschedule
              ? "Позиция month plan: детали и перенос"
              : "Позиция month plan: только просмотр"
        }
        isDirty={isDirty}
      >
        {editingItem ? (
          editingItemCanReschedule ? (
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
                <CalendarItemDetails item={editingItem} currentMonthInput={currentMonthInput} />

                <PprFormGroup label="Новая плановая дата">
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

                <div className="text-soft" style={{ fontSize: "0.84rem" }}>
                  Перенос из календаря доступен только внутри выбранного месяца. До materialization меняется `ppr_month_plan_item`, после materialization - связанная `ppr_task` с синхронизацией даты обратно.
                </div>
              </div>

              <div className="ppr-modal-footer">
                <button className="btn btn-accent" type="submit">
                  Сохранить
                </button>
              </div>
            </form>
          ) : (
            <div className="ppr-modal-content">
              <div className="ppr-modal-body grid">
                <CalendarItemDetails item={editingItem} currentMonthInput={currentMonthInput} />
                <div className="text-soft" style={{ fontSize: "0.84rem" }}>
                  Перенос недоступен для текущего статуса. Здесь можно быстро посмотреть детали позиции и связанной задачи.
                </div>
              </div>
            </div>
          )
        ) : null}
      </PprModal>
    </>
  );
}
