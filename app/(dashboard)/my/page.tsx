import { canEditTasks, requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listTasksForProfile, type TaskFiltersInput } from "@/lib/tasks";
import { listObjectsForProfile } from "@/lib/objects";
import { TaskFilters } from "@/components/tasks/task-filters";
import { TaskList } from "@/components/tasks/task-list";
import { PageHeader } from "@/components/ui/page-header";
import type { SortMode } from "@/lib/task-sort";

type Search = Record<string, string | string[] | undefined>;

const VALID_SORT_MODES: SortMode[] = ["smart", "due_asc", "due_desc", "created_desc"];
type GroupBy = "none" | "object" | "status";
const VALID_GROUP_BY: GroupBy[] = ["none", "object", "status"];

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

  const rawClientSort = typeof params.client_sort === "string" ? params.client_sort : "smart";
  const clientSort: SortMode = (VALID_SORT_MODES as string[]).includes(rawClientSort)
    ? (rawClientSort as SortMode)
    : "smart";

  const rawGroupBy = typeof params.group_by === "string" ? params.group_by : "none";
  const groupBy: GroupBy = (VALID_GROUP_BY as string[]).includes(rawGroupBy)
    ? (rawGroupBy as GroupBy)
    : "none";

  const [objects, tasks, allTasks, assignees] = await Promise.all([
    listObjectsForProfile(supabase, profile),
    listTasksForProfile(supabase, profile, "my", filters),
    // KPI всегда по полному списку без фильтров
    listTasksForProfile(supabase, profile, "my"),
    supabase
      .from("profiles")
      .select("id,full_name,role")
      .in("role", ["lead", "engineer", "object_engineer", "tech"])
      .order("full_name")
  ]);

  return (
    <section className="tl-page">
      <PageHeader
        title="Мои задачи"
        description="Рабочий список задач с быстрым поиском, фильтрами и переходом в карточку."
      />
      <TaskFilters
        objects={objects}
        assignees={(assignees.data ?? []).map((item) => ({ id: item.id, full_name: item.full_name }))}
        initial={{ ...filters, clientSort, groupBy }}
        showCreateButton={canEditTasks(profile.role)}
        createHref="/tasks/create"
        listHref="/my"
        tasks={tasks}
        allTasks={allTasks}
      />
      <TaskList
        tasks={tasks}
        currentUser={{ id: profile.id, role: profile.role }}
        clientSort={clientSort}
        groupBy={groupBy}
      />
    </section>
  );
}
