"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { StockItemForm } from "@/components/warehouse/stock-item-form";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { useToast } from "@/components/ui/toast";
import { stockItemKindMeta } from "@/lib/warehouse/presentation";
import { createStockItemAction, removeEquipmentComponentAction, upsertEquipmentComponentAction } from "@/app/actions/warehouse-actions";
import { EmptyStateAction } from "@/components/ui/empty-state-action";

type ComponentItem = {
  id: string;
  name: string;
  kind: "zip" | "component";
  unit: string;
  min_qty: number;
  current_qty: number;
  sku?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  is_spare_part?: boolean;
  is_active?: boolean;
  storage_location_name?: string | null;
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
type PprTemplateOption = {
  id: string;
  name: string;
  object_id: string;
  system_id: string;
  system_group_id: string;
};

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
  pprTemplates?: PprTemplateOption[];
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
  pprTemplates = [],
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
            pprTemplates={pprTemplates}
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
              <EmptyStateAction
                tone="warning"
                title="На объекте пока нет мест хранения"
                description={`Чтобы создать ТМЦ, для объекта «${objectName}» сначала нужно создать склад, шкаф или зону хранения.`}
                primary={{
                  label: "Создать место хранения",
                  href: `/warehouse/locations?objectId=${objectId}&new=1`,
                }}
              />
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

        <div className="grid" style={{ gap: "0.6rem" }}>
          <span className="text-soft">ТМЦ</span>
          <input type="hidden" name="stock_item_id" value={stockItemId} required />
          <StockItemCombobox
            items={items}
            value={stockItemId}
            onChange={setStockItemId}
            disabled={Boolean(initialComponent)}
          />
          <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <button className="btn btn-ghost ppr-action-btn" type="button" onClick={onCreateItemRequested} disabled={!hasStorageLocations}>
              + Создать новую ТМЦ
            </button>
            {!hasStorageLocations ? <span className="text-soft">Нужно создать место хранения на объекте.</span> : null}
          </div>
        </div>

        {selectedItem ? <SelectedItemPreview item={selectedItem} /> : null}

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

type KindFilter = "all" | "zip" | "component";

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function StockItemCombobox({
  items,
  value,
  onChange,
  disabled,
}: {
  items: StockItemOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(() => items.find((item) => item.id === value) ?? null, [items, value]);

  const filtered = useMemo(() => {
    const query = normalizeSearch(search);
    return items.filter((item) => {
      if (kindFilter !== "all" && item.kind !== kindFilter) return false;
      if (!query) return true;
      const haystack = [item.name, item.sku ?? "", item.manufacturer ?? "", item.model ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [items, kindFilter, search]);

  useEffect(() => {
    setActiveIndex(0);
  }, [search, kindFilter, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleDocClick(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [isOpen]);

  function choose(id: string) {
    onChange(id);
    setIsOpen(false);
    setSearch("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) setIsOpen(true);
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === "Enter") {
      if (isOpen && filtered[activeIndex]) {
        event.preventDefault();
        choose(filtered[activeIndex].id);
      }
    } else if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      {selected && !isOpen ? (
        <button
          type="button"
          className="input"
          onClick={() => {
            if (disabled) return;
            setIsOpen(true);
            setSearch("");
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          disabled={disabled}
          style={{
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            minHeight: 44,
            cursor: disabled ? "not-allowed" : "pointer",
            width: "100%",
          }}
        >
          <span className="grid" style={{ gap: "0.15rem" }}>
            <span style={{ fontWeight: 600 }}>{selected.name}</span>
            <span className="text-soft" style={{ fontSize: "0.85rem" }}>
              {[
                stockItemKindMeta[selected.kind].label,
                selected.sku ? `арт. ${selected.sku}` : null,
                selected.manufacturer || selected.model
                  ? [selected.manufacturer, selected.model].filter(Boolean).join(" ")
                  : null,
              ]
                .filter(Boolean)
                .join(" • ")}
            </span>
          </span>
          <span className="text-soft" aria-hidden="true">▾</span>
        </button>
      ) : (
        <>
          <input
            ref={inputRef}
            className="input"
            type="text"
            placeholder="Поиск по названию, SKU, производителю…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => {
              if (!disabled) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            style={{ minHeight: 44, width: "100%" }}
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            role="combobox"
          />
          <div className="row" style={{ gap: "0.35rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
            {(
              [
                { key: "all", label: "Все" },
                { key: "zip", label: "ЗИП" },
                { key: "component", label: "Компоненты" },
              ] as { key: KindFilter; label: string }[]
            ).map((option) => {
              const active = kindFilter === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={active ? "btn btn-accent" : "btn btn-ghost"}
                  onClick={() => setKindFilter(option.key)}
                  style={{ padding: "0.3rem 0.75rem", minHeight: 32, fontSize: "0.85rem", cursor: "pointer" }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {isOpen && !disabled ? (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 0.35rem)",
            left: 0,
            right: 0,
            zIndex: 30,
            maxHeight: 320,
            overflowY: "auto",
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 10px 32px rgba(0,0,0,0.18)",
          }}
        >
          {filtered.length === 0 ? (
            <div className="text-soft" style={{ padding: "0.9rem 1rem" }}>
              Ничего не найдено. Попробуйте сменить фильтр или создать новую ТМЦ.
            </div>
          ) : (
            filtered.map((item, index) => {
              const isActive = index === activeIndex;
              const isSelected = item.id === value;
              const isLow = item.current_qty < item.min_qty;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(item.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "0.65rem 0.9rem",
                    background: isActive ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                    border: "none",
                    borderBottom: "1px solid var(--border-soft, rgba(127,127,127,0.15))",
                    cursor: "pointer",
                    minHeight: 44,
                  }}
                >
                  <div className="row" style={{ justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start" }}>
                    <div className="grid" style={{ gap: "0.2rem", minWidth: 0 }}>
                      <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.name}
                      </div>
                      <div className="text-soft" style={{ fontSize: "0.82rem" }}>
                        {[
                          item.sku ? `арт. ${item.sku}` : null,
                          item.manufacturer || item.model
                            ? [item.manufacturer, item.model].filter(Boolean).join(" ")
                            : null,
                          item.storage_location_name ?? null,
                        ]
                          .filter(Boolean)
                          .join(" • ") || "—"}
                      </div>
                    </div>
                    <div className="grid" style={{ gap: "0.25rem", justifyItems: "end", flexShrink: 0 }}>
                      <div className="row" style={{ gap: "0.3rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Badge tone={item.kind === "zip" ? "info" : "neutral"}>
                          {stockItemKindMeta[item.kind].label}
                        </Badge>
                        {item.is_spare_part ? <Badge tone="warning">Запасная</Badge> : null}
                        {item.is_active === false ? <Badge tone="neutral">Архив</Badge> : null}
                      </div>
                      <div className="text-soft" style={{ fontSize: "0.82rem" }}>
                        {formatQty(item.current_qty, item.unit)}
                        {isLow ? <span style={{ color: "var(--danger, #d64545)", marginLeft: "0.3rem" }}>· низкий</span> : null}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function SelectedItemPreview({ item }: { item: StockItemOption }) {
  const isLow = item.current_qty < item.min_qty;
  return (
    <div
      className="section-card"
      style={{
        padding: "0.75rem 1rem",
        background: "color-mix(in srgb, var(--panel-soft) 35%, transparent)",
        borderLeft: "3px solid var(--accent)",
      }}
    >
      <div className="row" style={{ justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div className="grid" style={{ gap: "0.15rem" }}>
          <div className="text-soft" style={{ fontSize: "0.8rem" }}>Выбранная ТМЦ</div>
          <div style={{ fontWeight: 600 }}>{item.name}</div>
          {item.storage_location_name ? (
            <div className="text-soft" style={{ fontSize: "0.85rem" }}>
              Место: {item.storage_location_name}
            </div>
          ) : null}
        </div>
        <div className="grid" style={{ gap: "0.25rem", justifyItems: "end" }}>
          <div className="text-soft" style={{ fontSize: "0.85rem" }}>
            На складе: {formatQty(item.current_qty, item.unit)} · минимум {formatQty(item.min_qty, item.unit)}
          </div>
          {isLow ? <Badge tone="warning">Запас под контролем</Badge> : <Badge tone="success">Запас в норме</Badge>}
        </div>
      </div>
    </div>
  );
}
