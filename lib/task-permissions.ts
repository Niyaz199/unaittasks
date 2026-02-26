import type { Role } from "@/lib/types";

type TaskAccess = {
  id: string;
  object_id: string;
  created_by: string;
  assigned_to: string;
};

export function canAssignRole(assignerRole: Role, targetRole: Role) {
  if (assignerRole === "admin") return true;
  if (assignerRole === "chief") return ["lead", "engineer", "object_engineer", "tech"].includes(targetRole);
  if (assignerRole === "lead") return ["engineer", "object_engineer", "tech"].includes(targetRole);
  if (assignerRole === "engineer") return ["engineer", "object_engineer", "tech"].includes(targetRole);
  if (assignerRole === "object_engineer") return ["lead", "engineer", "object_engineer", "tech"].includes(targetRole);
  return false;
}

export function canCreateOrAssignTask(
  actorRole: Role,
  targetRole: Role,
  options: { objectEngineerScoped: boolean }
) {
  if (actorRole === "admin") return true;
  if (actorRole === "tech") return false;
  if (actorRole === "object_engineer" && !options.objectEngineerScoped) return false;
  return canAssignRole(actorRole, targetRole);
}

export function canManageTaskTeam(role: Role, options: { objectEngineerScoped: boolean }) {
  if (role === "admin") return true;
  if (["chief", "lead", "engineer"].includes(role)) return true;
  if (role === "object_engineer") return options.objectEngineerScoped;
  return false;
}

export function isTaskParticipant(task: TaskAccess, userId: string, teamMemberIds: string[]) {
  return task.assigned_to === userId || teamMemberIds.includes(userId);
}

export function canReadTaskByRole(
  role: Role,
  userId: string,
  task: TaskAccess,
  teamMemberIds: string[],
  objectEngineerId: string | null
) {
  if (role === "admin") return true;
  if (role === "chief") return true;
  if (role === "lead" || role === "engineer") {
    return task.created_by === userId || task.assigned_to === userId || teamMemberIds.includes(userId);
  }
  if (role === "object_engineer") {
    return objectEngineerId === userId;
  }
  if (role === "tech") {
    return task.assigned_to === userId || teamMemberIds.includes(userId);
  }
  return false;
}

export function canChangeTaskStatus(role: Role, task: TaskAccess, userId: string, teamMemberIds: string[]) {
  if (role === "admin") return true;
  return isTaskParticipant(task, userId, teamMemberIds);
}

export function canChangeStatus(
  task: TaskAccess,
  currentUser: { id: string; role: Role },
  options?: { teamMemberIds?: string[] }
) {
  return canChangeTaskStatus(currentUser.role, task, currentUser.id, options?.teamMemberIds ?? []);
}
