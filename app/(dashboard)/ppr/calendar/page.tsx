import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  canAccessPprCalendarScreens,
  listPprCalendarSystemsForProfile,
  listPprMonthPlanItemsForProfile,
  listPprMonthPlansForProfile,
} from "@/lib/ppr/queries";
import { normalizePlanMonth } from "@/lib/ppr/scheduler";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprCalendarAdmin } from "@/components/ppr/calendar/ppr-calendar-admin";

function currentMonthInput() {
  return new Date().toISOString().slice(0, 7);
}

export default async function PprCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const requestedMonth = typeof search.month === "string" && /^\d{4}-\d{2}$/.test(search.month) ? search.month : currentMonthInput();
  const requestedSystemId = typeof search.system === "string" && search.system ? search.system : undefined;

  const { profile } = await requireProfile();
  if (!canAccessPprCalendarScreens(profile.role)) {
    return <div className="empty-state">Доступ к календарю ППР запрещён.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const systems = await listPprCalendarSystemsForProfile(supabase, profile);
  const selectedSystemId = requestedSystemId && systems.some((item) => item.id === requestedSystemId) ? requestedSystemId : undefined;
  const normalizedPlanMonth = normalizePlanMonth(requestedMonth);

  const [monthPlans, monthPlanItems] = await Promise.all([
    listPprMonthPlansForProfile(supabase, profile, { planMonth: normalizedPlanMonth, systemId: selectedSystemId }),
    listPprMonthPlanItemsForProfile(supabase, profile, { planMonth: normalizedPlanMonth, systemId: selectedSystemId }),
  ]);

  return (
    <section className="grid">
      <PageHeader
        title="Календарь ППР"
        description="Месячный план по активным назначениям с ручным распределением работ по дням без materialization в заявки."
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />

      <PprCalendarAdmin
        systems={systems}
        monthPlans={monthPlans}
        monthPlanItems={monthPlanItems}
        currentMonthInput={requestedMonth}
        selectedSystemId={selectedSystemId}
      />
    </section>
  );
}
