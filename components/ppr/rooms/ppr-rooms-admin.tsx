"use client";

import dynamic from "next/dynamic";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createObjectRoomActionSafe, updateObjectRoomActionSafe } from "@/app/actions/object-room-actions";
import { DataTable } from "@/components/ui/data-table";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";
import { StatusBadge } from "@/components/ppr/ui/status-badge";
import { AssigneeCombobox, type AssigneeOption } from "@/components/ui/assignee-combobox";

const PprRoomForm = dynamic(
  () => import("@/components/ppr/rooms/ppr-room-form").then((module) => module.PprRoomForm),
  { loading: () => <div className="section-card text-soft">Загрузка...</div> }
);
const PprRoomImportModal = dynamic(
  () => import("@/components/ppr/rooms/ppr-room-import-modal").then((module) => module.PprRoomImportModal),
  { loading: () => <div className="section-card text-soft">Загрузка...</div> }
);

type RoomRow = {
  id: string;
  object_id: string;
  name: string;
  floor: string | null;
  floor_id: string | null;
  room_type_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  object: { name: string } | Array<{ name: string }> | null;
  floor_ref:
    | { id: string; name: string; sort_order: number; is_active: boolean }
    | Array<{ id: string; name: string; sort_order: number; is_active: boolean }>
    | null;
  room_type: { id: string; name: string; is_active: boolean } | Array<{ id: string; name: string; is_active: boolean }> | null;
};

type ObjectOption = { id: string; name: string };
type FloorOption = { id: string; object_id: string; name: string; sort_order: number; is_active: boolean };
type RoomTypeOption = { id: string; name: string; sort_order: number | null; is_active: boolean };

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

