"use client";

import { useEffect, useMemo, useState } from "react";
import { PprFormGroup, PprFormSection } from "@/components/ppr/ui/ppr-modal";
import { useToast } from "@/components/ui/toast";

type ObjectOption = { id: string; name: string };
type SystemOption = { id: string; object_id: string; name: string; is_active?: boolean };
type RoomOption = { id: string; object_id: string; name: string; is_active?: boolean };

type StockLocationFormValues = {
  object_id: string;
  system_id: string;
  room_id: string;
  name: string;
  description: string;
  is_active: boolean;
};

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  objects: ObjectOption[];
  systems: SystemOption[];
  rooms: RoomOption[];
  initialValues?: Partial<StockLocationFormValues>;
  locationId?: string;
  onSubmitted?: () => void;
  onChange?: () => void;
  submitLabel: string;
};

const defaultValues: StockLocationFormValues = {
  object_id: "",
  system_id: "",
  room_id: "",
  name: "",
  description: "",
  is_active: true,
};

export function StockLocationForm({
  action,
  objects,
  systems,
  rooms,
  initialValues,
  locationId,
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
  const filteredSystems = useMemo(() => systems.filter((item) => item.object_id === selectedObjectId), [selectedObjectId, systems]);
  const filteredRooms = useMemo(() => rooms.filter((item) => item.object_id === selectedObjectId), [rooms, selectedObjectId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await action(new FormData(event.currentTarget));
      addToast(locationId ? "Место хранения обновлено" : "Место хранения создано", "success");
      onSubmitted?.();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Не удалось сохранить место хранения", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    if (!selectedSystemId) return;
    if (filteredSystems.some((item) => item.id === selectedSystemId)) return;
    setSelectedSystemId("");
  }, [filteredSystems, selectedSystemId]);

  useEffect(() => {
    if (!selectedRoomId) return;
    if (filteredRooms.some((item) => item.id === selectedRoomId)) return;
    setSelectedRoomId("");
  }, [filteredRooms, selectedRoomId]);

  return (
    <form onSubmit={handleSubmit} onChange={onChange} className="ppr-modal-content">
      <div className="ppr-modal-body grid">
        {locationId ? <input type="hidden" name="location_id" value={locationId} /> : null}

        <PprFormSection title="Место хранения" desc="Складская зона, шкаф, стеллаж или кладовая внутри объекта">
          <PprFormGroup label="Объект">
            <select
              className="select"
              name="object_id"
              required
              value={selectedObjectId}
              onChange={(event) => setSelectedObjectId(event.target.value)}
            >
              <option value="" disabled>
                Выберите объект
              </option>
              {objects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </PprFormGroup>

          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <PprFormGroup label="Система">
              <select
                className="select"
                name="system_id"
                required
                value={selectedSystemId}
                onChange={(event) => setSelectedSystemId(event.target.value)}
                disabled={!selectedObjectId || !filteredSystems.length}
              >
                <option value="" disabled>
                  {selectedObjectId ? "Выберите систему" : "Сначала выберите объект"}
                </option>
                {filteredSystems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.is_active === false ? " (неактивна)" : ""}
                  </option>
                ))}
              </select>
            </PprFormGroup>

            <PprFormGroup label="Помещение">
              <select
                className="select"
                name="room_id"
                required
                value={selectedRoomId}
                onChange={(event) => setSelectedRoomId(event.target.value)}
                disabled={!selectedObjectId || !filteredRooms.length}
              >
                <option value="" disabled>
                  {selectedObjectId ? "Выберите помещение" : "Сначала выберите объект"}
                </option>
                {filteredRooms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.is_active === false ? " (неактивно)" : ""}
                  </option>
                ))}
              </select>
            </PprFormGroup>
          </div>

          <PprFormGroup label="Название">
            <input className="input" name="name" defaultValue={values.name} placeholder="Например: Склад №1 / Электрощитовая / Стеллаж А" required />
          </PprFormGroup>

          <PprFormGroup label="Описание">
            <textarea className="input" name="description" rows={3} defaultValue={values.description} placeholder="Где находится и как использовать" />
          </PprFormGroup>

          <label className="row" style={{ gap: "0.6rem", alignItems: "center" }}>
            <input type="checkbox" name="is_active" defaultChecked={values.is_active} />
            <span>Активное место хранения</span>
          </label>
        </PprFormSection>
      </div>

      <div className="ppr-modal-footer">
        <button className="btn btn-accent" type="submit" disabled={isSubmitting || !selectedObjectId || !selectedSystemId || !selectedRoomId}>
          {isSubmitting ? "Сохранение..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
