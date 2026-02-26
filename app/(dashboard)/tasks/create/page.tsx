import { canEditTasks, requireProfile } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listObjectsForProfile } from "@/lib/objects";
import { CreateTaskForm } from "@/components/tasks/create-task-form";
import { PageHeader } from "@/components/ui/page-header";

export default async function CreateTaskPage() {
  const { profile } = await requireProfile();
  if (!canEditTasks(profile.role)) {
    return <div className="empty-state">Доступ запрещен.</div>;
  }

  const supabase = await createSupabaseServerClient();
  const [objects, assignees] = await Promise.all([
    listObjectsForProfile(supabase, profile),
    supabase
      .from("profiles")
      .select("id,full_name,role")
      .in("role", ["lead", "engineer", "object_engineer", "tech"])
      .order("full_name")
  ]);

  const assigneeRows = (assignees.data ?? []).map((item) => ({ id: item.id, full_name: item.full_name, email: null as string | null }));
  try {
    const admin = createSupabaseAdminClient();
    const { data: usersData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const emailById = new Map((usersData?.users ?? []).map((user) => [user.id, user.email ?? null]));
    assigneeRows.forEach((assignee) => {
      assignee.email = emailById.get(assignee.id) ?? null;
    });
  } catch {
    // Fallback: continue without email hints when service role key is unavailable.
  }

  return (
    <section className="grid">
      <PageHeader title="Создать задачу" description="Постановка задачи инженеру с приоритетом и сроком." />
      <CreateTaskForm
        objects={objects}
        assignees={assigneeRows}
        teamCandidates={assigneeRows}
      />
    </section>
  );
}
