"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";
import { stockItemKindMeta } from "@/lib/warehouse/presentation";
import { createStockItemAction, updateStockItemAction } from "@/app/actions/warehouse-actions";

const StockItemForm = dynamic(
  () => import("@/components/warehouse/stock-item-form").then((module) => module.StockItemForm),
  { loading: () => <div className="section-card text-soft">Загрузка...</div> }
);

type StockItemRow = {
  id: string;
  object_id: string;
  name: string;
  kind: "material" | "spare_part" | "consumable" | "component";
  unit: string;
  sku: string | null;
  min_qty: number;
  current_qty: number;
  comment: string | null;
  is_active: boolean;
  object: { name: string } | Array<{ name: string }> | null;
};

type ObjectOption = { id: string; name: string };

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

function formatQty(value: number, unit: string) {
  return `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} ${unit}`;
}

export function StockItemsAdmin({
  items,
  objects,
  initialFilterObjectId = "",
}: {
  items: StockItemRow[];
  objects: ObjectOption[];
  initialFilterObjectId?: string;
}) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterObjectId, setFilterObjectId] = useState(initialFilterObjectId);
  const [filterKind, setFilterKind] = useState<StockItemRow["kind"] | "">("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  useEffect(() => {
    setFilterObjectId(initialFilterObjectId);
  }, [initialFilterObjectId]);

  const editingItem = editingId ? items.find((item) => item.id === editingId) ?? null : null;

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesObject = filterObjectId === "" || item.object_id === filterObjectId;
      const matchesKind = filterKind === "" || item.kind === filterKind;
      const matchesLowStock = !lowStockOnly || item.current_qty <= item.min_qty;
      const search = searchTerm.trim().toLowerCase();
      const matchesSearch =
        search === "" ||
        item.name.toLowerCase().includes(search) ||
        item.sku?.toLowerCase().includes(search) ||
        resolveName(item.object).toLowerCase().includes(search);
      return matchesObject && matchesKind && matchesLowStock && matchesSearch;
    });
  }, [filterKind, filterObjectId, items, lowStockOnly, searchTerm]);

  function updateSearchParams(nextObjectId: string) {
    const params = new URLSearchParams();
    if (nextObjectId) params.set("objectId", nextObjectId);
    router.replace((`/warehouse/items${params.toString() ? `?${params.toString()}` : ""}`) as Route);
  }

  const metrics = useMemo(() => {
    const total = items.length;
    const active = items.filter((item) => item.is_active).length;
    const lowStock = items.filter((item) => item.current_qty <= item.min_qty).length;
    const spareParts = items.filter((item) => item.kind === "spare_part").length;
    return [
      { label: "Всего карточек", value: total, tone: "neutral" as const },
      { label: "Активных", value: active, tone: "success" as const },
      { label: "Ниже минимума", value: lowStock, tone: "danger" as const },
      { label: "ЗИП", value: spareParts, tone: "info" as const },
    ];
  }, [items]);

  return (
    <>
      <PprPageShell
        metrics={metrics}
        onSearch={setSearchTerm}
        searchPlaceholder="Поиск по названию, SKU или объекту..."
        isEmpty={items.length === 0}
        emptyState={{
          message: "Карточки ТМЦ пока не созданы",
          hint: "Добавьте первую карточку материала, расходника или запасной части.",
        }}
        isFilteredEmpty={filteredItems.length === 0}
        filters={
          <>
            <select
              className="select"
              value={filterObjectId}
              onChange={(event) => {
                const nextObjectId = event.target.value;
                setFilterObjectId(nextObjectId);
                updateSearchParams(nextObjectId);
              }}
              style={{ maxWidth: "220px" }}
            >
              <option value="">Все объекты</option>
              {objects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>

            <select className="select" value={filterKind} onChange={(event) => setFilterKind(event.target.value as StockItemRow["kind"] | "")}>
              <option value="">Все типы</option>
              {Object.entries(stockItemKindMeta).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>

            <label className="row" style={{ gap: "0.4rem", alignItems: "center" }}>
              <input type="checkbox" checked={lowStockOnly} onChange={(event) => setLowStockOnly(event.target.checked)} />
              <span>Только критический остаток</span>
            </label>

            <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)}>
              + ТМЦ
            </button>
          </>
        }
      >
        <div className="desktop-only">
          <DataTable
            columns={[
              { key: "name", label: "ТМЦ" },
              { key: "kind", label: "Тип" },
              { key: "object", label: "Объект" },
              { key: "stock", label: "Остаток" },
              { key: "status", label: "Статус" },
              { key: "actions", label: "Действия" },
            ]}
          >
            {filteredItems.map((item) => {
              const isLowStock = item.current_qty <= item.min_qty;
              return (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div className="text-soft">{item.sku ? `SKU: ${item.sku}` : `Ед. изм.: ${item.unit}`}</div>
                  </td>
                  <td>{stockItemKindMeta[item.kind].label}</td>
                  <td>{resolveName(item.object)}</td>
                  <td>
                    <div>{formatQty(item.current_qty, item.unit)}</div>
                    <div className="text-soft">Мин.: {formatQty(item.min_qty, item.unit)}</div>
                  </td>
                  <td>
                    <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                      <Badge tone={item.is_active ? "success" : "neutral"}>{item.is_active ? "Активна" : "Неактивна"}</Badge>
                      {isLowStock ? <Badge tone="danger">Ниже минимума</Badge> : <Badge tone="info">Остаток в норме</Badge>}
                    </div>
                  </td>
                  <td>
                    <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(item.id)}>
                      Изменить
                    </button>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        </div>

        <div className="mobile-cards mobile-only">
          {filteredItems.map((item) => {
            const isLowStock = item.current_qty <= item.min_qty;
            return (
              <div key={item.id} className="section-card mobile-card">
                <div className="grid" style={{ gap: "0.55rem" }}>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  <div className="text-soft">{stockItemKindMeta[item.kind].label}</div>
                  <div className="text-soft">Объект: {resolveName(item.object)}</div>
                  <div className="text-soft">Остаток: {formatQty(item.current_qty, item.unit)}</div>
                  <div className="text-soft">Мин.: {formatQty(item.min_qty, item.unit)}</div>
                  <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                    <Badge tone={item.is_active ? "success" : "neutral"}>{item.is_active ? "Активна" : "Неактивна"}</Badge>
                    {isLowStock ? <Badge tone="danger">Ниже минимума</Badge> : null}
                  </div>
                  <div className="ppr-table-actions">
                    <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(item.id)}>
                      Изменить
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </PprPageShell>

      <PprModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setIsDirty(false); }} title="Новая карточка ТМЦ" isDirty={isDirty}>
        <StockItemForm
          action={createStockItemAction}
          objects={objects}
          onSubmitted={() => { setIsCreateOpen(false); setIsDirty(false); }}
          onChange={() => setIsDirty(true)}
          submitLabel="Создать"
        />
      </PprModal>

      <PprModal open={Boolean(editingItem)} onClose={() => { setEditingId(null); setIsDirty(false); }} title="Редактирование ТМЦ" isDirty={isDirty}>
        {editingItem ? (
          <StockItemForm
            action={updateStockItemAction}
            itemId={editingItem.id}
            objects={objects}
            onSubmitted={() => { setEditingId(null); setIsDirty(false); }}
            onChange={() => setIsDirty(true)}
            submitLabel="Сохранить"
            initialValues={{
              object_id: editingItem.object_id,
              name: editingItem.name,
              kind: editingItem.kind,
              unit: editingItem.unit,
              sku: editingItem.sku ?? "",
              min_qty: String(editingItem.min_qty),
              comment: editingItem.comment ?? "",
              is_active: editingItem.is_active,
            }}
          />
        ) : null}
      </PprModal>
    </>
  );
}
