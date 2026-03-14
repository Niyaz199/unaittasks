"use client";

import { useEffect, useMemo, useState } from "react";
import { pprEquipmentStatusMeta } from "@/lib/ppr/presentation";
import { PprFormGroup, PprFormSection } from "@/components/ppr/ui/ppr-modal";

type ObjectOption = { id: string; name: string };
type SystemOption = { id: string; object_id: string; name: string };
type SubsystemOption = { id: string; object_id: string; system_id: string; name: string };
type RoomOption = { id: string; object_id: string; name: string };

type EquipmentFormValues = {
  object_id: string;
  system_id: string;
  subsystem_id: string;
  room_id: string;
  inventory_no: string;
  name: string;
  dispatch_name: string;
  service_start_date: string;
  status: "active" | "repair" | "out_of_service" | "archived";
  serial_no: string;
  manufacturer: string;
  model: string;
  description: string;
  comment: string;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  objects: ObjectOption[];
  systems: SystemOption[];
  subsystems: SubsystemOption[];
  rooms: RoomOption[];
  initialValues?: Partial<EquipmentFormValues>;
  equipmentId?: string;
  onSubmitted?: () => void;
  onChange?: () => void;
  submitLabel: string;
};

const defaultValues: EquipmentFormValues = {
  object_id: "",
  system_id: "",
  subsystem_id: "",
  room_id: "",
  inventory_no: "",
  name: "",
  dispatch_name: "",
  service_start_date: "",
  status: "active",
  serial_no: "",
  manufacturer: "",
  model: "",
  description: "",
  comment: "",
};

export function PprEquipmentForm({
  action,
  objects,
  systems,
  subsystems,
  rooms,
  initialValues,
  equipmentId,
  onSubmitted,
  onChange,
  submitLabel,
}: Props) {
  const values = { ...defaultValues, ...initialValues };
  const [selectedObjectId, setSelectedObjectId] = useState(values.object_id);
  const [selectedSystemId, setSelectedSystemId] = useState(values.system_id);
  const [selectedSubsystemId, setSelectedSubsystemId] = useState(values.subsystem_id);
  const [selectedRoomId, setSelectedRoomId] = useState(values.room_id);

  const filteredSystems = useMemo(
    () => systems.filter((system) => !selectedObjectId || system.object_id === selectedObjectId),
    [selectedObjectId, systems]
  );
  const filteredSubsystems = useMemo(
    () =>
      subsystems.filter(
        (subsystem) =>
          (!selectedObjectId || subsystem.object_id === selectedObjectId) &&
          (!selectedSystemId || subsystem.system_id === selectedSystemId)
      ),
    [selectedObjectId, selectedSystemId, subsystems]
  );
  const filteredRooms = useMemo(
    () => rooms.filter((room) => !selectedObjectId || room.object_id === selectedObjectId),
    [selectedObjectId, rooms]
  );

  useEffect(() => {
    if (selectedSystemId && !filteredSystems.some((system) => system.id === selectedSystemId)) {
      setSelectedSystemId("");
    }
  }, [filteredSystems, selectedSystemId]);

  useEffect(() => {
    if (selectedSubsystemId && !filteredSubsystems.some((subsystem) => subsystem.id === selectedSubsystemId)) {
      setSelectedSubsystemId("");
    }
  }, [filteredSubsystems, selectedSubsystemId]);

  useEffect(() => {
    if (selectedRoomId && !filteredRooms.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId("");
    }
  }, [filteredRooms, selectedRoomId]);

  return (
    <form action={action} className="ppr-modal-content" onSubmit={onSubmitted} onChange={onChange}>
      <div className="ppr-modal-body grid">
        {equipmentId ? <input type="hidden" name="equipment_id" value={equipmentId} /> : null}

        <PprFormSection title="Расположение" desc="Привязка к инженерной структуре объекта">
          <PprFormGroup label="Объект">
            <select
              className="select"
              name="object_id"
              required
              value={selectedObjectId}
              onChange={(event) => setSelectedObjectId(event.target.value)}
            >
              <option value="" disabled>Выберите объект</option>
              {objects.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </PprFormGroup>

          <PprFormGroup label="Система">
            <select
              className="select"
              name="system_id"
              required
              value={selectedSystemId}
              onChange={(event) => setSelectedSystemId(event.target.value)}
            >
              <option value="" disabled>Выберите систему</option>
              {filteredSystems.map((system) => (
                <option key={system.id} value={system.id}>{system.name}</option>
              ))}
            </select>
          </PprFormGroup>

          <PprFormGroup label="Подсистема">
            <select
              className="select"
              name="subsystem_id"
              required
              value={selectedSubsystemId}
              onChange={(event) => setSelectedSubsystemId(event.target.value)}
            >
              <option value="" disabled>Выберите подсистему</option>
              {filteredSubsystems.map((subsystem) => (
                <option key={subsystem.id} value={subsystem.id}>{subsystem.name}</option>
              ))}
            </select>
          </PprFormGroup>

          <PprFormGroup label="Помещение">
            <select className="select" name="room_id" required value={selectedRoomId} onChange={(event) => setSelectedRoomId(event.target.value)}>
              <option value="" disabled>Выберите помещение</option>
              {filteredRooms.map((room) => (
                <option key={room.id} value={room.id}>{room.name}</option>
              ))}
            </select>
          </PprFormGroup>
        </PprFormSection>

        <PprFormSection title="Идентификация" desc="Основные параметры оборудования">
          <PprFormGroup label="Инвентарный номер">
            <input className="input" name="inventory_no" defaultValue={values.inventory_no} placeholder="Генерируется автоматически, если пусто" />
          </PprFormGroup>
          
          <PprFormGroup label="Название оборудования">
            <input className="input" name="name" defaultValue={values.name} placeholder="Полное наименование оборудования" required />
          </PprFormGroup>
          
          <PprFormGroup label="Диспетчерское имя">
            <input className="input" name="dispatch_name" defaultValue={values.dispatch_name} placeholder="Краткое имя для диспетчера" required />
          </PprFormGroup>
          
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <PprFormGroup label="Дата ввода">
              <input className="input" type="date" name="service_start_date" defaultValue={values.service_start_date} required />
            </PprFormGroup>

            <PprFormGroup label="Статус">
              <select className="select" name="status" defaultValue={values.status}>
                {Object.entries(pprEquipmentStatusMeta).map(([status, meta]) => (
                  <option key={status} value={status}>{meta.label}</option>
                ))}
              </select>
            </PprFormGroup>
          </div>
        </PprFormSection>

        <PprFormSection title="Технические характеристики">
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <PprFormGroup label="Производитель">
              <input className="input" name="manufacturer" defaultValue={values.manufacturer} placeholder="Изготовитель" />
            </PprFormGroup>
            
            <PprFormGroup label="Модель">
              <input className="input" name="model" defaultValue={values.model} placeholder="Модель" />
            </PprFormGroup>
          </div>

          <PprFormGroup label="Серийный номер">
            <input className="input" name="serial_no" defaultValue={values.serial_no} placeholder="S/N (необязательно)" />
          </PprFormGroup>

          <PprFormGroup label="Описание">
            <textarea className="input" name="description" rows={3} defaultValue={values.description} placeholder="Технические характеристики / описание" />
          </PprFormGroup>
          
          <PprFormGroup label="Комментарий">
            <textarea className="input" name="comment" rows={3} defaultValue={values.comment} placeholder="Скрытый комментарий (необязательно)" />
          </PprFormGroup>
        </PprFormSection>
      </div>

      <div className="ppr-modal-footer">
        <button className="btn btn-accent" type="submit">
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
