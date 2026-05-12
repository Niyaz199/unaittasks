"use client";

import { useMemo, useState } from "react";
import { generatePprMonthPlanAction } from "@/app/actions/ppr-calendar-actions";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { pprMonthPlanItemStatusMeta, pprTaskStatusMeta } from "@/lib/ppr/presentation";
import { AssigneeCombobox, type AssigneeOption } from "@/components/ui/assignee-combobox";
import {
  buildDaySummaries,
  buildEquipmentMonthRows,
  buildMonthDays,
  canRescheduleFromCalendar,
  formatDate,
  formatHours,
  formatMonthLabel,
  getDayTone,
  resolveEquipmentInfo,
  resolveName,
  resolveTask,
  resolveTemplate,
} from "./ppr-calendar-selectors";
import type {
  BadgeTone,
  CalendarObjectOption,
  CalendarSystemGroupOption,
  CalendarSystemOption,
  MonthPlanItemRow,
  MonthPlanRow,
  MonthlyNotice,
} from "./types";

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
  selectedObject?: CalendarObjectOption;
  selectedGroup?: CalendarSystemGroupOption;
  selectedSystem?: CalendarSystemOption;
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
            <AssigneeCombobox
              name="system_id"
              placeholder="Выберите систему"
              required
              defaultValue={selectedSystemId ?? ""}
              selectionHint="Выберите систему из списка"
              options={filteredSystems.map<AssigneeOption>((system) => ({
                id: system.id,
                label: system.name,
              }))}
            />
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
        height: "24px",
        padding: "0 0.25rem",
        borderRadius: "6px",
        border: "1px solid color-mix(in srgb, var(--line) 80%, transparent)",
        background: isDragging ? "color-mix(in srgb, var(--info) 12%, var(--panel))" : "color-mix(in srgb, var(--panel-soft) 55%, var(--panel))",
        color: "inherit",
        textAlign: "center",
        cursor: canReschedule ? (isDragging ? "grabbing" : "grab") : "pointer",
        opacity: isDragging ? 0.45 : 1,
        boxShadow: isDragging ? "0 10px 15px -3px rgba(0, 0, 0, 0.3)" : canReschedule ? "0 1px 0 color-mix(in srgb, var(--line) 30%, transparent)" : "none",
        fontSize: "12px",
        fontWeight: 500,
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {hoursLabel}
    </button>
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
        <span className="text-soft" style={{ fontSize: "0.78rem" }}>
          Главный акцент: работы, часы и перенос. Статусы вынесены в детали.
        </span>
      </div>

      <div style={{ overflow: "auto", border: "1px solid var(--line)", borderRadius: "14px" }}>
        <table style={{ width: "100%", minWidth: `${240 + days.length * 48}px`, borderCollapse: "separate", borderSpacing: 0 }}>
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
                  padding: "0.75rem",
                  borderBottom: "1px solid var(--line)",
                  borderRight: "1px solid var(--line)",
                  boxShadow: "4px 0 12px rgba(0,0,0,0.15)",
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
                      minWidth: "48px",
                      background: day.isWeekend ? "color-mix(in srgb, var(--panel-soft) 40%, var(--panel))" : `color-mix(in srgb, var(--${tone}) 6%, var(--panel))`,
                      textAlign: "center",
                      padding: "0.35rem 0.2rem",
                      borderBottom: "1px solid var(--line)",
                      borderRight: "1px solid color-mix(in srgb, var(--line) 40%, transparent)",
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
                    boxShadow: "4px 0 12px rgba(0,0,0,0.15)",
                    verticalAlign: "top",
                    minWidth: "240px",
                    maxWidth: "240px",
                  }}
                >
                  <div className="grid" style={{ gap: "0.22rem" }}>
                    <strong style={{ fontSize: "0.86rem", lineHeight: 1.2, fontWeight: 600 }}>{row.equipmentName}</strong>
                    <span className="text-soft" style={{ fontSize: "0.74rem" }}>{row.inventoryNo}</span>
                    <span className="text-soft" style={{ fontSize: "0.74rem" }}>{row.roomName}</span>
                    <span className="text-soft" style={{ fontSize: "0.74rem" }}>{row.itemsCount} работ • {formatHours(row.hours)} ч</span>
                  </div>
                </td>
                {days.map((day) => {
                  const cellItems = row.itemsByDate.get(day.isoDate) ?? [];
                  const summary = daySummaries.get(day.isoDate) ?? { itemsCount: 0, hours: 0, hasOverdue: false, hasCarryover: false };
                  const tone: BadgeTone = getDayTone(summary);
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
                          : day.isWeekend
                            ? "color-mix(in srgb, var(--panel-soft) 30%, transparent)"
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
                        minWidth: "48px",
                        padding: "0.18rem",
                        verticalAlign: "top",
                        borderBottom: "1px solid var(--line)",
                        borderRight: "1px solid color-mix(in srgb, var(--line) 40%, transparent)",
                        background,
                        outline: isHovered ? `2px solid ${hoverCell?.valid ? "var(--warning)" : "var(--danger)"}` : isValidTarget ? "1px dashed var(--warning)" : "none",
                        outlineOffset: "-2px",
                        opacity: isSubmitting ? 0.7 : 1,
                      }}
                    >
                      {cellItems.length ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.18rem", alignContent: "flex-start" }}>
                          {cellItems.slice(0, 2).map((item) => (
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
                          {cellItems.length > 2 && (
                            <button
                              type="button"
                              onClick={() => onOpenItem(cellItems[2].id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                minWidth: "0",
                                height: "24px",
                                padding: "0 0.25rem",
                                borderRadius: "6px",
                                border: "1px solid color-mix(in srgb, var(--line) 80%, transparent)",
                                background: "color-mix(in srgb, var(--panel-soft) 30%, var(--panel))",
                                color: "var(--text-soft)",
                                fontSize: "11px",
                                fontWeight: 600,
                                lineHeight: 1,
                                cursor: "pointer",
                              }}
                            >
                              +{cellItems.length - 2}
                            </button>
                          )}
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

function PprCalendarMonthList({
  items,
  onOpenItem,
}: {
  items: MonthPlanItemRow[];
  onOpenItem: (id: string) => void;
}) {
  return (
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
        {items.map((item) => {
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
                <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => onOpenItem(item.id)}>
                  Открыть
                </button>
              </td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}

function PprCalendarMonthMobileList({
  items,
  onOpenItem,
}: {
  items: MonthPlanItemRow[];
  onOpenItem: (id: string) => void;
}) {
  return (
    <div className="mobile-cards mobile-only">
      {items.map((item) => {
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
              <button className="btn btn-ghost" type="button" onClick={() => onOpenItem(item.id)}>
                Открыть детали
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PprCalendarMonthSection({
  monthPlans,
  currentMonthInput,
  filteredSystems,
  selectedSystemId,
  monthTotals,
  selectedObject,
  selectedGroup,
  selectedSystem,
  monthlyNotice,
  monthView,
  onMonthViewChange,
  localMonthItems,
  onOpenItem,
  onRequestMove,
  isSubmitting,
  previousMonthHref,
  nextMonthHref,
}: {
  monthPlans: MonthPlanRow[];
  currentMonthInput: string;
  filteredSystems: CalendarSystemOption[];
  selectedSystemId?: string;
  monthTotals: { items: number; overdue: number; carried: number; materialized: number; hours: number; equipment: number };
  selectedObject?: CalendarObjectOption;
  selectedGroup?: CalendarSystemGroupOption;
  selectedSystem?: CalendarSystemOption;
  monthlyNotice: MonthlyNotice | null;
  monthView: "grid" | "list";
  onMonthViewChange: (view: "grid" | "list") => void;
  localMonthItems: MonthPlanItemRow[];
  onOpenItem: (id: string) => void;
  onRequestMove: (item: MonthPlanItemRow, targetDate: string) => void;
  isSubmitting: boolean;
  previousMonthHref: string;
  nextMonthHref: string;
}) {
  return (
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
        onMonthViewChange={onMonthViewChange}
      />

      <MonthlyNoticeBar notice={monthlyNotice} />

      {!selectedSystem ? (
        <EmptyState message="Для monthly view нужно выбрать систему" hint="Провалитесь из уровня 2 по нужному месяцу или выберите систему через фильтр сверху." />
      ) : monthView === "grid" ? (
        <MonthlyDnDGrid
          month={currentMonthInput}
          items={localMonthItems}
          onOpenItem={onOpenItem}
          onRequestMove={onRequestMove}
          isSubmitting={isSubmitting}
        />
      ) : (
        <PprCalendarMonthList items={localMonthItems} onOpenItem={onOpenItem} />
      )}

      <PprCalendarMonthMobileList items={localMonthItems} onOpenItem={onOpenItem} />

      <MonthlySecondaryTools
        monthPlans={monthPlans}
        currentMonthInput={currentMonthInput}
        filteredSystems={filteredSystems}
        selectedSystemId={selectedSystemId}
      />
    </div>
  );
}
