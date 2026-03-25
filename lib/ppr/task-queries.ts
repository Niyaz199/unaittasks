import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";
import { canAssignExecutorToPprTask } from "@/lib/ppr/permissions";
import type { PprTaskComment } from "@/lib/ppr/types";
import {
  assertPprQrQueryAccess,
  assertPprTaskQueryAccess,
  listPprManageableObjectsForProfile,
} from "@/lib/ppr/access";

type PprTaskListKind = "my" | "active" | "archive";
type PprTaskListView = "all" | "review";

export type PprTaskSummaryRow = {
  id: string;
  object_id: string;
  system_id: string;
  equipment_id: string;
  responsible_user_id: string;
  assignee_id: string | null;
  planned_for: string;
  completed_at: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  status: "new" | "in_progress" | "done" | "closed" | "cancelled";
  is_overdue: boolean;
  is_rescheduled: boolean;
  general_comment: string | null;
  cancel_reason: string | null;
  created_at: string;
  object: { name: string } | Array<{ name: string }> | null;
  system: { name: string } | Array<{ name: string }> | null;
  equipment: { name: string; inventory_no: string } | Array<{ name: string; inventory_no: string }> | null;
  responsible: { full_name: string } | Array<{ full_name: string }> | null;
  assignee: { full_name: string } | Array<{ full_name: string }> | null;
};

export type PprTaskWorkItemRow = {
  id: string;
  object_id: string;
  task_id: string;
  assignment_id: string;
  template_id: string;
  plan_item_id: string | null;
  title_snapshot: string;
  description_snapshot: string | null;
  methodology_snapshot: string | null;
  checklist_snapshot: Array<{ sort_order: number; title: string; description: string | null }>;
  norm_hours_snapshot: number | null;
  sort_order: number;
};

export type PprTaskAssigneeCandidateRow = {
  id: string;
  full_name: string;
  role: "engineer" | "object_engineer" | "tech";
};

export type PprTaskCommentRow = PprTaskComment & {
  author: { full_name: string } | Array<{ full_name: string }> | null;
};

function buildPprTaskSummaryQuery(supabase: SupabaseClient) {
  return supabase
    .from("ppr_tasks")
    .select(
      "id,object_id,system_id,equipment_id,responsible_user_id,assignee_id,planned_for,completed_at,closed_at,cancelled_at,cancelled_by,status,is_overdue,is_rescheduled,general_comment,cancel_reason,created_at,object:objects(name),system:ppr_systems(name),equipment:ppr_equipment(name,inventory_no),responsible:profiles!ppr_tasks_responsible_user_id_fkey(full_name),assignee:profiles!ppr_tasks_assignee_id_fkey(full_name)"
    )
    .order("planned_for", { ascending: true })
    .order("created_at", { ascending: false });
}

export async function listPprTasksForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  options: { kind?: PprTaskListKind; view?: PprTaskListView } = {}
) {
  assertPprTaskQueryAccess(profile.role);

  const kind = options.kind ?? "active";
  let query = buildPprTaskSummaryQuery(supabase);

  if (kind === "my") {
    query = query.eq("assignee_id", profile.id).neq("status", "closed").neq("status", "cancelled");
  } else if (kind === "archive") {
    query = query.in("status", ["closed", "cancelled"]);
  } else {
    query = query.in("status", ["new", "in_progress", "done"]);
  }

  if (profile.role === "lead" || profile.role === "object_engineer") {
    const objects = await listPprManageableObjectsForProfile(supabase, profile);
    if (!objects.length) return [];
    query = query.in(
      "object_id",
      objects.map((item) => item.id)
    );
  } else if (profile.role === "engineer" && kind !== "my") {
    query = query.or(`responsible_user_id.eq.${profile.id},assignee_id.eq.${profile.id}`);
  } else if (profile.role === "tech" && kind !== "my") {
    query = query.eq("assignee_id", profile.id);
  }

  const { data, error } = await query;
  if (error) throw error;

  const tasks = (data ?? []) as PprTaskSummaryRow[];
  if (kind === "active" && options.view === "review") {
    return tasks.filter((task) => task.status === "done" && task.assignee_id !== task.responsible_user_id);
  }
  return tasks;
}

