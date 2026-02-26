import type { SupabaseClient } from "@supabase/supabase-js";
import { canReadTaskByRole } from "@/lib/task-permissions";
import type { Profile, TaskHistoryEvent, TaskItem, TaskPriority, TaskStatus } from "@/lib/types";

type TaskListKind = "my" | "new" | "archive";

export type TaskFiltersInput = {
  q?: string;
  status?: TaskStatus | "all";
  priority?: TaskPriority | "all";
  object?: string | "all";
  assignee?: string | "all";
  teamMember?: string | "all";
  due?: "all" | "overdue" | "today" | "week";
  sort?: "due_asc" | "due_desc" | "priority" | "status" | "created_desc";
};

export async function listTasksForProfile(
  supabase: SupabaseClient,
  profile: Profile,
  kind: TaskListKind,
  filters?: TaskFiltersInput
) {
  let query = supabase
    .from("tasks")
    .select(
      "id,title,description,object_id,status,priority,due_at,resume_at,created_at,created_by,assigned_to,accepted_at,completed_at,archived_at,objects(name,object_engineer_id),assignee:profiles!tasks_assigned_to_fkey(full_name),team_members:task_team_members(task_id,user_id,added_by,created_at,member:profiles!task_team_members_user_id_fkey(full_name))"
    );

  if (kind === "new") {
    query = query.eq("status", "new");
    if (profile.role !== "admin") {
      const { data: myTeamRows, error: myTeamError } = await supabase
        .from("task_team_members")
        .select("task_id")
        .eq("user_id", profile.id);
      if (myTeamError) throw myTeamError;

      const myTeamTaskIds = (myTeamRows ?? []).map((row) => row.task_id);
      if (myTeamTaskIds.length) {
        query = query.or(`assigned_to.eq.${profile.id},id.in.(${myTeamTaskIds.join(",")})`);
      } else {
        query = query.eq("assigned_to", profile.id);
      }
    }
  } else if (kind === "archive") {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.priority && filters.priority !== "all") {
    query = query.eq("priority", filters.priority);
  }
  if (filters?.object && filters.object !== "all") {
    query = query.eq("object_id", filters.object);
  }
  if (filters?.assignee && filters.assignee !== "all") {
    query = query.eq("assigned_to", filters.assignee);
  }
  if (filters?.teamMember && filters.teamMember !== "all") {
    const { data: tmRows, error: tmError } = await supabase
      .from("task_team_members")
      .select("task_id")
      .eq("user_id", filters.teamMember);
    if (tmError) throw tmError;

    const teamTaskIds = (tmRows ?? []).map((row) => row.task_id);
    if (!teamTaskIds.length) {
      return [];
    }
    query = query.in("id", teamTaskIds);
  }
  if (filters?.q) {
    query = query.ilike("title", `%${filters.q.trim()}%`);
  }
  if (filters?.due && filters.due !== "all") {
    const now = new Date();
    if (filters.due === "overdue") {
      query = query.lt("due_at", now.toISOString());
    } else if (filters.due === "today") {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      query = query.gte("due_at", start.toISOString()).lt("due_at", end.toISOString());
    } else if (filters.due === "week") {
      const end = new Date(now);
      end.setDate(now.getDate() + 7);
      query = query.gte("due_at", now.toISOString()).lt("due_at", end.toISOString());
    }
  }

  const sort = filters?.sort ?? "due_asc";
  if (sort === "due_desc") {
    query = query.order("due_at", { ascending: false, nullsFirst: false });
  } else if (sort === "priority") {
    query = query.order("priority", { ascending: false }).order("created_at", { ascending: false });
  } else if (sort === "status") {
    query = query.order("status", { ascending: true }).order("due_at", { ascending: true, nullsFirst: false });
  } else if (sort === "created_desc") {
    query = query.order("created_at", { ascending: false });
  } else {
    query = query.order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as TaskItem[];
}

export async function getTaskByIdForProfile(
  supabase: SupabaseClient,
  _profile: Profile,
  taskId: string
) {
  const query = supabase
    .from("tasks")
    .select(
      "id,title,description,object_id,status,priority,due_at,resume_at,created_at,created_by,assigned_to,accepted_at,completed_at,archived_at,objects(name,object_engineer_id),assignee:profiles!tasks_assigned_to_fkey(full_name),team_members:task_team_members(task_id,user_id,added_by,created_at,member:profiles!task_team_members_user_id_fkey(full_name))"
    )
    .eq("id", taskId)
    .single();

  const { data, error } = await query;
  if (error) throw error;
  return data as unknown as TaskItem;
}

export async function getTaskHistoryForProfile(
  supabase: SupabaseClient,
  profile: Profile,
  taskId: string
) {
  const allowedHistoryRoles = new Set(["admin", "chief", "lead", "engineer"]);
  if (!allowedHistoryRoles.has(profile.role)) {
    throw new Error("Нет доступа к истории задачи");
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id,assigned_to,created_by,object_id,team_members:task_team_members(user_id),objects(object_engineer_id)")
    .eq("id", taskId)
    .single();
  if (taskError || !task) throw new Error("Задача не найдена");

  const teamMemberIds = (task.team_members ?? []).map((member) => member.user_id);
  const objectsRelation = task.objects as
    | { object_engineer_id: string | null }
    | Array<{ object_engineer_id: string | null }>
    | null;
  const objectEngineerId = Array.isArray(objectsRelation)
    ? objectsRelation[0]?.object_engineer_id ?? null
    : objectsRelation?.object_engineer_id ?? null;

  const canRead = canReadTaskByRole(profile.role, profile.id, task, teamMemberIds, objectEngineerId);
  if (!canRead) {
    throw new Error("Нет доступа к истории задачи");
  }

  const { data: rows, error } = await supabase
    .from("audit_log")
    .select("id,actor_id,action,entity_type,entity_id,meta,created_at")
    .eq("entity_type", "task")
    .eq("entity_id", taskId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const actorIds = [...new Set((rows ?? []).map((row) => row.actor_id).filter(Boolean))];
  const referencedUserIds = [...new Set((rows ?? []).flatMap((row) => {
    const meta = (row.meta ?? {}) as Record<string, unknown>;
    const userIds: string[] = [];
    if (typeof meta.user_id === "string") userIds.push(meta.user_id);
    if (typeof meta.assigned_to === "string") userIds.push(meta.assigned_to);
    return userIds;
  }))];
  const profileIds = [...new Set([...actorIds, ...referencedUserIds])];
  const { data: actors } = profileIds.length
    ? await supabase.from("profiles").select("id,full_name").in("id", profileIds)
    : { data: [] as Array<{ id: string; full_name: string }> };

  const actorMap = new Map((actors ?? []).map((actor) => [actor.id, actor.full_name]));
  return (rows ?? []).map((row) => {
    const meta = { ...(((row.meta ?? {}) as Record<string, unknown>) ?? {}) };
    if (typeof meta.user_id === "string") {
      meta.user_name = actorMap.get(meta.user_id) ?? meta.user_id;
    }
    if (typeof meta.assigned_to === "string") {
      meta.assigned_to_name = actorMap.get(meta.assigned_to) ?? meta.assigned_to;
    }

    return {
      id: row.id,
      actor_id: row.actor_id,
      actor_name: row.actor_id ? actorMap.get(row.actor_id) ?? "Пользователь" : "Система",
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      meta,
      created_at: row.created_at
    };
  }) as TaskHistoryEvent[];
}
