"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { AssigneeCombobox, type AssigneeOption } from "@/components/ui/assignee-combobox";
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

const movementTypeOptions = ["receipt", "issue"] as const;
type MovementType = (typeof movementTypeOptions)[number];

function getMovementSubmitLabel(type: MovementType) {
  return type === "receipt" ? "Сохранить приход" : "Сохранить выдачу";
}

function getMovementHint(type: MovementType) {
  return type === "receipt"
    ? "Зафиксируйте, что положили в это место хранения."
    : "Зафиксируйте, что забрали из этого места хранения.";
}

export function StockMovementForm({ objectId, locationId, items, action }: Props) {
  const router = useRouter();
  const [itemId, setItemId] = useState("");
  const [movementType, setMovementType] = useState<MovementType>("issue");
  const [quantity, setQuantity] = useState("1");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  const availableItems = useMemo(() => {
    const scopedItems =
      movementType === "issue"
        ? items.filter((item) => item.locationQty > 0)
        : items.filter((item) => item.isActive || item.locationQty > 0 || item.totalQty > 0);
    return [...scopedItems].sort((left, right) => left.name.localeCompare(right.name, "ru"));
  }, [items, movementType]);
  const itemOptions = useMemo<AssigneeOption[]>(
    () =>
      availableItems.map((item) => ({
        id: item.id,
        label: item.name,
        subtitle:
          movementType === "issue"
            ? `${item.kindLabel} • в месте ${formatQty(item.locationQty, item.unit)}`
            : `${item.kindLabel} • всего ${formatQty(item.totalQty, item.unit)}`,
      })),
    [availableItems, movementType]
  );
  const selectedItem = useMemo(() => items.find((item) => item.id === itemId) ?? null, [itemId, items]);
  const quantityValue = Number(quantity || 0);
  const delta = getMovementDelta(movementType, quantityValue);
  const nextLocationQty = selectedItem ? selectedItem.locationQty + delta : 0;
  const isNegativeResult = movementType === "issue" && selectedItem ? nextLocationQty < 0 : false;
  const isQuantityInvalid = !quantityValue || quantityValue <= 0;
  const submitLabel = getMovementSubmitLabel(movementType);
  const movementHint = getMovementHint(movementType);
  const emptyStateMessage =
    movementType === "issue"
      ? "В этом месте хранения сейчас нет ТМЦ, которые можно выдать."
      : "Нет доступных карточек ТМЦ для прихода.";

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
            {movementTypeOptions.map((key) => {
              const meta = stockMovementTypeMeta[key];
              const isActive = movementType === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={`warehouse-movement-segment ${isActive ? "is-active" : ""} tone-${meta.tone}`}
                  onClick={() => setMovementType(key)}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
          <div className="warehouse-movement-hint text-soft">{movementHint}</div>
        </div>

        <label className="grid" style={{ gap: "0.35rem" }}>
          <span className="text-soft">ТМЦ</span>
          <AssigneeCombobox
            name="item_id"
            options={itemOptions}
            placeholder={movementType === "issue" ? "Что забрали из этого места?" : "Что положили в это место?"}
            required
            defaultValue={itemId}
            onSelectedIdChange={setItemId}
          />
        </label>

        {!availableItems.length ? <div className="text-soft">{emptyStateMessage}</div> : null}

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
                <span className="warehouse-movement-stat-label">Сейчас в месте</span>
                <strong className="tabular-nums">{formatQty(selectedItem.locationQty, selectedItem.unit)}</strong>
              </div>
              <div className="warehouse-movement-stat">
                <span className="warehouse-movement-stat-label">Станет после операции</span>
                <strong
                  className={`tabular-nums ${isNegativeResult ? "warehouse-danger-text" : ""}`}
                >
                  {formatQty(nextLocationQty, selectedItem.unit)}
                </strong>
              </div>
              <div className="warehouse-movement-stat">
                <span className="warehouse-movement-stat-label">Всего по объекту</span>
                <strong className="tabular-nums">{formatQty(selectedItem.totalQty, selectedItem.unit)}</strong>
              </div>
            </div>

            <div className="warehouse-movement-summary row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <Badge tone={stockMovementTypeMeta[movementType].tone}>{stockMovementTypeMeta[movementType].label}</Badge>
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
              placeholder={
                movementType === "issue"
                  ? "Необязательно. Например: забрал для замены блока питания"
                  : "Необязательно. Например: положили после закупки"
              }
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
