import { requireProfile } from "@/lib/auth";
import { canReadDailyChecklistControl } from "@/lib/daily-checklists/access";
import { getDailyChecklistRunByIdForProfile } from "@/lib/daily-checklists/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listObjectsForProfile } from "@/lib/objects";
import { listAssignableTaskCandidatesForProfile } from "@/lib/tasks";
import { ChecklistDayView } from "@/components/checklists/checklist-day-view";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";

export default async function DailyChecklistRunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { profile } = await requireProfile();

  if (!canReadDailyChecklistControl(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Просмотр чек-листа" description="Доступ ограничен." />
        <div className="section-card">У вас нет доступа к просмотру чек-листов других сотрудников.</div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [dayData, objects, assignees] = await Promise.all([
    getDailyChecklistRunByIdForProfile(supabase, profile, id),
    listObjectsForProfile(supabase, profile),
    listAssignableTaskCandidatesForProfile(supabase, profile),
  ]);

  if (!dayData?.run) {
    return (
      <section className="grid" style={{ gap: "1rem" }}>
        <PageHeader
          title="Просмотр чек-листа"
          description="Чек-лист не найден или у вас нет доступа."
          actions={<BackButton fallback="/checklists/control" label="← К контролю" />}
        />
        <EmptyState message="Чек-лист не найден." hint="Возможно, он был удалён." />
      </section>
    );
  }

  return (
    <section className="grid" style={{ gap: "1rem" }}>
      <PageHeader
        title="Просмотр чек-листа"
        description="Детальный просмотр выполнения чек-листа сотрудником."
        actions={<BackButton fallback="/checklists/control" label="← К контролю" />}
      />
      <ChecklistDayView
        dayData={dayData}
        objects={objects}
        assignees={assignees.map((item) => ({
          id: item.id,
          full_name: item.full_name,
          role: item.role,
          object_ids: item.object_ids,
          is_global_scope: item.is_global_scope,
          email: null,
        }))}
        readOnly={true}
      />
    </section>
  );
}
