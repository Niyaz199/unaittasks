"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { reschedulePprMonthPlanItemAction } from "@/app/actions/ppr-calendar-actions";
import { EmptyState } from "@/components/ui/empty-state";
import type { PprCalendarYearGroupOverviewRow, PprCalendarYearSystemOverviewRow } from "@/lib/ppr/queries";
import {
  buildCalendarHref,
  countMonthHours,
  formatDate,
  moveItemToDate,
  resolveTemplate,
  shiftPlanMonth,
} from "./ppr-calendar-selectors";
import { PprCalendarYearView } from "./ppr-calendar-year-view";
import type {
  CalendarFilters,
  CalendarObjectOption,
  CalendarSystemGroupOption,
  CalendarSystemOption,
  MonthPlanItemRow,
  MonthPlanRow,
  MonthlyNotice,
  PendingMaterializedMove,
} from "./types";

const PprFiltersDrawer = dynamic(() => import("./filters-drawer").then((module) => module.PprFiltersDrawer));
const PprCalendarMonthSection = dynamic(() => import("./ppr-calendar-month-section").then((module) => module.PprCalendarMonthSection), {
  loading: () => <div className="section-card text-soft">Загрузка месячного плана...</div>,
});
const PprCalendarItemDrawers = dynamic(() => import("./ppr-calendar-item-drawers").then((module) => module.PprCalendarItemDrawers));

