"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

type MonthlyNotice = {
  tone: BadgeTone;
  message: string;
};

type DragState = {
  itemId: string;
  equipmentId: string;
  sourceDate: string;
  canReschedule: boolean;
};

type HoverCell = {
  equipmentId: string;
  isoDate: string;
  valid: boolean;
};

type PendingMaterializedMove = {
  itemId: string;
  targetDate: string;
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

function monthMetricTone(metrics: { items_count: number; norm_hours_total?: number }) {
  if (!metrics.items_count) return "neutral" as const;
  if ((metrics.norm_hours_total ?? 0) > 24) return "violet" as const;
  return "info" as const;
}

function getDayTone(summary: DaySummary): BadgeTone {
  if (!summary.itemsCount) return "neutral";
  if (summary.hours > 8) return "violet";
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

function moveItemToDate(items: MonthPlanItemRow[], itemId: string, targetDate: string) {
  return items.map((item) => (item.id === itemId ? { ...item, planned_for: targetDate, is_overdue: targetDate < new Date().toISOString().slice(0, 10) } : item));
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
  const opacityPercent = Math.round(6 + intensity * 22);

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
        gap: "0.15rem",
        padding: "0.55rem 0.6rem",
        borderRadius: "8px",
        border: `1px solid ${isEmpty ? "var(--line)" : `color-mix(in srgb, var(--${tone}) 20%, var(--line))`}`,
        background: isEmpty ? "var(--panel)" : `color-mix(in srgb, var(--${tone}) ${opacityPercent}%, var(--panel))`,
        color: "inherit",
        textDecoration: "none",
        minHeight: "68px",
        alignContent: "center",
      }}
    >
      {isEmpty ? (
        <span style={{ fontSize: "0.95rem", fontWeight: 700, textAlign: "center", opacity: 0.55 }}>—</span>
      ) : (
        <>
          <span style={{ fontSize: "0.98rem", fontWeight: 700, textAlign: "center", lineHeight: 1.1 }}>
            {formatHours(metrics.norm_hours_total)} ч
          </span>
          <span className="text-soft" style={{ fontSize: "0.7rem", textAlign: "center", lineHeight: 1.05 }}>
            {metrics.items_count} поз.
          </span>
        </>
      )}
    </a>
  );
}

function DraggableWorkChip({
  item,
  isDragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  item: MonthPlanItemRow;
  isDragging: boolean;
  onOpen: (id: string) => void;
  onDragStart: (item: MonthPlanItemRow) => void;
  onDragEnd: () => void;
}) {
  const template = resolveTemplate(item.template);
  const task = resolveTask(item.task);
  const canReschedule = canRescheduleFromCalendar(item);
  const hoursLabel = template?.norm_hours ? `${formatHours(template.norm_hours)} ч` : "—";
  const statusLabel = task ? pprTaskStatusMeta[task.status].label : pprMonthPlanItemStatusMeta[item.status].label;

  return (
    <button
      type="button"
      draggable={canReschedule}
      onClick={() => onOpen(item.id)}
      onDragStart={(event) => {
        if (!canReschedule) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", item.id);
        onDragStart(item);
      }}
      onDragEnd={onDragEnd}
      title={[
        template?.name ?? "Работа",
        `Часы: ${hoursLabel}`,
        `Статус: ${statusLabel}`,
        `План: ${formatDate(item.planned_for)}`,
        canReschedule ? "Перетащите на другой день месяца" : "Перенос недоступен для текущего статуса",
      ].join("\n")}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "0",
        padding: "0.2rem 0.35rem",
        borderRadius: "999px",
        border: "1px solid color-mix(in srgb, var(--line) 80%, transparent)",
        background: isDragging ? "color-mix(in srgb, var(--info) 12%, var(--panel))" : "color-mix(in srgb, var(--panel-soft) 55%, var(--panel))",
        color: "inherit",
        textAlign: "center",
        cursor: canReschedule ? (isDragging ? "grabbing" : "grab") : "pointer",
        opacity: isDragging ? 0.45 : 1,
        boxShadow: canReschedule ? "0 1px 0 color-mix(in srgb, var(--line) 30%, transparent)" : "none",
        fontSize: "0.67rem",
        fontWeight: 700,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
      }}
    >
      {hoursLabel}
    </button>
  );
}

