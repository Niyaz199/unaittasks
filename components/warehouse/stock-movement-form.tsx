"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/components/ui/toast";
import { stockMovementTypeMeta } from "@/lib/warehouse/presentation";

type MovementItemOption = {
  id: string;
  name: string;
  unit: string;
  kindLabel: string;
  locationQty: number;
  totalQty: number;
  minQty: number;
  isActive: boolean;
};

type Props = {
  objectId: string;
  locationId: string;
  items: MovementItemOption[];
  action: (formData: FormData) => void | Promise<void>;
};

function formatQty(value: number, unit: string) {
  return `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} ${unit}`;
}

export function StockMovementForm({ objectId, locationId, items, action }: Props) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [movementType, setMovementType] = useState<keyof typeof stockMovementTypeMeta>("issue");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  const selectedItem = useMemo(() => items.find((item) => item.id === itemId) ?? null, [itemId, items]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await action(new FormData(event.currentTarget));
      addToast("Движение по складу сохранено", "success");
      setQuantity("1");
      setNote("");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Не удалось сохранить движение", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid" style={{ gap: "1rem" }}>
      <input type="hidden" name="object_id" value={objectId} />
      <input type="hidden" name="location_id" value={locationId} />

      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
        <label className="grid" style={{ gap: "0.35rem" }}>
          <span className="text-soft">ТМЦ</span>
          <select className="select" name="item_id" required value={itemId} onChange={(event) => setItemId(event.target.value)}>
            <option value="" disabled>
              Выберите ТМЦ
            </option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} • {item.kindLabel}
              </option>
            ))}
          </select>
        </label>

        <label className="grid" style={{ gap: "0.35rem" }}>
          <span className="text-soft">Тип движения</span>
          <select
            className="select"
            name="movement_type"
            required
            value={movementType}
            onChange={(event) => setMovementType(event.target.value as keyof typeof stockMovementTypeMeta)}
          >
            {Object.entries(stockMovementTypeMeta).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedItem ? (
        <div className="row" style={{ gap: "1rem", flexWrap: "wrap" }}>
          <div className="text-soft">На этом месте: {formatQty(selectedItem.locationQty, selectedItem.unit)}</div>
          <div className="text-soft">Общий остаток: {formatQty(selectedItem.totalQty, selectedItem.unit)}</div>
          <div className="text-soft">Мин. остаток: {formatQty(selectedItem.minQty, selectedItem.unit)}</div>
        </div>
      ) : null}

      <div className="grid" style={{ gridTemplateColumns: "1fr 2fr", gap: "1rem" }}>
        <label className="grid" style={{ gap: "0.35rem" }}>
          <span className="text-soft">Количество</span>
          <input
            className="input"
            name="quantity"
            type="number"
            min="0.001"
            step="0.001"
            required
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>

        <label className="grid" style={{ gap: "0.35rem" }}>
          <span className="text-soft">Комментарий</span>
          <input
            className="input"
            name="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Например: забрали на замену блока питания"
          />
        </label>
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-accent" type="submit" disabled={isSubmitting || !itemId}>
          {isSubmitting ? "Сохраняем..." : "Зафиксировать"}
        </button>
      </div>
    </form>
  );
}
