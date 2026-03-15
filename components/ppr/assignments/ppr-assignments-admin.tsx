"use client";

import { useState } from "react";
import { createPprEquipmentAssignmentAction, updatePprEquipmentAssignmentAction } from "@/app/actions/ppr-template-actions";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { PprAssignmentForm } from "@/components/ppr/assignments/ppr-assignment-form";

type AssignmentRow = {
  id: string;
  object_id: string;
  equipment_id: string;
  template_id: string;
  start_date: string;
  period_months: number;
  is_active: boolean;
  created_at: string;
  equipment:
    | { name: string; inventory_no: string; system_id: string }
    | Array<{ name: string; inventory_no: string; system_id: string }>
    | null;
  template: { name: string; system_id: string } | Array<{ name: string; system_id: string }> | null;
  object: { name: string } | Array<{ name: string }> | null;
};

type ObjectOption = { id: string; name: string };
type EquipmentOption = { id: string; object_id: string; system_id: string; name: string; inventory_no: string };
type TemplateOption = { id: string; object_id: string; system_id: string; name: string; period_months: number; base_start_date: string; is_active: boolean };

function resolveObjectName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

function resolveEquipmentLabel(
  raw: { name: string; inventory_no: string; system_id: string } | Array<{ name: string; inventory_no: string; system_id: string }> | null | undefined
) {
  const item = Array.isArray(raw) ? raw[0] : raw;
  if (!item) return "—";
  return `${item.name} (${item.inventory_no})`;
}

function resolveTemplateLabel(
  raw: { name: string; system_id: string } | Array<{ name: string; system_id: string }> | null | undefined
) {
  const item = Array.isArray(raw) ? raw[0] : raw;
  return item?.name ?? "—";
}

export function PprAssignmentsAdmin({
  assignments,
  objects,
  equipmentOptions,
  templateOptions,
}: {
  assignments: AssignmentRow[];
  objects: ObjectOption[];
  equipmentOptions: EquipmentOption[];
  templateOptions: TemplateOption[];
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const editingAssignment = editingId ? assignments.find((item) => item.id === editingId) ?? null : null;
  const hasPrerequisites = objects.length > 0 && equipmentOptions.length > 0 && templateOptions.length > 0;

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="text-soft">Назначения связывают шаблоны ППР с конкретной единицей оборудования.</div>
        <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)} disabled={!hasPrerequisites}>
          + Назначить шаблон
        </button>
      </div>

      {!hasPrerequisites ? (
        <EmptyState
          message="Недостаточно данных для создания назначения"
          hint="Для назначения нужны доступное оборудование и шаблоны ППР из предыдущих батчей."
        />
      ) : !assignments.length ? (
        <EmptyState message="Назначения ППР пока не созданы" hint="Свяжите шаблон с оборудованием и задайте стартовую дату." />
      ) : (
        <>
          <div className="desktop-only">
            <DataTable
              columns={[
                { key: "object", label: "Объект" },
                { key: "equipment", label: "Оборудование" },
                { key: "template", label: "Шаблон" },
                { key: "start", label: "Старт" },
                { key: "period", label: "Период" },
                { key: "status", label: "Статус" },
                { key: "actions", label: "Действия" },
              ]}
            >
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td>{resolveObjectName(assignment.object)}</td>
                  <td>{resolveEquipmentLabel(assignment.equipment)}</td>
                  <td>{resolveTemplateLabel(assignment.template)}</td>
                  <td>{new Date(assignment.start_date).toLocaleDateString("ru-RU")}</td>
                  <td>{assignment.period_months} мес.</td>
                  <td>
                    <Badge tone={assignment.is_active ? "success" : "neutral"}>
                      {assignment.is_active ? "Активно" : "Отключено"}
                    </Badge>
                  </td>
                  <td>
                    <div className="ppr-table-actions">
                      <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(assignment.id)}>
                        Изменить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>

          <div className="mobile-cards mobile-only">
            {assignments.map((assignment) => (
              <div key={assignment.id} className="section-card mobile-card">
                <div className="grid" style={{ gap: "0.45rem" }}>
                  <div>{resolveTemplateLabel(assignment.template)}</div>
                  <div className="text-soft">Объект: {resolveObjectName(assignment.object)}</div>
                  <div className="text-soft">Оборудование: {resolveEquipmentLabel(assignment.equipment)}</div>
                  <div className="text-soft">Старт: {new Date(assignment.start_date).toLocaleDateString("ru-RU")}</div>
                  <div className="text-soft">Период: {assignment.period_months} мес.</div>
                  <div>
                    <Badge tone={assignment.is_active ? "success" : "neutral"}>
                      {assignment.is_active ? "Активно" : "Отключено"}
                    </Badge>
                  </div>
                  <div className="ppr-table-actions">
                    <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(assignment.id)}>
                      Изменить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <PprModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setIsDirty(false); }} title="Новое назначение ППР" isDirty={isDirty}>
        <PprAssignmentForm
          action={createPprEquipmentAssignmentAction}
          objects={objects}
          equipmentOptions={equipmentOptions}
          templateOptions={templateOptions}
          submitLabel="Создать"
          onChange={() => setIsDirty(true)}
          onSubmitted={() => { setIsCreateOpen(false); setIsDirty(false); }}
        />
      </PprModal>

      <PprModal open={Boolean(editingAssignment)} onClose={() => { setEditingId(null); setIsDirty(false); }} title="Редактирование назначения ППР" isDirty={isDirty}>
        {editingAssignment ? (
          <PprAssignmentForm
            action={updatePprEquipmentAssignmentAction}
            assignmentId={editingAssignment.id}
            objects={objects}
            equipmentOptions={equipmentOptions}
            templateOptions={templateOptions}
            submitLabel="Сохранить"
            onChange={() => setIsDirty(true)}
            onSubmitted={() => { setEditingId(null); setIsDirty(false); }}
            initialValues={{
              object_id: editingAssignment.object_id,
              equipment_id: editingAssignment.equipment_id,
              template_id: editingAssignment.template_id,
              start_date: editingAssignment.start_date,
              period_months: editingAssignment.period_months,
              is_active: editingAssignment.is_active,
            }}
          />
        ) : null}
      </PprModal>
    </>
  );
}
