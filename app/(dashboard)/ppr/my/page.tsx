import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canAccessPprTaskScreens, listPprTasksForProfile } from "@/lib/ppr/queries";
import { PageHeader } from "@/components/ui/page-header";
import { PprTasksAdmin } from "@/components/ppr/tasks/ppr-tasks-admin";

export default async function PprMyTasksPage() {
  const { profile } = await requireProfile();

  if (!canAccessPprTaskScreens(profile.role)) {
    return (
      <section className="grid">
        <PageHeader title="Мои ППР" description="Доступ к ППР-заявкам ограничен." />
        <div className="section-card">У вас нет доступа к списку ППР-заявок.</div>
      </section>
    );
  }

  const supabase = await createSupabaseServerClient();
  const tasks = await listPprTasksForProfile(supabase, profile, { kind: "my" });

  return (
    <section className="grid">
      <PageHeader
        title="Мои ППР"
        description="Список активных ППР-заявок, где вы указаны исполнителем."
      />
      <PprTasksAdmin
        tasks={tasks}
        emptyMessage="Активных ППР-заявок у вас нет"
        emptyHint="После назначения исполнителем заявки появятся в этом разделе."
      />
    </section>
  );
}