function resolveFloor(raw: RoomRow["floor_ref"]) {
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function resolveRoomType(raw: RoomRow["room_type"]) {
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function getFloorLabel(room: RoomRow) {
  return resolveFloor(room.floor_ref)?.name ?? room.floor ?? "—";
}

function getRoomTypeLabel(room: RoomRow) {
  return resolveRoomType(room.room_type)?.name ?? "—";
}

export function PprRoomsAdmin({
  rooms,
  objects,
  floors,
  roomTypes,
  initialFilterObjectId = "",
  initialFilterFloorId = "",
  initialCreateOpen = false,
}: {
  rooms: RoomRow[];
  objects: ObjectOption[];
  floors: FloorOption[];
  roomTypes: RoomTypeOption[];
  initialFilterObjectId?: string;
  initialFilterFloorId?: string;
  initialCreateOpen?: boolean;
}) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(initialCreateOpen);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterObjectId, setFilterObjectId] = useState(initialFilterObjectId);
  const [filterFloorId, setFilterFloorId] = useState(initialFilterFloorId);
  const [filterRoomTypeId, setFilterRoomTypeId] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const editingRoom = editingId ? rooms.find((item) => item.id === editingId) ?? null : null;
  const hasSelectedObject = filterObjectId !== "";

  useEffect(() => {
    setFilterObjectId(initialFilterObjectId);
    setFilterFloorId(initialFilterFloorId);
  }, [initialFilterFloorId, initialFilterObjectId]);

  const availableFloors = useMemo(() => {
    const filtered = filterObjectId === "" ? floors : floors.filter((floor) => floor.object_id === filterObjectId);
    return filtered.filter((floor) => floor.is_active).sort((left, right) => {
      if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
      return left.name.localeCompare(right.name, "ru");
    });
  }, [filterObjectId, floors]);

  const availableRoomTypes = useMemo(
    () =>
      roomTypes.filter((roomType) => roomType.is_active).sort((left, right) => {
        const sortLeft = left.sort_order ?? Number.MAX_SAFE_INTEGER;
        const sortRight = right.sort_order ?? Number.MAX_SAFE_INTEGER;
        if (sortLeft !== sortRight) return sortLeft - sortRight;
        return left.name.localeCompare(right.name, "ru");
      }),
    [roomTypes]
  );

  const formObjects = useMemo(
    () => objects.filter((objectItem) => objectItem.id === filterObjectId),
    [filterObjectId, objects]
  );

  function updateSearchParams(nextObjectId: string) {
    const params = new URLSearchParams();
    if (nextObjectId) params.set("objectId", nextObjectId);
    router.replace((`/ppr/rooms${params.toString() ? `?${params.toString()}` : ""}`) as Route);
  }

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      const matchesSearch = searchTerm === "" || room.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesObject = filterObjectId === "" || room.object_id === filterObjectId;
      const matchesFloor = filterFloorId === "" || room.floor_id === filterFloorId;
      const matchesRoomType = filterRoomTypeId === "" || room.room_type_id === filterRoomTypeId;
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "active" && room.is_active) ||
        (filterStatus === "inactive" && !room.is_active);

      return matchesSearch && matchesObject && matchesFloor && matchesRoomType && matchesStatus;
    }).sort((a, b) => {
      const objectA = resolveName(a.object);
      const objectB = resolveName(b.object);
      if (objectA !== objectB) return objectA.localeCompare(objectB, "ru");

      const floorA = resolveFloor(a.floor_ref);
      const floorB = resolveFloor(b.floor_ref);
      const sortFloorA = floorA?.sort_order ?? Number.MAX_SAFE_INTEGER;
      const sortFloorB = floorB?.sort_order ?? Number.MAX_SAFE_INTEGER;
      if (sortFloorA !== sortFloorB) return sortFloorA - sortFloorB;

      const floorLabelA = getFloorLabel(a);
      const floorLabelB = getFloorLabel(b);
      if (floorLabelA !== floorLabelB) return floorLabelA.localeCompare(floorLabelB, "ru", { numeric: true });

      return a.name.localeCompare(b.name);
    });
  }, [filterFloorId, filterObjectId, filterRoomTypeId, filterStatus, rooms, searchTerm]);

  const metrics = useMemo(() => {
    const total = rooms.length;
    const floorCounts = rooms.reduce((acc, room) => {
      const floor = getFloorLabel(room);
      acc[floor] = (acc[floor] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topFloor = Object.entries(floorCounts)
      .sort(([, a], [, b]) => b - a)[0];

    return [
      { label: "Всего помещений", value: total, tone: "neutral" as const },
      {
        label: "Типов помещений",
        value: new Set(rooms.map((room) => room.room_type_id).filter((value): value is string => Boolean(value))).size,
        tone: "success" as const,
      },
      {
        label: "Больше всего помещений",
        value: topFloor ? `${topFloor[0]} (${topFloor[1]})` : "—",
        tone: "info" as const
      },
    ];
  }, [rooms]);

  return (
    <>
      <PprPageShell
        metrics={metrics}
        onSearch={setSearchTerm}
        searchPlaceholder="Поиск по названию..."
        isEmpty={!objects.length || !hasSelectedObject || rooms.length === 0}
        emptyState={{
          message:
            !objects.length
              ? "Нет доступных объектов"
              : !hasSelectedObject
                ? "Выберите объект"
                : "Помещения не найдены",
          hint:
            !objects.length
              ? "Чтобы добавить помещение, сначала нужен доступ хотя бы к одному объекту."
              : !hasSelectedObject
                ? "Сначала выберите объект, чтобы загрузить помещения и этажи только для него."
                : "Создайте первое помещение для выбранного объекта.",
        }}
        isFilteredEmpty={filteredRooms.length === 0}
        filters={
          <>
            <div style={{ maxWidth: "240px", width: "100%" }}>
              <AssigneeCombobox
                name="filter_object_id"
                placeholder="— Выберите объект —"
                defaultValue={filterObjectId}
                selectionHint="Выберите объект из списка"
                options={objects.map<AssigneeOption>((obj) => ({
                  id: obj.id,
                  label: obj.name,
                }))}
                onSelectedIdChange={(id) => {
                  setFilterObjectId(id);
                  setFilterFloorId("");
                  updateSearchParams(id);
                }}
              />
            </div>

            <div style={{ maxWidth: "220px", width: "100%" }}>
              <AssigneeCombobox
                key={`filter-floor-${filterObjectId || "any"}`}
                name="filter_floor_id"
                placeholder="Все этажи"
                defaultValue={filterFloorId}
                selectionHint="Выберите этаж из списка"
                options={availableFloors.map<AssigneeOption>((floor) => ({
                  id: floor.id,
                  label: floor.name,
                }))}
                onSelectedIdChange={(id) => setFilterFloorId(id)}
              />
            </div>

            <div style={{ maxWidth: "260px", width: "100%" }}>
              <AssigneeCombobox
                name="filter_room_type_id"
                placeholder="Все типы помещений"
                defaultValue={filterRoomTypeId}
                selectionHint="Выберите тип помещения из списка"
                options={availableRoomTypes.map<AssigneeOption>((roomType) => ({
                  id: roomType.id,
                  label: roomType.name,
                }))}
                onSelectedIdChange={(id) => setFilterRoomTypeId(id)}
              />
            </div>

            <select
              className="select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as "all" | "active" | "inactive")}
              style={{ maxWidth: "150px" }}
            >
              <option value="all">Все статусы</option>
              <option value="active">Активные</option>
              <option value="inactive">Неактивные</option>
            </select>

            <a className="btn btn-ghost" href="/templates/object-rooms-import-template.xlsx" download>
              Скачать шаблон
            </a>

            <button className="btn" type="button" onClick={() => setIsImportOpen(true)}>
              Импорт
            </button>

            <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)} disabled={!hasSelectedObject}>
              + Добавить
            </button>
          </>
        }
      >
        <div className="desktop-only">
          <DataTable
            columns={[
              { key: "object", label: "Объект" },
              { key: "floor", label: "Этаж" },
              { key: "room_type", label: "Тип помещения" },
              { key: "name", label: "Помещение" },
              { key: "status", label: "Статус" },
              { key: "actions", label: "Действия" },
            ]}
          >
            {filteredRooms.map((room) => (
              <tr 
                key={room.id}
                className="clickable-row"
                onClick={() => router.push(`/ppr/rooms/${encodeURIComponent(room.id)}` as Route)}
              >
                <td>{resolveName(room.object)}</td>
                <td>{getFloorLabel(room)}</td>
                <td>{getRoomTypeLabel(room)}</td>
                <td style={{ fontWeight: 600 }}>{room.name}</td>
                <td><StatusBadge isActive={room.is_active} /></td>
                <td onClick={(e) => e.stopPropagation()}>
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
            <div 
              key={room.id} 
              className="section-card mobile-card"
              style={{ cursor: "pointer" }}
              onClick={() => router.push(`/ppr/rooms/${encodeURIComponent(room.id)}` as Route)}
            >
              <div className="grid" style={{ gap: "0.45rem" }}>
                <div style={{ fontWeight: 600 }}>{room.name}</div>
                <div className="text-soft">Объект: {resolveName(room.object)}</div>
                <div className="text-soft">Этаж: {getFloorLabel(room)}</div>
                <div className="text-soft">Тип помещения: {getRoomTypeLabel(room)}</div>
                <div><StatusBadge isActive={room.is_active} /></div>
                <div className="ppr-table-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(room.id)}>
                    Изменить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PprPageShell>

      <PprModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setIsDirty(false); }} title="Новое помещение" isDirty={isDirty}>
        <PprRoomForm
          action={createObjectRoomActionSafe}
          objects={formObjects}
          floors={floors}
          roomTypes={roomTypes}
          onSubmitted={() => {
            router.refresh();
            setIsCreateOpen(false);
            setIsDirty(false);
          }}
          onChange={() => setIsDirty(true)}
          submitLabel="Создать"
        />
      </PprModal>

      <PprModal open={Boolean(editingRoom)} onClose={() => { setEditingId(null); setIsDirty(false); }} title="Редактирование помещения" isDirty={isDirty}>
        {editingRoom ? (
          <PprRoomForm
            action={updateObjectRoomActionSafe}
            roomId={editingRoom.id}
            objects={formObjects}
            floors={floors}
            roomTypes={roomTypes}
            onSubmitted={() => {
              router.refresh();
              setEditingId(null);
              setIsDirty(false);
            }}
            onChange={() => setIsDirty(true)}
            submitLabel="Сохранить"
            initialValues={{
              object_id: editingRoom.object_id,
              name: editingRoom.name,
              floor_id: editingRoom.floor_id ?? "",
              room_type_id: editingRoom.room_type_id ?? "",
              description: editingRoom.description ?? "",
              is_active: editingRoom.is_active,
            }}
          />
        ) : null}
      </PprModal>

      <PprRoomImportModal
        open={isImportOpen}
        onClose={() => {
          setIsImportOpen(false);
        }}
      />
    </>
  );
}
