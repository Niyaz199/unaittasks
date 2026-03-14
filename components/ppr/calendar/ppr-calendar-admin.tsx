"use client";

import { useState } from "react";
import { generatePprMonthPlanAction, reschedulePprMonthPlanItemAction } from "@/app/actions/ppr-calendar-actions";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PprModal, PprFormGroup } from "@/components/ppr/ui/ppr-modal";
import { pprMonthPlanItemStatusMeta } from "@/lib/ppr/presentation";

type CalendarSystemOption = {
  id: string;
  object_id: string;
  name: string;
  responsible_user_id: string | null;
  object: { name: string } | Array<{ name: string }> | null;
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
  subsystem_id: string;
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
  template: { name: string } | Array<{ name: string }> | null;
  system: { name: string } | Array<{ name: string }> | null;
  object: { name: string } | Array<{ name: string }> | null;
};

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

function resolveEquipment(raw: { name: string; inventory_no: string } | Array<{ name: string; inventory_no: string }> | null | undefined) {
  const item = Array.isArray(raw) ? raw[0] : raw;
  if (!item) return "—";
  return `${item.name} (${item.inventory_no})`;
}

export function PprCalendarAdmin({
  systems,
  monthPlans,
  monthPlanItems,
  currentMonthInput,
  selectedSystemId,
}: {
  systems: CalendarSystemOption[];
  monthPlans: MonthPlanRow[];
  monthPlanItems: MonthPlanItemRow[];
  currentMonthInput: string;
  selectedSystemId?: string;
}) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const editingItem = editingItemId ? monthPlanItems.find((item) => item.id === editingItemId) ?? null : null;

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
            <span className="text-soft">Месяц</span>
            <input className="input" type="month" name="month" defaultValue={currentMonthInput} />
          </label>
          <label className="grid" style={{ gap: "0.3rem" }}>
            <span className="text-soft">Система</span>
            <select className="select" name="system" defaultValue={selectedSystemId ?? ""}>
              <option value="">Все доступные системы</option>
              {systems.map((system) => (
                <option key={system.id} value={system.id}>
                  {resolveName(system.object)} / {system.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-ghost" type="submit">
            Показать
          </button>
        </form>
      </div>

      <div className="section-card">
        <form action={generatePprMonthPlanAction} className="row" style={{ gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
          <label className="grid" style={{ gap: "0.3rem" }}>
            <span className="text-soft">Сформировать план по системе</span>
            <select className="select" name="system_id" required defaultValue={selectedSystemId ?? ""}>
              <option value="" disabled>
                Выберите систему
              </option>
              {systems.map((system) => (
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
          hint="Сформируйте план для одной из доступных систем и затем разнесите работы по дням."
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
                return (
                  <tr key={item.id}>
                    <td>{resolveName(item.system)}</td>
                    <td>{resolveEquipment(item.equipment)}</td>
                    <td>{resolveName(item.template)}</td>
                    <td>{new Date(item.source_due_date).toLocaleDateString("ru-RU")}</td>
                    <td>{new Date(item.planned_for).toLocaleDateString("ru-RU")}</td>
                    <td>
                      <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                        {item.is_carried_over ? <Badge tone="warning">Carryover</Badge> : null}
                        {item.task_id === null ? <Badge tone="neutral">Без task</Badge> : null}
                      </div>
                    </td>
                    <td>
                      <div className="ppr-table-actions">
                        <button
                          className="btn btn-ghost ppr-action-btn"
                          type="button"
                          disabled={item.status !== "pending" && item.status !== "carried_over"}
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
              return (
                <div key={item.id} className="section-card mobile-card">
                  <div className="grid" style={{ gap: "0.45rem" }}>
                    <div>{resolveEquipment(item.equipment)}</div>
                    <div className="text-soft">Система: {resolveName(item.system)}</div>
                    <div className="text-soft">Шаблон: {resolveName(item.template)}</div>
                    <div className="text-soft">Исходная дата: {new Date(item.source_due_date).toLocaleDateString("ru-RU")}</div>
                    <div className="text-soft">Плановая дата: {new Date(item.planned_for).toLocaleDateString("ru-RU")}</div>
                    <div>
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    </div>
                    <div className="ppr-table-actions">
                      <button
                        className="btn btn-ghost ppr-action-btn"
                        type="button"
                        disabled={item.status !== "pending" && item.status !== "carried_over"}
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

      <PprModal open={Boolean(editingItem)} onClose={() => { setEditingItemId(null); setIsDirty(false); }} title="Перенос plan item по дате" isDirty={isDirty}>
        {editingItem ? (
          <form action={reschedulePprMonthPlanItemAction} onSubmit={() => { setEditingItemId(null); setIsDirty(false); }} onChange={() => setIsDirty(true)} className="ppr-modal-content">
            <div className="ppr-modal-body grid">
              <input type="hidden" name="item_id" value={editingItem.id} />
              
              <div className="section-card" style={{ marginBottom: "1rem" }}>
                <div className="text-soft"><strong>Оборудование:</strong> {resolveEquipment(editingItem.equipment)}</div>
              </div>

              <div className="text-soft text-sm" style={{ marginBottom: "0.5rem" }}>
                Укажите новую плановую дату.
              </div>
              
              <PprFormGroup label="Плановая дата">
                <input className="input" type="date" name="planned_for" defaultValue={editingItem.planned_for} />
              </PprFormGroup>
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
