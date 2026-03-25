"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPprEquipmentAction, updatePprEquipmentAction } from "@/app/actions/ppr-directory-actions";
import { DataTable } from "@/components/ui/data-table";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { pprEquipmentStatusMeta } from "@/lib/ppr/presentation";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";
import { StatusBadge } from "@/components/ppr/ui/status-badge";

const PprEquipmentForm = dynamic(
  () => import("@/components/ppr/equipment/ppr-equipment-form").then((module) => module.PprEquipmentForm),
  { loading: () => <div className="section-card text-soft">Загрузка формы оборудования...</div> }
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

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

function resolveRoomLabel(
  raw:
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
    | null
    | undefined
) {
  const room = Array.isArray(raw) ? raw[0] : raw;
  if (!room) return "—";
  const floor = resolveName(room.floor_ref) !== "—" ? resolveName(room.floor_ref) : (room.floor ?? null);
  const roomType = resolveName(room.room_type);
  return [room.name, floor, roomType !== "—" ? roomType : null].filter(Boolean).join(" • ");
}

const EQUIPMENT_LABELS = {
  active: pprEquipmentStatusMeta.active.label,
  repair: pprEquipmentStatusMeta.repair.label,
  out_of_service: pprEquipmentStatusMeta.out_of_service.label,
  archived: pprEquipmentStatusMeta.archived.label,
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
  const [filterSystemId, setFilterSystemId] = useState("");
  const [filterRoomId, setFilterRoomId] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const editingEquipment = editingId ? equipment.find((item) => item.id === editingId) ?? null : null;
  const hasSelectedObject = filterObjectId !== "";
  const hasPrerequisites = hasSelectedObject && systems.length > 0 && rooms.length > 0;

  useEffect(() => {
    setFilterObjectId(initialFilterObjectId);
    setFilterSystemId("");
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
      const matchesSystem = filterSystemId === "" || item.system_id === filterSystemId;
      const matchesRoom = filterRoomId === "" || item.room_id === filterRoomId;
      const matchesStatus = filterStatus === "" || item.status === filterStatus;

      return matchesSearch && matchesObject && matchesSystem && matchesRoom && matchesStatus;
    });
  }, [equipment, searchTerm, filterObjectId, filterSystemId, filterRoomId, filterStatus]);

  // Dependent filters
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
                  ? "Для создания оборудования в выбранном объекте нужны система и помещение."
                  : "Добавьте первую единицу оборудования для выбранного объекта.",
        }}
        isFilteredEmpty={filteredEquipment.length === 0}
        filters={
          <>
            <select
              className="select"
              value={filterObjectId}
              onChange={(e) => {
                const nextObjectId = e.target.value;
                setFilterObjectId(nextObjectId);
                setFilterSystemId("");
                setFilterRoomId("");
                updateSearchParams(nextObjectId);
              }}
              style={{ maxWidth: "200px" }}
            >
              <option value="">Выберите объект</option>
              {objects.map((obj) => (
                <option key={obj.id} value={obj.id}>
                  {obj.name}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={filterSystemId}
              onChange={(e) => setFilterSystemId(e.target.value)}
              disabled={!hasSelectedObject}
              style={{ maxWidth: "200px" }}
            >
              <option value="">Все системы</option>
              {availableSystems.map((sys) => (
                <option key={sys.id} value={sys.id}>
                  {sys.name}
                </option>
              ))}
            </select>

            <select
              className="select"
              value={filterRoomId}
              onChange={(e) => setFilterRoomId(e.target.value)}
              disabled={!hasSelectedObject}
              style={{ maxWidth: "200px" }}
            >
              <option value="">Все помещения</option>
              {availableRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>

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
        <div className="desktop-only">
          <DataTable
            columns={[
              { key: "inventory", label: "Инв. номер" },
              { key: "name", label: "Оборудование" },
              { key: "object", label: "Объект" },
              { key: "system", label: "Система" },
              { key: "room", label: "Помещение" },
              { key: "status", label: "Статус" },
              { key: "actions", label: "Действия" },
            ]}
          >
            {filteredEquipment.map((item) => (
              <tr key={item.id}>
                <td style={{ fontFamily: "monospace", fontSize: "0.9em" }}>{item.inventory_no}</td>
                <td>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div className="text-soft" style={{ fontSize: "0.85em" }}>{item.dispatch_name}</div>
                </td>
                <td>{resolveName(item.object)}</td>
                <td>{resolveName(item.system)}</td>
                <td>{resolveRoomLabel(item.room)}</td>
                <td>
                  <StatusBadge status={item.status} labels={EQUIPMENT_LABELS} />
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
            ))}
          </DataTable>
        </div>

        <div className="mobile-cards mobile-only">
          {filteredEquipment.map((item) => (
            <div key={item.id} className="section-card mobile-card">
              <div className="grid" style={{ gap: "0.45rem" }}>
                <div style={{ fontWeight: 600 }}>{item.name}</div>
                <div className="text-soft">Инв. номер: {item.inventory_no}</div>
                <div className="text-soft">Объект: {resolveName(item.object)}</div>
                <div className="text-soft">Система: {resolveName(item.system)}</div>
                <div className="text-soft">Помещение: {resolveRoomLabel(item.room)}</div>
                <div>
                  <StatusBadge status={item.status} labels={EQUIPMENT_LABELS} />
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
          ))}
        </div>
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
