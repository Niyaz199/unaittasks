"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { ArrowLeft, Boxes, Building2, ChevronDown, Filter, Layers3, MapPinned, PackagePlus, Search, TriangleAlert } from "lucide-react";
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
  kind: "zip" | "component";
  is_spare_part: boolean;
  procurement_method: "engineer" | "procurement";
  unit: string;
  sku: string | null;
  manufacturer: string | null;
  model: string | null;
  description: string | null;
  min_qty: number;
  current_qty: number;
  storage_location_id: string | null;
  comment: string | null;
  is_active: boolean;
  object: { name: string } | Array<{ name: string }> | null;
  storage_location: { id: string; name: string } | Array<{ id: string; name: string }> | null;
  system_group_links:
    | Array<{
        id: string;
        system_group_id: string;
        system_group: { id: string; name: string; code: string } | Array<{ id: string; name: string; code: string }> | null;
      }>
    | null;
  ppr_template_links:
    | Array<{
        id: string;
        template_id: string;
        required_qty: number;
        template: { id: string; name: string; system_id: string } | Array<{ id: string; name: string; system_id: string }> | null;
      }>
    | null;
};

type ObjectOption = { id: string; name: string };
type LocationOption = { id: string; object_id: string; name: string; is_active?: boolean };
type SystemGroupOption = { id: string; name: string; code: string; is_active?: boolean };
type PprTemplateOption = { id: string; name: string; object_id: string; system_id: string; system_group_id: string };

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

