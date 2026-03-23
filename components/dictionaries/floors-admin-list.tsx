"use client";

import Link from "next/link";
import type { Route } from "next";
import { useMemo, useState } from "react";
import { createFloorAction, deleteFloorAction, updateFloorAction } from "@/app/actions/floor-actions";
import { DataTable } from "@/components/ui/data-table";
import { PprModal, PprFormGroup } from "@/components/ppr/ui/ppr-modal";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";
import { StatusBadge } from "@/components/ppr/ui/status-badge";

type ObjectOption = { id: string; name: string };
type FloorRow = {
  id: string;
  object_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  usage_count: number;
  object: { name: string } | Array<{ name: string }> | null;
};

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

function buildRoomsHref(floor: FloorRow) {
  return `/ppr/rooms?objectId=${encodeURIComponent(floor.object_id)}&floorId=${encodeURIComponent(floor.id)}` as Route;
}

export function FloorsAdminList({
  floors,
  objects,
  canManage,
}: {
  floors: FloorRow[];
  objects: ObjectOption[];
  canManage: boolean;
}) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterObjectId, setFilterObjectId] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const editingFloor = editingId ? floors.find((item) => item.id === editingId) ?? null : null;
  const deletingFloor = deletingId ? floors.find((item) => item.id === deletingId) ?? null : null;

  const filteredFloors = useMemo(() => {
    return floors
      .filter((floor) => {
        const objectName = resolveName(floor.object);
        const matchesSearch =
          searchTerm === "" ||
          floor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          objectName.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesObject = filterObjectId === "" || floor.object_id === filterObjectId;
        const matchesStatus =
          filterStatus === "all" ||
          (filterStatus === "active" && floor.is_active) ||
          (filterStatus === "inactive" && !floor.is_active);
        return matchesSearch && matchesObject && matchesStatus;
      })
      .sort((left, right) => {
        const objectCompare = resolveName(left.object).localeCompare(resolveName(right.object), "ru");
        if (objectCompare !== 0) return objectCompare;
        if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
        return left.name.localeCompare(right.name, "ru");
      });
  }, [filterObjectId, filterStatus, floors, searchTerm]);

  const metrics = useMemo(
    () => [
      { label: "Всего этажей", value: floors.length, tone: "neutral" as const },
      { label: "Активных", value: floors.filter((item) => item.is_active).length, tone: "success" as const },
      { label: "Используются", value: floors.filter((item) => item.usage_count > 0).length, tone: "info" as const },
    ],
    [floors]
  );

  return (
    <>
      <PprPageShell
        metrics={metrics}
        onSearch={setSearchTerm}
        searchPlaceholder="Поиск по этажу или объекту..."
        isEmpty={floors.length === 0}
        emptyState={{
          message: "Справочник этажей пока пуст",
          hint: canManage
            ? "Создайте первый этаж для объекта, чтобы помещения больше не вводились свободным текстом."
            : "Справочник этажей пока не заполнен.",
        }}
        isFilteredEmpty={filteredFloors.length === 0}
        filters={
          <>
            <select
              className="select"
              value={filterObjectId}
              onChange={(event) => setFilterObjectId(event.target.value)}
              style={{ maxWidth: "220px" }}
            >
              <option value="">Все объекты</option>
              {objects.map((objectItem) => (
                <option key={objectItem.id} value={objectItem.id}>
                  {objectItem.name}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={filterStatus}
              onChange={(event) => setFilterStatus(event.target.value as "all" | "active" | "inactive")}
              style={{ maxWidth: "160px" }}
            >
              <option value="all">Все статусы</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </select>
            {canManage ? (
              <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)} disabled={!objects.length}>
                + Добавить
              </button>
            ) : null}
          </>
        }
      >
        <div className="desktop-only">
          <DataTable
            columns={[
              { key: "object", label: "Объект" },
              { key: "name", label: "Этаж" },
              { key: "usage", label: "Помещения" },
              { key: "status", label: "Статус" },
              { key: "actions", label: "Действия" },
            ]}
          >
            {filteredFloors.map((floor) => (
              <tr key={floor.id}>
                <td>{resolveName(floor.object)}</td>
                <td style={{ fontWeight: 600 }}>{floor.name}</td>
                <td>
                  <Link href={buildRoomsHref(floor)} className="btn btn-ghost ppr-action-btn">
                    {floor.usage_count}
                  </Link>
                </td>
                <td>
                  <StatusBadge isActive={floor.is_active} />
                </td>
                <td>
                  {canManage ? (
                    <div className="ppr-table-actions">
                      <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(floor.id)}>
                        Изменить
                      </button>
                      <button
                        className="btn btn-ghost ppr-action-btn"
                        type="button"
                        onClick={() => setDeletingId(floor.id)}
                        disabled={floor.usage_count > 0}
                      >
                        Удалить
                      </button>
                    </div>
                  ) : (
                    <span className="text-soft">Только просмотр</span>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        </div>

        <div className="mobile-cards mobile-only">
          {filteredFloors.map((floor) => (
            <div key={floor.id} className="section-card mobile-card">
              <div className="grid" style={{ gap: "0.45rem" }}>
                <div style={{ fontWeight: 600 }}>{floor.name}</div>
                <div className="text-soft">Объект: {resolveName(floor.object)}</div>
                <div className="text-soft">
                  Помещений:{" "}
                  <Link href={buildRoomsHref(floor)} className="btn btn-ghost ppr-action-btn" style={{ marginLeft: "0.35rem" }}>
                    {floor.usage_count}
                  </Link>
                </div>
                <div>
                  <StatusBadge isActive={floor.is_active} />
                </div>
                {canManage ? (
                  <div className="ppr-table-actions">
                    <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(floor.id)}>
                      Изменить
                    </button>
                    <button
                      className="btn btn-ghost ppr-action-btn"
                      type="button"
                      onClick={() => setDeletingId(floor.id)}
                      disabled={floor.usage_count > 0}
                    >
                      Удалить
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </PprPageShell>

      {canManage ? (
        <PprModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setIsDirty(false); }} title="Новый этаж" isDirty={isDirty}>
          <form
            action={createFloorAction}
            onSubmit={() => {
              setIsCreateOpen(false);
              setIsDirty(false);
            }}
            onChange={() => setIsDirty(true)}
            className="ppr-modal-content"
          >
            <div className="ppr-modal-body grid">
              <PprFormGroup label="Объект">
                <select className="select" name="object_id" required defaultValue="">
                  <option value="" disabled>
                    Выберите объект
                  </option>
                  {objects.map((objectItem) => (
                    <option key={objectItem.id} value={objectItem.id}>
                      {objectItem.name}
                    </option>
                  ))}
                </select>
              </PprFormGroup>
              <PprFormGroup label="Название этажа">
                <input className="input" name="name" placeholder="Например: 1, -1, Кровля" required />
              </PprFormGroup>
              <PprFormGroup label="Порядок сортировки">
                <input className="input" name="sort_order" type="number" placeholder="Например: 100" />
              </PprFormGroup>
              <label className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
                <input type="checkbox" name="is_active" defaultChecked />
                Активен
              </label>
            </div>
            <div className="ppr-modal-footer">
              <button className="btn btn-accent" type="submit">
                Создать
              </button>
            </div>
          </form>
        </PprModal>
      ) : null}

      {canManage ? (
        <PprModal
          open={Boolean(editingFloor)}
          onClose={() => {
            setEditingId(null);
            setIsDirty(false);
          }}
          title="Редактирование этажа"
          isDirty={isDirty}
        >
          {editingFloor ? (
            <form
              action={updateFloorAction}
              onSubmit={() => {
                setEditingId(null);
                setIsDirty(false);
              }}
              onChange={() => setIsDirty(true)}
              className="ppr-modal-content"
            >
              <div className="ppr-modal-body grid">
                <input type="hidden" name="floor_id" value={editingFloor.id} />
                <PprFormGroup label="Объект">
                  <select className="select" name="object_id" required defaultValue={editingFloor.object_id}>
                    {objects.map((objectItem) => (
                      <option key={objectItem.id} value={objectItem.id}>
                        {objectItem.name}
                      </option>
                    ))}
                  </select>
                </PprFormGroup>
                <PprFormGroup label="Название этажа">
                  <input className="input" name="name" defaultValue={editingFloor.name} required />
                </PprFormGroup>
                <PprFormGroup label="Порядок сортировки">
                  <input className="input" name="sort_order" type="number" defaultValue={editingFloor.sort_order} />
                </PprFormGroup>
                <label className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" name="is_active" defaultChecked={editingFloor.is_active} />
                  Активен
                </label>
              </div>
              <div className="ppr-modal-footer">
                <button className="btn btn-accent" type="submit">
                  Сохранить
                </button>
              </div>
            </form>
          ) : null}
        </PprModal>
      ) : null}

      {canManage ? (
        <PprModal open={Boolean(deletingFloor)} onClose={() => setDeletingId(null)} title="Удалить этаж?" isDirty={false}>
          {deletingFloor ? (
            <form action={deleteFloorAction} className="ppr-modal-content" onSubmit={() => setDeletingId(null)}>
              <div className="ppr-modal-body grid">
                <input type="hidden" name="floor_id" value={deletingFloor.id} />
                <div>Этаж: <strong>{deletingFloor.name}</strong></div>
                <div className="text-soft">Объект: {resolveName(deletingFloor.object)}</div>
                <div className="text-soft">Удаление доступно только для неиспользуемых этажей.</div>
              </div>
              <div className="ppr-modal-footer">
                <button className="btn btn-danger" type="submit">
                  Подтвердить удаление
                </button>
              </div>
            </form>
          ) : null}
        </PprModal>
      ) : null}
    </>
  );
}
