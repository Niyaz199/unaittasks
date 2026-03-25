"use client";

import { DirectorySummary } from "@/components/ppr/ui/directory-summary";
import { Badge } from "@/components/ui/badge";
import type { PprCalendarYearGroupOverviewRow, PprCalendarYearSystemOverviewRow } from "@/lib/ppr/queries";
import { buildCalendarHref, formatHours, formatMonthLabel, monthMetricTone } from "./ppr-calendar-selectors";
import type { CalendarFilters, CalendarSystemGroupOption } from "./types";

function AnnualMetricCell({
  href,
  metrics,
  maxHours,
}: {
  href: string;
  metrics: {
    items_count: number;
    norm_hours_total: number;
    overdue_count: number;
    carried_over_count: number;
    materialized_count: number;
  };
  maxHours: number;
}) {
  const tone = monthMetricTone(metrics);
  const isEmpty = metrics.items_count === 0;
  const intensity = Math.min(Math.max(metrics.norm_hours_total / Math.max(maxHours, 1), 0), 1);
  const opacityPercent = Math.round(6 + intensity * 22);

  return (
    <a
      href={href}
      title={[
        `Позиций: ${metrics.items_count}`,
        `Нормо-часы: ${formatHours(metrics.norm_hours_total)}`,
        metrics.materialized_count ? `В задачах: ${metrics.materialized_count}` : "",
        metrics.carried_over_count ? `Carryover: ${metrics.carried_over_count}` : "",
        metrics.overdue_count ? `Просрочено: ${metrics.overdue_count}` : "",
      ]
        .filter(Boolean)
        .join("\n")}
      style={{
        display: "grid",
        gap: "0.15rem",
        padding: "0.55rem 0.6rem",
        borderRadius: "8px",
        border: "1px solid transparent",
        background: isEmpty ? "transparent" : `color-mix(in srgb, var(--${tone}) ${opacityPercent}%, transparent)`,
        color: "inherit",
        textDecoration: "none",
        minHeight: "68px",
        alignContent: "center",
      }}
    >
      {isEmpty ? (
        <span style={{ fontSize: "0.95rem", fontWeight: 700, textAlign: "center", color: "var(--text-soft)", opacity: 0.5 }}>—</span>
      ) : (
        <>
          <span style={{ fontSize: "1rem", fontWeight: 600, textAlign: "center", lineHeight: 1.1, color: "var(--text)" }}>
            {formatHours(metrics.norm_hours_total)} ч
          </span>
          <span style={{ fontSize: "0.75rem", textAlign: "center", lineHeight: 1.05, color: "var(--text-soft)" }}>
            {metrics.items_count} поз.
          </span>
        </>
      )}
    </a>
  );
}

