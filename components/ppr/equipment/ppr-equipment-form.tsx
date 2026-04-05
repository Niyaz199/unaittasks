"use client";

import { useEffect, useMemo, useState } from "react";
import { pprEquipmentStatusMeta } from "@/lib/ppr/presentation";
import { PprFormGroup, PprFormSection } from "@/components/ppr/ui/ppr-modal";
import { useToast } from "@/components/ui/toast";

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

type EquipmentFormValues = {
  object_id: string;
  system_id: string;
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
  const [selectedRoomId, setSelectedRoomId] = useState(values.room_id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  const filteredSystems = useMemo(
    () => systems.filter((system) => !selectedObjectId || system.object_id === selectedObjectId),
    [selectedObjectId, systems]
  );
  const filteredRooms = useMemo(
    () => rooms.filter((room) => (!selectedObjectId || room.object_id === selectedObjectId) && (room.is_active || room.id === selectedRoomId)),
    [selectedObjectId, selectedRoomId, rooms]
  );

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (selectedSystemId && !filteredSystems.some((system) => system.id === selectedSystemId)) {
      setSelectedSystemId("");
    }
  }, [filteredSystems, selectedSystemId]);

  useEffect(() => {
    if (selectedRoomId && !filteredRooms.some((room) => room.id === selectedRoomId)) {
      setSelectedRoomId("");
    }
  }, [filteredRooms, selectedRoomId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    
    try {
      await action(formData);
      addToast(equipmentId ? "Оборудование успешно обновлено" : "Оборудование успешно создано", "success");
      onSubmitted?.();
    } catch (error) {
      addToast("Произошла ошибка при сохранении", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} onChange={onChange} className="ppr-modal-content">
      <div className="ppr-modal-body grid">
        {equipmentId ? <input type="hidden" name="equipment_id" value={equipmentId} /> : null}

        <PprFormSection title="Расположение" desc="Привязка к инженерной системе объекта и общему помещению">
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

          <PprFormGroup label="Помещение">
            <select className="select" name="room_id" required value={selectedRoomId} onChange={(event) => setSelectedRoomId(event.target.value)}>
              <option value="" disabled>Выберите помещение</option>
              {filteredRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                  {room.floor_name ? ` • ${room.floor_name}` : ""}
                  {room.room_type_name ? ` • ${room.room_type_name}` : ""}
                  {room.is_active ? "" : " (неактивно)"}
                </option>
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
          
          <PprFormGroup label="Диспетчерское наименование" description="краткое имя в сводках и таблицах">
            <input className="input" name="dispatch_name" defaultValue={values.dispatch_name} placeholder="Например: ВУ-01, Насос П-2" required />
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
          <div className="grid" style={{ gap: "0.5rem" }}>
            <button 
              type="button" 
              className="btn btn-ghost" 
              style={{ width: "100%", justifyContent: "space-between", display: "flex" }}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>Дополнительные параметры</span>
              <span style={{ transform: showAdvanced ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
            </button>
          </div>

          {showAdvanced && (
            <div className="grid" style={{ gap: "1rem", marginTop: "1rem" }}>
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
              
              <PprFormGroup label="Комментарий" description="внутренние заметки, не видны в отчётах">
                <textarea className="input" name="comment" rows={3} defaultValue={values.comment} placeholder="Внутренний комментарий (необязательно)" />
              </PprFormGroup>
            </div>
          )}
        </PprFormSection>
      </div>

      <div className="ppr-modal-footer">
        <button className="btn btn-accent" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Сохранение..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
