import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listTasksForProfile } from "@/lib/tasks";
import { TaskList } from "@/components/tasks/task-list";
import { PageHeader } from "@/components/ui/page-header";

export default async function NewTasksPage() {
  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const tasks = await listTasksForProfile(supabase, profile, "new");

  return (
    <section className="grid">
      <PageHeader
        title="Новые задачи"
        description="Новые задачи, где вы назначены ответственным или входите в команду. Для admin доступен полный список."
      />
      <TaskList tasks={tasks} showTakeButton currentUser={{ id: profile.id, role: profile.role }} />
    </section>
  );
}
