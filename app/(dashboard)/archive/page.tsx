import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listTasksForProfile } from "@/lib/tasks";
import { TaskList } from "@/components/tasks/task-list";
import { PageHeader } from "@/components/ui/page-header";

export default async function ArchivePage() {
  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const tasks = await listTasksForProfile(supabase, profile, "archive");

  return (
    <section className="grid">
      <PageHeader
        title="Архив"
        description="Автоархив задач выполняется фоном через SQL-функцию или cron после 36 часов."
      />
      <TaskList tasks={tasks} currentUser={{ id: profile.id, role: profile.role }} />
    </section>
  );
}