export async function getPprTaskByIdForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  taskId: string
) {
  assertPprTaskQueryAccess(profile.role);

  const { data, error } = await buildPprTaskSummaryQuery(supabase).eq("id", taskId).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  if (profile.role === "admin" || profile.role === "chief") {
    return data as PprTaskSummaryRow;
  }

  if (profile.role === "lead" || profile.role === "object_engineer") {
    const objects = await listPprManageableObjectsForProfile(supabase, profile);
    if (!objects.some((item) => item.id === data.object_id)) {
      return null;
    }
    return data as PprTaskSummaryRow;
  }

  if (profile.role === "engineer") {
    if (data.responsible_user_id !== profile.id && data.assignee_id !== profile.id) {
      return null;
    }
    return data as PprTaskSummaryRow;
  }

  if (data.assignee_id !== profile.id) {
    return null;
  }
  return data as PprTaskSummaryRow;
}

export async function listPprTaskWorkItemsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  taskId: string
) {
  const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
  if (!task) {
    return [];
  }

  const { data, error } = await supabase
    .from("ppr_task_work_items")
    .select(
      "id,object_id,task_id,assignment_id,template_id,plan_item_id,title_snapshot,description_snapshot,methodology_snapshot,checklist_snapshot,norm_hours_snapshot,sort_order"
    )
    .eq("task_id", taskId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PprTaskWorkItemRow[];
}

export async function listPprTaskCommentsForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  taskId: string
) {
  const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
  if (!task) {
    return [];
  }

  const { data, error } = await supabase
    .from("ppr_task_comments")
    .select("id,object_id,task_id,author_id,body,created_at,author:profiles(full_name)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PprTaskCommentRow[];
}

export async function getPreferredActivePprTaskForEquipmentForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  equipmentId: string
) {
  assertPprQrQueryAccess(profile.role);

  let query = buildPprTaskSummaryQuery(supabase)
    .eq("equipment_id", equipmentId)
    .in("status", ["new", "in_progress", "done"])
    .order("is_overdue", { ascending: false })
    .order("planned_for", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(1);

  if (profile.role === "lead" || profile.role === "object_engineer") {
    const objects = await listPprManageableObjectsForProfile(supabase, profile);
    if (!objects.length) return null;
    query = query.in(
      "object_id",
      objects.map((item) => item.id)
    );
  } else if (profile.role === "engineer") {
    query = query.or(`responsible_user_id.eq.${profile.id},assignee_id.eq.${profile.id}`);
  } else if (profile.role === "tech") {
    query = query.eq("assignee_id", profile.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? [])[0] ?? null) as PprTaskSummaryRow | null;
}

export async function listPprTaskAssigneeCandidatesForProfile(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">,
  taskId: string
) {
  const task = await getPprTaskByIdForProfile(supabase, profile, taskId);
  if (!task) {
    return [];
  }

  const accessibleObjectIds =
    profile.role === "lead" || profile.role === "object_engineer"
      ? (await listPprManageableObjectsForProfile(supabase, profile)).map((item) => item.id)
      : [];
  const canAssign = canAssignExecutorToPprTask(
    { id: profile.id, role: profile.role, accessibleObjectIds },
    { object_id: task.object_id, responsible_user_id: task.responsible_user_id }
  );
  if (!canAssign) {
    return [];
  }

  const { data: links, error: linksError } = await supabase
    .from("user_objects")
    .select("user_id")
    .eq("object_id", task.object_id);
  if (linksError) throw linksError;

  const candidateIds = [...new Set((links ?? []).map((row) => row.user_id))];
  if (!candidateIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,role")
    .in("id", candidateIds)
    .in("role", ["engineer", "object_engineer", "tech"])
    .order("full_name", { ascending: true });
  if (error) throw error;

  return (data ?? []) as PprTaskAssigneeCandidateRow[];
}

export async function getActivePprTaskByAggregation(
  supabase: SupabaseClient,
  options: { equipmentId: string; plannedFor: string }
) {
  const { data, error } = await supabase
    .from("ppr_tasks")
    .select(
      "id,object_id,system_id,equipment_id,responsible_user_id,assignee_id,planned_for,completed_at,closed_at,cancelled_at,cancelled_by,status,is_overdue,is_rescheduled,general_comment,cancel_reason,created_at"
    )
    .eq("equipment_id", options.equipmentId)
    .eq("planned_for", options.plannedFor)
    .in("status", ["new", "in_progress", "done"])
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as
    | {
        id: string;
        object_id: string;
        system_id: string;
        equipment_id: string;
        responsible_user_id: string;
        assignee_id: string | null;
        planned_for: string;
        completed_at: string | null;
        closed_at: string | null;
        cancelled_at: string | null;
        cancelled_by: string | null;
        status: "new" | "in_progress" | "done";
        is_overdue: boolean;
        is_rescheduled: boolean;
        general_comment: string | null;
        cancel_reason: string | null;
        created_at: string;
      }
    | null;
}
