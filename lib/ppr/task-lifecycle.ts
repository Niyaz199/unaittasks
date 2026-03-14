import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/lib/types";
import {
  canAssignExecutorToPprTask,
  canAssignAsPprTaskExecutor,
  canCancelPprTask,
  canClosePprTask,
  canExecutePprTask,
  isActivePprTaskStatus,
  canReschedulePprTask,
  canTransitionPprTaskStatus,
} from "@/lib/ppr/permissions";
import type { PprActor, PprTask } from "@/lib/ppr/types";
import type { PprTaskSummaryRow } from "@/lib/ppr/queries";

type TaskRow = Pick<
  PprTask,
  | "id"
  | "object_id"
  | "responsible_user_id"
  | "assignee_id"
  | "status"
  | "planned_for"
  | "completed_at"
  | "closed_at"
  | "cancelled_at"
  | "cancelled_by"
  | "cancel_reason"
  | "is_overdue"
  | "is_rescheduled"
>;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function listPprActorAccessibleObjectIds(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
) {
  if (profile.role !== "lead" && profile.role !== "object_engineer") {
    return [];
  }

  const { data, error } = await supabase
    .from("user_objects")
    .select("object_id")
    .eq("user_id", profile.id);
  if (error) throw error;
  return (data ?? []).map((item) => item.object_id);
}

export async function buildPprTaskActor(
  supabase: SupabaseClient,
  profile: Pick<Profile, "id" | "role">
): Promise<PprActor> {
  const accessibleObjectIds = await listPprActorAccessibleObjectIds(supabase, profile);
  return {
    id: profile.id,
    role: profile.role,
    accessibleObjectIds,
  };
}

export async function getPprTaskLifecycleRow(supabase: SupabaseClient, taskId: string) {
  const { data, error } = await supabase
    .from("ppr_tasks")
    .select(
      "id,object_id,responsible_user_id,assignee_id,status,planned_for,completed_at,closed_at,cancelled_at,cancelled_by,cancel_reason,is_overdue,is_rescheduled"
    )
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as TaskRow | null;
}

export async function assertPprTaskAssigneeCandidate(
  supabase: SupabaseClient,
  assigneeId: string,
  objectId: string
) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,role")
    .eq("id", assigneeId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || !canAssignAsPprTaskExecutor(profile.role)) {
    throw new Error("Выбранный исполнитель недопустим для ППР-заявки");
  }

  const { count, error: accessError } = await supabase
    .from("user_objects")
    .select("object_id", { count: "exact", head: true })
    .eq("user_id", assigneeId)
    .eq("object_id", objectId);
  if (accessError) throw accessError;
  if ((count ?? 0) === 0) {
    throw new Error("Исполнитель должен иметь доступ к объекту ППР-заявки");
  }

  return profile as { id: string; full_name: string; role: Profile["role"] };
}

export function canAssignPprTaskExecutor(actor: PprActor, task: Pick<PprTask, "object_id" | "responsible_user_id" | "status">) {
  if (task.status === "closed" || task.status === "cancelled") return false;
  if (task.status === "done") return false;
  return canAssignExecutorToPprTask(actor, task);
}

export function canStartPprTask(actor: PprActor, task: Pick<PprTask, "object_id" | "responsible_user_id" | "assignee_id" | "status">) {
  return (
    task.status === "new" &&
    task.assignee_id === actor.id &&
    canExecutePprTask(actor, task) &&
    canTransitionPprTaskStatus(task.status, "in_progress")
  );
}

export function canCompletePprTask(actor: PprActor, task: Pick<PprTask, "object_id" | "responsible_user_id" | "assignee_id" | "status">) {
  return (
    task.status === "in_progress" &&
    task.assignee_id === actor.id &&
    canExecutePprTask(actor, task) &&
    canTransitionPprTaskStatus(task.status, "done")
  );
}

export function canClosePprTaskLifecycle(actor: PprActor, task: Pick<PprTask, "object_id" | "responsible_user_id" | "status">) {
  return task.status === "done" && canClosePprTask(actor, task);
}

export function canCancelPprTaskLifecycle(actor: PprActor, task: Pick<PprTask, "object_id" | "responsible_user_id" | "status">) {
  if (task.status === "closed" || task.status === "cancelled") return false;
  return canCancelPprTask(actor, task);
}

export function canReschedulePprTaskLifecycle(actor: PprActor, task: Pick<PprTask, "object_id" | "responsible_user_id" | "status">) {
  if (task.status !== "new" && task.status !== "in_progress") return false;
  return canReschedulePprTask(actor, task);
}

export function canAddPprTaskComment(actor: PprActor, task: Pick<PprTask, "object_id" | "responsible_user_id" | "assignee_id" | "status">) {
  return isActivePprTaskStatus(task.status) && canExecutePprTask(actor, task);
}

export function canUploadPprTaskAttachment(
  actor: PprActor,
  task: Pick<PprTask, "object_id" | "responsible_user_id" | "assignee_id" | "status">
) {
  return canAddPprTaskComment(actor, task);
}

export async function syncPprTaskPlanItemsStatus(
  supabase: SupabaseClient,
  taskId: string,
  status: "closed" | "cancelled"
) {
  const { error } = await supabase
    .from("ppr_month_plan_items")
    .update({ status })
    .eq("task_id", taskId);
  if (error) throw error;
}

export async function syncPprTaskPlanItemsPlannedFor(
  supabase: SupabaseClient,
  task: Pick<PprTaskSummaryRow, "id" | "planned_for">,
  nextPlannedFor: string
) {
  const today = todayIso();
  const isOverdue = task.planned_for < today || nextPlannedFor < today;

  const { error } = await supabase
    .from("ppr_month_plan_items")
    .update({
      planned_for: nextPlannedFor,
      is_overdue: isOverdue,
    })
    .eq("task_id", task.id);
  if (error) throw error;
}

export function calculatePprTaskOverdueAfterReschedule(currentPlannedFor: string, nextPlannedFor: string) {
  const today = todayIso();
  return currentPlannedFor < today || nextPlannedFor < today;
}
