"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState, useTransition } from "react";
import { PprFormGroup } from "@/components/ppr/ui/ppr-modal";
import { useToast } from "@/components/ui/toast";
import { AssigneeCombobox, type AssigneeOption } from "@/components/ui/assignee-combobox";

type ObjectOption = { id: string; name: string };
type FloorOption = { id: string; object_id: string; name: string; sort_order: number; is_active: boolean };
type RoomTypeOption = { id: string; name: string; sort_order: number | null; is_active: boolean };

type RoomFormValues = {
  object_id: string;
  name: string;
  floor_id: string;
  room_type_id: string;
  description: string;
  is_active: boolean;
};

type Props = {
  action: (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string }>;
  objects: ObjectOption[];
  floors: FloorOption[];
  roomTypes: RoomTypeOption[];
  initialValues?: Partial<RoomFormValues>;
  roomId?: string;
  onSubmitted?: () => void;
  onChange?: () => void;
  submitLabel: string;
};

const defaultValues: RoomFormValues = {
  object_id: "",
  name: "",
  floor_id: "",
  room_type_id: "",
  description: "",
  is_active: true,
};

export function PprRoomForm({
  action,
  objects,
  floors,
  roomTypes,
  initialValues,
  roomId,
  onSubmitted,
  onChange,
  submitLabel,
}: Props) {
  const values = { ...defaultValues, ...initialValues };
  const [selectedObjectId, setSelectedObjectId] = useState(values.object_id);
  const [selectedFloorId, setSelectedFloorId] = useState(values.floor_id);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState(values.room_type_id);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { addToast } = useToast();

  const availableFloors = useMemo(
    () =>
      floors
        .filter((floor) => !selectedObjectId || floor.object_id === selectedObjectId)
        .filter((floor) => floor.is_active || floor.id === selectedFloorId)
        .sort((left, right) => {
          if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order;
          return left.name.localeCompare(right.name, "ru");
        }),
    [floors, selectedFloorId, selectedObjectId]
  );

  const availableRoomTypes = useMemo(
    () =>
      roomTypes
        .filter((roomType) => roomType.is_active || roomType.id === selectedRoomTypeId)
        .sort((left, right) => {
          const sortLeft = left.sort_order ?? Number.MAX_SAFE_INTEGER;
          const sortRight = right.sort_order ?? Number.MAX_SAFE_INTEGER;
          if (sortLeft !== sortRight) return sortLeft - sortRight;
          return left.name.localeCompare(right.name, "ru");
        }),
    [roomTypes, selectedRoomTypeId]
  );

  const activeFloorsForObject = useMemo(
    () => availableFloors.filter((floor) => floor.is_active),
    [availableFloors]
  );
  const activeRoomTypes = useMemo(
    () => availableRoomTypes.filter((roomType) => roomType.is_active),
    [availableRoomTypes]
  );

  useEffect(() => {
    if (selectedFloorId && !availableFloors.some((floor) => floor.id === selectedFloorId)) {
      setSelectedFloorId("");
    }
  }, [availableFloors, selectedFloorId]);

  useEffect(() => {
    if (selectedRoomTypeId && !availableRoomTypes.some((roomType) => roomType.id === selectedRoomTypeId)) {
      setSelectedRoomTypeId("");
    }
  }, [availableRoomTypes, selectedRoomTypeId]);

  const canSubmit =
    Boolean(selectedObjectId) &&
    Boolean(selectedFloorId) &&
    Boolean(selectedRoomTypeId) &&
    activeFloorsForObject.length > 0 &&
    activeRoomTypes.length > 0;

  function handleFormChange() {
    if (submitError) setSubmitError(null);
    onChange?.();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        const result = await action(formData);
        if (!result.ok) {
          setSubmitError(result.error);
          addToast(result.error, "error");
          return;
        }

        addToast(roomId ? "Помещение успешно обновлено" : "Помещение успешно создано", "success");
        onSubmitted?.();
      } catch (error) {
        addToast("Произошла ошибка при сохранении", "error");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} onChange={handleFormChange} className="ppr-modal-content">
      <div className="ppr-modal-body grid">
        {roomId ? <input type="hidden" name="room_id" value={roomId} /> : null}

        {submitError ? (
          <div className="section-card" role="alert" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>
            {submitError}
          </div>
        ) : null}

        <PprFormGroup label="Объект">
          <div style={{ opacity: isPending ? 0.6 : 1, pointerEvents: isPending ? "none" : "auto" }}>
            <AssigneeCombobox
              name="object_id"
              placeholder="Выберите объект"
              required
              defaultValue={selectedObjectId}
              selectionHint="Выберите объект из списка"
              options={objects.map<AssigneeOption>((objectItem) => ({
                id: objectItem.id,
                label: objectItem.name,
              }))}
              onSelectedIdChange={(id) => setSelectedObjectId(id)}
            />
          </div>
        </PprFormGroup>

        <PprFormGroup label="Название помещения">
          <input
            className="input"
            name="name"
            defaultValue={values.name}
            placeholder="Например: Серверная 1"
            required
            disabled={isPending}
          />
        </PprFormGroup>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <PprFormGroup label="Этаж">
            {selectedObjectId && activeFloorsForObject.length === 0 ? (
              <div className="section-card" style={{ display: "grid", gap: "0.5rem" }}>
                <div>Для выбранного объекта ещё не заведены этажи.</div>
                <Link href={"/directories/floors" as Route} className="btn btn-ghost" style={{ width: "fit-content" }}>
                  Открыть справочник этажей
                </Link>
              </div>
            ) : (
              <div style={{ opacity: !selectedObjectId || isPending ? 0.6 : 1, pointerEvents: !selectedObjectId || isPending ? "none" : "auto" }}>
                <AssigneeCombobox
                  key={`floor-${selectedObjectId || "any"}`}
                  name="floor_id"
                  placeholder={selectedObjectId ? "Выберите этаж" : "Сначала выберите объект"}
                  required
                  defaultValue={selectedFloorId}
                  selectionHint="Выберите этаж из списка"
                  options={availableFloors.map<AssigneeOption>((floor) => ({
                    id: floor.id,
                    label: floor.name + (floor.is_active ? "" : " (неактивен)"),
                  }))}
                  onSelectedIdChange={(id) => setSelectedFloorId(id)}
                />
              </div>
            )}
          </PprFormGroup>

          <PprFormGroup label="Тип помещения">
            {activeRoomTypes.length === 0 ? (
              <div className="section-card" style={{ display: "grid", gap: "0.5rem" }}>
                <div>В справочнике пока нет активных типов помещений.</div>
                <Link href={"/directories/room-types" as Route} className="btn btn-ghost" style={{ width: "fit-content" }}>
                  Открыть справочник типов помещений
                </Link>
              </div>
            ) : (
              <div style={{ opacity: isPending ? 0.6 : 1, pointerEvents: isPending ? "none" : "auto" }}>
                <AssigneeCombobox
                  name="room_type_id"
                  placeholder="Выберите тип помещения"
                  required
                  defaultValue={selectedRoomTypeId}
                  selectionHint="Выберите тип помещения из списка"
                  options={availableRoomTypes.map<AssigneeOption>((roomType) => ({
                    id: roomType.id,
                    label: roomType.name + (roomType.is_active ? "" : " (неактивен)"),
                  }))}
                  onSelectedIdChange={(id) => setSelectedRoomTypeId(id)}
                />
              </div>
            )}
          </PprFormGroup>
        </div>

        <PprFormGroup label="Описание">
          <textarea
            className="input"
            name="description"
            rows={3}
            defaultValue={values.description}
            placeholder="Дополнительная техническая информация"
            disabled={isPending}
          />
        </PprFormGroup>

        <label className="row" style={{ alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" name="is_active" defaultChecked={values.is_active} disabled={isPending} />
          Активно
        </label>
      </div>

      <div className="ppr-modal-footer">
        <button className="btn btn-accent" type="submit" disabled={!canSubmit || isPending}>
          {isPending ? "Сохраняем..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
