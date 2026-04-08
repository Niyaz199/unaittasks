import type { Role, TaskStatus } from "@/lib/types";
import {
  canArchiveTask,
  canAddTaskTeamMember,
  canAssignRole,
  canChangeTaskStatus,
  canCreateOrAssignTask,
  canManageTaskTeam,
  canReadTaskByRole,
  canViewTaskHistoryByRole,
  canWorkOnTaskByRole,
} from "@/lib/access/tasks";

type TaskAccess = {
  id: string;
  object_id: string;
  created_by: string;
  assigned_to: string;
  objects?: { object_engineer_id?: string | null } | Array<{ object_engineer_id?: string | null }> | null;
};

const taskStatusTransitions: Record<TaskStatus, TaskStatus[]> = {
  new: ["accepted"],
  accepted: ["in_progress", "done"],
  in_progress: ["paused", "done"],
  paused: ["in_progress"],
  done: [],
};

function getObjectEngineerId(task: TaskAccess) {
  if (Array.isArray(task.objects)) return task.objects[0]?.object_engineer_id ?? null;
  return task.objects?.object_engineer_id ?? null;
}

export {
  canArchiveTask,
  canAddTaskTeamMember,
  canAssignRole,
  canCreateOrAssignTask,
  canManageTaskTeam,
  canReadTaskByRole,
  canViewTaskHistoryByRole,
  canWorkOnTaskByRole,
};

export function getAllowedTaskTransitions(status: TaskStatus) {
  return taskStatusTransitions[status];
}

export function canTransitionTaskStatus(currentStatus: TaskStatus, nextStatus: TaskStatus) {
  return taskStatusTransitions[currentStatus].includes(nextStatus);
}

export function canChangeStatus(
  task: TaskAccess,
  currentUser: { id: string; role: Role },
  options?: { teamMemberIds?: string[] }
) {
  return canChangeTaskStatus(
    currentUser.role,
    task,
    currentUser.id,
    options?.teamMemberIds ?? [],
    getObjectEngineerId(task)
  );
}
