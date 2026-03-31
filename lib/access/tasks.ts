import type { Role } from "@/lib/types";
import { canAssignTaskToRole, canCreateTasks, canDeleteTasks, canManageTaskTeam as canManageTaskTeamByRole } from "@/lib/access/matrix";

type TaskAccess = {
  id: string;
  object_id: string;
  created_by: string;
  assigned_to: string;
};

type TaskArchiveAccess = {
  status: string;
  archived_at: string | null;
};

export function canAssignRole(actorRole: Role, targetRole: Role) {
  return canAssignTaskToRole(actorRole, targetRole);
}

export function canCreateOrAssignTask(
  actorRole: Role,
  targetRole: Role,
  options: { objectEngineerScoped: boolean }
) {
  if (!canCreateTasks(actorRole)) return false;
  if (actorRole === "object_engineer" && !options.objectEngineerScoped) return false;
  return canAssignRole(actorRole, targetRole);
}

export function canManageTaskTeam(role: Role, options: { objectEngineerScoped: boolean }) {
  if (!canManageTaskTeamByRole(role)) return false;
  if (role !== "object_engineer") return true;
  return options.objectEngineerScoped;
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
  if (role === "admin" || role === "chief") {
    return true;
  }

  if (role === "lead" || role === "engineer") {
    return task.created_by === userId || task.assigned_to === userId || teamMemberIds.includes(userId);
  }

  if (role === "object_engineer") {
    return (
      objectEngineerId === userId ||
      task.created_by === userId ||
      task.assigned_to === userId ||
      teamMemberIds.includes(userId)
    );
  }

  if (role === "tech") {
    return task.assigned_to === userId || teamMemberIds.includes(userId);
  }

  return false;
}

export function canWorkOnTaskByRole(
  role: Role,
  userId: string,
  task: TaskAccess,
  teamMemberIds: string[],
  objectEngineerId: string | null
) {
  return canReadTaskByRole(role, userId, task, teamMemberIds, objectEngineerId);
}

export function canViewTaskHistoryByRole(
  role: Role,
  userId: string,
  task: TaskAccess,
  teamMemberIds: string[],
  objectEngineerId: string | null
) {
  return canReadTaskByRole(role, userId, task, teamMemberIds, objectEngineerId);
}

export function canDeleteTaskByRole(
  role: Role,
  userId: string,
  task: TaskAccess,
  teamMemberIds: string[],
  objectEngineerId: string | null
) {
  if (!canDeleteTasks(role)) {
    return false;
  }

  if (role === "admin" || role === "chief") {
    return true;
  }

  return canReadTaskByRole(role, userId, task, teamMemberIds, objectEngineerId);
}

export function canChangeTaskStatus(
  role: Role,
  task: TaskAccess,
  userId: string,
  teamMemberIds: string[],
  objectEngineerId: string | null
) {
  return canWorkOnTaskByRole(role, userId, task, teamMemberIds, objectEngineerId);
}

export function canArchiveTask(role: Role, task: TaskArchiveAccess) {
  if (role !== "admin" && role !== "chief") return false;
  if (task.status !== "done") return false;
  return task.archived_at === null;
}
