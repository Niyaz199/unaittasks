"use client";

import dynamic from "next/dynamic";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPprEquipmentAction, updatePprEquipmentAction } from "@/app/actions/ppr-directory-actions";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { pprEquipmentStatusMeta } from "@/lib/ppr/presentation";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";
import { PprEquipmentTree } from "@/components/ppr/equipment/ppr-equipment-tree";
import { AssigneeCombobox, type AssigneeOption } from "@/components/ui/assignee-combobox";

const PprEquipmentForm = dynamic(
  () => import("@/components/ppr/equipment/ppr-equipment-form").then((module) => module.PprEquipmentForm),
  { loading: () => <div className="section-card text-soft">Загрузка...</div> }
);

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
  room:
    | {
        name: string;
        floor: string | null;
        floor_ref: { name: string } | Array<{ name: string }> | null;
        room_type: { name: string } | Array<{ name: string }> | null;
      }
    | Array<{
        name: string;
        floor: string | null;
        floor_ref: { name: string } | Array<{ name: string }> | null;
        room_type: { name: string } | Array<{ name: string }> | null;
      }>
    | null;
};

type ObjectOption = { id: string; name: string };
type SystemOption = { id: string; object_id: string; name: string };
type RoomOption = {
  id: string;
  object_id: string;
  name: string;
  floor_name: string | null;
  room_type_name: string | null;
  is_active: boolean;
};

export function PprEquipmentAdmin({
  equipment,
  objects,
  systems,
  rooms,
  initialFilterObjectId = "",
}: {
  equipment: EquipmentRow[];
  objects: ObjectOption[];
  systems: SystemOption[];
  rooms: RoomOption[];
  initialFilterObjectId?: string;
}) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [filterObjectId, setFilterObjectId] = useState(initialFilterObjectId);
  const [filterRoomId, setFilterRoomId] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const editingEquipment = editingId ? equipment.find((item) => item.id === editingId) ?? null : null;
  const hasSelectedObject = filterObjectId !== "";
  const hasPrerequisites = hasSelectedObject && systems.length > 0 && rooms.length > 0;

  useEffect(() => {
    setFilterObjectId(initialFilterObjectId);
    setFilterRoomId("");
  }, [initialFilterObjectId]);

  // Filter logic
  const filteredEquipment = useMemo(() => {
    return equipment.filter((item) => {
      const matchesSearch =
        searchTerm === "" ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.inventory_no.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesObject = filterObjectId === "" || item.object_id === filterObjectId;
      const matchesRoom = filterRoomId === "" || item.room_id === filterRoomId;
      const matchesStatus = filterStatus === "" || item.status === filterStatus;

      return matchesSearch && matchesObject && matchesRoom && matchesStatus;
    });
  }, [equipment, searchTerm, filterObjectId, filterRoomId, filterStatus]);

  const availableSystems = useMemo(() => {
    if (!filterObjectId) return systems;
    return systems.filter((s) => s.object_id === filterObjectId);
  }, [systems, filterObjectId]);

  const availableRooms = useMemo(() => {
    if (!filterObjectId) return rooms;
    return rooms.filter((r) => r.object_id === filterObjectId);
  }, [rooms, filterObjectId]);

  const formObjects = useMemo(
    () => objects.filter((objectItem) => objectItem.id === filterObjectId),
    [filterObjectId, objects]
  );

  function updateSearchParams(nextObjectId: string) {
    const params = new URLSearchParams();
    if (nextObjectId) params.set("objectId", nextObjectId);
    router.replace((`/ppr/equipment${params.toString() ? `?${params.toString()}` : ""}`) as Route);
  }

  // Summary metrics
  const metrics = useMemo(() => {
    const total = equipment.length;
    const active = equipment.filter((e) => e.status === "active").length;
    const repair = equipment.filter((e) => e.status === "repair").length;
    const out = equipment.filter((e) => e.status === "out_of_service").length;

    return [
      { label: "Всего оборудования", value: total, tone: "neutral" as const },
      { label: "В эксплуатации", value: active, tone: "success" as const },
      { label: "В ремонте", value: repair, tone: "warning" as const },
      { label: "Выведено", value: out, tone: "danger" as const },
    ];
  }, [equipment]);

  return (
    <>
      <PprPageShell
        metrics={metrics}
        onSearch={setSearchTerm}
        searchPlaceholder="Поиск по названию или инв. номеру..."
        isEmpty={!objects.length || !hasSelectedObject || !hasPrerequisites || equipment.length === 0}
        emptyState={{
          message:
            !objects.length
              ? "Нет доступных объектов"
              : !hasSelectedObject
                ? "Выберите объект"
                : !hasPrerequisites
                  ? "Недостаточно структуры для создания оборудования"
                  : "Оборудование ППР пока не создано",
          hint:
            !objects.length
              ? "Чтобы управлять оборудованием, нужен доступ хотя бы к одному объекту."
              : !hasSelectedObject
                ? "Сначала выберите объект, чтобы загрузить оборудование, системы и помещения только для него."
                : !hasPrerequisites
                  ? !availableSystems.length
                    ? "Для создания оборудования в выбранном объекте нужна хотя бы одна система."
                    : "Для создания оборудования нужно хотя бы одно помещение в этом объекте."
                  : "Добавьте первую единицу оборудования для выбранного объекта.",
          actionLabel:
            hasSelectedObject && !hasPrerequisites
              ? availableSystems.length === 0
                ? "Создать систему →"
                : availableRooms.length === 0
                  ? "Создать помещение →"
                  : undefined
              : undefined,
          actionHref:
            hasSelectedObject && !hasPrerequisites
              ? availableSystems.length === 0
                ? (`/ppr/systems?objectId=${filterObjectId}&new=1` as Route)
                : availableRooms.length === 0
                  ? (`/ppr/rooms?objectId=${filterObjectId}&new=1` as Route)
                  : undefined
              : undefined,
        }}
        isFilteredEmpty={filteredEquipment.length === 0}
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
                  setFilterRoomId("");
                  updateSearchParams(id);
                }}
              />
            </div>

            <div style={{ maxWidth: "240px", width: "100%", opacity: hasSelectedObject ? 1 : 0.5, pointerEvents: hasSelectedObject ? "auto" : "none" }}>
              <AssigneeCombobox
                key={`filter-room-${filterObjectId || "any"}`}
                name="filter_room_id"
                placeholder="Все помещения"
                defaultValue={filterRoomId}
                selectionHint="Выберите помещение из списка"
                options={availableRooms.map<AssigneeOption>((room) => ({
                  id: room.id,
                  label: [room.name, room.floor_name, room.room_type_name].filter(Boolean).join(" • "),
                }))}
                onSelectedIdChange={(id) => setFilterRoomId(id)}
              />
            </div>

            <select
              className="select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ maxWidth: "150px" }}
            >
              <option value="">Все статусы</option>
              {Object.entries(pprEquipmentStatusMeta).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>

            <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)} disabled={!hasPrerequisites}>
              + Добавить
            </button>
          </>
        }
      >
        <PprEquipmentTree
          equipment={filteredEquipment}
          systems={availableSystems}
          onEdit={(id) => setEditingId(id)}
        />
      </PprPageShell>

      <PprModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setIsDirty(false); }} title="Новое оборудование ППР" isDirty={isDirty}>
        <PprEquipmentForm
          action={createPprEquipmentAction}
          objects={formObjects}
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
            objects={formObjects}
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