function resolveLocationName(raw: { id: string; name: string } | Array<{ id: string; name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

function resolveSystemGroupLabel(
  raw:
    | { id: string; name: string; code: string }
    | Array<{ id: string; name: string; code: string }>
    | null
    | undefined
) {
  const group = Array.isArray(raw) ? raw[0] ?? null : raw;
  if (!group) return null;
  return group.code ? `${group.name} (${group.code})` : group.name;
}

function formatQty(value: number, unit: string) {
  return `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 3 })} ${unit}`;
}

export function StockItemsAdmin({
  items,
  objects,
  locations,
  systemGroups,
  pprTemplates = [],
  equipment = [],
  canManage,
  initialFilterObjectId = "",
  currentObject = null,
  isAllObjectsMode = false,
}: {
  items: StockItemRow[];
  objects: ObjectOption[];
  locations: LocationOption[];
  systemGroups: SystemGroupOption[];
  pprTemplates?: PprTemplateOption[];
  equipment?: Array<{ id: string; name: string; dispatch_name: string | null; inventory_no: string | null; object_id: string; system_id: string; system_group_id: string | null }>;
  canManage: boolean;
  initialFilterObjectId?: string;
  currentObject?: ObjectOption | null;
  isAllObjectsMode?: boolean;
}) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const scopedObjectId = currentObject?.id ?? initialFilterObjectId;
  const isObjectScoped = Boolean(currentObject);
  const [filterObjectId, setFilterObjectId] = useState(scopedObjectId);
  const [filterKind, setFilterKind] = useState<StockItemRow["kind"] | "">("");
  const [filterLocationId, setFilterLocationId] = useState("");
  const [filterSystemGroupId, setFilterSystemGroupId] = useState("");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    setFilterObjectId(scopedObjectId);
  }, [scopedObjectId]);

  const editingItem = editingId ? items.find((item) => item.id === editingId) ?? null : null;

  const filteredItems = useMemo(() => {
    const result = items.filter((item) => {
      const matchesObject = filterObjectId === "" || item.object_id === filterObjectId;
      const matchesKind = filterKind === "" || item.kind === filterKind;
      const matchesLocation = filterLocationId === "" || item.storage_location_id === filterLocationId;
      const matchesSystemGroup =
        filterSystemGroupId === "" ||
        (item.system_group_links ?? []).some((link) => link.system_group_id === filterSystemGroupId);
      const matchesLowStock = !lowStockOnly || item.current_qty < item.min_qty;
      const search = searchTerm.trim().toLowerCase();
      const matchesSearch =
        search === "" ||
        item.name.toLowerCase().includes(search) ||
        item.sku?.toLowerCase().includes(search) ||
        resolveName(item.object).toLowerCase().includes(search);
      return matchesObject && matchesKind && matchesLocation && matchesSystemGroup && matchesLowStock && matchesSearch;
    });

    // Default sort by name, but put critical items first if lowStockOnly is not checked
    return result.sort((a, b) => {
      const aCritical = a.current_qty < a.min_qty;
      const bCritical = b.current_qty < b.min_qty;
      if (!lowStockOnly && aCritical !== bCritical) {
        return aCritical ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [filterKind, filterObjectId, filterLocationId, filterSystemGroupId, items, lowStockOnly, searchTerm]);

  const paginatedItems = useMemo(() => {
    return filteredItems.slice(0, page * itemsPerPage);
  }, [filteredItems, page]);

  useEffect(() => {
    setPage(1);
  }, [filterKind, filterObjectId, filterLocationId, filterSystemGroupId, lowStockOnly, searchTerm]);

  function updateSearchParams({
    nextObjectId = "",
    nextShowAll = false,
  }: {
    nextObjectId?: string;
    nextShowAll?: boolean;
  }) {
    const params = new URLSearchParams();
    if (nextObjectId) {
      params.set("objectId", nextObjectId);
    } else if (nextShowAll) {
      params.set("showAll", "1");
    }
    router.replace((`/warehouse/items${params.toString() ? `?${params.toString()}` : ""}`) as Route);
  }

  const filteredLocationOptions = useMemo(
    () => locations.filter((item) => (filterObjectId ? item.object_id === filterObjectId : true)),
    [filterObjectId, locations]
  );
  const lowStockCount = useMemo(() => items.filter((item) => item.current_qty < item.min_qty).length, [items]);
  const activeCount = useMemo(() => items.filter((item) => item.is_active).length, [items]);
  const activeFiltersCount = [filterKind, filterLocationId, filterSystemGroupId, lowStockOnly ? "low-stock" : ""].filter(Boolean).length;
  const selectedLocationName = filteredLocationOptions.find((item) => item.id === filterLocationId)?.name ?? null;
  const selectedSystemGroupName = systemGroups.find((item) => item.id === filterSystemGroupId)?.name ?? null;
  const searchPlaceholder = isObjectScoped
    ? "Найти ТМЦ по названию или SKU..."
    : "Поиск по названию, SKU или объекту...";

  useEffect(() => {
    if (!filterLocationId) return;
    if (filteredLocationOptions.some((item) => item.id === filterLocationId)) return;
    setFilterLocationId("");
  }, [filterLocationId, filteredLocationOptions]);

  const metrics = useMemo(
    () => [
      { label: "Всего карточек", value: items.length, tone: "neutral" as const },
      { label: "Активные", value: activeCount, tone: "success" as const },
      {
        label: "Ниже минимума",
        value: lowStockCount,
        tone: "danger" as const,
        isActive: lowStockOnly,
        onClick: () => setLowStockOnly((current) => !current),
      },
      {
        label: activeFiltersCount > 0 ? "После фильтров" : "В выдаче",
        value: filteredItems.length,
        tone: "info" as const,
      },
    ],
    [activeCount, activeFiltersCount, filteredItems.length, items.length, lowStockCount, lowStockOnly]
  );
  const scopeBadges = isObjectScoped
    ? [
        { key: "items", label: `${items.length} ТМЦ`, tone: "info" as const },
        { key: "locations", label: `${locations.length} мест хранения`, tone: "neutral" as const },
      ]
    : [
        { key: "all", label: `${objects.length} объектов`, tone: "info" as const },
        {
          key: "low-stock",
          label: lowStockCount > 0 ? `${lowStockCount} ниже минимума` : "Без критичных остатков",
          tone: lowStockCount > 0 ? ("danger" as const) : ("success" as const),
        },
      ];

  const activeFilterChips = [
    filterKind
      ? {
          key: "kind",
          label: `Тип: ${stockItemKindMeta[filterKind].label}`,
          onRemove: () => setFilterKind(""),
        }
      : null,
    selectedLocationName
      ? {
          key: "location",
          label: `Хранение: ${selectedLocationName}`,
          onRemove: () => setFilterLocationId(""),
        }
      : null,
    selectedSystemGroupName
      ? {
          key: "system-group",
          label: `Система: ${selectedSystemGroupName}`,
          onRemove: () => setFilterSystemGroupId(""),
        }
      : null,
    lowStockOnly
      ? {
          key: "low-stock",
          label: "Ниже минимума",
          onRemove: () => setLowStockOnly(false),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; onRemove: () => void }>;

  function resetFilters() {
    setFilterKind("");
    setFilterLocationId("");
    setFilterSystemGroupId("");
    setLowStockOnly(false);
  }

  return (
    <>
      <PprPageShell
        metrics={isObjectScoped ? undefined : metrics}
        onSearch={isObjectScoped ? undefined : setSearchTerm}
        searchPlaceholder={isObjectScoped ? undefined : searchPlaceholder}
        isEmpty={items.length === 0}
        keepChildrenWhenEmpty={isObjectScoped || isAllObjectsMode}
        emptyState={{
          message: "Карточки ТМЦ пока не созданы",
          hint: "Добавьте первую карточку ЗИП или компонента.",
        }}
        isFilteredEmpty={filteredItems.length === 0}
        keepChildrenWhenFilteredEmpty={isObjectScoped || isAllObjectsMode}
        filteredEmptyState={{
          message: "Ничего не найдено по текущим условиям",
          hint:
            activeFiltersCount > 0
              ? isObjectScoped
                ? "Выберите другое место хранения или объект в блоке каталога выше, либо снимите часть фильтров."
                : "Снимите часть фильтров или откройте конкретный объект."
              : "Попробуйте изменить поисковый запрос.",
        }}
        actions={!isObjectScoped ? (
          <>
            {isAllObjectsMode ? (
              <select
                className="select warehouse-toolbar-select"
                value=""
                onChange={(event) => {
                  if (!event.target.value) return;
                  updateSearchParams({ nextObjectId: event.target.value });
                }}
              >
                <option value="">Открыть объект...</option>
                {objects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : null}
            {!isObjectScoped ? (
              <button
                className={`btn warehouse-toolbar-btn ${lowStockOnly ? "btn-danger" : "btn-ghost"}`}
                type="button"
                onClick={() => setLowStockOnly(!lowStockOnly)}
              >
                <TriangleAlert size={15} aria-hidden="true" />
                Ниже минимума
                {lowStockCount > 0 && (
                  <span className={`warehouse-toolbar-badge${lowStockOnly ? " is-inverted" : ""}`}>
                    {lowStockCount}
                  </span>
                )}
              </button>
            ) : null}
            {!isObjectScoped ? (
              <button
                className={`btn warehouse-toolbar-btn ${isFiltersOpen ? "btn-neutral" : "btn-ghost"}`}
                type="button"
                onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              >
                <Filter size={15} aria-hidden="true" />
                Фильтры
                {activeFiltersCount > 0 && (
                  <span className="warehouse-toolbar-badge warehouse-toolbar-badge-accent">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            ) : null}
            {canManage ? (
              <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)}>
                <PackagePlus size={15} aria-hidden="true" />
                Новая ТМЦ
              </button>
            ) : null}
          </>
        ) : undefined}
        filters={
          !isObjectScoped && (isFiltersOpen || activeFilterChips.length > 0) ? (
            <div className="warehouse-filters-shell">
              {activeFilterChips.length > 0 ? (
                <div className="warehouse-filter-chips">
                  {activeFilterChips.map((chip) => (
                    <button key={chip.key} type="button" className="warehouse-filter-chip" onClick={chip.onRemove}>
                      {chip.label}
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {isFiltersOpen ? (
                <div className="warehouse-filter-grid">
                  <select className="select" value={filterKind} onChange={(event) => setFilterKind(event.target.value as StockItemRow["kind"] | "")}>
                    <option value="">Все типы ТМЦ</option>
                    {Object.entries(stockItemKindMeta).map(([key, meta]) => (
                      <option key={key} value={key}>
                        {meta.label}
                      </option>
                    ))}
                  </select>

                  {!isObjectScoped ? (
                    <select
                      className="select"
                      value={filterLocationId}
                      onChange={(event) => setFilterLocationId(event.target.value)}
                      disabled={!filteredLocationOptions.length}
                    >
                      <option value="">Все места хранения</option>
                      {filteredLocationOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  <select
                    className="select"
                    value={filterSystemGroupId}
                    onChange={(event) => setFilterSystemGroupId(event.target.value)}
                  >
                    <option value="">Все группы систем</option>
                    {systemGroups.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} {item.code ? `(${item.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="warehouse-filters-meta">
                <div className="text-soft warehouse-filters-results">
                  Найдено карточек: {filteredItems.length}
                </div>
                
                {activeFiltersCount > 0 && (
                  <button 
                    className="btn btn-ghost" 
                    type="button" 
                    onClick={resetFilters}
                  >
                    Сбросить всё
                  </button>
                )}
              </div>
            </div>
          ) : null
        }
      >
        {isObjectScoped || isAllObjectsMode ? (
          <div className="section-card warehouse-items-scope">
            <div className="warehouse-items-scope-top">
              <div className="warehouse-items-scope-copy">
                <div className="warehouse-items-scope-head">
                  <div className="warehouse-items-scope-title-row">
                    {isObjectScoped ? <Building2 size={18} aria-hidden="true" /> : <Layers3 size={18} aria-hidden="true" />}
                    <div className="warehouse-items-scope-title">{isObjectScoped ? currentObject?.name : "Все объекты"}</div>
                  </div>
                  <div className="warehouse-items-scope-badges">
                    {scopeBadges.map((badge) => (
                      <Badge key={badge.key} tone={badge.tone}>
                        {badge.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                {!isObjectScoped ? (
                  <div className="text-soft warehouse-items-scope-subtitle">
                    Этот режим нужен для обзора. Для повседневной работы удобнее открыть один объект и работать уже внутри него.
                  </div>
                ) : null}
              </div>

              <div className="warehouse-items-scope-actions">
                <button className="btn btn-ghost" type="button" onClick={() => updateSearchParams({})}>
                  <ArrowLeft size={15} aria-hidden="true" />
                  К объектам
                </button>
                {isObjectScoped ? (
                  <button className="btn btn-ghost" type="button" onClick={() => updateSearchParams({ nextShowAll: true })}>
                    <Layers3 size={15} aria-hidden="true" />
                    Весь каталог
                  </button>
                ) : null}
              </div>
            </div>

            <div className="warehouse-items-scope-filterbar">
              {isObjectScoped ? (
                <>
                  {/* Full-width search */}
                  <div className="warehouse-items-scope-input" style={{ flex: "1 1 100%" }}>
                    <Search size={15} aria-hidden="true" />
                    <input
                      className="input"
                      type="text"
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="По названию или SKU..."
                    />
                  </div>

                  {/* Filter pills */}
                  <div className="warehouse-filter-pills">
                    {/* Object switcher */}
                    <div className="warehouse-filter-pill">
                      <Building2 size={15} aria-hidden="true" />
                      <span className="warehouse-filter-pill-label">{currentObject?.name ?? "Объект"}</span>
                      <ChevronDown size={12} aria-hidden="true" />
                      <select
                        className="select warehouse-filter-pill-select"
                        value={currentObject?.id ?? ""}
                        onChange={(event) => updateSearchParams({ nextObjectId: event.target.value })}
                      >
                        {objects.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Location pill */}
                    <div className={`warehouse-filter-pill${filterLocationId ? " is-active" : ""}`}>
                      <MapPinned size={15} aria-hidden="true" />
                      <span className="warehouse-filter-pill-label">
                        {selectedLocationName ?? "Место хранения"}
                      </span>
                      <ChevronDown size={12} aria-hidden="true" />
                      <select
                        className="select warehouse-filter-pill-select"
                        value={filterLocationId}
                        onChange={(event) => setFilterLocationId(event.target.value)}
                        disabled={!filteredLocationOptions.length}
                      >
                        <option value="">Все места хранения</option>
                        {filteredLocationOptions.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Type pill */}
                    <div className={`warehouse-filter-pill${filterKind ? " is-active" : ""}`}>
                      <Boxes size={15} aria-hidden="true" />
                      <span className="warehouse-filter-pill-label">
                        {filterKind ? stockItemKindMeta[filterKind].label : "Тип ТМЦ"}
                      </span>
                      <ChevronDown size={12} aria-hidden="true" />
                      <select
                        className="select warehouse-filter-pill-select"
                        value={filterKind}
                        onChange={(event) => setFilterKind(event.target.value as StockItemRow["kind"] | "")}
                      >
                        <option value="">Все типы</option>
                        {Object.entries(stockItemKindMeta).map(([key, meta]) => (
                          <option key={key} value={key}>{meta.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* System group pill */}
                    <div className={`warehouse-filter-pill${filterSystemGroupId ? " is-active" : ""}`}>
                      <Filter size={15} aria-hidden="true" />
                      <span className="warehouse-filter-pill-label">
                        {selectedSystemGroupName ?? "Группы систем"}
                      </span>
                      <ChevronDown size={12} aria-hidden="true" />
                      <select
                        className="select warehouse-filter-pill-select"
                        value={filterSystemGroupId}
                        onChange={(event) => setFilterSystemGroupId(event.target.value)}
                      >
                        <option value="">Все группы систем</option>
                        {systemGroups.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}{item.code ? ` (${item.code})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Reset active filters */}
                    {activeFiltersCount > 0 ? (
                      <button
                        type="button"
                        className="warehouse-filter-pill"
                        onClick={resetFilters}
                        style={{ color: "var(--danger)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--danger) 35%, transparent)" }}
                      >
                        Сбросить
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="warehouse-items-scope-note text-soft">
                  Выберите объект через список сверху или вернитесь к карточкам объектов, если нужен более спокойный вход в каталог.
                </div>
              )}
            </div>
            
            {isObjectScoped ? (
              <div className="warehouse-items-scope-filter-bar">
                <div className="text-soft warehouse-filters-results">Найдено карточек: {filteredItems.length}</div>
                <div className="warehouse-items-scope-filter-actions">
                  {canManage ? (
                    <button className="btn btn-accent warehouse-items-scope-primary-btn" type="button" onClick={() => setIsCreateOpen(true)}>
                      <PackagePlus size={15} aria-hidden="true" />
                      Новая ТМЦ
                    </button>
                  ) : null}
                  <button
                    className={`btn warehouse-toolbar-btn ${lowStockOnly ? "btn-danger" : "btn-ghost"}`}
                    type="button"
                    onClick={() => setLowStockOnly(!lowStockOnly)}
                  >
                    <TriangleAlert size={15} aria-hidden="true" />
                    Ниже минимума
                    {lowStockCount > 0 && (
                      <span className={`warehouse-toolbar-badge${lowStockOnly ? " is-inverted" : ""}`}>
                        {lowStockCount}
                      </span>
                    )}
                  </button>
                  {activeFiltersCount > 0 ? (
                    <button className="btn btn-ghost" type="button" onClick={resetFilters}>
                      Сбросить всё
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {filteredItems.length > 0 ? (
          <>
            <div className="desktop-only">
              <DataTable
                className="table-zebra table-dense warehouse-items-table"
                columns={[
                  { key: "name", label: "ТМЦ" },
                  { key: "kind", label: "Тип" },
                  ...(isObjectScoped ? [] : [{ key: "object", label: "Объект" }]),
                  { key: "storage", label: "Хранение" },
                  { key: "stock", label: "Остаток", className: "text-right" },
                  { key: "status", label: "Статус" },
                  { key: "actions", label: "Действия", className: "text-right" },
                ]}
              >
                {paginatedItems.map((item) => {
                  const isLowStock = item.current_qty < item.min_qty;
                  const systemGroupsLabel = (item.system_group_links ?? [])
                    .map((link) => resolveSystemGroupLabel(link.system_group))
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <tr
                      key={item.id}
                      className={isLowStock ? "warehouse-row-alert" : undefined}
                      onClick={() => router.push(`/warehouse/items/${item.id}` as Route)}
                      style={{ cursor: "pointer" }}
                    >
                      <td>
                        <Link
                          href={`/warehouse/items/${item.id}` as Route}
                          style={{ fontWeight: 600, textDecoration: "none", color: "inherit", cursor: "pointer" }}
                        >
                          {item.name}
                        </Link>
                        <div className="text-soft" style={{ fontSize: "0.85rem" }}>
                          {item.sku ? `SKU: ${item.sku}` : null}
                        </div>
                        {systemGroupsLabel ? (
                          <div className="text-soft" style={{ fontSize: "0.8rem", marginTop: "0.2rem", maxWidth: "250px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={systemGroupsLabel}>
                            {systemGroupsLabel}
                          </div>
                        ) : null}
                      </td>
                      <td>{stockItemKindMeta[item.kind].label}</td>
                      {!isObjectScoped ? <td>{resolveName(item.object)}</td> : null}
                      <td>{resolveLocationName(item.storage_location)}</td>
                      <td className="text-right tabular-nums">
                        <div style={{ fontWeight: 500, color: isLowStock ? "var(--danger)" : "inherit" }}>
                          {formatQty(item.current_qty, item.unit)}
                        </div>
                        <div className="text-soft" style={{ fontSize: "0.8rem" }}>
                          мин. {formatQty(item.min_qty, item.unit)}
                        </div>
                      </td>
                      <td>
                        <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                          {!item.is_active && <Badge tone="neutral">Неактивна</Badge>}
                          {isLowStock && <Badge tone="danger">Ниже минимума</Badge>}
                        </div>
                      </td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        {canManage ? (
                          <button
                            className="btn btn-ghost ppr-action-btn"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(item.id);
                            }}
                          >
                            Изменить
                          </button>
                        ) : (
                          <span className="text-soft">Просмотр</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            </div>

            <div className="mobile-cards mobile-only">
              {paginatedItems.map((item) => {
                const isLowStock = item.current_qty < item.min_qty;
                return (
                  <div
                    key={item.id}
                    className="section-card mobile-card"
                    style={{ padding: "0.8rem", display: "grid", gap: "0.6rem", cursor: "pointer" }}
                    onClick={() => router.push(`/warehouse/items/${item.id}` as Route)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                      <div>
                        <Link
                          href={`/warehouse/items/${item.id}` as Route}
                          style={{ fontWeight: 600, fontSize: "1rem", lineHeight: 1.2, textDecoration: "none", color: "inherit", cursor: "pointer" }}
                        >
                          {item.name}
                        </Link>
                        <div className="text-soft" style={{ fontSize: "0.8rem", marginTop: "0.2rem" }}>
                          {isObjectScoped ? stockItemKindMeta[item.kind].label : `${stockItemKindMeta[item.kind].label} • ${resolveName(item.object)}`}
                        </div>
                        {item.sku ? (
                          <div className="text-soft" style={{ fontSize: "0.76rem", marginTop: "0.18rem" }}>
                            SKU: {item.sku}
                          </div>
                        ) : null}
                      </div>
                      {isLowStock && <Badge tone="danger">Ниже мин.</Badge>}
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.85rem", background: "color-mix(in srgb, var(--panel-soft) 40%, transparent)", padding: "0.6rem", borderRadius: "8px" }}>
                      <div>
                        <div className="text-soft" style={{ fontSize: "0.75rem", marginBottom: "0.1rem" }}>Остаток</div>
                        <div style={{ fontWeight: 600, color: isLowStock ? "var(--danger)" : "inherit" }} className="tabular-nums">
                          {formatQty(item.current_qty, item.unit)}
                        </div>
                      </div>
                      <div>
                        <div className="text-soft" style={{ fontSize: "0.75rem", marginBottom: "0.1rem" }}>Минимум</div>
                        <div className="tabular-nums">{formatQty(item.min_qty, item.unit)}</div>
                      </div>
                      {item.storage_location_id && (
                        <div style={{ gridColumn: "1 / -1", paddingTop: "0.2rem", borderTop: "1px solid color-mix(in srgb, var(--line) 30%, transparent)", marginTop: "0.2rem" }}>
                          <div className="text-soft" style={{ fontSize: "0.75rem", marginBottom: "0.1rem" }}>Хранение</div>
                          <div>{resolveLocationName(item.storage_location)}</div>
                        </div>
                      )}
                    </div>

                    {item.system_group_links?.length ? (
                      <div className="text-soft" style={{ fontSize: "0.76rem", lineHeight: 1.35 }}>
                        {item.system_group_links
                          .map((link) => resolveSystemGroupLabel(link.system_group))
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    ) : null}

                    {canManage && (
                      <div
                        style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.2rem" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="btn btn-ghost ppr-action-btn"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(item.id);
                          }}
                          style={{ width: "100%", justifyContent: "center" }}
                        >
                          Изменить
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {paginatedItems.length < filteredItems.length && (
              <div className="row" style={{ justifyContent: "center", marginTop: "1rem" }}>
                <button className="btn btn-ghost" type="button" onClick={() => setPage((p) => p + 1)}>
                  Показать еще ({filteredItems.length - paginatedItems.length} осталось)
                </button>
              </div>
            )}
          </>
        ) : null}
      </PprPageShell>

      <PprModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setIsDirty(false); }} title="Новая карточка ТМЦ" isDirty={isDirty}>
        <StockItemForm
          action={createStockItemAction}
          objects={objects}
          locations={locations}
          systemGroups={systemGroups}
          pprTemplates={pprTemplates}
          equipment={equipment}
          fixedObjectId={isObjectScoped ? currentObject?.id : undefined}
          fixedObjectName={isObjectScoped ? currentObject?.name : undefined}
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
            locations={locations}
            systemGroups={systemGroups}
            pprTemplates={pprTemplates}
            equipment={equipment}
            onSubmitted={() => { setEditingId(null); setIsDirty(false); }}
            onChange={() => setIsDirty(true)}
            submitLabel="Сохранить"
            initialValues={{
              object_id: editingItem.object_id,
              name: editingItem.name,
              kind: editingItem.kind,
              is_spare_part: editingItem.is_spare_part,
              procurement_method: editingItem.procurement_method,
              unit: editingItem.unit,
              sku: editingItem.sku ?? "",
              manufacturer: editingItem.manufacturer ?? "",
              model: editingItem.model ?? "",
              description: editingItem.description ?? "",
              min_qty: String(editingItem.min_qty),
              storage_location_id: editingItem.storage_location_id ?? "",
              system_group_ids: (editingItem.system_group_links ?? []).map((link) => link.system_group_id),
              ppr_template_links: (editingItem.ppr_template_links ?? []).map((link) => ({
                template_id: link.template_id,
                required_qty: String(link.required_qty),
              })),
              comment: editingItem.comment ?? "",
              is_active: editingItem.is_active,
            }}
          />
        ) : null}
      </PprModal>
    </>
  );
}
