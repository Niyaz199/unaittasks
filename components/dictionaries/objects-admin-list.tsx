"use client";

import { useState } from "react";
import { deleteObjectAction, updateObjectAction } from "@/app/actions/task-actions";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Modal } from "@/components/ui/modal";

type ObjectRow = {
  id: string;
  name: string;
  created_at: string;
  object_engineer_id: string | null;
  object_engineer: { full_name: string } | Array<{ full_name: string }> | null;
};

function resolveObjectEngineerName(objectItem: ObjectRow) {
  if (Array.isArray(objectItem.object_engineer)) return objectItem.object_engineer[0]?.full_name ?? "—";
  return objectItem.object_engineer?.full_name ?? "—";
}

export function ObjectsAdminList({
  objects,
  objectEngineers
}: {
  objects: ObjectRow[];
  objectEngineers: Array<{ id: string; full_name: string }>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editingObject = editingId ? objects.find((objectItem) => objectItem.id === editingId) ?? null : null;
  const deletingObject = deletingId ? objects.find((objectItem) => objectItem.id === deletingId) ?? null : null;

  if (!objects.length) {
    return (
      <EmptyState
        message="Справочник объектов пока пуст"
        hint="Создайте объект, чтобы назначать по нему задачи."
        actionLabel="+ Добавить объект"
        actionHref="/objects/create"
      />
    );
  }

  return (
    <>
      <div className="desktop-only">
        <DataTable
          columns={[
            { key: "name", label: "Объект" },
            { key: "object_engineer", label: "Инженер объекта" },
            { key: "created", label: "Создан" },
            { key: "actions", label: "Действия" }
          ]}
        >
          {objects.map((objectItem) => (
            <tr key={objectItem.id}>
              <td>{objectItem.name}</td>
              <td>{resolveObjectEngineerName(objectItem)}</td>
              <td>{new Date(objectItem.created_at).toLocaleString("ru-RU")}</td>
              <td>
                <div className="row">
                  <button className="btn btn-ghost" type="button" onClick={() => setEditingId(objectItem.id)}>
                    Изменить
                  </button>
                  <button className="btn btn-danger" type="button" onClick={() => setDeletingId(objectItem.id)}>
                    Удалить
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      <div className="mobile-cards mobile-only">
        {objects.map((objectItem) => (
          <div key={objectItem.id} className="section-card mobile-card">
            <div className="grid" style={{ gap: "0.45rem" }}>
              <div>{objectItem.name}</div>
              <div className="text-soft">Инженер объекта: {resolveObjectEngineerName(objectItem)}</div>
              <div className="text-soft">{new Date(objectItem.created_at).toLocaleString("ru-RU")}</div>
              <div className="row">
                <button className="btn btn-ghost" type="button" onClick={() => setEditingId(objectItem.id)}>
                  Изменить
                </button>
                <button className="btn btn-danger" type="button" onClick={() => setDeletingId(objectItem.id)}>
                  Удалить
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal open={Boolean(editingObject)} onClose={() => setEditingId(null)} title="Редактирование объекта">
        {editingObject ? (
          <form action={updateObjectAction} className="grid" onSubmit={() => setEditingId(null)}>
            <input type="hidden" name="object_id" value={editingObject.id} />
            <input className="input" name="name" defaultValue={editingObject.name} required />
            <select
              className="select"
              name="object_engineer_id"
              defaultValue={editingObject.object_engineer_id ?? ""}
            >
              <option value="">Без инженера объекта</option>
              {objectEngineers.map((engineer) => (
                <option key={engineer.id} value={engineer.id}>
                  {engineer.full_name}
                </option>
              ))}
            </select>
            <div className="row">
              <button className="btn btn-accent" type="submit">
                Сохранить
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal open={Boolean(deletingObject)} onClose={() => setDeletingId(null)} title="Удалить объект?">
        {deletingObject ? (
          <form action={deleteObjectAction} className="grid" onSubmit={() => setDeletingId(null)}>
            <input type="hidden" name="object_id" value={deletingObject.id} />
            <div className="text-soft">
              Объект: <strong>{deletingObject.name}</strong>
            </div>
            <div className="text-soft">Если есть связанные задачи, удаление будет отклонено.</div>
            <div className="row">
              <button className="btn btn-danger" type="submit">
                Подтвердить удаление
              </button>
              <button className="btn btn-ghost" type="button" onClick={() => setDeletingId(null)}>
                Отмена
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </>
  );
}
