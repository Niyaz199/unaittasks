"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { clonePprEquipmentAction } from "@/app/actions/ppr-directory-actions";
import { AssigneeCombobox, type AssigneeOption } from "@/components/ui/assignee-combobox";

type RoomOption = {
  id: string;
  name: string;
  floor_label?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  source: {
    id: string;
    name: string;
    inventory_no: string;
    dispatch_name: string;
    service_start_date: string;
    room_id: string;
    object_name: string;
  };
  rooms: RoomOption[];
  componentsCount: number;
  assignmentsCount: number;
};

export function PprEquipmentCloneDialog({
  open,
  onClose,
  source,
  rooms,
  componentsCount,
  assignmentsCount,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(suggestName(source.name));
  const [inventoryNo, setInventoryNo] = useState("");
  const [dispatchName, setDispatchName] = useState("");
  const [roomId, setRoomId] = useState(source.room_id);
  const [serialNo, setSerialNo] = useState("");
  const [serviceStartDate, setServiceStartDate] = useState(source.service_start_date);
  const [copyComponents, setCopyComponents] = useState(true);
  const [copyAssignments, setCopyAssignments] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function submit() {
    if (!name.trim()) {
      setError("Укажите название копии");
      return;
    }
    startTransition(async () => {
      try {
        setError(null);
        const formData = new FormData();
        formData.set("source_equipment_id", source.id);
        formData.set("name", name.trim());
        formData.set("inventory_no", inventoryNo.trim());
        formData.set("dispatch_name", dispatchName.trim() || name.trim());
        formData.set("room_id", roomId);
        if (serialNo.trim()) formData.set("serial_no", serialNo.trim());
        formData.set("service_start_date", serviceStartDate);
        formData.set("copy_components", copyComponents ? "1" : "0");
        formData.set("copy_assignments", copyAssignments ? "1" : "0");

        const result = await clonePprEquipmentAction(formData);
        router.push(`/ppr/equipment/${result.id}` as Route);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось создать копию");
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="clone-eq-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "560px",
          maxHeight: "90vh",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--line)" }}>
          <h2 id="clone-eq-title" style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>
            Создать копию оборудования
          </h2>
          <p className="text-soft" style={{ margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
            На основе «{source.name}» (инв. {source.inventory_no}). Объект: {source.object_name}.
          </p>
        </div>

        <div style={{ padding: "1rem 1.25rem", display: "grid", gap: "0.75rem" }}>
          <label className="grid" style={{ gap: "0.25rem" }}>
            <span className="text-soft" style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Название копии
            </span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Напр.: ПВ-2"
              disabled={pending}
              autoFocus
            />
          </label>

          <label className="grid" style={{ gap: "0.25rem" }}>
            <span className="text-soft" style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Инвентарный номер <span style={{ textTransform: "none", opacity: 0.7 }}>— если пусто, сгенерируем автоматически</span>
            </span>
            <input
              className="input"
              value={inventoryNo}
              onChange={(e) => setInventoryNo(e.target.value)}
              placeholder="Оставьте пустым для авто-генерации"
              disabled={pending}
            />
          </label>

          <label className="grid" style={{ gap: "0.25rem" }}>
            <span className="text-soft" style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Диспетчерское имя <span style={{ textTransform: "none", opacity: 0.7 }}>— если пусто, возьмём название</span>
            </span>
            <input
              className="input"
              value={dispatchName}
              onChange={(e) => setDispatchName(e.target.value)}
              placeholder={name || "Совпадает с названием"}
              disabled={pending}
            />
          </label>

          <label className="grid" style={{ gap: "0.25rem" }}>
            <span className="text-soft" style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Помещение
            </span>
            <div style={{ opacity: pending ? 0.6 : 1, pointerEvents: pending ? "none" : "auto" }}>
              <AssigneeCombobox
                name="room_id"
                placeholder="Выберите помещение"
                required
                defaultValue={roomId}
                selectionHint="Выберите помещение из списка"
                options={rooms.map<AssigneeOption>((r) => ({
                  id: r.id,
                  label: [r.floor_label, r.name].filter(Boolean).join(" • "),
                }))}
                onSelectedIdChange={(id) => setRoomId(id)}
              />
            </div>
          </label>

          <div className="row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
            <label className="grid" style={{ gap: "0.25rem", flex: "1 1 200px" }}>
              <span className="text-soft" style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Серийный номер <span style={{ textTransform: "none", opacity: 0.7 }}>— необяз.</span>
              </span>
              <input
                className="input"
                value={serialNo}
                onChange={(e) => setSerialNo(e.target.value)}
                placeholder="Если каждой штуке свой"
                disabled={pending}
              />
            </label>

            <label className="grid" style={{ gap: "0.25rem", flex: "1 1 180px" }}>
              <span className="text-soft" style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Ввод в эксплуатацию
              </span>
              <input
                className="input"
                type="date"
                value={serviceStartDate}
                onChange={(e) => setServiceStartDate(e.target.value)}
                disabled={pending}
              />
            </label>
          </div>

          {(componentsCount > 0 || assignmentsCount > 0) ? (
            <div
              style={{
                padding: "0.6rem 0.8rem",
                borderRadius: "8px",
                background: "color-mix(in srgb, var(--panel-soft) 50%, transparent)",
                border: "1px solid color-mix(in srgb, var(--line) 40%, transparent)",
                display: "grid",
                gap: "0.5rem",
              }}
            >
              <div className="text-soft" style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Что будет скопировано
              </div>
              {componentsCount > 0 ? (
                <label className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={copyComponents}
                    onChange={(e) => setCopyComponents(e.target.checked)}
                    disabled={pending}
                  />
                  <span>
                    Состав комплектующих ({componentsCount})
                  </span>
                </label>
              ) : null}
              {assignmentsCount > 0 ? (
                <label className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={copyAssignments}
                    onChange={(e) => setCopyAssignments(e.target.checked)}
                    disabled={pending}
                  />
                  <span>
                    Привязки шаблонов ППР ({assignmentsCount})
                  </span>
                </label>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                background: "color-mix(in srgb, var(--danger) 12%, transparent)",
                border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
                color: "var(--danger)",
                fontSize: "0.85rem",
              }}
            >
              {error}
            </div>
          ) : null}
        </div>

        <div
          className="row"
          style={{
            padding: "0.75rem 1.25rem",
            borderTop: "1px solid var(--line)",
            justifyContent: "flex-end",
            gap: "0.5rem",
          }}
        >
          <button type="button" className="btn" onClick={onClose} disabled={pending}>
            Отмена
          </button>
          <button type="button" className="btn btn-accent" onClick={submit} disabled={pending}>
            {pending ? "Создаём..." : "Создать копию"}
          </button>
        </div>
      </div>
    </div>
  );
}

function suggestName(srcName: string) {
  // «ПВ-1» → «ПВ-2», иначе «{name} (копия)»
  const match = srcName.match(/^(.*?)(\d+)\s*$/);
  if (match) {
    const next = parseInt(match[2], 10) + 1;
    return `${match[1]}${next}`;
  }
  return `${srcName} (копия)`;
}
