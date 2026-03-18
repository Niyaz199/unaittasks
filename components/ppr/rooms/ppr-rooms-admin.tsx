"use client";

import { useMemo, useState } from "react";
import { createObjectRoomAction, updateObjectRoomAction } from "@/app/actions/object-room-actions";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PprModal, PprFormGroup } from "@/components/ppr/ui/ppr-modal";
import { DirectoryToolbar } from "@/components/ppr/ui/directory-toolbar";
import { DirectorySummary } from "@/components/ppr/ui/directory-summary";
import { StatusBadge } from "@/components/ppr/ui/status-badge";

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

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterObjectId, setFilterObjectId] = useState("");
  const [filterFloor, setFilterFloor] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const editingRoom = editingId ? rooms.find((item) => item.id === editingId) ?? null : null;

  // Collect unique floors for filter
  const uniqueFloors = useMemo(() => {
    const floors = new Set<string>();
    rooms.forEach((room) => {
      if (room.floor) floors.add(room.floor);
    });
    return Array.from(floors).sort();
  }, [rooms]);

  // Filter logic
  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesSearch = searchTerm === "" || room.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesObject = filterObjectId === "" || room.object_id === filterObjectId;
      const matchesFloor = filterFloor === "" || room.floor === filterFloor;
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && room.is_active) ||
        (filterStatus === "inactive" && !room.is_active);

      return matchesSearch && matchesObject && matchesFloor && matchesStatus;
    }).sort((a, b) => {
      // Sort by Object -> Floor -> Name
      const objectA = resolveName(a.object);
      const objectB = resolveName(b.object);
      if (objectA !== objectB) return objectA.localeCompare(objectB);
      
      const floorA = a.floor || "";
      const floorB = b.floor || "";
      if (floorA !== floorB) return floorA.localeCompare(floorB, undefined, { numeric: true });
      
      return a.name.localeCompare(b.name);
    });
  }, [rooms, searchTerm, filterObjectId, filterFloor, filterStatus]);

  // Summary metrics
  const metrics = useMemo(() => {
    const total = rooms.length;
    
    // Most populated floor
    const floorCounts = rooms.reduce((acc, room) => {
      const floor = room.floor || "Без этажа";
      acc[floor] = (acc[floor] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topFloor = Object.entries(floorCounts)
      .sort(([, a], [, b]) => b - a)[0];

    return [
      { label: "Всего помещений", value: total, tone: "neutral" as const },
      { 
        label: "Больше всего помещений", 
        value: topFloor ? `${topFloor[0]} (${topFloor[1]})` : "—", 
        tone: "info" as const 
      },
    ];
  }, [rooms]);

  return (
    <div className="grid" style={{ gap: "1.5rem" }}>
      <DirectorySummary metrics={metrics} />

      <DirectoryToolbar onSearch={setSearchTerm} searchPlaceholder="Поиск по названию...">
        <select
          className="select"
          value={filterObjectId}
          onChange={(e) => setFilterObjectId(e.target.value)}
          style={{ maxWidth: "200px" }}
        >
          <option value="">Все объекты</option>
          {objects.map((obj) => (
            <option key={obj.id} value={obj.id}>
              {obj.name}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={filterFloor}
          onChange={(e) => setFilterFloor(e.target.value)}
          style={{ maxWidth: "150px" }}
        >
          <option value="">Все этажи</option>
          {uniqueFloors.map((floor) => (
            <option key={floor} value={floor}>
              {floor}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          style={{ maxWidth: "150px" }}
        >
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
        </select>

        <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)} disabled={!objects.length}>
          + Добавить
        </button>
      </DirectoryToolbar>

      {!objects.length ? (
        <EmptyState message="Нет доступных объектов" hint="Чтобы добавить помещение, сначала нужен доступ хотя бы к одному объекту." />
      ) : !filteredRooms.length ? (
        <EmptyState 
          message="Помещения не найдены" 
          hint={rooms.length ? "Попробуйте изменить параметры фильтрации." : "Создайте первое помещение для доступного объекта."} 
        />
      ) : (
        <>
          <div className="desktop-only">
            <DataTable
              columns={[
                { key: "name", label: "Помещение" },
                { key: "object", label: "Объект" },
                { key: "floor", label: "Этаж" },
                { key: "status", label: "Статус" },
                { key: "actions", label: "Действия" },
              ]}
            >
              {filteredRooms.map((room) => (
                <tr key={room.id}>
                  <td style={{ fontWeight: 600 }}>{room.name}</td>
                  <td>{resolveName(room.object)}</td>
                  <td>{room.floor ?? "—"}</td>
                  <td><StatusBadge isActive={room.is_active} /></td>
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
            {filteredRooms.map((room) => (
              <div key={room.id} className="section-card mobile-card">
                <div className="grid" style={{ gap: "0.45rem" }}>
                  <div style={{ fontWeight: 600 }}>{room.name}</div>
                  <div className="text-soft">Объект: {resolveName(room.object)}</div>
                  <div className="text-soft">Этаж: {room.floor ?? "—"}</div>
                  <div><StatusBadge isActive={room.is_active} /></div>
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

      <PprModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setIsDirty(false); }} title="Новое помещение" isDirty={isDirty}>
        <form action={createObjectRoomAction} onSubmit={() => { setIsCreateOpen(false); setIsDirty(false); }} onChange={() => setIsDirty(true)} className="ppr-modal-content">
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

      <PprModal open={Boolean(editingRoom)} onClose={() => { setEditingId(null); setIsDirty(false); }} title="Редактирование помещения" isDirty={isDirty}>
        {editingRoom ? (
          <form action={updateObjectRoomAction} onSubmit={() => { setEditingId(null); setIsDirty(false); }} onChange={() => setIsDirty(true)} className="ppr-modal-content">
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
    </div>
  );
}
