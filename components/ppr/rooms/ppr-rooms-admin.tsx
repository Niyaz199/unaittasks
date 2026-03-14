"use client";

import { useState } from "react";
import { createPprRoomAction, updatePprRoomAction } from "@/app/actions/ppr-directory-actions";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PprModal, PprFormGroup } from "@/components/ppr/ui/ppr-modal";

type RoomRow = {
  id: string;
  object_id: string;
  name: string;
  floor: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  object: { name: string } | Array<{ name: string }> | null;
};

type ObjectOption = { id: string; name: string };

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

export function PprRoomsAdmin({ rooms, objects }: { rooms: RoomRow[]; objects: ObjectOption[] }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const editingRoom = editingId ? rooms.find((item) => item.id === editingId) ?? null : null;

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="text-soft">Помещения привязываются к объекту и будут использоваться дальше для оборудования.</div>
        <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)} disabled={!objects.length}>
          + Добавить помещение
        </button>
      </div>

      {!objects.length ? (
        <EmptyState message="Нет доступных объектов" hint="Чтобы добавить помещение, сначала нужен доступ хотя бы к одному объекту." />
      ) : !rooms.length ? (
        <EmptyState message="Помещения ППР пока не созданы" hint="Создайте первое помещение для доступного объекта." />
      ) : (
        <>
          <div className="desktop-only">
            <DataTable
              columns={[
                { key: "object", label: "Объект" },
                { key: "name", label: "Помещение" },
                { key: "floor", label: "Этаж" },
                { key: "status", label: "Статус" },
                { key: "actions", label: "Действия" },
              ]}
            >
              {rooms.map((room) => (
                <tr key={room.id}>
                  <td>{resolveName(room.object)}</td>
                  <td>{room.name}</td>
                  <td>{room.floor ?? "—"}</td>
                  <td>{room.is_active ? "Активно" : "Отключено"}</td>
                  <td>
                    <div className="ppr-table-actions">
                      <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(room.id)}>
                        Изменить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>

          <div className="mobile-cards mobile-only">
            {rooms.map((room) => (
              <div key={room.id} className="section-card mobile-card">
                <div className="grid" style={{ gap: "0.45rem" }}>
                  <div>{room.name}</div>
                  <div className="text-soft">Объект: {resolveName(room.object)}</div>
                  <div className="text-soft">Этаж: {room.floor ?? "—"}</div>
                  <div className="text-soft">{room.is_active ? "Активно" : "Отключено"}</div>
                  <div className="ppr-table-actions">
                    <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(room.id)}>
                      Изменить
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <PprModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setIsDirty(false); }} title="Новое помещение ППР" isDirty={isDirty}>
        <form action={createPprRoomAction} onSubmit={() => { setIsCreateOpen(false); setIsDirty(false); }} onChange={() => setIsDirty(true)} className="ppr-modal-content">
          <div className="ppr-modal-body grid">
            <PprFormGroup label="Объект">
              <select className="select" name="object_id" required defaultValue="">
                <option value="" disabled>Выберите объект</option>
                {objects.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </PprFormGroup>

            <PprFormGroup label="Название помещения">
              <input className="input" name="name" placeholder="Например: Серверная 1" required />
            </PprFormGroup>

            <PprFormGroup label="Этаж / зона">
              <input className="input" name="floor" placeholder="Например: 1 этаж" />
            </PprFormGroup>

            <PprFormGroup label="Описание">
              <textarea className="input" name="description" rows={3} placeholder="Дополнительная техническая информация" />
            </PprFormGroup>

            <label className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" name="is_active" defaultChecked />
              Активно
            </label>
          </div>

          <div className="ppr-modal-footer">
            <button className="btn btn-accent" type="submit">Создать</button>
          </div>
        </form>
      </PprModal>

      <PprModal open={Boolean(editingRoom)} onClose={() => { setEditingId(null); setIsDirty(false); }} title="Редактирование помещения ППР" isDirty={isDirty}>
        {editingRoom ? (
          <form action={updatePprRoomAction} onSubmit={() => { setEditingId(null); setIsDirty(false); }} onChange={() => setIsDirty(true)} className="ppr-modal-content">
            <div className="ppr-modal-body grid">
              <input type="hidden" name="room_id" value={editingRoom.id} />

              <PprFormGroup label="Объект">
                <select className="select" name="object_id" required defaultValue={editingRoom.object_id}>
                  {objects.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </PprFormGroup>

              <PprFormGroup label="Название помещения">
                <input className="input" name="name" defaultValue={editingRoom.name} required />
              </PprFormGroup>

              <PprFormGroup label="Этаж / зона">
                <input className="input" name="floor" defaultValue={editingRoom.floor ?? ""} />
              </PprFormGroup>

              <PprFormGroup label="Описание">
                <textarea className="input" name="description" rows={3} defaultValue={editingRoom.description ?? ""} />
              </PprFormGroup>

              <label className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" name="is_active" defaultChecked={editingRoom.is_active} />
                Активно
              </label>
            </div>

            <div className="ppr-modal-footer">
              <button className="btn btn-accent" type="submit">Сохранить</button>
            </div>
          </form>
        ) : null}
      </PprModal>
    </>
  );
}
