"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { PprPageShell } from "@/components/ppr/ui/ppr-page-shell";
import type { PprEquipmentObjectSummaryRow } from "@/lib/ppr/structure-queries";

export function PprEquipmentObjectHub({
  summaries,
}: {
  summaries: PprEquipmentObjectSummaryRow[];
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
      { label: "В эксплуатации", value: summaries.reduce((sum, item) => sum + item.active_count, 0), tone: "success" as const },
      { label: "В ремонте", value: summaries.reduce((sum, item) => sum + item.repair_count, 0), tone: "warning" as const },
      { label: "Выведено", value: summaries.reduce((sum, item) => sum + item.out_of_service_count, 0), tone: "danger" as const },
    ],
    [summaries]
  );

  return (
    <PprPageShell
      metrics={metrics}
      onSearch={setSearchTerm}
      searchPlaceholder="Найдите объект по названию..."
      isEmpty={summaries.length === 0}
      emptyState={{
        message: "Нет доступных объектов",
        hint: "Когда для вас откроют объекты ППР, здесь появится стартовый экран выбора.",
      }}
      isFilteredEmpty={filteredSummaries.length === 0}
      filteredEmptyState={{
        message: "Объекты не найдены",
        hint: "Попробуйте уточнить название объекта.",
      }}
    >
      <div className="warehouse-items-hub">
        <div className="text-soft">
          Выберите объект, чтобы просмотреть оборудование, системы и помещения только для него.
        </div>

        <div className="warehouse-items-hub-grid">
          {filteredSummaries.map((item) => {
            const hasIssues = item.repair_count + item.out_of_service_count > 0;
            const issueCount = item.repair_count + item.out_of_service_count;
            return (
              <Link
                key={item.object_id}
                href={`/ppr/equipment?objectId=${item.object_id}` as Route}
                className="warehouse-items-hub-card-link"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <article className="section-card warehouse-items-hub-card" style={{ cursor: "pointer", transition: "box-shadow 0.15s" }}>
                  <div className="warehouse-items-hub-head">
                    <div className="warehouse-items-hub-copy">
                      <div className="warehouse-items-hub-title">{item.object_name}</div>
                      <div className="warehouse-items-hub-subtitle">Оборудование ППР по объекту</div>
                    </div>
                    <span className={`badge ${hasIssues ? "badge-warning" : "badge-success"}`}>
                      {hasIssues ? `${issueCount} не в работе` : "Всё в норме"}
                    </span>
                  </div>

                  <div className="warehouse-items-hub-stats" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                    <div className="warehouse-items-hub-stat">
                      <span className="warehouse-items-hub-stat-label">Всего</span>
                      <strong>{item.total_count}</strong>
                    </div>
                    <div className="warehouse-items-hub-stat">
                      <span className="warehouse-items-hub-stat-label">В работе</span>
                      <strong>{item.active_count}</strong>
                    </div>
                    <div className="warehouse-items-hub-stat">
                      <span className="warehouse-items-hub-stat-label">В ремонте</span>
                      <strong>{item.repair_count}</strong>
                    </div>
                    <div className="warehouse-items-hub-stat">
                      <span className="warehouse-items-hub-stat-label">Выведено</span>
                      <strong>{item.out_of_service_count}</strong>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span className="text-soft" style={{ fontSize: "0.82rem" }}>Открыть оборудование</span>
                    <span className="text-soft" style={{ fontSize: "0.82rem" }}>→</span>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      </div>
    </PprPageShell>
  );
}
