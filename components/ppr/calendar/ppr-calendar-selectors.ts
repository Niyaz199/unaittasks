"use client";

import type {
  BadgeTone,
  CalendarFilters,
  DaySummary,
  EquipmentMonthRow,
  EquipmentRelation,
  FilterPatch,
  MonthDay,
  MonthPlanItemRow,
  MonthPlanTaskRelation,
  RoomRelation,
} from "./types";

export function resolveRelation<T>(raw: T | Array<T> | null | undefined) {
  return Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);
}

export function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  return resolveRelation(raw)?.name ?? "—";
}

export function resolveTemplate(
  raw: { name: string; norm_hours: number | null } | Array<{ name: string; norm_hours: number | null }> | null | undefined
) {
  return resolveRelation(raw);
}

export function resolveTask(raw: MonthPlanTaskRelation | undefined) {
  return resolveRelation(raw);
}

export function resolveEquipmentInfo(raw: EquipmentRelation | Array<EquipmentRelation> | null | undefined) {
  const equipment = resolveRelation(raw);
  const room = resolveRelation(equipment?.room as RoomRelation | Array<RoomRelation> | null | undefined);
  const inventoryNo = equipment?.inventory_no?.trim() || "без инв.";
  const floorRelation = resolveRelation(room?.floor_ref);
  return {
    equipmentName: equipment?.name ?? "—",
    inventoryNo,
    roomName: room?.name ?? "—",
    roomFloor: floorRelation?.name ?? room?.floor ?? null,
  };
}

function parseMonthValue(value: string) {
  const normalized = value.trim();
  const parsed = /^\d{4}-\d{2}$/.test(normalized)
    ? new Date(`${normalized}-01T00:00:00.000Z`)
    : /^\d{4}-\d{2}-\d{2}$/.test(normalized)
      ? new Date(`${normalized}T00:00:00.000Z`)
      : new Date(Number.NaN);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatMonthLabel(value: string, monthFormat: "long" | "short" = "long") {
  const parsed = parseMonthValue(value);
  if (!parsed) {
    return "—";
  }
  return parsed.toLocaleDateString("ru-RU", {
    month: monthFormat,
    timeZone: "UTC",
    year: monthFormat === "long" ? "numeric" : undefined,
  });
}

export function formatDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("ru-RU");
}

export function formatHours(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(value);
}

export function buildCalendarHref(current: CalendarFilters, patch: FilterPatch = {}) {
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

export function canRescheduleFromCalendar(item: MonthPlanItemRow) {
  const task = resolveTask(item.task);
  if (!task) {
    return item.status === "pending" || item.status === "carried_over";
  }
  return task.status === "new" || task.status === "in_progress";
}

export function monthMetricTone(metrics: { items_count: number; norm_hours_total?: number }) {
  if (!metrics.items_count) return "neutral" as const;
  if ((metrics.norm_hours_total ?? 0) > 24) return "violet" as const;
  return "info" as const;
}

export function getDayTone(summary: DaySummary): BadgeTone {
  if (!summary.itemsCount) return "neutral";
  if (summary.hours > 8) return "violet";
  if (summary.hours > 4) return "violet";
  return "info";
}

export function buildMonthDays(month: string) {
  const [yearValue, monthValue] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(yearValue, monthValue, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, index) => {
    const dayNumber = index + 1;
    const date = new Date(Date.UTC(yearValue, monthValue - 1, dayNumber));
    const dayOfWeek = date.getUTCDay();
    return {
      isoDate: `${month}-${String(dayNumber).padStart(2, "0")}`,
      dayNumber,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
    };
  });
}

export function buildDaySummaries(days: MonthDay[], items: MonthPlanItemRow[]) {
  const summaryMap = new Map<string, DaySummary>();

  for (const day of days) {
    summaryMap.set(day.isoDate, {
      itemsCount: 0,
      hours: 0,
      hasOverdue: false,
      hasCarryover: false,
    });
  }

  for (const item of items) {
    const current = summaryMap.get(item.planned_for);
    if (!current) continue;
    current.itemsCount += 1;
    current.hours += resolveTemplate(item.template)?.norm_hours ?? 0;
    current.hasOverdue ||= item.is_overdue;
    current.hasCarryover ||= item.is_carried_over;
  }

  return summaryMap;
}

export function countMonthHours(items: MonthPlanItemRow[]) {
  return items.reduce((sum, item) => sum + (resolveTemplate(item.template)?.norm_hours ?? 0), 0);
}

export function buildEquipmentMonthRows(items: MonthPlanItemRow[]) {
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

export function shiftPlanMonth(month: string, delta: number) {
  const [yearValue, monthValue] = month.split("-").map(Number);
  const date = new Date(Date.UTC(yearValue, monthValue - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function moveItemToDate(items: MonthPlanItemRow[], itemId: string, targetDate: string) {
  return items.map((item) =>
    item.id === itemId ? { ...item, planned_for: targetDate, is_overdue: targetDate < new Date().toISOString().slice(0, 10) } : item
  );
}
