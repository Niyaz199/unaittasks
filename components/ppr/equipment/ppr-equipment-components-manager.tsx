"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { StockItemForm } from "@/components/warehouse/stock-item-form";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { useToast } from "@/components/ui/toast";
import { stockItemKindMeta } from "@/lib/warehouse/presentation";
import { createStockItemAction, removeEquipmentComponentAction, upsertEquipmentComponentAction } from "@/app/actions/warehouse-actions";

type ComponentItem = {
  id: string;
  name: string;
  kind: "zip" | "component";
  unit: string;
  min_qty: number;
  current_qty: number;
};

type ComponentRow = {
  id: string;
  stock_item_id: string;
  quantity: number;
  reserve_qty: number;
  is_critical: boolean;
  note: string | null;
  stock_item: ComponentItem | ComponentItem[] | null;
};

type StockItemOption = ComponentItem;
type LocationOption = { id: string; object_id: string; name: string; is_active?: boolean };
type SystemGroupOption = { id: string; name: string; code: string; is_active?: boolean };

function resolveItem(raw: ComponentItem | ComponentItem[] | null) {
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function formatQty(value: number, unit: string) {
  return `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} ${unit}`;
}

type Props = {
  equipmentId: string;
  objectId: string;
  objectName: string;
  components: ComponentRow[];
  stockItems: StockItemOption[];
  storageLocations: LocationOption[];
  systemGroups: SystemGroupOption[];
  canManage: boolean;
};

export function PprEquipmentComponentsManager({
  equipmentId,
  objectId,
  objectName,
  components,
  stockItems,
  storageLocations,
  systemGroups,
  canManage,
}: Props) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isStockItemOpen, setIsStockItemOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isStockItemDirty, setIsStockItemDirty] = useState(false);
  const [preferredStockItemId, setPreferredStockItemId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const editingComponent = editingId ? components.find((component) => component.id === editingId) ?? null : null;
  const availableItems = useMemo(() => {
    const usedIds = new Set(components.map((component) => component.stock_item_id));
    return stockItems.filter((item) => item.id === editingComponent?.stock_item_id || !usedIds.has(item.id));
  }, [components, editingComponent?.stock_item_id, stockItems]);

  async function handleSubmit(formData: FormData) {
    try {
      await upsertEquipmentComponentAction(formData);
      addToast(editingComponent ? "Составляющая обновлена" : "Составляющая добавлена", "success");
      setIsOpen(false);
      setEditingId(null);
      setIsDirty(false);
      setPreferredStockItemId(null);
      router.refresh();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Не удалось сохранить составляющую", "error");
    }
  }

  function handleStockItemCreated(result?: { id?: string } | void) {
    if (result && typeof result === "object" && result.id) {
      setPreferredStockItemId(result.id);
    }
    setIsStockItemOpen(false);
    setIsStockItemDirty(false);
    router.refresh();
  }

  function handleDelete(componentId: string) {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("component_id", componentId);
        formData.set("equipment_id", equipmentId);
        await removeEquipmentComponentAction(formData);
        addToast("Составляющая удалена", "success");
        router.refresh();
      } catch (error) {
        addToast(error instanceof Error ? error.message : "Не удалось удалить составляющую", "error");
      }
    });
  }

  return (
    <>
      <div className="grid" style={{ gap: "0.85rem" }}>
        {components.length ? (
          components.map((component) => {
            const item = resolveItem(component.stock_item);
            if (!item) return null;
            const isLowStock = item.current_qty < item.min_qty;
            return (
              <div key={component.id} className="section-card" style={{ padding: "1rem", background: "color-mix(in srgb, var(--panel-soft) 20%, transparent)" }}>
                <div className="row" style={{ justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                  <div className="grid" style={{ gap: "0.25rem" }}>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div className="text-soft">
                      {stockItemKindMeta[item.kind].label} • {formatQty(component.quantity, item.unit)} в составе • резерв {formatQty(component.reserve_qty, item.unit)}
                    </div>
                    <div className="text-soft">
                      На складе: {formatQty(item.current_qty, item.unit)} • минимум {formatQty(item.min_qty, item.unit)}
                    </div>
                    {component.note?.trim() ? <div className="text-soft">{component.note}</div> : null}
                  </div>
                  <div className="grid" style={{ gap: "0.6rem", justifyItems: "end" }}>
                    <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {component.is_critical ? <Badge tone="danger">Критичный элемент</Badge> : <Badge tone="info">Некритичный</Badge>}
                      {isLowStock ? <Badge tone="warning">Запас под контролем</Badge> : <Badge tone="success">Запас в норме</Badge>}
                    </div>
                    {canManage ? (
                      <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button
                          className="btn btn-ghost ppr-action-btn"
                          type="button"
                          onClick={() => {
                            setEditingId(component.id);
                            setIsOpen(true);
                          }}
                        >
                          Изменить
                        </button>
                        <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => handleDelete(component.id)} disabled={pending}>
                          Удалить
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-soft">Составляющие пока не заполнены.</div>
        )}

        {canManage ? (
          <div className="row">
            <button
              className="btn btn-accent"
              type="button"
              onClick={() => {
                setEditingId(null);
                setIsOpen(true);
              }}
            >
              + Добавить составляющую
            </button>
          </div>
        ) : null}
      </div>

      <PprModal
        open={isOpen}
        onClose={() => {
          setIsOpen(false);
          setEditingId(null);
          setIsDirty(false);
          setPreferredStockItemId(null);
        }}
        title={editingComponent ? "Редактирование составляющей" : "Новая составляющая"}
        isDirty={isDirty}
      >
        <EquipmentComponentForm
          equipmentId={equipmentId}
          items={availableItems}
          hasStorageLocations={storageLocations.length > 0}
          initialComponent={editingComponent}
          preferredStockItemId={preferredStockItemId}
          onCreateItemRequested={() => setIsStockItemOpen(true)}
          onChange={() => setIsDirty(true)}
          onSubmit={handleSubmit}
        />
      </PprModal>

      <PprModal
        open={isStockItemOpen}
        onClose={() => {
          setIsStockItemOpen(false);
          setIsStockItemDirty(false);
        }}
        title="Новая карточка ТМЦ"
        isDirty={isStockItemDirty}
      >
        {storageLocations.length ? (
          <StockItemForm
            action={createStockItemAction}
            objects={[]}
            locations={storageLocations}
            systemGroups={systemGroups}
            initialValues={{ kind: "component" }}
            fixedObjectId={objectId}
            fixedObjectName={objectName}
            onSubmitted={handleStockItemCreated}
            onChange={() => setIsStockItemDirty(true)}
            submitLabel="Создать"
          />
        ) : (
          <div className="ppr-modal-content">
            <div className="ppr-modal-body">
              <div className="text-soft">
                На объекте пока нет мест хранения. Сначала создайте склад, коробку или ящик для хранения ТМЦ.
              </div>
            </div>
          </div>
        )}
      </PprModal>
    </>
  );
}

function EquipmentComponentForm({
  equipmentId,
  items,
  hasStorageLocations,
  initialComponent,
  preferredStockItemId,
  onCreateItemRequested,
  onChange,
  onSubmit,
}: {
  equipmentId: string;
  items: StockItemOption[];
  hasStorageLocations: boolean;
  initialComponent: ComponentRow | null;
  preferredStockItemId?: string | null;
  onCreateItemRequested: () => void;
  onChange?: () => void;
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const [stockItemId, setStockItemId] = useState(initialComponent?.stock_item_id ?? items[0]?.id ?? "");
  const [quantity, setQuantity] = useState(initialComponent ? String(initialComponent.quantity) : "1");
  const [reserveQty, setReserveQty] = useState(initialComponent ? String(initialComponent.reserve_qty) : "0");
  const [isCritical, setIsCritical] = useState(initialComponent?.is_critical ?? false);
  const [note, setNote] = useState(initialComponent?.note ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedItem = useMemo(() => items.find((item) => item.id === stockItemId) ?? null, [items, stockItemId]);

  useEffect(() => {
    if (preferredStockItemId) {
      setStockItemId(preferredStockItemId);
    }
  }, [preferredStockItemId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(new FormData(event.currentTarget));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onChange={onChange} className="ppr-modal-content">
      <div className="ppr-modal-body grid">
        {initialComponent ? <input type="hidden" name="component_id" value={initialComponent.id} /> : null}
        <input type="hidden" name="equipment_id" value={equipmentId} />

        <label className="grid" style={{ gap: "0.35rem" }}>
          <span className="text-soft">ТМЦ</span>
          <div className="grid" style={{ gap: "0.6rem" }}>
            <select className="select" name="stock_item_id" required value={stockItemId} onChange={(event) => setStockItemId(event.target.value)}>
              <option value="" disabled>
                Выберите ТМЦ
              </option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} • {stockItemKindMeta[item.kind].label}
                </option>
              ))}
            </select>
            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <button className="btn btn-ghost ppr-action-btn" type="button" onClick={onCreateItemRequested} disabled={!hasStorageLocations}>
                + Создать новую ТМЦ
              </button>
              {!hasStorageLocations ? <span className="text-soft">Нужно создать место хранения на объекте.</span> : null}
            </div>
          </div>
        </label>

        {selectedItem ? (
          <div className="text-soft">
            На складе: {formatQty(selectedItem.current_qty, selectedItem.unit)} • минимум {formatQty(selectedItem.min_qty, selectedItem.unit)}
          </div>
        ) : null}

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <label className="grid" style={{ gap: "0.35rem" }}>
            <span className="text-soft">Количество в составе</span>
            <input className="input" name="quantity" type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} required />
          </label>

          <label className="grid" style={{ gap: "0.35rem" }}>
            <span className="text-soft">Резерв на складе</span>
            <input className="input" name="reserve_qty" type="number" min="0" step="0.001" value={reserveQty} onChange={(event) => setReserveQty(event.target.value)} required />
          </label>
        </div>

        <label className="row" style={{ gap: "0.6rem", alignItems: "center" }}>
          <input type="checkbox" name="is_critical" checked={isCritical} onChange={(event) => setIsCritical(event.target.checked)} />
          <span>Критичный элемент оборудования</span>
        </label>

        <label className="grid" style={{ gap: "0.35rem" }}>
          <span className="text-soft">Комментарий</span>
          <textarea className="input" name="note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Например: должен всегда быть в резерве на объекте" />
        </label>
      </div>

      <div className="ppr-modal-footer">
        <button className="btn btn-accent" type="submit" disabled={isSubmitting || !stockItemId}>
          {isSubmitting ? "Сохраняем..." : initialComponent ? "Сохранить" : "Добавить"}
        </button>
      </div>
    </form>
  );
}
