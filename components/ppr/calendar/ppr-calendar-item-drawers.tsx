"use client";

import { reschedulePprMonthPlanItemAction } from "@/app/actions/ppr-calendar-actions";
import { PprDrawer } from "@/components/ppr/ui/ppr-drawer";
import { PprFormGroup } from "@/components/ppr/ui/ppr-modal";
import { Badge } from "@/components/ui/badge";
import { pprMonthPlanItemStatusMeta, pprTaskStatusMeta } from "@/lib/ppr/presentation";
import {
  canRescheduleFromCalendar,
  formatDate,
  formatHours,
  formatMonthLabel,
  resolveEquipmentInfo,
  resolveTask,
  resolveTemplate,
} from "./ppr-calendar-selectors";
import type { MonthPlanItemRow, PendingMaterializedMove } from "./types";

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

export function PprCalendarItemDrawers({
  editingItem,
  currentMonthInput,
  isDirty,
  onDirtyChange,
  onCloseEditing,
  pendingMaterializedItem,
  pendingMaterializedMove,
  materializedReason,
  onMaterializedReasonChange,
  onCloseMaterialized,
  onConfirmMaterialized,
  isSubmitting,
}: {
  editingItem: MonthPlanItemRow | null;
  currentMonthInput: string;
  isDirty: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onCloseEditing: () => void;
  pendingMaterializedItem: MonthPlanItemRow | null;
  pendingMaterializedMove: PendingMaterializedMove | null;
  materializedReason: string;
  onMaterializedReasonChange: (value: string) => void;
  onCloseMaterialized: () => void;
  onConfirmMaterialized: () => void;
  isSubmitting: boolean;
}) {
  const editingTask = resolveTask(editingItem?.task);
  const editingItemCanReschedule = editingItem ? canRescheduleFromCalendar(editingItem) : false;

  return (
    <>
      <PprDrawer open={Boolean(editingItem)} onClose={onCloseEditing} title={
        editingTask
          ? editingItemCanReschedule
            ? "Materialized заявка: детали и fallback-перенос"
            : "Materialized заявка: только просмотр"
          : editingItemCanReschedule
            ? "Позиция month plan: детали и fallback-перенос"
            : "Позиция month plan: только просмотр"
      } isDirty={isDirty}>
        {editingItem ? (
          editingItemCanReschedule ? (
            <form
              action={reschedulePprMonthPlanItemAction}
              onSubmit={() => onCloseEditing()}
              onChange={() => onDirtyChange(true)}
              className="ppr-drawer-content"
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
            <div className="ppr-drawer-content">
              <div className="ppr-modal-body grid">
                <CalendarItemDetails item={editingItem} currentMonthInput={currentMonthInput} />
                <div className="text-soft" style={{ fontSize: "0.84rem" }}>
                  Перенос недоступен для текущего статуса. Здесь можно быстро посмотреть детали позиции и связанной задачи.
                </div>
              </div>
            </div>
          )
        ) : null}
      </PprDrawer>

      <PprDrawer
        open={Boolean(pendingMaterializedItem && pendingMaterializedMove)}
        onClose={onCloseMaterialized}
        title="Подтвердить перенос materialized заявки"
        isDirty={Boolean(materializedReason)}
      >
        {pendingMaterializedItem && pendingMaterializedMove ? (
          <div className="ppr-drawer-content">
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
                  onChange={(event) => onMaterializedReasonChange(event.target.value)}
                  placeholder="Почему требуется перенос materialized заявки внутри месяца"
                />
              </PprFormGroup>
            </div>
            <div className="ppr-modal-footer">
              <button
                className="btn btn-accent"
                type="button"
                disabled={materializedReason.trim().length < 3 || isSubmitting}
                onClick={onConfirmMaterialized}
              >
                Подтвердить перенос
              </button>
            </div>
          </div>
        ) : null}
      </PprDrawer>
    </>
  );
}
