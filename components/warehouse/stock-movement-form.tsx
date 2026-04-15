"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
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

function getMovementDelta(type: keyof typeof stockMovementTypeMeta, value: number) {
  if (type === "receipt" || type === "adjustment_in") return value;
  return -value;
}

function getMovementSubmitLabel(type: keyof typeof stockMovementTypeMeta) {
  if (type === "receipt") return "Оприходовать";
  if (type === "issue") return "Списать";
  return "Применить";
}

function getMovementHint(type: keyof typeof stockMovementTypeMeta) {
  if (type === "receipt") return "Поставка или найденный остаток.";
  if (type === "issue") return "Выдача или списание.";
  if (type === "adjustment_in") return "Увеличение без прихода.";
  return "Уменьшение без отдельной выдачи.";
}

export function StockMovementForm({ objectId, locationId, items, action }: Props) {
  const router = useRouter();
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [itemQuery, setItemQuery] = useState("");
  const [movementType, setMovementType] = useState<keyof typeof stockMovementTypeMeta>("issue");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  const filteredItems = useMemo(() => {
    const query = itemQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.name.toLowerCase().includes(query) || item.kindLabel.toLowerCase().includes(query));
  }, [itemQuery, items]);
  const selectableItems = useMemo(() => {
    const selected = items.find((item) => item.id === itemId);
    if (!selected || filteredItems.some((item) => item.id === itemId)) return filteredItems;
    return [selected, ...filteredItems];
  }, [filteredItems, itemId, items]);
  const selectedItem = useMemo(() => items.find((item) => item.id === itemId) ?? null, [itemId, items]);
  const quantityValue = Number(quantity || 0);
  const delta = getMovementDelta(movementType, quantityValue);
  const nextLocationQty = selectedItem ? selectedItem.locationQty + delta : 0;
  const nextTotalQty = selectedItem ? selectedItem.totalQty + delta : 0;
  const isNegativeResult = selectedItem ? nextLocationQty < 0 : false;
  const isBelowMinimum = selectedItem ? nextTotalQty <= selectedItem.minQty : false;
  const isQuantityInvalid = !quantityValue || quantityValue <= 0;
  const submitLabel = getMovementSubmitLabel(movementType);
  const movementHint = getMovementHint(movementType);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await action(new FormData(event.currentTarget));
      addToast("Движение по складу сохранено", "success");
      setQuantity("1");
      setNote("");
      router.refresh();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Не удалось сохранить движение", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="warehouse-movement-form">
      <input type="hidden" name="object_id" value={objectId} />
      <input type="hidden" name="location_id" value={locationId} />
      <input type="hidden" name="movement_type" value={movementType} />

      <div className="warehouse-movement-shell">
        <div className="warehouse-movement-head">
          <div className="warehouse-movement-segmented" role="tablist" aria-label="Тип движения">
            {Object.entries(stockMovementTypeMeta).map(([key, meta]) => {
              const isActive = movementType === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`warehouse-movement-segment ${isActive ? "is-active" : ""} tone-${meta.tone}`}
                  onClick={() => setMovementType(key as keyof typeof stockMovementTypeMeta)}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
          <div className="warehouse-movement-hint text-soft">{movementHint}</div>
        </div>

        <label className="grid" style={{ gap: "0.35rem" }}>
          <span className="text-soft">Поиск</span>
          <input
            className="input"
            type="search"
            value={itemQuery}
            onChange={(event) => setItemQuery(event.target.value)}
            placeholder="Название или тип"
          />
        </label>

        <label className="grid" style={{ gap: "0.35rem" }}>
          <span className="text-soft">ТМЦ</span>
          <select className="select" name="item_id" required value={itemId} onChange={(event) => setItemId(event.target.value)}>
            <option value="" disabled>
              Выберите ТМЦ
            </option>
            {selectableItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} • {item.kindLabel}
              </option>
            ))}
          </select>
        </label>
        {itemQuery.trim() && filteredItems.length === 0 ? (
          <div className="text-soft" style={{ fontSize: "0.84rem" }}>
            По текущему запросу ТМЦ не найдены. Уточните запрос или очистите поиск.
          </div>
        ) : null}

        {selectedItem ? (
          <div className="warehouse-movement-context">
            <div className="warehouse-movement-context-top">
              <div>
                <div className="warehouse-movement-item-name">{selectedItem.name}</div>
                <div className="text-soft" style={{ fontSize: "0.82rem" }}>
                  {selectedItem.kindLabel}
                </div>
              </div>
              {!selectedItem.isActive ? <Badge tone="neutral">Неактивна</Badge> : null}
            </div>

            <div className="warehouse-movement-forecast">
              <div className="warehouse-movement-stat">
                <span className="warehouse-movement-stat-label">Сейчас на месте</span>
                <strong className="tabular-nums">{formatQty(selectedItem.locationQty, selectedItem.unit)}</strong>
              </div>
              <div className="warehouse-movement-stat">
                <span className="warehouse-movement-stat-label">После операции</span>
                <strong
                  className={`tabular-nums ${isNegativeResult || isBelowMinimum ? "warehouse-danger-text" : ""}`}
                >
                  {formatQty(nextLocationQty, selectedItem.unit)}
                </strong>
              </div>
              <div className="warehouse-movement-stat">
                <span className="warehouse-movement-stat-label">Минимум</span>
                <strong className="tabular-nums">{formatQty(selectedItem.minQty, selectedItem.unit)}</strong>
              </div>
            </div>

            <div className="warehouse-movement-summary row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <Badge tone={stockMovementTypeMeta[movementType].tone}>{stockMovementTypeMeta[movementType].label}</Badge>
              <span className="text-soft">Общий остаток: {formatQty(selectedItem.totalQty, selectedItem.unit)}</span>
              {isBelowMinimum ? <Badge tone="danger">После операции общий остаток будет ниже минимума</Badge> : null}
              {isNegativeResult ? <Badge tone="danger">Недостаточно ТМЦ на этом месте хранения</Badge> : null}
            </div>
          </div>
        ) : null}

        <div className="warehouse-movement-fields">
          <label className="grid" style={{ gap: "0.35rem" }}>
            <span className="text-soft">Количество</span>
            <input
              className="input"
              name="quantity"
              type="number"
              min="0.001"
              step="0.001"
              inputMode="decimal"
              required
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>

          <label className="grid" style={{ gap: "0.35rem" }}>
            <span className="text-soft">Комментарий</span>
            <textarea
              className="input"
              name="note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Например: списали для замены блока питания"
            />
          </label>
        </div>
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-accent" type="submit" disabled={isSubmitting || !itemId || isNegativeResult || isQuantityInvalid}>
          {isSubmitting ? "Сохраняем..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
