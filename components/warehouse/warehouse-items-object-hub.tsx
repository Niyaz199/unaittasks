"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";

type WarehouseObjectSummary = {
  object_id: string;
  object_name: string;
  item_count: number;
  active_item_count: number;
  location_count: number;
  low_stock_count: number;
};

export function WarehouseItemsObjectHub({
  summaries,
}: {
  summaries: WarehouseObjectSummary[];
}) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSummaries = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return summaries;
    return summaries.filter((item) => item.object_name.toLowerCase().includes(query));
  }, [searchTerm, summaries]);

  const metrics = useMemo(
    () => [
      { label: "Объекты", value: summaries.length, tone: "info" as const },
      { label: "Активные ТМЦ", value: summaries.reduce((sum, item) => sum + item.active_item_count, 0), tone: "success" as const },
      { label: "Места хранения", value: summaries.reduce((sum, item) => sum + item.location_count, 0), tone: "neutral" as const },
      { label: "Ниже минимума", value: summaries.reduce((sum, item) => sum + item.low_stock_count, 0), tone: "danger" as const },
    ],
    [summaries]
  );

  return (
    <PprPageShell
      metrics={metrics}
      onSearch={setSearchTerm}
      searchPlaceholder="Найдите объект по названию..."
      actions={
        <Link className="btn btn-ghost" href="/warehouse/items?showAll=1">
          Показать весь каталог
        </Link>
      }
      isEmpty={summaries.length === 0}
      emptyState={{
        message: "Нет доступных объектов",
        hint: "Когда для вас откроют объекты склада, здесь появится стартовый экран выбора.",
      }}
      isFilteredEmpty={filteredSummaries.length === 0}
      filteredEmptyState={{
        message: "Объекты не найдены",
        hint: "Попробуйте уточнить название объекта или переключитесь в обзорный режим.",
      }}
    >
      <div className="warehouse-items-hub">
        <div className="text-soft">
          Сначала выберите объект, а уже внутри него переключайтесь между местами хранения и фильтрами каталога.
        </div>

        <div className="warehouse-items-hub-grid">
          {filteredSummaries.map((item) => (
            <Link
              key={item.object_id}
              href={`/warehouse/items?objectId=${item.object_id}` as Route}
              className="warehouse-items-hub-card-link"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <article className="section-card warehouse-items-hub-card" style={{ cursor: "pointer", transition: "box-shadow 0.15s" }}>
                <div className="warehouse-items-hub-head">
                  <div className="warehouse-items-hub-copy">
                    <div className="warehouse-items-hub-title">{item.object_name}</div>
                    <div className="warehouse-items-hub-subtitle">Каталог ТМЦ и места хранения по объекту</div>
                  </div>
                  <span className={`badge ${item.low_stock_count > 0 ? "badge-danger" : "badge-success"}`}>
                    {item.low_stock_count > 0 ? `${item.low_stock_count} ниже минимума` : "Остатки в норме"}
                  </span>
                </div>

                <div className="warehouse-items-hub-stats">
                  <div className="warehouse-items-hub-stat">
                    <span className="warehouse-items-hub-stat-label">ТМЦ</span>
                    <strong>{item.item_count}</strong>
                  </div>
                  <div className="warehouse-items-hub-stat">
                    <span className="warehouse-items-hub-stat-label">Активные</span>
                    <strong>{item.active_item_count}</strong>
                  </div>
                  <div className="warehouse-items-hub-stat">
                    <span className="warehouse-items-hub-stat-label">Склады</span>
                    <strong>{item.location_count}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="text-soft" style={{ fontSize: "0.82rem" }}>Открыть каталог</span>
                  <span className="text-soft" style={{ fontSize: "0.82rem" }}>→</span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </PprPageShell>
  );
}
