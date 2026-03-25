import { requireProfile } from "@/lib/auth";
import {
  canAccessPprCalendarScreens,
  listPprCalendarSystemsForProfile,
  listPprCalendarYearOverviewByGroupForProfile,
  listPprCalendarYearOverviewBySystemForProfile,
  listPprMonthPlanItemsForProfile,
  listPprMonthPlansForProfile,
} from "@/lib/ppr/queries";
import { normalizePlanMonth } from "@/lib/ppr/scheduler";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprCalendarAdmin } from "@/components/ppr/calendar/ppr-calendar-monthly-dnd";

function currentYearValue() {
  return new Date().getUTCFullYear();
}

function currentMonthInput(year: number) {
  const now = new Date();
  const month = year === now.getUTCFullYear() ? now.getUTCMonth() + 1 : 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function unwrapRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function PprCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const requestedYear =
    typeof search.year === "string" && /^\d{4}$/.test(search.year) ? Number(search.year) : currentYearValue();
  const requestedMonth =
    typeof search.month === "string" && /^\d{4}-\d{2}$/.test(search.month) ? search.month : currentMonthInput(requestedYear);
  const requestedObjectId = typeof search.object === "string" && search.object ? search.object : undefined;
  const requestedGroupId = typeof search.group === "string" && search.group ? search.group : undefined;
  const requestedSystemId = typeof search.system === "string" && search.system ? search.system : undefined;
  const requestedTab = search.tab === "month" ? "month" : "year";

  const { profile, supabase } = await requireProfile();
  if (!canAccessPprCalendarScreens(profile.role)) {
    return <div className="empty-state">Доступ к календарю ППР запрещён.</div>;
  }
  const systems = await listPprCalendarSystemsForProfile(supabase, profile);
  const objects = [...new Map(
    systems
      .map((system) => {
        const object = unwrapRelation(system.object);
        if (!object) return null;
        return [system.object_id, { id: system.object_id, name: object.name }] as const;
      })
      .filter((item): item is readonly [string, { id: string; name: string }] => item !== null)
  ).values()].sort((left, right) => left.name.localeCompare(right.name, "ru"));
  const selectedObjectId =
    requestedObjectId && objects.some((object) => object.id === requestedObjectId) ? requestedObjectId : undefined;
  const systemsForObject = selectedObjectId ? systems.filter((system) => system.object_id === selectedObjectId) : systems;
  const systemGroups = [...new Map(
    systemsForObject
      .map((system) => {
        const group = unwrapRelation(system.system_group);
        if (!group) return null;
        return [
          system.system_group_id,
          {
            id: system.system_group_id,
            name: group.name,
            code: group.code,
          },
        ] as const;
      })
      .filter((item): item is readonly [string, { id: string; name: string; code: string }] => item !== null)
  ).values()].sort((left, right) => left.name.localeCompare(right.name, "ru"));
  const systemById = new Map(systemsForObject.map((system) => [system.id, system] as const));
  const inferredGroupId = requestedSystemId ? systemById.get(requestedSystemId)?.system_group_id : undefined;
  const selectedGroupId =
    requestedGroupId && systemGroups.some((group) => group.id === requestedGroupId) ? requestedGroupId : inferredGroupId;
  const selectedSystemId =
    requestedSystemId &&
    systemsForObject.some((item) => item.id === requestedSystemId && (!selectedGroupId || item.system_group_id === selectedGroupId))
      ? requestedSystemId
      : undefined;
  const normalizedPlanMonth = normalizePlanMonth(requestedMonth);

  const [yearGroupOverview, yearSystemOverview, monthPlans, monthPlanItems] = await Promise.all([
    listPprCalendarYearOverviewByGroupForProfile(supabase, profile, { year: requestedYear, objectId: selectedObjectId }),
    selectedGroupId
      ? listPprCalendarYearOverviewBySystemForProfile(supabase, profile, {
          year: requestedYear,
          systemGroupId: selectedGroupId,
          objectId: selectedObjectId,
        })
      : Promise.resolve([]),
    listPprMonthPlansForProfile(supabase, profile, {
      planMonth: normalizedPlanMonth,
      systemId: selectedSystemId,
      objectId: selectedObjectId,
      systemGroupId: selectedGroupId,
    }),
    listPprMonthPlanItemsForProfile(supabase, profile, {
      planMonth: normalizedPlanMonth,
      systemId: selectedSystemId,
      objectId: selectedObjectId,
      systemGroupId: selectedGroupId,
    }),
  ]);

  return (
    <section className="grid">
      <PageHeader
        title="Календарь ППР"
        description="Годовой обзор нагрузки по группам и системам с drill-down до месячного operational-календаря по оборудованию и дням."
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />

      <PprCalendarAdmin
        objects={objects}
        systemGroups={systemGroups}
        systems={systemsForObject}
        yearGroupOverview={yearGroupOverview}
        yearSystemOverview={yearSystemOverview}
        monthPlans={monthPlans}
        monthPlanItems={monthPlanItems}
        currentYear={requestedYear}
        currentMonthInput={requestedMonth}
        selectedObjectId={selectedObjectId}
        selectedGroupId={selectedGroupId}
        selectedSystemId={selectedSystemId}
        initialTab={requestedTab}
      />
    </section>
  );
}
