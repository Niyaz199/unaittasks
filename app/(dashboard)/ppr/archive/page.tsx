import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canAccessPprTaskScreens, listPprTasksForProfile } from "@/lib/ppr/queries";
import { PageHeader } from "@/components/ui/page-header";
import { BackButton } from "@/components/ui/back-button";
import { PprTasksAdmin } from "@/components/ppr/tasks/ppr-tasks-admin";

export default async function PprArchivePage() {
  const { profile } = await requireProfile();

  if (!canAccessPprTaskScreens(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Архив ППР" description="Доступ к архиву ППР ограничен." />
        <div className="section-card">У вас нет доступа к архиву ППР-заявок.</div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const tasks = await listPprTasksForProfile(supabase, profile, { kind: "archive" });

  return (
    <section className="grid">
      <PageHeader
        title="Архив ППР"
        description="Здесь доступны завершенные архивные ППР-заявки со статусами `closed` и `cancelled`."
        actions={<BackButton fallback="/ppr" label="← Назад к ППР" />}
      />
      <PprTasksAdmin
        tasks={tasks}
        emptyMessage="Архив ППР пока пуст"
        emptyHint="После закрытия или отмены заявки она перейдет в этот раздел."
      />
    </section>
  );
}