export function PprCalendarYearView({
  filters,
  currentYear,
  yearGroupOverview,
  yearSystemOverview,
  yearSummary,
  yearScreen,
  selectedGroup,
  backToGroupsHref,
  globalMaxHours,
}: {
  filters: CalendarFilters;
  currentYear: number;
  yearGroupOverview: PprCalendarYearGroupOverviewRow[];
  yearSystemOverview: PprCalendarYearSystemOverviewRow[];
  yearSummary: { totalHours: number; overdue: number; carry: number; positions: number };
  yearScreen: "groups" | "systems";
  selectedGroup?: CalendarSystemGroupOption;
  backToGroupsHref: string;
  globalMaxHours: number;
}) {
  return (
    <div className="grid" style={{ gap: "1rem" }}>
      {yearScreen === "groups" ? (
        <>
          <DirectorySummary
            metrics={[
              { label: "Групп в обзоре", value: yearGroupOverview.length, tone: "info" },
              { label: "Суммарные нормо-часы", value: `${formatHours(yearSummary.totalHours)} ч`, tone: "info" },
              { label: "Плановых позиций", value: yearSummary.positions, tone: "neutral" },
            ]}
          />

          <div className="section-card grid" style={{ gap: "0.9rem" }}>
            <div className="grid" style={{ gap: "0.35rem" }}>
              <strong>Уровень 1. Годовой обзор по группам систем</strong>
              <span className="text-soft">Группы систем и плановая нагрузка по месяцам.</span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: "1100px", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "0.75rem", color: "var(--text-soft)", borderBottom: "1px solid var(--line)", fontWeight: 500 }}>
                      Группа систем
                    </th>
                    {Array.from({ length: 12 }, (_, index) => {
                      const month = `${currentYear}-${String(index + 1).padStart(2, "0")}`;
                      return (
                        <th
                          key={month}
                          style={{ textAlign: "center", padding: "0.75rem 0.25rem", color: "var(--text-soft)", borderBottom: "1px solid var(--line)", fontWeight: 500 }}
                        >
                          {formatMonthLabel(month, "short")}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {yearGroupOverview.map((row) => (
                    <tr key={row.system_group_id} className="annual-row">
                      <td style={{ padding: "1rem 0.75rem", verticalAlign: "middle", borderBottom: "1px solid var(--line)" }}>
                        <div className="grid" style={{ gap: "0.25rem" }}>
                          <a
                            href={buildCalendarHref(filters, {
                              groupId: row.system_group_id,
                              systemId: null,
                              tab: "year",
                            })}
                            style={{ color: "inherit", textDecoration: "none", fontWeight: 700 }}
                          >
                            {row.name}
                          </a>
                          <span className="text-soft" style={{ fontSize: "0.8rem" }}>
                            {row.code} • {row.systems_count} систем
                          </span>
                        </div>
                      </td>
                      {row.months.map((metrics) => (
                        <td key={`${row.system_group_id}-${metrics.month}`} style={{ padding: "0.5rem 0.25rem", height: "1px", borderBottom: "1px solid var(--line)" }}>
                          <AnnualMetricCell
                            href={buildCalendarHref(filters, {
                              groupId: row.system_group_id,
                              systemId: null,
                              month: metrics.month,
                              tab: "year",
                            })}
                            metrics={metrics}
                            maxHours={globalMaxHours}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="section-card grid" style={{ gap: "0.9rem" }}>
          <div className="grid" style={{ gap: "0.6rem" }}>
            <div className="row" style={{ gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
              <span className="text-soft" style={{ fontSize: "0.82rem" }}>Календарь ППР</span>
              <span className="text-soft">/</span>
              <span className="text-soft" style={{ fontSize: "0.82rem" }}>Группы систем</span>
              <span className="text-soft">/</span>
              <strong style={{ fontSize: "0.88rem" }}>{selectedGroup?.name ?? "Выбранная группа"}</strong>
            </div>

            <div className="grid" style={{ gap: "0.35rem" }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
                <div className="grid" style={{ gap: "0.35rem" }}>
                  <strong>Уровень 2. Годовой обзор по системам внутри группы</strong>
                  <span className="text-soft">Системы выбранной группы и плановая нагрузка по месяцам.</span>
                </div>
                <a href={backToGroupsHref} className="btn btn-ghost">
                  ← Назад к группам
                </a>
              </div>
            </div>
          </div>

          <DirectorySummary
            metrics={[
              { label: "Выбранная группа", value: selectedGroup?.name ?? "—", tone: "neutral" },
              { label: "Систем в группе", value: yearSystemOverview.length, tone: "info" },
              {
                label: "Суммарные часы группы",
                value: `${formatHours(yearSystemOverview.reduce((sum, row) => sum + row.totals.norm_hours_total, 0))} ч`,
                tone: "neutral",
              },
            ]}
          />

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "1100px", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "0.75rem", color: "var(--text-soft)", borderBottom: "1px solid var(--line)", fontWeight: 500 }}>
                    Система
                  </th>
                  {Array.from({ length: 12 }, (_, index) => {
                    const month = `${currentYear}-${String(index + 1).padStart(2, "0")}`;
                    return (
                      <th
                        key={month}
                        style={{ textAlign: "center", padding: "0.75rem 0.25rem", color: "var(--text-soft)", borderBottom: "1px solid var(--line)", fontWeight: 500 }}
                      >
                        {formatMonthLabel(month, "short")}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {yearSystemOverview.map((row) => (
                  <tr key={row.system_id} className="annual-row">
                    <td style={{ padding: "1rem 0.75rem", verticalAlign: "middle", borderBottom: "1px solid var(--line)" }}>
                      <div className="grid" style={{ gap: "0.25rem" }}>
                        <a
                          href={buildCalendarHref(filters, {
                            groupId: row.system_group_id,
                            systemId: row.system_id,
                            tab: "month",
                          })}
                          style={{ color: "inherit", textDecoration: "none", fontWeight: 700 }}
                        >
                          {row.name}
                        </a>
                        <span className="text-soft" style={{ fontSize: "0.8rem" }}>
                          {row.object_name}
                        </span>
                      </div>
                    </td>
                    {row.months.map((metrics) => (
                      <td key={`${row.system_id}-${metrics.month}`} style={{ padding: "0.5rem 0.25rem", height: "1px", borderBottom: "1px solid var(--line)" }}>
                        <AnnualMetricCell
                          href={buildCalendarHref(filters, {
                            groupId: row.system_group_id,
                            systemId: row.system_id,
                            month: metrics.month,
                            tab: "month",
                          })}
                          metrics={metrics}
                          maxHours={globalMaxHours}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {yearSummary.overdue > 0 ? (
        <div className="row" style={{ gap: "0.45rem", flexWrap: "wrap" }}>
          <Badge tone="danger">Просрочка: {yearSummary.overdue}</Badge>
          <Badge tone="warning">Carryover: {yearSummary.carry}</Badge>
        </div>
      ) : null}
    </div>
  );
}
