"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { createPprEquipmentAction, updatePprEquipmentAction } from "@/app/actions/ppr-directory-actions";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { pprEquipmentStatusMeta } from "@/lib/ppr/presentation";
import { PprEquipmentForm } from "@/components/ppr/equipment/ppr-equipment-form";

type EquipmentRow = {
  id: string;
  object_id: string;
  system_id: string;
  room_id: string;
  inventory_no: string;
  name: string;
  dispatch_name: string;
  service_start_date: string;
  status: "active" | "repair" | "out_of_service" | "archived";
  serial_no: string | null;
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  comment: string | null;
  created_at: string;
  object: { name: string } | Array<{ name: string }> | null;
  system: { name: string } | Array<{ name: string }> | null;
  room: { name: string } | Array<{ name: string }> | null;
};

type ObjectOption = { id: string; name: string };
type SystemOption = { id: string; object_id: string; name: string };
type RoomOption = { id: string; object_id: string; name: string };

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

export function PprEquipmentAdmin({
  equipment,
  objects,
  systems,
  rooms,
}: {
  equipment: EquipmentRow[];
  objects: ObjectOption[];
  systems: SystemOption[];
  rooms: RoomOption[];
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const editingEquipment = editingId ? equipment.find((item) => item.id === editingId) ?? null : null;
  const hasPrerequisites = objects.length > 0 && systems.length > 0 && rooms.length > 0;

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="text-soft">
          Equipment-level структура ППР: объект, система и помещение фиксируются сразу.
        </div>
        <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)} disabled={!hasPrerequisites}>
          + Добавить оборудование
        </button>
      </div>

      {!hasPrerequisites ? (
        <EmptyState
          message="Недостаточно структуры для создания оборудования"
          hint="Для создания оборудования нужны объект, система и помещение."
        />
      ) : !equipment.length ? (
        <EmptyState message="Оборудование ППР пока не создано" hint="Добавьте первую единицу оборудования для доступного объекта." />
      ) : (
        <>
          <div className="desktop-only">
            <DataTable
              columns={[
                { key: "inventory", label: "Инв. номер" },
                { key: "name", label: "Оборудование" },
                { key: "object", label: "Объект" },
                { key: "location", label: "Система / помещение" },
                { key: "status", label: "Статус" },
                { key: "actions", label: "Действия" },
              ]}
            >
              {equipment.map((item) => {
                const statusMeta = pprEquipmentStatusMeta[item.status];
                return (
                  <tr key={item.id}>
                    <td>{item.inventory_no}</td>
                    <td>
                      <div>{item.name}</div>
                      <div className="text-soft">{item.dispatch_name}</div>
                    </td>
                    <td>{resolveName(item.object)}</td>
                    <td>
                      {resolveName(item.system)} / {resolveName(item.room)}
                    </td>
                    <td>
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    </td>
                    <td>
                      <div className="ppr-table-actions">
                        <Link className="btn btn-ghost ppr-action-btn" href={`/ppr/equipment/${item.id}` as Route}>
                          Карточка
                        </Link>
                        <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(item.id)}>
                          Изменить
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </DataTable>
          </div>

          <div className="mobile-cards mobile-only">
            {equipment.map((item) => {
              const statusMeta = pprEquipmentStatusMeta[item.status];
              return (
                <div key={item.id} className="section-card mobile-card">
                  <div className="grid" style={{ gap: "0.45rem" }}>
                    <div>{item.name}</div>
                    <div className="text-soft">Инв. номер: {item.inventory_no}</div>
                    <div className="text-soft">Объект: {resolveName(item.object)}</div>
                    <div className="text-soft">Система: {resolveName(item.system)}</div>
                    <div className="text-soft">Помещение: {resolveName(item.room)}</div>
                    <div>
                      <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                    </div>
                    <div className="ppr-table-actions">
                      <Link className="btn btn-ghost ppr-action-btn" href={`/ppr/equipment/${item.id}` as Route}>
                        Карточка
                      </Link>
                      <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(item.id)}>
                        Изменить
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <PprModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setIsDirty(false); }} title="Новое оборудование ППР" isDirty={isDirty}>
        <PprEquipmentForm
          action={createPprEquipmentAction}
          objects={objects}
          systems={systems}
          rooms={rooms}
          onSubmitted={() => { setIsCreateOpen(false); setIsDirty(false); }}
          onChange={() => setIsDirty(true)}
          submitLabel="Создать"
        />
      </PprModal>

      <PprModal open={Boolean(editingEquipment)} onClose={() => { setEditingId(null); setIsDirty(false); }} title="Редактирование оборудования ППР" isDirty={isDirty}>
        {editingEquipment ? (
          <PprEquipmentForm
            action={updatePprEquipmentAction}
            equipmentId={editingEquipment.id}
            objects={objects}
            systems={systems}
            rooms={rooms}
            onSubmitted={() => { setEditingId(null); setIsDirty(false); }}
            onChange={() => setIsDirty(true)}
            submitLabel="Сохранить"
            initialValues={{
              object_id: editingEquipment.object_id,
              system_id: editingEquipment.system_id,
              room_id: editingEquipment.room_id,
              inventory_no: editingEquipment.inventory_no,
              name: editingEquipment.name,
              dispatch_name: editingEquipment.dispatch_name,
              service_start_date: editingEquipment.service_start_date,
              status: editingEquipment.status,
              serial_no: editingEquipment.serial_no ?? "",
              manufacturer: editingEquipment.manufacturer ?? "",
              model: editingEquipment.model ?? "",
              description: editingEquipment.description ?? "",
              comment: editingEquipment.comment ?? "",
            }}
          />
        ) : null}
      </PprModal>
    </>
  );
}