export function PprCalendarAdmin({
  objects,
  systemGroups,
  systems,
  yearGroupOverview,
  yearSystemOverview,
  monthPlans,
  monthPlanItems,
  currentYear,
  currentMonthInput,
  selectedObjectId,
  selectedGroupId,
  selectedSystemId,
  initialTab,
}: {
  objects: CalendarObjectOption[];
  systemGroups: CalendarSystemGroupOption[];
  systems: CalendarSystemOption[];
  yearGroupOverview: PprCalendarYearGroupOverviewRow[];
  yearSystemOverview: PprCalendarYearSystemOverviewRow[];
  monthPlans: MonthPlanRow[];
  monthPlanItems: MonthPlanItemRow[];
  currentYear: number;
  currentMonthInput: string;
  selectedObjectId?: string;
  selectedGroupId?: string;
  selectedSystemId?: string;
  initialTab: "year" | "month";
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"year" | "month">(initialTab);
  const [monthView, setMonthView] = useState<"grid" | "list">("grid");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [localMonthItems, setLocalMonthItems] = useState(monthPlanItems);
  const [monthlyNotice, setMonthlyNotice] = useState<MonthlyNotice | null>(null);
  const [pendingMaterializedMove, setPendingMaterializedMove] = useState<PendingMaterializedMove | null>(null);
  const [materializedReason, setMaterializedReason] = useState("");
  const [isSubmitting, startSubmitting] = useTransition();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    if (tabParam === "month") {
      setActiveTab("month");
    } else if (tabParam === "year") {
      setActiveTab("year");
    }
  }, [tabParam]);

  useEffect(() => {
    setLocalMonthItems(monthPlanItems);
  }, [monthPlanItems]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleTabChange = (tab: "year" | "month") => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}` as never);
  };

  const editingItem = editingItemId ? localMonthItems.find((item) => item.id === editingItemId) ?? null : null;
  const pendingMaterializedItem = pendingMaterializedMove
    ? localMonthItems.find((item) => item.id === pendingMaterializedMove.itemId) ?? null
    : null;

  const filters: CalendarFilters = {
    year: currentYear,
    month: currentMonthInput,
    objectId: selectedObjectId,
    groupId: selectedGroupId,
    systemId: selectedSystemId,
  };

  const filteredSystems = useMemo(() => {
    if (!selectedGroupId) return systems;
    return systems.filter((system) => system.system_group_id === selectedGroupId);
  }, [selectedGroupId, systems]);

  const selectedObject = objects.find((item) => item.id === selectedObjectId);
  const selectedGroup = systemGroups.find((item) => item.id === selectedGroupId);
  const selectedSystem = systems.find((item) => item.id === selectedSystemId);
  const yearScreen: "groups" | "systems" = selectedGroupId ? "systems" : "groups";

  const monthTotals = useMemo(
    () => ({
      items: localMonthItems.length,
      overdue: localMonthItems.filter((item) => item.is_overdue).length,
      carried: localMonthItems.filter((item) => item.is_carried_over).length,
      materialized: localMonthItems.filter((item) => item.task_id !== null).length,
      hours: countMonthHours(localMonthItems),
      equipment: new Set(localMonthItems.map((item) => item.equipment_id)).size,
    }),
    [localMonthItems]
  );

  const yearSummary = useMemo(() => {
    const totalHours = yearGroupOverview.reduce((sum, row) => sum + row.totals.norm_hours_total, 0);
    const overdue = yearGroupOverview.reduce((sum, row) => sum + row.totals.overdue_count, 0);
    const carry = yearGroupOverview.reduce((sum, row) => sum + row.totals.carried_over_count, 0);
    const positions = yearGroupOverview.reduce((sum, row) => sum + row.totals.items_count, 0);
    return { totalHours, overdue, carry, positions };
  }, [yearGroupOverview]);

  const maxGroupHours = useMemo(
    () => Math.max(...yearGroupOverview.flatMap((row) => row.months.map((month) => month.norm_hours_total)), 1),
    [yearGroupOverview]
  );
  const maxSystemHours = useMemo(
    () => Math.max(...yearSystemOverview.flatMap((row) => row.months.map((month) => month.norm_hours_total)), 1),
    [yearSystemOverview]
  );
  const globalMaxHours = Math.max(maxGroupHours, maxSystemHours);

  if (!systems.length) {
    return <EmptyState message="Календарь ППР пока недоступен" hint="Нет систем, доступных для управления календарем в рамках выбранных прав или объекта." />;
  }

  const previousMonthHref = buildCalendarHref(filters, { month: shiftPlanMonth(currentMonthInput, -1), tab: "month" });
  const nextMonthHref = buildCalendarHref(filters, { month: shiftPlanMonth(currentMonthInput, 1), tab: "month" });
  const backToGroupsHref = buildCalendarHref(filters, { groupId: null, systemId: null, tab: "year" });

  const submitReschedule = (item: MonthPlanItemRow, targetDate: string, reason?: string) => {
    const snapshot = localMonthItems;
    setLocalMonthItems((current) => moveItemToDate(current, item.id, targetDate));
    setMonthlyNotice({ tone: "info", message: `Переносим "${resolveTemplate(item.template)?.name ?? "работу"}" на ${formatDate(targetDate)}...` });

    startSubmitting(async () => {
      try {
        const formData = new FormData();
        formData.set("item_id", item.id);
        formData.set("planned_for", targetDate);
        if (reason) {
          formData.set("reason", reason);
        }
        await reschedulePprMonthPlanItemAction(formData);
        setMonthlyNotice({ tone: "success", message: `Работа перенесена на ${formatDate(targetDate)}.` });
        router.refresh();
      } catch (error) {
        setLocalMonthItems(snapshot);
        setMonthlyNotice({
          tone: "danger",
          message: error instanceof Error ? error.message : "Не удалось перенести работу. Проверьте правила переноса и повторите.",
        });
      }
    });
  };

  const handleMoveRequest = (item: MonthPlanItemRow, targetDate: string) => {
    if (item.planned_for === targetDate || isSubmitting) {
      return;
    }
    if (item.task_id) {
      setPendingMaterializedMove({ itemId: item.id, targetDate });
      setMaterializedReason("");
      setMonthlyNotice({
        tone: "warning",
        message: `Выбрана новая дата ${formatDate(targetDate)}. Для уже созданной ППР-заявки нужно подтвердить перенос и указать причину.`,
      });
      return;
    }
    submitReschedule(item, targetDate);
  };

  const handleMaterializedConfirm = () => {
    if (!pendingMaterializedItem || !pendingMaterializedMove) return;
    submitReschedule(pendingMaterializedItem, pendingMaterializedMove.targetDate, materializedReason);
    setPendingMaterializedMove(null);
    setMaterializedReason("");
  };

  const handleCloseEditing = () => {
    setEditingItemId(null);
    setIsDirty(false);
  };

  const handleCloseMaterialized = () => {
    setPendingMaterializedMove(null);
    setMaterializedReason("");
  };

  const activeFiltersCount = [selectedObjectId, selectedGroupId, selectedSystemId].filter(Boolean).length;

  return (
    <>
      <div
        className="section-card"
        style={{
          padding: "0.75rem 1rem",
          position: "sticky",
          top: "1rem",
          zIndex: 20,
          borderBottom: "1px solid color-mix(in srgb, var(--line) 55%, transparent)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          background: "color-mix(in srgb, var(--panel) 95%, transparent)",
          backdropFilter: "blur(10px)",
          marginBottom: "1rem",
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <span className="text-soft" style={{ fontSize: "0.88rem" }}>Календарь ППР</span>
            <span className="text-soft">/</span>
            <strong style={{ fontSize: "0.92rem" }}>
              {activeTab === "year" ? (yearScreen === "groups" ? "Годовой план — Группы" : "Годовой план — Системы") : "Месячный план"}
            </strong>
          </div>

          <div className="row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
            <div className="row" style={{ gap: "0.25rem", background: "var(--panel-soft)", padding: "0.2rem", borderRadius: "10px" }}>
              <button type="button" className={`btn ${activeTab === "year" ? "btn-secondary" : "btn-ghost"}`} onClick={() => handleTabChange("year")}>
                Годовой план
              </button>
              <button type="button" className={`btn ${activeTab === "month" ? "btn-secondary" : "btn-ghost"}`} onClick={() => handleTabChange("month")}>
                Месячный план
              </button>
            </div>

            <button
              type="button"
              className="btn btn-ghost tl-btn-filters"
              onClick={() => setIsFiltersOpen(true)}
              style={{ position: "relative" }}
            >
              Фильтры
              {activeFiltersCount > 0 && <span className="tl-filters-dot" style={{ position: "absolute", top: "4px", right: "4px" }} />}
            </button>
          </div>
        </div>

        {/* Активные фильтры как кликабельные chip'ы — открывают drawer для редактирования */}
        <div
          className="row"
          style={{
            gap: "0.4rem",
            flexWrap: "wrap",
            alignItems: "center",
            marginTop: "0.6rem",
            paddingTop: "0.6rem",
            borderTop: "1px solid color-mix(in srgb, var(--line) 35%, transparent)",
          }}
          aria-label="Активные фильтры календаря"
        >
          <span className="text-soft" style={{ fontSize: "0.78rem", marginRight: "0.2rem" }}>
            Фильтр:
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsFiltersOpen(true)}
            style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem", lineHeight: 1.2 }}
            title="Изменить год"
          >
            {currentYear} <span style={{ opacity: 0.7, marginLeft: "0.2rem" }}>▾</span>
          </button>
          <button
            type="button"
            className={`btn ${selectedObjectId ? "btn-secondary" : "btn-ghost"}`}
            onClick={() => setIsFiltersOpen(true)}
            style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem", lineHeight: 1.2 }}
            title={selectedObjectId ? "Изменить объект" : "Выбрать объект"}
          >
            {selectedObject?.name ?? "Все объекты"}
            <span style={{ opacity: 0.7, marginLeft: "0.2rem" }}>▾</span>
          </button>
          <button
            type="button"
            className={`btn ${selectedGroupId ? "btn-secondary" : "btn-ghost"}`}
            onClick={() => setIsFiltersOpen(true)}
            style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem", lineHeight: 1.2 }}
            title={selectedGroupId ? "Изменить группу систем" : "Выбрать группу систем"}
          >
            {selectedGroup?.name ?? "Все группы"}
            <span style={{ opacity: 0.7, marginLeft: "0.2rem" }}>▾</span>
          </button>
          <button
            type="button"
            className={`btn ${selectedSystemId ? "btn-secondary" : "btn-ghost"}`}
            onClick={() => setIsFiltersOpen(true)}
            style={{ fontSize: "0.8rem", padding: "0.25rem 0.6rem", lineHeight: 1.2 }}
            title={selectedSystemId ? "Изменить систему" : "Выбрать систему"}
          >
            {selectedSystem?.name ?? "Все системы"}
            <span style={{ opacity: 0.7, marginLeft: "0.2rem" }}>▾</span>
          </button>
        </div>
      </div>

      {isFiltersOpen ? (
        <PprFiltersDrawer
          objects={objects}
          systemGroups={systemGroups}
          systems={filteredSystems}
          initial={{
            year: currentYear,
            month: currentMonthInput,
            objectId: selectedObjectId,
            groupId: selectedGroupId,
            systemId: selectedSystemId,
            tab: activeTab,
          }}
          onClose={() => setIsFiltersOpen(false)}
        />
      ) : null}

      {activeTab === "year" ? (
        <PprCalendarYearView
          filters={filters}
          currentYear={currentYear}
          yearGroupOverview={yearGroupOverview}
          yearSystemOverview={yearSystemOverview}
          yearSummary={yearSummary}
          yearScreen={yearScreen}
          selectedGroup={selectedGroup}
          backToGroupsHref={backToGroupsHref}
          globalMaxHours={globalMaxHours}
        />
      ) : (
        hasMounted ? (
          <PprCalendarMonthSection
            monthPlans={monthPlans}
            currentMonthInput={currentMonthInput}
            filteredSystems={filteredSystems}
            selectedSystemId={selectedSystemId}
            monthTotals={monthTotals}
            selectedObject={selectedObject}
            selectedGroup={selectedGroup}
            selectedSystem={selectedSystem}
            monthlyNotice={monthlyNotice}
            monthView={monthView}
            onMonthViewChange={setMonthView}
            localMonthItems={localMonthItems}
            onOpenItem={setEditingItemId}
            onRequestMove={handleMoveRequest}
            isSubmitting={isSubmitting}
            previousMonthHref={previousMonthHref}
            nextMonthHref={nextMonthHref}
          />
        ) : (
          <div className="section-card text-soft">Загрузка месячного плана...</div>
        )
      )}

      {editingItem || (pendingMaterializedItem && pendingMaterializedMove) ? (
        <PprCalendarItemDrawers
          editingItem={editingItem}
          currentMonthInput={currentMonthInput}
          isDirty={isDirty}
          onDirtyChange={setIsDirty}
          onCloseEditing={handleCloseEditing}
          pendingMaterializedItem={pendingMaterializedItem}
          pendingMaterializedMove={pendingMaterializedMove}
          materializedReason={materializedReason}
          onMaterializedReasonChange={setMaterializedReason}
          onCloseMaterialized={handleCloseMaterialized}
          onConfirmMaterialized={handleMaterializedConfirm}
          isSubmitting={isSubmitting}
        />
      ) : null}
    </>
  );
}
