"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { PprModal } from "@/components/ppr/ui/ppr-modal";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";
import { createStockLocationAction, updateStockLocationAction } from "@/app/actions/warehouse-actions";

const StockLocationForm = dynamic(
  () => import("@/components/warehouse/stock-location-form").then((module) => module.StockLocationForm),
  { loading: () => <div className="section-card text-soft">Загрузка...</div> }
);

type StockLocationRow = {
  id: string;
  object_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  object: { name: string } | Array<{ name: string }> | null;
};

type ObjectOption = { id: string; name: string };

function resolveName(raw: { name: string } | Array<{ name: string }> | null | undefined) {
  if (Array.isArray(raw)) return raw[0]?.name ?? "—";
  return raw?.name ?? "—";
}

export function StockLocationsAdmin({
  locations,
  objects,
  initialFilterObjectId = "",
}: {
  locations: StockLocationRow[];
  objects: ObjectOption[];
  initialFilterObjectId?: string;
}) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterObjectId, setFilterObjectId] = useState(initialFilterObjectId);

  useEffect(() => {
    setFilterObjectId(initialFilterObjectId);
  }, [initialFilterObjectId]);

  const editingLocation = editingId ? locations.find((item) => item.id === editingId) ?? null : null;

  const filteredLocations = useMemo(() => {
    return locations.filter((item) => {
      const matchesObject = filterObjectId === "" || item.object_id === filterObjectId;
      const search = searchTerm.trim().toLowerCase();
      const matchesSearch =
        search === "" ||
        item.name.toLowerCase().includes(search) ||
        item.description?.toLowerCase().includes(search) ||
        resolveName(item.object).toLowerCase().includes(search);
      return matchesObject && matchesSearch;
    });
  }, [filterObjectId, locations, searchTerm]);

  function updateSearchParams(nextObjectId: string) {
    const params = new URLSearchParams();
    if (nextObjectId) params.set("objectId", nextObjectId);
    router.replace((`/warehouse/locations${params.toString() ? `?${params.toString()}` : ""}`) as Route);
  }

  const metrics = useMemo(() => {
    const total = locations.length;
    const active = locations.filter((item) => item.is_active).length;
    const inactive = total - active;
    return [
      { label: "Всего мест хранения", value: total, tone: "neutral" as const },
      { label: "Активных", value: active, tone: "success" as const },
      { label: "Неактивных", value: inactive, tone: "warning" as const },
    ];
  }, [locations]);

  return (
    <>
      <PprPageShell
        metrics={metrics}
        onSearch={setSearchTerm}
        searchPlaceholder="Поиск по названию или объекту..."
        isEmpty={locations.length === 0}
        emptyState={{
          message: "Места хранения пока не созданы",
          hint: "Создайте первое место хранения и начните использовать QR для склада.",
        }}
        isFilteredEmpty={filteredLocations.length === 0}
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

            <button className="btn btn-accent" type="button" onClick={() => setIsCreateOpen(true)}>
              + Место хранения
            </button>
          </>
        }
      >
        <div className="desktop-only">
          <DataTable
            columns={[
              { key: "name", label: "Место хранения" },
              { key: "object", label: "Объект" },
              { key: "description", label: "Описание" },
              { key: "status", label: "Статус" },
              { key: "actions", label: "Действия" },
            ]}
          >
            {filteredLocations.map((item) => (
              <tr key={item.id} className="clickable-row" onClick={() => router.push(`/warehouse/locations/${item.id}` as Route)}>
                <td style={{ fontWeight: 600 }}>{item.name}</td>
                <td>{resolveName(item.object)}</td>
                <td>{item.description?.trim() || <span className="text-soft">Без описания</span>}</td>
                <td>
                  <Badge tone={item.is_active ? "success" : "neutral"}>{item.is_active ? "Активно" : "Неактивно"}</Badge>
                </td>
                <td onClick={(event) => event.stopPropagation()}>
                  <div className="ppr-table-actions">
                    <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(item.id)}>
                      Изменить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </div>

        <div className="mobile-cards mobile-only">
          {filteredLocations.map((item) => (
            <div
              key={item.id}
              className="section-card mobile-card"
              style={{ cursor: "pointer" }}
              onClick={() => router.push(`/warehouse/locations/${item.id}` as Route)}
            >
              <div className="grid" style={{ gap: "0.55rem" }}>
                <div style={{ fontWeight: 600 }}>{item.name}</div>
                <div className="text-soft">Объект: {resolveName(item.object)}</div>
                <div className="text-soft">{item.description?.trim() || "Без описания"}</div>
                <div>
                  <Badge tone={item.is_active ? "success" : "neutral"}>{item.is_active ? "Активно" : "Неактивно"}</Badge>
                </div>
                <div className="ppr-table-actions" onClick={(event) => event.stopPropagation()}>
                  <button className="btn btn-ghost ppr-action-btn" type="button" onClick={() => setEditingId(item.id)}>
                    Изменить
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PprPageShell>

      <PprModal open={isCreateOpen} onClose={() => { setIsCreateOpen(false); setIsDirty(false); }} title="Новое место хранения" isDirty={isDirty}>
        <StockLocationForm
          action={createStockLocationAction}
          objects={objects}
          onSubmitted={() => { setIsCreateOpen(false); setIsDirty(false); }}
          onChange={() => setIsDirty(true)}
          submitLabel="Создать"
        />
      </PprModal>

      <PprModal open={Boolean(editingLocation)} onClose={() => { setEditingId(null); setIsDirty(false); }} title="Редактирование места хранения" isDirty={isDirty}>
        {editingLocation ? (
          <StockLocationForm
            action={updateStockLocationAction}
            locationId={editingLocation.id}
            objects={objects}
            onSubmitted={() => { setEditingId(null); setIsDirty(false); }}
            onChange={() => setIsDirty(true)}
            submitLabel="Сохранить"
            initialValues={{
              object_id: editingLocation.object_id,
              name: editingLocation.name,
              description: editingLocation.description ?? "",
              is_active: editingLocation.is_active,
            }}
          />
        ) : null}
      </PprModal>
    </>
  );
}
