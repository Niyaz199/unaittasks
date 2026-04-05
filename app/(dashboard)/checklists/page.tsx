import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import {
  canAccessDailyChecklists,
  canManageDailyChecklistTemplates,
  canReadDailyChecklistControl,
  isDailyChecklistTemplateRole,
} from "@/lib/daily-checklists/access";
import { getOrCreateDailyChecklistDayForProfile } from "@/lib/daily-checklists/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listObjectsForProfile } from "@/lib/objects";
import { listAssignableTaskCandidatesForProfile } from "@/lib/tasks";
import { ChecklistDayView } from "@/components/checklists/checklist-day-view";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export default async function DailyChecklistsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = searchParams ? await searchParams : {};
  const { profile } = await requireProfile();
  if (!canAccessDailyChecklists(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Чек-листы" description="Доступ к ежедневным чек-листам ограничен." />
        <div className="section-card">У вас нет доступа к этому разделу.</div>
      </section>
    );
  }

  if (!isDailyChecklistTemplateRole(profile.role)) {
    return (
      <section className="grid" style={{ gap: "1rem" }}>
        <PageHeader
          title="Чек-листы"
          description="Для вашей роли личный чек-лист не формируется. Используйте контроль выполнения или управление шаблонами."
        />
        <div className="row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
          {canReadDailyChecklistControl(profile.role) ? (
            <Link className="btn btn-accent" href="/checklists/control">
              Контроль выполнения
            </Link>
          ) : null}
          {canManageDailyChecklistTemplates(profile.role) ? (
            <Link className="btn btn-ghost" href="/checklists/templates">
              Управление шаблонами
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const requestedDate = typeof search.date === "string" ? search.date : undefined;
  const [dayData, objects, assignees] = await Promise.all([
    getOrCreateDailyChecklistDayForProfile(supabase, profile, requestedDate),
    listObjectsForProfile(supabase, profile),
    listAssignableTaskCandidatesForProfile(supabase, profile),
  ]);

  return (
    <section className="grid" style={{ gap: "1rem" }}>
      <PageHeader
        title="Мой чек-лист"
        description="Ваш персональный ежедневный чек-лист. Из проблемного пункта можно сразу поставить обычную задачу."
      />
      {dayData.run ? (
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
        />
      ) : (
        <EmptyState
          message="Ваш персональный шаблон чек-листа не найден."
          hint="Руководитель или администратор должен опубликовать шаблон именно для вас."
        />
      )}
    </section>
  );
}
