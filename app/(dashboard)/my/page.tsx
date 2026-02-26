import { canEditTasks, requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listTasksForProfile, type TaskFiltersInput } from "@/lib/tasks";
import { listObjectsForProfile } from "@/lib/objects";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskList } from "@/components/tasks/task-list";
import { PageHeader } from "@/components/ui/page-header";

type Search = Record<string, string | string[] | undefined>;

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const { profile } = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const filters: TaskFiltersInput = {
    q: typeof params.q === "string" ? params.q : undefined,
    status: typeof params.status === "string" ? (params.status as TaskFiltersInput["status"]) : "all",
    priority: typeof params.priority === "string" ? (params.priority as TaskFiltersInput["priority"]) : "all",
    object: typeof params.object === "string" ? params.object : "all",
    assignee: typeof params.assignee === "string" ? params.assignee : "all",
    teamMember: typeof params.team_member === "string" ? params.team_member : "all",
    due:
      typeof params.due === "string" && ["all", "overdue", "today", "week"].includes(params.due)
        ? (params.due as TaskFiltersInput["due"])
        : "all",
    sort:
      typeof params.sort === "string" &&
      ["due_asc", "due_desc", "priority", "status", "created_desc"].includes(params.sort)
        ? (params.sort as TaskFiltersInput["sort"])
        : "due_asc"
  };

  const [objects, tasks, assignees] = await Promise.all([
    listObjectsForProfile(supabase, profile),
    listTasksForProfile(supabase, profile, "my", filters),
    supabase
      .from("profiles")
      .select("id,full_name,role")
      .in("role", ["lead", "engineer", "object_engineer", "tech"])
      .order("full_name")
  ]);

  return (
    <section className="grid">
      <PageHeader
        title="Мои задачи"
        description="Рабочий список задач с быстрым поиском, фильтрами и переходом в карточку."
      />
      <TaskFilters
        objects={objects}
        assignees={(assignees.data ?? []).map((item) => ({ id: item.id, full_name: item.full_name }))}
        initial={filters}
        showCreateButton={canEditTasks(profile.role)}
        createHref="/tasks/create"
        listHref="/my"
      />
      <TaskList tasks={tasks} currentUser={{ id: profile.id, role: profile.role }} />
    </section>
  );
}