function MonthlyCompactSummary({
  totals,
  selectedObject,
  selectedGroup,
  selectedSystem,
  currentMonthInput,
  previousMonthHref,
  nextMonthHref,
  monthView,
  onMonthViewChange,
}: {
  totals: { items: number; overdue: number; carried: number; materialized: number; hours: number; equipment: number };
  selectedObject?: { name: string };
  selectedGroup?: { name: string };
  selectedSystem?: { name: string };
  currentMonthInput: string;
  previousMonthHref: string;
  nextMonthHref: string;
  monthView: "grid" | "list";
  onMonthViewChange: (view: "grid" | "list") => void;
}) {
  return (
    <div className="section-card grid" style={{ gap: "0.8rem", padding: "0.85rem" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
        <div className="grid" style={{ gap: "0.25rem" }}>
          <strong>План месяца</strong>
          <span className="text-soft">
            {selectedObject ? <>Объект: <strong>{selectedObject.name}</strong> • </> : null}
            {selectedGroup ? <>Группа: <strong>{selectedGroup.name}</strong> • </> : null}
            {selectedSystem ? <>Система: <strong>{selectedSystem.name}</strong> • </> : null}
            Месяц: <strong>{formatMonthLabel(currentMonthInput)}</strong>
          </span>
        </div>

        <div className="row" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
          <a href={previousMonthHref} className="btn btn-ghost">
            ← Пред. месяц
          </a>
          <a href={nextMonthHref} className="btn btn-ghost">
            След. месяц →
          </a>
          <div className="row desktop-only" style={{ gap: "0.25rem", background: "var(--panel-soft)", padding: "0.2rem", borderRadius: "10px" }}>
            <button type="button" className={`btn ${monthView === "grid" ? "btn-secondary" : "btn-ghost"}`} onClick={() => onMonthViewChange("grid")}>
              Сетка
            </button>
            <button type="button" className={`btn ${monthView === "list" ? "btn-secondary" : "btn-ghost"}`} onClick={() => onMonthViewChange("list")}>
              Список
            </button>
          </div>
        </div>
      </div>

      <div className="row" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
        <Badge tone="info">Работ: {totals.items}</Badge>
        <Badge tone="violet">Часы: {formatHours(totals.hours)}</Badge>
        <Badge tone="neutral">Оборудование: {totals.equipment}</Badge>
      </div>
    </div>
  );
}

function MonthlyNoticeBar({ notice }: { notice: MonthlyNotice | null }) {
  if (!notice) return null;
  return (
    <div
      className="section-card"
      style={{
        padding: "0.7rem 0.85rem",
        border: `1px solid color-mix(in srgb, var(--${notice.tone}) 35%, var(--line))`,
        background: `color-mix(in srgb, var(--${notice.tone}) 12%, var(--panel))`,
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.86rem" }}>{notice.message}</span>
        <Badge tone={notice.tone}>
          {notice.tone === "success" ? "Готово" : notice.tone === "danger" ? "Ошибка" : notice.tone === "warning" ? "Внимание" : "Статус"}
        </Badge>
      </div>
    </div>
  );
}

function MonthlySecondaryTools({
  monthPlans,
  currentMonthInput,
  filteredSystems,
  selectedSystemId,
}: {
  monthPlans: MonthPlanRow[];
  currentMonthInput: string;
  filteredSystems: CalendarSystemOption[];
  selectedSystemId?: string;
}) {
  return (
    <details className="section-card" style={{ padding: "0.85rem" }}>
      <summary style={{ cursor: "pointer", fontWeight: 600, userSelect: "none" }}>Служебные действия месяца</summary>
      <div className="grid" style={{ gap: "0.85rem", marginTop: "0.85rem" }}>
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
          <div className="grid" style={{ gap: "0.45rem" }}>
            <strong style={{ fontSize: "0.88rem" }}>Сформированные планы</strong>
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
        ) : (
          <span className="text-soft" style={{ fontSize: "0.85rem" }}>
            Для выбранного месяца планы еще не сформированы.
          </span>
        )}
      </div>
    </details>
  );
}

function MonthlyDnDGrid({
  month,
  items,
  onOpenItem,
  onRequestMove,
  isSubmitting,
}: {
  month: string;
  items: MonthPlanItemRow[];
  onOpenItem: (id: string) => void;
  onRequestMove: (item: MonthPlanItemRow, targetDate: string) => void;
  isSubmitting: boolean;
}) {
  const days = useMemo(() => buildMonthDays(month), [month]);
  const rows = useMemo(() => buildEquipmentMonthRows(items), [items]);
  const daySummaries = useMemo(() => buildDaySummaries(days, items), [days, items]);
  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item] as const)), [items]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoverCell, setHoverCell] = useState<HoverCell | null>(null);

  const clearDragState = () => {
    setDragState(null);
    setHoverCell(null);
  };

  if (!rows.length) {
    return <EmptyState message="План месяца пока пуст" hint="Сформируйте план по выбранной системе, чтобы увидеть operational-сетку по оборудованию." />;
  }

  return (
    <div className="section-card grid desktop-only" style={{ gap: "0.7rem", padding: "0.75rem" }}>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <div className="grid" style={{ gap: "0.2rem" }}>
          <strong>Планировочная сетка месяца</strong>
          <span className="text-soft">Перетащите работу на другой день той же строки оборудования. Допустимые drop-зоны подсвечиваются автоматически.</span>
        </div>
        <span className="text-soft" style={{ fontSize: "0.78rem" }}>Главный акцент: работы, часы и перенос. Статусы вынесены в детали.</span>
      </div>

      <div style={{ overflow: "auto", border: "1px solid var(--line)", borderRadius: "14px" }}>
        <table style={{ width: "100%", minWidth: `${280 + days.length * 64}px`, borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr>
              <th
                style={{
                  position: "sticky",
                  top: 0,
                  left: 0,
                  zIndex: 5,
                  minWidth: "280px",
                  maxWidth: "280px",
                  background: "var(--panel)",
                  textAlign: "left",
                  padding: "0.75rem",
                  borderBottom: "1px solid var(--line)",
                  borderRight: "1px solid var(--line)",
                }}
              >
                Оборудование / помещение
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
                      minWidth: "64px",
                      background: `color-mix(in srgb, var(--${tone}) 6%, var(--panel))`,
                      textAlign: "center",
                      padding: "0.35rem 0.2rem",
                      borderBottom: "1px solid var(--line)",
                      borderRight: "1px solid var(--line)",
                    }}
                  >
                    <div style={{ fontSize: "0.84rem", fontWeight: 700 }}>{day.dayNumber}</div>
                    <div className="text-soft" style={{ fontSize: "0.64rem" }}>
                      {summary.itemsCount ? `${summary.itemsCount}` : "—"}
                    </div>
                    <div className="text-soft" style={{ fontSize: "0.62rem" }}>
                      {summary.itemsCount ? `${formatHours(summary.hours)} ч` : ""}
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
                    background: dragState?.equipmentId === row.equipmentId ? "color-mix(in srgb, var(--info) 5%, var(--panel))" : "var(--panel)",
                    padding: "0.7rem",
                    borderBottom: "1px solid var(--line)",
                    borderRight: "1px solid var(--line)",
                    verticalAlign: "top",
                    minWidth: "280px",
                    maxWidth: "280px",
                  }}
                >
                  <div className="grid" style={{ gap: "0.22rem" }}>
                    <strong style={{ fontSize: "0.86rem", lineHeight: 1.2 }}>{row.equipmentName}</strong>
                    <span className="text-soft" style={{ fontSize: "0.74rem" }}>{row.inventoryNo}</span>
                    <span className="text-soft" style={{ fontSize: "0.74rem" }}>{row.roomName}</span>
                    <span className="text-soft" style={{ fontSize: "0.74rem" }}>{row.itemsCount} работ • {formatHours(row.hours)} ч</span>
                  </div>
                </td>
                {days.map((day) => {
                  const cellItems = row.itemsByDate.get(day.isoDate) ?? [];
                  const summary = daySummaries.get(day.isoDate) ?? { itemsCount: 0, hours: 0, hasOverdue: false, hasCarryover: false };
                  const tone = getDayTone(summary);
                  const isValidTarget = dragState
                    ? dragState.canReschedule && dragState.equipmentId === row.equipmentId && dragState.sourceDate !== day.isoDate
                    : false;
                  const isHovered = hoverCell?.equipmentId === row.equipmentId && hoverCell.isoDate === day.isoDate;
                  const isSourceCell = dragState?.equipmentId === row.equipmentId && dragState.sourceDate === day.isoDate;
                  const hoveredInvalid = isHovered && hoverCell && !hoverCell.valid;
                  const background = hoveredInvalid
                    ? "color-mix(in srgb, var(--danger) 14%, var(--panel))"
                    : isHovered && isValidTarget
                      ? "color-mix(in srgb, var(--warning) 16%, var(--panel))"
                      : isSourceCell
                        ? "color-mix(in srgb, var(--info) 6%, var(--panel))"
                        : cellItems.length
                          ? `color-mix(in srgb, var(--${tone}) 3%, transparent)`
                          : "transparent";

                  return (
                    <td
                      key={`${row.equipmentId}-${day.isoDate}`}
                      onDragOver={(event) => {
                        if (!dragState) return;
                        const draggedItem = itemsById.get(dragState.itemId);
                        const isValid = Boolean(draggedItem) && isValidTarget;
                        if (isValid) {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                        }
                        setHoverCell({ equipmentId: row.equipmentId, isoDate: day.isoDate, valid: isValid });
                      }}
                      onDragLeave={() => {
                        setHoverCell((current) => {
                          if (!current) return current;
                          return current.equipmentId === row.equipmentId && current.isoDate === day.isoDate ? null : current;
                        });
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const draggedItem = dragState ? itemsById.get(dragState.itemId) : null;
                        if (!draggedItem || !isValidTarget || isSubmitting) {
                          clearDragState();
                          return;
                        }
                        onRequestMove(draggedItem, day.isoDate);
                        clearDragState();
                      }}
                      style={{
                        minWidth: "64px",
                        padding: "0.18rem",
                        verticalAlign: "top",
                        borderBottom: "1px solid var(--line)",
                        borderRight: "1px solid var(--line)",
                        background,
                        outline: isHovered ? `2px solid ${hoverCell?.valid ? "var(--warning)" : "var(--danger)"}` : isValidTarget ? "1px dashed var(--warning)" : "none",
                        outlineOffset: "-2px",
                        opacity: isSubmitting ? 0.7 : 1,
                      }}
                    >
                      {cellItems.length ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.18rem", alignContent: "flex-start" }}>
                          {cellItems.map((item) => (
                            <DraggableWorkChip
                              key={item.id}
                              item={item}
                              isDragging={dragState?.itemId === item.id}
                              onOpen={onOpenItem}
                              onDragStart={(draggedItem) =>
                                setDragState({
                                  itemId: draggedItem.id,
                                  equipmentId: draggedItem.equipment_id,
                                  sourceDate: draggedItem.planned_for,
                                  canReschedule: canRescheduleFromCalendar(draggedItem),
                                })
                              }
                              onDragEnd={clearDragState}
                            />
                          ))}
                        </div>
                      ) : (
                        <span
                          className="text-soft"
                          style={{
                            display: "grid",
                            minHeight: "20px",
                            placeItems: "center",
                            fontSize: "0.68rem",
                            opacity: dragState && dragState.equipmentId === row.equipmentId && dragState.sourceDate !== day.isoDate ? 0.65 : 0.35,
                          }}
                        >
                          —
                        </span>
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
  const [localMonthItems, setLocalMonthItems] = useState(monthPlanItems);
  const [monthlyNotice, setMonthlyNotice] = useState<MonthlyNotice | null>(null);
  const [pendingMaterializedMove, setPendingMaterializedMove] = useState<PendingMaterializedMove | null>(null);
  const [materializedReason, setMaterializedReason] = useState("");
  const [isSubmitting, startSubmitting] = useTransition();

  useEffect(() => {
    if (tabParam === "month") {
      setActiveTab("month");
    } else if (tabParam === "year") {
      setActiveTab("year");
    }
  }, [tabParam]);

  useEffect(() => {
    setLocalMonthItems(monthPlanItems);
  }, [monthPlanItems]);

  const handleTabChange = (tab: "year" | "month") => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}` as never);
  };

  const editingItem = editingItemId ? localMonthItems.find((item) => item.id === editingItemId) ?? null : null;
  const editingTask = resolveTask(editingItem?.task);
  const editingItemCanReschedule = editingItem ? canRescheduleFromCalendar(editingItem) : false;
  const pendingMaterializedItem = pendingMaterializedMove
    ? localMonthItems.find((item) => item.id === pendingMaterializedMove.itemId) ?? null
    : null;

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
  const yearScreen: "groups" | "systems" = selectedGroupId ? "systems" : "groups";

  const monthTotals = useMemo(
    () => ({
      items: localMonthItems.length,
      overdue: localMonthItems.filter((item) => item.is_overdue).length,
      carried: localMonthItems.filter((item) => item.is_carried_over).length,
      materialized: localMonthItems.filter((item) => item.task_id !== null).length,
      hours: countMonthHours(localMonthItems),
      equipment: new Set(localMonthItems.map((item) => item.equipment_id)).size,
    }),
    [localMonthItems]
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
    return <EmptyState message="Календарь ППР пока недоступен" hint="Нет систем, доступных для управления календарем в рамках выбранных прав или объекта." />;
  }

  const previousMonthHref = buildCalendarHref(filters, { month: shiftPlanMonth(currentMonthInput, -1), tab: "month" });
  const nextMonthHref = buildCalendarHref(filters, { month: shiftPlanMonth(currentMonthInput, 1), tab: "month" });
  const backToGroupsHref = buildCalendarHref(filters, { groupId: null, systemId: null, tab: "year" });

  const submitReschedule = (item: MonthPlanItemRow, targetDate: string, reason?: string) => {
    const snapshot = localMonthItems;
    setLocalMonthItems((current) => moveItemToDate(current, item.id, targetDate));
    setMonthlyNotice({ tone: "info", message: `Переносим "${resolveTemplate(item.template)?.name ?? "работу"}" на ${formatDate(targetDate)}...` });

    startSubmitting(async () => {
      try {
        const formData = new FormData();
        formData.set("item_id", item.id);
        formData.set("planned_for", targetDate);
        if (reason) {
          formData.set("reason", reason);
        }
        await reschedulePprMonthPlanItemAction(formData);
        setMonthlyNotice({ tone: "success", message: `Работа перенесена на ${formatDate(targetDate)}.` });
        router.refresh();
      } catch (error) {
        setLocalMonthItems(snapshot);
        setMonthlyNotice({
          tone: "danger",
          message: error instanceof Error ? error.message : "Не удалось перенести работу. Проверьте правила переноса и повторите.",
        });
      }
    });
  };

  const handleMoveRequest = (item: MonthPlanItemRow, targetDate: string) => {
    if (item.planned_for === targetDate || isSubmitting) {
      return;
    }
    if (item.task_id) {
      setPendingMaterializedMove({ itemId: item.id, targetDate });
      setMaterializedReason("");
      setMonthlyNotice({
        tone: "warning",
        message: `Выбрана новая дата ${formatDate(targetDate)}. Для materialized заявки нужно подтвердить перенос и указать причину.`,
      });
      return;
    }
    submitReschedule(item, targetDate);
  };

  const handleMaterializedConfirm = () => {
    if (!pendingMaterializedItem || !pendingMaterializedMove) return;
    submitReschedule(pendingMaterializedItem, pendingMaterializedMove.targetDate, materializedReason);
    setPendingMaterializedMove(null);
    setMaterializedReason("");
  };

  return (
    <>
      <div className="section-card sticky-toolbar" style={{ padding: activeTab === "month" ? "0.75rem" : "0.7rem", position: "sticky", top: "1rem", zIndex: 10 }}>
        <div className="grid" style={{ gap: activeTab === "month" ? "0.65rem" : "0.6rem" }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <button type="button" className={`btn ${activeTab === "year" ? "btn-accent" : "btn-ghost"}`} onClick={() => handleTabChange("year")}>
                Уровни 1-2
              </button>
              <button type="button" className={`btn ${activeTab === "month" ? "btn-accent" : "btn-ghost"}`} onClick={() => handleTabChange("month")}>
                Уровень 3
              </button>
            </div>
            {activeTab === "year" ? (
              <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                <Badge tone="info">Годовой обзор</Badge>
                <Badge tone={yearScreen === "groups" ? "info" : "neutral"}>
                  {yearScreen === "groups" ? "Уровень 1: группы" : "Уровень 2: системы"}
                </Badge>
              </div>
            ) : (
              <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
                {selectedObject ? <Badge tone="neutral">{selectedObject.name}</Badge> : null}
                {selectedGroup ? <Badge tone="neutral">{selectedGroup.name}</Badge> : null}
                {selectedSystem ? <Badge tone="violet">{selectedSystem.name}</Badge> : null}
              </div>
            )}
          </div>

          {activeTab === "year" ? (
            <>
              <div className="row" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
                {selectedObject ? <Badge tone="neutral">Объект: {selectedObject.name}</Badge> : null}
                {selectedGroup ? <Badge tone="neutral">Группа: {selectedGroup.name}</Badge> : null}
                <Badge tone="neutral">Часы + позиции</Badge>
              </div>

              <form method="get" className="grid" style={{ gap: "0.75rem" }}>
                <input type="hidden" name="tab" value={activeTab} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.55rem" }}>
                  <label className="grid" style={{ gap: "0.3rem" }}>
                    <span className="text-soft" style={{ fontSize: "0.8rem" }}>Год обзора</span>
                    <input className="input" type="number" min={2024} max={2100} name="year" defaultValue={currentYear} />
                  </label>
                  <input type="hidden" name="month" value={currentMonthInput} />

                  <label className="grid" style={{ gap: "0.3rem" }}>
                    <span className="text-soft" style={{ fontSize: "0.8rem" }}>Объект</span>
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
                    <span className="text-soft" style={{ fontSize: "0.8rem" }}>Группа систем</span>
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
                    <span className="text-soft" style={{ fontSize: "0.8rem" }}>Система</span>
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
                  <button className="btn btn-secondary" type="submit" style={{ paddingInline: "0.85rem" }}>
                    Применить
                  </button>
                  <a href={`/ppr/calendar?tab=${activeTab}`} className="btn btn-ghost">
                    Сбросить
                  </a>
                </div>
              </form>
            </>
          ) : (
            <details>
              <summary style={{ cursor: "pointer", fontSize: "0.82rem", color: "var(--text-soft)" }}>Показать фильтры и контекст выбора</summary>
              <form method="get" className="grid" style={{ gap: "0.75rem", marginTop: "0.7rem" }}>
                <input type="hidden" name="tab" value={activeTab} />
                <input type="hidden" name="year" value={currentYear} />
                <input type="hidden" name="month" value={currentMonthInput} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.75rem" }}>
                  <label className="grid" style={{ gap: "0.3rem" }}>
                    <span className="text-soft" style={{ fontSize: "0.8rem" }}>Объект</span>
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
                    <span className="text-soft" style={{ fontSize: "0.8rem" }}>Группа систем</span>
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
                    <span className="text-soft" style={{ fontSize: "0.8rem" }}>Система</span>
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
                  <a href={`/ppr/calendar?tab=${activeTab}`} className="btn btn-ghost">
                    Сбросить
                  </a>
                </div>
              </form>
            </details>
          )}
        </div>
      </div>

      {activeTab === "year" ? (
        <div className="grid" style={{ gap: "1rem" }}>
          {yearScreen === "groups" ? (
            <>
              <DirectorySummary
                metrics={[
                  { label: "Групп в обзоре", value: yearGroupOverview.length, tone: "info" },
                  { label: "Суммарные нормо-часы", value: `${formatHours(yearSummary.totalHours)} ч`, tone: "info" },
                  { label: "Плановых позиций", value: yearSummary.positions, tone: "neutral" },
                ]}
              />

              <div className="section-card grid" style={{ gap: "0.9rem" }}>
                <div className="grid" style={{ gap: "0.35rem" }}>
                  <strong>Уровень 1. Годовой обзор по группам систем</strong>
                  <span className="text-soft">Группы систем и плановая нагрузка по месяцам.</span>
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
                                {row.code} • {row.systems_count} систем
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
            </>
          ) : (
            <div className="section-card grid" style={{ gap: "0.9rem" }}>
              <div className="grid" style={{ gap: "0.6rem" }}>
                <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                  <span className="text-soft" style={{ fontSize: "0.82rem" }}>Календарь ППР</span>
                  <span className="text-soft">/</span>
                  <span className="text-soft" style={{ fontSize: "0.82rem" }}>Группы систем</span>
                  <span className="text-soft">/</span>
                  <strong style={{ fontSize: "0.88rem" }}>{selectedGroup?.name ?? "Выбранная группа"}</strong>
                </div>

                <div className="grid" style={{ gap: "0.35rem" }}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
                    <div className="grid" style={{ gap: "0.35rem" }}>
                      <strong>Уровень 2. Годовой обзор по системам внутри группы</strong>
                      <span className="text-soft">
                        Системы выбранной группы и плановая нагрузка по месяцам.
                      </span>
                    </div>
                    <a href={backToGroupsHref} className="btn btn-ghost">
                      ← Назад к группам
                    </a>
                  </div>
                </div>
              </div>

              <DirectorySummary
                metrics={[
                  { label: "Выбранная группа", value: selectedGroup?.name ?? "—", tone: "neutral" },
                  { label: "Систем в группе", value: yearSystemOverview.length, tone: "info" },
                  {
                    label: "Суммарные часы группы",
                    value: `${formatHours(yearSystemOverview.reduce((sum, row) => sum + row.totals.norm_hours_total, 0))} ч`,
                    tone: "neutral",
                  },
                ]}
              />

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
                              {row.object_name}
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
          )}
        </div>
      ) : (
        <div className="grid" style={{ gap: "0.9rem" }}>
          <MonthlyCompactSummary
            totals={monthTotals}
            selectedObject={selectedObject}
            selectedGroup={selectedGroup}
            selectedSystem={selectedSystem}
            currentMonthInput={currentMonthInput}
            previousMonthHref={previousMonthHref}
            nextMonthHref={nextMonthHref}
            monthView={monthView}
            onMonthViewChange={setMonthView}
          />

          <MonthlyNoticeBar notice={monthlyNotice} />

          {!selectedSystem ? (
            <EmptyState message="Для monthly view нужно выбрать систему" hint="Провалитесь из уровня 2 по нужному месяцу или выберите систему через фильтр сверху." />
          ) : monthView === "grid" ? (
            <MonthlyDnDGrid
              month={currentMonthInput}
              items={localMonthItems}
              onOpenItem={setEditingItemId}
              onRequestMove={handleMoveRequest}
              isSubmitting={isSubmitting}
            />
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
                {localMonthItems.map((item) => {
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
            {localMonthItems.map((item) => {
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

          <MonthlySecondaryTools monthPlans={monthPlans} currentMonthInput={currentMonthInput} filteredSystems={filteredSystems} selectedSystemId={selectedSystemId} />
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
              ? "Materialized заявка: детали и fallback-перенос"
              : "Materialized заявка: только просмотр"
            : editingItemCanReschedule
              ? "Позиция month plan: детали и fallback-перенос"
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
                    <textarea className="input" name="reason" rows={4} minLength={3} placeholder="Почему требуется сдвиг materialized заявки внутри месяца" />
                  </PprFormGroup>
                ) : null}
                <div className="text-soft" style={{ fontSize: "0.84rem" }}>
                  Основной сценарий переноса теперь drag-and-drop. Эта форма оставлена как fallback для точечного ручного изменения даты.
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

      <PprModal
        open={Boolean(pendingMaterializedItem && pendingMaterializedMove)}
        onClose={() => {
          setPendingMaterializedMove(null);
          setMaterializedReason("");
        }}
        title="Подтвердить перенос materialized заявки"
        isDirty={Boolean(materializedReason)}
      >
        {pendingMaterializedItem && pendingMaterializedMove ? (
          <div className="ppr-modal-content">
            <div className="ppr-modal-body grid">
              <CalendarItemDetails item={pendingMaterializedItem} currentMonthInput={currentMonthInput} />
              <div className="section-card">
                <div className="grid" style={{ gap: "0.35rem" }}>
                  <div className="text-soft">
                    <strong>Новая дата:</strong> {formatDate(pendingMaterializedMove.targetDate)}
                  </div>
                  <div className="text-soft">
                    Перенос для materialized заявки был выбран через drag-and-drop. Чтобы сохранить существующие правила, нужно указать причину и подтвердить действие.
                  </div>
                </div>
              </div>
              <PprFormGroup label="Причина переноса">
                <textarea
                  className="input"
                  rows={4}
                  minLength={3}
                  value={materializedReason}
                  onChange={(event) => setMaterializedReason(event.target.value)}
                  placeholder="Почему требуется перенос materialized заявки внутри месяца"
                />
              </PprFormGroup>
            </div>
            <div className="ppr-modal-footer">
              <button className="btn btn-accent" type="button" disabled={materializedReason.trim().length < 3 || isSubmitting} onClick={handleMaterializedConfirm}>
                Подтвердить перенос
              </button>
            </div>
          </div>
        ) : null}
      </PprModal>
    </>
  );
}
