import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
import { PprCalendarAdmin } from "@/components/ppr/calendar/ppr-calendar-admin";

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
  const requestedGroupId = typeof search.group === "string" && search.group ? search.group : undefined;
  const requestedSystemId = typeof search.system === "string" && search.system ? search.system : undefined;

  const { profile } = await requireProfile();
  if (!canAccessPprCalendarScreens(profile.role)) {
    return <div className="empty-state">Доступ к календарю ППР запрещён.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const systems = await listPprCalendarSystemsForProfile(supabase, profile);
  const systemGroups = [...new Map(
    systems
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
  const systemById = new Map(systems.map((system) => [system.id, system] as const));
  const inferredGroupId = requestedSystemId ? systemById.get(requestedSystemId)?.system_group_id : undefined;
  const selectedGroupId =
    requestedGroupId && systemGroups.some((group) => group.id === requestedGroupId) ? requestedGroupId : inferredGroupId;
  const selectedSystemId =
    requestedSystemId &&
    systems.some((item) => item.id === requestedSystemId && (!selectedGroupId || item.system_group_id === selectedGroupId))
      ? requestedSystemId
      : undefined;
  const normalizedPlanMonth = normalizePlanMonth(requestedMonth);
  const selectedGroupSystemIds = selectedGroupId
    ? systems.filter((system) => system.system_group_id === selectedGroupId).map((system) => system.id)
    : [];

  const [yearGroupOverview, yearSystemOverview, monthPlansRaw, monthPlanItemsRaw] = await Promise.all([
    listPprCalendarYearOverviewByGroupForProfile(supabase, profile, { year: requestedYear }),
    selectedGroupId
      ? listPprCalendarYearOverviewBySystemForProfile(supabase, profile, { year: requestedYear, systemGroupId: selectedGroupId })
      : Promise.resolve([]),
    listPprMonthPlansForProfile(supabase, profile, { planMonth: normalizedPlanMonth, systemId: selectedSystemId }),
    listPprMonthPlanItemsForProfile(supabase, profile, { planMonth: normalizedPlanMonth, systemId: selectedSystemId }),
  ]);
  const monthPlans =
    selectedSystemId || !selectedGroupId
      ? monthPlansRaw
      : monthPlansRaw.filter((plan) => selectedGroupSystemIds.includes(plan.system_id));
  const monthPlanItems =
    selectedSystemId || !selectedGroupId
      ? monthPlanItemsRaw
      : monthPlanItemsRaw.filter((item) => selectedGroupSystemIds.includes(item.system_id));

  return (
    <section className="grid">
      <PageHeader
        title="Календарь ППР"
        description="Годовой обзор нагрузки по группам и системам с drill-down до месячного календаря по дням."
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />

      <PprCalendarAdmin
        systemGroups={systemGroups}
        systems={systems}
        yearGroupOverview={yearGroupOverview}
        yearSystemOverview={yearSystemOverview}
        monthPlans={monthPlans}
        monthPlanItems={monthPlanItems}
        currentYear={requestedYear}
        currentMonthInput={requestedMonth}
        selectedGroupId={selectedGroupId}
        selectedSystemId={selectedSystemId}
      />
    </section>
  );
}
