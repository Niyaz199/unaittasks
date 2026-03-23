"use client";

import { useMemo, useState } from "react";
import { createRoomTypeAction, deleteRoomTypeAction, updateRoomTypeAction } from "@/app/actions/room-type-actions";
import { DataTable } from "@/components/ui/data-table";
import { PprModal, PprFormGroup } from "@/components/ppr/ui/ppr-modal";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";
import { StatusBadge } from "@/components/ppr/ui/status-badge";

type RoomTypeRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  usage_count: number;
};

export function RoomTypesAdminList({ roomTypes, canManage }: { roomTypes: RoomTypeRow[]; canManage: boolean }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const editingRoomType = editingId ? roomTypes.find((item) => item.id === editingId) ?? null : null;
  const deletingRoomType = deletingId ? roomTypes.find((item) => item.id === deletingId) ?? null : null;

  const filteredRoomTypes = useMemo(() => {
    return roomTypes
      .filter((roomType) => {
        const matchesSearch =
          searchTerm === "" ||
          roomType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (roomType.description ?? "").toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus =
          filterStatus === "all" ||
          (filterStatus === "active" && roomType.is_active) ||
          (filterStatus === "inactive" && !roomType.is_active);
        return matchesSearch && matchesStatus;
      })
      .sort((left, right) => {
        const sortLeft = left.sort_order ?? Number.MAX_SAFE_INTEGER;
        const sortRight = right.sort_order ?? Number.MAX_SAFE_INTEGER;
        if (sortLeft !== sortRight) return sortLeft - sortRight;
        return left.name.localeCompare(right.name, "ru");
      });
  }, [filterStatus, roomTypes, searchTerm]);

  const metrics = useMemo(
    () => [
      { label: "Всего типов", value: roomTypes.length, tone: "neutral" as const },
      { label: "Активных", value: roomTypes.filter((item) => item.is_active).length, tone: "success" as const },
      { label: "Используются", value: roomTypes.filter((item) => item.usage_count > 0).length, tone: "info" as const },
    ],
    [roomTypes]
  );

  return (
    <>
      <PprPageShell
        metrics={metrics}
        onSearch={setSearchTerm}
        searchPlaceholder="Поиск по названию или описанию..."
        isEmpty={roomTypes.length === 0}
        emptyState={{
          message: "Справочник типов помещений пока пуст",
          hint: canManage
            ? "Создайте первый тип помещения, чтобы помещения и будущие обходы использовали единый классификатор."
            : "Справочник типов помещений пока не заполнен.",
        }}
        isFilteredEmpty={filteredRoomTypes.length === 0}
        filters={
          <>
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
              <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)}>
                + Добавить
              </button>
            ) : null}
          </>
        }
      >
        <div className="desktop-only">
          <DataTable
            columns={[
              { key: "name", label: "Название" },
              { key: "description", label: "Описание" },
              { key: "sort", label: "Порядок" },
              { key: "usage", label: "Помещения" },
              { key: "status", label: "Статус" },
              { key: "actions", label: "Действия" },
            ]}
          >
            {filteredRoomTypes.map((roomType) => (
              <tr key={roomType.id}>
                <td style={{ fontWeight: 600 }}>{roomType.name}</td>
                <td>{roomType.description ?? "—"}</td>
                <td>{roomType.sort_order ?? "—"}</td>
                <td>{roomType.usage_count}</td>
                <td>
                  <StatusBadge isActive={roomType.is_active} />
                </td>
                <td>
                  {canManage ? (
                    <div className="ppr-table-actions">
                      <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(roomType.id)}>
                        Изменить
                      </button>
                      <button
                        className="btn btn-ghost ppr-action-btn"
                        type="button"
                        onClick={() => setDeletingId(roomType.id)}
                        disabled={roomType.usage_count > 0}
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
          {filteredRoomTypes.map((roomType) => (
            <div key={roomType.id} className="section-card mobile-card">
              <div className="grid" style={{ gap: "0.45rem" }}>
                <div style={{ fontWeight: 600 }}>{roomType.name}</div>
                <div className="text-soft">Описание: {roomType.description ?? "—"}</div>
                <div className="text-soft">Порядок: {roomType.sort_order ?? "—"}</div>
                <div className="text-soft">Помещений: {roomType.usage_count}</div>
                <div>
                  <StatusBadge isActive={roomType.is_active} />
                </div>
                {canManage ? (
                  <div className="ppr-table-actions">
                    <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(roomType.id)}>
                      Изменить
                    </button>
                    <button
                      className="btn btn-ghost ppr-action-btn"
                      type="button"
                      onClick={() => setDeletingId(roomType.id)}
                      disabled={roomType.usage_count > 0}
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
        <PprModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setIsDirty(false); }} title="Новый тип помещения" isDirty={isDirty}>
          <form
            action={createRoomTypeAction}
            onSubmit={() => {
              setIsCreateOpen(false);
              setIsDirty(false);
            }}
            onChange={() => setIsDirty(true)}
            className="ppr-modal-content"
          >
            <div className="ppr-modal-body grid">
              <PprFormGroup label="Название">
                <input className="input" name="name" placeholder="Например: Серверная" required />
              </PprFormGroup>
              <PprFormGroup label="Описание">
                <textarea className="input" name="description" rows={3} placeholder="Необязательное описание" />
              </PprFormGroup>
              <PprFormGroup label="Порядок сортировки">
                <input className="input" name="sort_order" type="number" placeholder="Например: 10" />
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
          open={Boolean(editingRoomType)}
          onClose={() => {
            setEditingId(null);
            setIsDirty(false);
          }}
          title="Редактирование типа помещения"
          isDirty={isDirty}
        >
          {editingRoomType ? (
            <form
              action={updateRoomTypeAction}
              onSubmit={() => {
                setEditingId(null);
                setIsDirty(false);
              }}
              onChange={() => setIsDirty(true)}
              className="ppr-modal-content"
            >
              <div className="ppr-modal-body grid">
                <input type="hidden" name="room_type_id" value={editingRoomType.id} />
                <PprFormGroup label="Название">
                  <input className="input" name="name" defaultValue={editingRoomType.name} required />
                </PprFormGroup>
                <PprFormGroup label="Описание">
                  <textarea className="input" name="description" rows={3} defaultValue={editingRoomType.description ?? ""} />
                </PprFormGroup>
                <PprFormGroup label="Порядок сортировки">
                  <input className="input" name="sort_order" type="number" defaultValue={editingRoomType.sort_order ?? undefined} />
                </PprFormGroup>
                <label className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
                  <input type="checkbox" name="is_active" defaultChecked={editingRoomType.is_active} />
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
        <PprModal open={Boolean(deletingRoomType)} onClose={() => setDeletingId(null)} title="Удалить тип помещения?" isDirty={false}>
          {deletingRoomType ? (
            <form action={deleteRoomTypeAction} className="ppr-modal-content" onSubmit={() => setDeletingId(null)}>
              <div className="ppr-modal-body grid">
                <input type="hidden" name="room_type_id" value={deletingRoomType.id} />
                <div>
                  Тип: <strong>{deletingRoomType.name}</strong>
                </div>
                <div className="text-soft">Удаление доступно только для неиспользуемых типов помещений.</div>
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
