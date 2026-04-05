import type { Role } from "@/lib/types";
import type { PprActor, PprTask } from "@/lib/ppr/types";

type PprCalendarOptions = {
  objectId: string;
  isResponsibleForSystem?: boolean;
};

function isChiefOrAdmin(role: Role) {
  return role === "admin" || role === "chief";
}

function hasObjectAccess(actor: PprActor, objectId: string) {
  if (isChiefOrAdmin(actor.role)) return true;
  return (actor.accessibleObjectIds ?? []).includes(objectId);
}

export function canAccessPprModule(role: Role) {
  return ["admin", "chief", "lead", "engineer", "object_engineer", "tech"].includes(role);
}

export function canBeResponsibleForSystem(role: Role) {
  return role === "lead" || role === "engineer" || role === "object_engineer";
}

export function canReadPprObjectScope(actor: PprActor, objectId: string) {
  if (actor.role === "tech") return false;
  return hasObjectAccess(actor, objectId);
}

export function canManagePprStructure(actor: PprActor, objectId: string) {
  if (isChiefOrAdmin(actor.role)) return true;
  if (!hasObjectAccess(actor, objectId)) return false;
  return actor.role === "lead" || actor.role === "engineer" || actor.role === "object_engineer";
}

export function canManagePprTemplates(actor: PprActor, objectId: string) {
  if (isChiefOrAdmin(actor.role)) return true;
  if (!hasObjectAccess(actor, objectId)) return false;
  return actor.role === "lead" || actor.role === "engineer" || actor.role === "object_engineer";
}

export function canManagePprCalendar(actor: PprActor, options: PprCalendarOptions) {
  if (isChiefOrAdmin(actor.role)) return true;
  if (!hasObjectAccess(actor, options.objectId)) return false;
  if (actor.role === "lead" || actor.role === "engineer" || actor.role === "object_engineer") return true;
  return false;
}

export function isActivePprTaskStatus(status: string) {
  return status === "new" || status === "in_progress" || status === "done";
}

export function canReadPprTask(actor: PprActor, task: Pick<PprTask, "object_id" | "responsible_user_id" | "assignee_id">) {
  if (isChiefOrAdmin(actor.role)) return true;
  if (actor.role === "lead" || actor.role === "engineer" || actor.role === "object_engineer") {
    return hasObjectAccess(actor, task.object_id);
  }
  if (actor.role === "tech") {
    return task.assignee_id === actor.id;
  }
  return false;
}

export function canAssignExecutorToPprTask(actor: PprActor, task: Pick<PprTask, "object_id" | "responsible_user_id">) {
  if (isChiefOrAdmin(actor.role)) return true;
  if (actor.role === "lead" || actor.role === "engineer" || actor.role === "object_engineer") {
    return hasObjectAccess(actor, task.object_id);
  }
  return false;
}

export function canCancelPprTask(actor: PprActor, task: Pick<PprTask, "object_id" | "responsible_user_id">) {
  return canClosePprTask(actor, task);
}

export function canReschedulePprTask(actor: PprActor, task: Pick<PprTask, "object_id" | "responsible_user_id">) {
  return canClosePprTask(actor, task);
}

export function canClosePprTask(actor: PprActor, task: Pick<PprTask, "object_id" | "responsible_user_id">) {
  if (isChiefOrAdmin(actor.role)) return true;
  if (actor.role === "lead" || actor.role === "engineer" || actor.role === "object_engineer") {
    return hasObjectAccess(actor, task.object_id);
  }
  return false;
}

export function canExecutePprTask(actor: PprActor, task: Pick<PprTask, "object_id" | "responsible_user_id" | "assignee_id">) {
  if (isChiefOrAdmin(actor.role)) return true;
  if (actor.role === "lead" || actor.role === "object_engineer") {
    return hasObjectAccess(actor, task.object_id) && task.assignee_id === actor.id;
  }
  if (actor.role === "engineer") {
    return task.responsible_user_id === actor.id || task.assignee_id === actor.id;
  }
  if (actor.role === "tech") {
    return task.assignee_id === actor.id;
  }
  return false;
}

export function canAssignAsPprTaskExecutor(role: Role) {
  return role === "engineer" || role === "object_engineer" || role === "tech";
}

export function canTransitionPprTaskStatus(currentStatus: PprTask["status"], nextStatus: PprTask["status"]) {
  if (currentStatus === "new") return nextStatus === "in_progress";
  if (currentStatus === "in_progress") return nextStatus === "done";
  if (currentStatus === "done") return nextStatus === "closed";
  return false;
}
